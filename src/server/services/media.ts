import { Readable } from "node:stream";
import mongoose from "mongoose";
import { env } from "../config/env";
import { connectDb, getMediaBucket } from "../db/connect";
import {
  GalleryModel,
  LeaderModel,
  LogoModel,
  ProductModel,
  SiteSettingsModel,
  SurveyModel,
} from "../db/models";
import { sha256 } from "../lib/crypto";
import { conflict, notFound, payloadTooLarge, unsupportedMedia } from "../lib/errors";
import { slugify } from "../lib/text";
import { audit, type Actor } from "./audit";

const ObjectId = mongoose.mongo.ObjectId;
type ObjectId = InstanceType<typeof ObjectId>;

/*
 * Uploaded files live in MongoDB GridFS (bucket "media"), so the database is the single store
 * for data. Seed images that ship with the app stay as static files under /public.
 */

const PDF_LIMIT = 25 * 1024 * 1024;

interface Detected {
  contentType: string;
  extension: string;
}

/** Identifies a file from its leading bytes. The client-supplied MIME type is never trusted. */
export function detectFileType(bytes: Buffer): Detected | null {
  const startsWith = (...sig: number[]) => sig.every((byte, i) => bytes[i] === byte);
  const ascii = (from: number, to: number) => bytes.subarray(from, to).toString("latin1");

  if (startsWith(0xff, 0xd8, 0xff)) return { contentType: "image/jpeg", extension: "jpg" };
  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return { contentType: "image/png", extension: "png" };
  if (ascii(0, 6) === "GIF87a" || ascii(0, 6) === "GIF89a") return { contentType: "image/gif", extension: "gif" };
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return { contentType: "image/webp", extension: "webp" };
  if (ascii(4, 8) === "ftyp" && ["avif", "avis"].includes(ascii(8, 12))) return { contentType: "image/avif", extension: "avif" };
  if (ascii(0, 5) === "%PDF-") return { contentType: "application/pdf", extension: "pdf" };
  return null; // notably: SVG and HTML are rejected (script-bearing formats)
}

export interface MediaDTO {
  id: string;
  url: string;
  filename: string;
  contentType: string;
  size: number;
  alt: string;
  sha256: string;
  uploadedAt: string;
  uploadedBy: string | null;
}

interface FileDoc {
  _id: ObjectId;
  filename: string;
  length: number;
  uploadDate: Date;
  metadata?: { contentType?: string; alt?: string; sha256?: string; uploadedBy?: string };
}

const toMedia = (doc: FileDoc): MediaDTO => ({
  id: String(doc._id),
  url: `/api/media/${doc._id}`,
  filename: doc.filename,
  contentType: doc.metadata?.contentType ?? "application/octet-stream",
  size: doc.length,
  alt: doc.metadata?.alt ?? "",
  sha256: doc.metadata?.sha256 ?? "",
  uploadedAt: doc.uploadDate.toISOString(),
  uploadedBy: doc.metadata?.uploadedBy ?? null,
});

async function filesCollection() {
  const db = (await connectDb()).connection.db!;
  return db.collection<FileDoc>("media.files");
}

function mediaId(id: string): ObjectId {
  if (!/^[0-9a-fA-F]{24}$/.test(id)) throw notFound("File");
  return new ObjectId(id);
}

export async function uploadMedia(file: File, alt: string, actor: Actor, ipHash?: string): Promise<{ media: MediaDTO; duplicate: boolean }> {
  if (file.size === 0) throw unsupportedMedia("The uploaded file is empty.");
  if (file.size > Math.max(env().uploadMaxBytes, PDF_LIMIT)) throw payloadTooLarge("File is too large.");

  const bytes = Buffer.from(await file.arrayBuffer());
  const detected = detectFileType(bytes);
  if (!detected) throw unsupportedMedia("Unsupported file type. Allowed: JPEG, PNG, WebP, AVIF, GIF, PDF.");

  const limit = detected.contentType === "application/pdf" ? PDF_LIMIT : env().uploadMaxBytes;
  if (bytes.length > limit) throw payloadTooLarge(`Files of this type may be at most ${Math.floor(limit / 1024 / 1024)} MB.`);

  const files = await filesCollection();
  const hash = sha256(bytes);

  // Identical bytes are stored once.
  const existing = await files.findOne({ "metadata.sha256": hash });
  if (existing) return { media: toMedia(existing), duplicate: true };

  const stem = slugify(file.name.replace(/\.[^.]+$/, "")) || "file";
  const filename = `${stem}.${detected.extension}`;

  const bucket = await getMediaBucket();
  const stream = bucket.openUploadStream(filename, {
    metadata: { contentType: detected.contentType, alt: alt.slice(0, 200), sha256: hash, uploadedBy: actor.email },
  });

  await new Promise<void>((resolve, reject) => {
    stream.once("finish", () => resolve());
    stream.once("error", reject);
    stream.end(bytes);
  });

  const stored = await files.findOne({ _id: stream.id });
  await audit({ actor, action: "upload", resource: "media", resourceId: String(stream.id), summary: filename, ipHash });
  return { media: toMedia(stored!), duplicate: false };
}

export async function listMedia(opts: { page: number; limit: number; skip: number; q?: string; kind?: "image" | "pdf" }) {
  const files = await filesCollection();

  const filter: Record<string, unknown> = {};
  if (opts.q) filter.filename = { $regex: opts.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
  if (opts.kind === "pdf") filter["metadata.contentType"] = "application/pdf";
  if (opts.kind === "image") filter["metadata.contentType"] = { $regex: "^image/" };

  const [docs, total] = await Promise.all([
    files.find(filter).sort({ uploadDate: -1 }).skip(opts.skip).limit(opts.limit).toArray(),
    files.countDocuments(filter),
  ]);
  return { items: docs.map(toMedia), total };
}

export async function updateMedia(id: string, patch: { alt?: string }, actor: Actor, ipHash?: string) {
  const files = await filesCollection();
  const _id = mediaId(id);
  const result = await files.findOneAndUpdate(
    { _id },
    { $set: { ...(patch.alt !== undefined ? { "metadata.alt": patch.alt } : {}) } },
    { returnDocument: "after" },
  );
  if (!result) throw notFound("File");
  await audit({ actor, action: "update", resource: "media", resourceId: id, fields: Object.keys(patch), ipHash });
  return toMedia(result);
}

/** Content that currently references a media URL, so we don't orphan an image still in use. */
export async function findMediaUsage(id: string): Promise<{ resource: string; label: string }[]> {
  await connectDb();
  const url = `/api/media/${id}`;
  const usage: { resource: string; label: string }[] = [];

  const [products, surveys, gallery, logos, leaders, settings] = await Promise.all([
    ProductModel.find({ $or: [{ "image.src": url }, { "gallery.src": url }] }).select("title").lean(),
    SurveyModel.find({ "image.src": url }).select("title").lean(),
    GalleryModel.find({ src: url }).select("alt").lean(),
    LogoModel.find({ src: url }).select("name").lean(),
    LeaderModel.find({ image: url }).select("name").lean(),
    SiteSettingsModel.findOne({ "catalogue.url": url }).select("companyName").lean(),
  ]);

  products.forEach((d) => usage.push({ resource: "products", label: d.title }));
  surveys.forEach((d) => usage.push({ resource: "surveys", label: d.title }));
  gallery.forEach((d) => usage.push({ resource: "gallery", label: d.alt || "Gallery image" }));
  logos.forEach((d) => usage.push({ resource: "logos", label: d.name }));
  leaders.forEach((d) => usage.push({ resource: "leaders", label: d.name }));
  if (settings) usage.push({ resource: "settings", label: "Catalogue download" });
  return usage;
}

export async function deleteMedia(id: string, force: boolean, actor: Actor, ipHash?: string) {
  const files = await filesCollection();
  const _id = mediaId(id);
  const existing = await files.findOne({ _id });
  if (!existing) throw notFound("File");

  if (!force) {
    const usage = await findMediaUsage(id);
    if (usage.length > 0) throw conflict("This file is still used by published content.", { usage });
  }

  const bucket = await getMediaBucket();
  await bucket.delete(_id);
  await audit({ actor, action: "delete", resource: "media", resourceId: id, summary: existing.filename, ipHash });
}

export interface MediaStream {
  stream: ReadableStream<Uint8Array>;
  contentType: string;
  length: number;
  etag: string;
  filename: string;
  lastModified: Date;
}

/** Opens a stored file for download. Returns null when it doesn't exist. */
export async function openMedia(id: string): Promise<MediaStream | null> {
  if (!/^[0-9a-fA-F]{24}$/.test(id)) return null;
  const files = await filesCollection();
  const _id = new ObjectId(id);
  const doc = await files.findOne({ _id });
  if (!doc) return null;

  const bucket = await getMediaBucket();
  return {
    stream: Readable.toWeb(bucket.openDownloadStream(_id)) as ReadableStream<Uint8Array>,
    contentType: doc.metadata?.contentType ?? "application/octet-stream",
    length: doc.length,
    etag: `"${doc.metadata?.sha256 ?? String(doc._id)}"`,
    filename: doc.filename,
    lastModified: doc.uploadDate,
  };
}
