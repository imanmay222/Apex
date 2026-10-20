import { notFound } from "@/server/lib/errors";
import { api } from "@/server/lib/http";
import { openMedia } from "@/server/services/media";

/**
 * Streams an uploaded file from GridFS. Ids are unique per upload and never reused, so responses are
 * immutable and cache forever. Not rate-limited: it is cache-friendly and a write per image
 * request would be pure overhead.
 */
export const GET = api<{ id: string }>({ name: "media.get", rateLimit: false }, async ({ req, params }) => {
  const file = await openMedia(params.id);
  if (!file) throw notFound("File");

  const headers = {
    ETag: file.etag,
    "Last-Modified": file.lastModified.toUTCString(),
    "Cache-Control": "public, max-age=31536000, immutable",
    // Uploaded content is treated as inert: no scripts, no framing, no sniffing.
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "X-Content-Type-Options": "nosniff",
  };

  if (req.headers.get("if-none-match") === file.etag) {
    await file.stream.cancel();
    return new Response(null, { status: 304, headers });
  }

  return new Response(file.stream, {
    headers: {
      ...headers,
      "Content-Type": file.contentType,
      "Content-Length": String(file.length),
      "Content-Disposition": `inline; filename="${file.filename.replace(/[^\w.-]/g, "_")}"`,
    },
  });
});
