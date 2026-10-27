"use client";

/* eslint-disable @typescript-eslint/no-explicit-any -- items are heterogeneous content records */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowLeft } from "../icons";
import { cx } from "../ui";
import { AdminApiError, adminApi, errorMessage, useAdminQuery } from "./api";
import { buildPayload, missingRequired, resourceConfig, toFormValues, type FieldDef, type ResourceConfig } from "./content-config";
import { AssetInput, GalleryList, IconSelect, ImageInput, PairList, StringList } from "./fields";
import { formatDate } from "./format";
import { ExternalLink, Trash } from "./icons";
import { Badge, Button, Card, ConfirmButton, ErrorNotice, Field, Loading, PageHeader, Toggle, btn, inputClass, useToast } from "./ui";

export function ContentEditor({ resource, id }: { resource: string; id?: string }) {
  const config = resourceConfig(resource)!;
  const { data: item, error, loading, reload } = useAdminQuery<any>(id ? `/api/admin/content/${resource}/${id}` : null);

  const back = (
    <Link href={`/admin/content/${resource}`} className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
      <ArrowLeft className="size-4" /> {config.label}
    </Link>
  );

  if (id && error) {
    return (
      <>
        <PageHeader back={back} title={`Edit ${config.singular}`} />
        <ErrorNotice error={error.status === 404 ? `This ${config.singular} doesn't exist or was deleted.` : error} onRetry={error.status === 404 ? undefined : reload} />
      </>
    );
  }
  if (id && (loading || !item)) return <Loading />;

  return <EditorForm key={item?.id ?? "new"} config={config} item={id ? item : null} back={back} />;
}

function EditorForm({ config, item, back }: { config: ResourceConfig; item: any | null; back: React.ReactNode }) {
  const router = useRouter();
  const toast = useToast();
  const [original, setOriginal] = useState(() => (item ? toFormValues(config, item) : null));
  const [values, setValues] = useState(() => toFormValues(config, item));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const groups = useAdminQuery<{ key: string; title: string }[]>(config.fields.some((f) => f.kind === "group") ? "/api/admin/content/product-groups?limit=100&sort=order" : null);

  const set = (name: string, value: any) => {
    setValues((v) => ({ ...v, [name]: value }));
    setErrors((e) => (e[name] ? { ...e, [name]: "" } : e));
  };

  const dirty = original ? Object.keys(buildPayload(config, values, original)).length > 0 : true;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const missing = missingRequired(config, values);
    if (Object.keys(missing).length) {
      setErrors(missing);
      setFormError("Please fill in the required fields.");
      return;
    }

    const payload = buildPayload(config, values, original);
    if (item && Object.keys(payload).length === 0) {
      toast("No changes to save.");
      return;
    }

    setSaving(true);
    setFormError(null);
    setErrors({});
    try {
      if (item) {
        const updated = await adminApi.patch<any>(`/api/admin/content/${config.key}/${item.id}`, payload);
        const fresh = toFormValues(config, updated);
        setOriginal(fresh);
        setValues(fresh);
        toast("Saved — the website is updated.");
      } else {
        const created = await adminApi.post<any>(`/api/admin/content/${config.key}`, payload);
        toast(`Created ${config.singular}.`);
        router.replace(`/admin/content/${config.key}/${created.id}`);
      }
    } catch (err) {
      if (err instanceof AdminApiError && err.issues.length) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of err.issues) fieldErrors[issue.path.split(".")[0] || "_"] ??= issue.message;
        setErrors(fieldErrors);
        setFormError("Some fields need attention.");
      } else {
        setFormError(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    try {
      await adminApi.del(`/api/admin/content/${config.key}/${item.id}`);
      toast(`Deleted ${config.singular}.`);
      router.push(`/admin/content/${config.key}`);
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  const main = config.fields.filter((f) => !["published", "featured", "order"].includes(f.name));
  const side = config.fields.filter((f) => ["published", "featured", "order"].includes(f.name));
  const publicUrl = item && config.publicUrl ? config.publicUrl(item) : null;

  return (
    <form onSubmit={onSubmit} noValidate>
      <PageHeader
        back={back}
        title={item ? config.title(item) || `Edit ${config.singular}` : `New ${config.singular}`}
        description={item?.updatedAt ? `Last edited ${formatDate(item.updatedAt)}` : item ? undefined : config.description}
        actions={
          <>
            {publicUrl && item?.published ? (
              <a href={publicUrl} target="_blank" rel="noopener noreferrer" className={btn("secondary")}>
                <ExternalLink className="size-4" /> View on website
              </a>
            ) : null}
            <Button type="submit" variant="primary" busy={saving} disabled={!dirty}>
              {item ? "Save changes" : `Create ${config.singular}`}
            </Button>
          </>
        }
      />

      {formError ? (
        <div className="mb-4">
          <ErrorNotice error={errors._ ? `${formError} ${errors._}` : formError} />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Card>
          <div className="grid gap-5 sm:grid-cols-2">
            {main.map((field) => (
              <FieldEditor key={field.name} field={field} value={values[field.name]} error={errors[field.name]} onChange={(v) => set(field.name, v)} groups={groups.data ?? []} />
            ))}
          </div>
        </Card>
        <div className="space-y-6">
          <Card title="Visibility">
            <div className="space-y-4">
              {side.map((field) => (
                <FieldEditor key={field.name} field={field} value={values[field.name]} error={errors[field.name]} onChange={(v) => set(field.name, v)} groups={[]} />
              ))}
            </div>
          </Card>
          {item?.source === "public" ? (
            <Card title="Submitted on the website">
              <p className="text-sm text-muted">
                {formatDate(item.createdAt)}
                {item.submitterEmail ? (
                  <>
                    <br />
                    Contact (private):{" "}
                    <a href={`mailto:${item.submitterEmail}`} className="text-foreground hover:underline">
                      {item.submitterEmail}
                    </a>
                  </>
                ) : null}
              </p>
              {!item.published ? (
                <Badge tone="orange" className="mt-3">
                  Awaiting review — switch on “Published” and save to approve
                </Badge>
              ) : null}
            </Card>
          ) : null}
          {item ? (
            <Card title="Delete">
              <p className="mb-3 text-sm text-muted">Removes it from the website for good. To take it down temporarily, switch off “Published”.</p>
              <ConfirmButton onConfirm={remove}>
                <Trash className="size-3.5" /> Delete {config.singular}
              </ConfirmButton>
            </Card>
          ) : null}
        </div>
      </div>
    </form>
  );
}

function FieldEditor({ field, value, error, onChange, groups }: { field: FieldDef; value: any; error?: string; onChange: (value: any) => void; groups: { key: string; title: string }[] }) {
  const id = `field-${field.name}`;
  const wide = field.wide || ["textarea", "image", "gallery", "list", "pairs", "seo"].includes(field.kind);
  const common = { label: field.label, htmlFor: id, hint: field.hint, error, required: field.required, className: cx(wide && "sm:col-span-2") };
  const invalid = error ? "border-red-500" : "";

  switch (field.kind) {
    case "text":
    case "slug":
    case "url":
      return (
        <Field {...common}>
          <input
            id={id}
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            maxLength={field.max ?? (field.kind === "slug" ? 80 : 500)}
            placeholder={field.placeholder ?? (field.kind === "slug" ? "auto-generated" : undefined)}
            className={cx(inputClass, invalid, field.kind === "slug" && "font-mono text-[0.8rem]")}
            type={field.kind === "url" ? "url" : "text"}
          />
        </Field>
      );
    case "textarea":
      return (
        <Field {...common} hint={field.max ? `${String(value ?? "").length} / ${field.max} characters${field.hint ? ` · ${field.hint}` : ""}` : field.hint}>
          <textarea id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value)} rows={field.rows ?? 4} maxLength={field.max} className={cx(inputClass, invalid, "resize-y")} />
        </Field>
      );
    case "number":
      return (
        <Field {...common}>
          <input id={id} type="number" min={0} step={10} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={cx(inputClass, invalid)} />
        </Field>
      );
    case "boolean":
      return (
        <div>
          <Toggle checked={Boolean(value)} onChange={onChange} label={field.label} />
          {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
        </div>
      );
    case "rating":
      return (
        <Field {...common}>
          <div className="flex gap-1" role="radiogroup" aria-label={field.label}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={value === n}
                aria-label={`${n} out of 5`}
                onClick={() => onChange(n)}
                className={cx("text-2xl leading-none", n <= (value ?? 0) ? "text-safety-500" : "text-border")}
              >
                ★
              </button>
            ))}
          </div>
        </Field>
      );
    case "select":
      return (
        <Field {...common}>
          <select id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={cx(inputClass, invalid)}>
            {(field.options ?? []).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      );
    case "group":
      return (
        <Field {...common}>
          <select id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={cx(inputClass, invalid)}>
            <option value="">Choose a group…</option>
            {groups.map((g) => (
              <option key={g.key} value={g.key}>
                {g.title}
              </option>
            ))}
            {value && !groups.some((g) => g.key === value) ? <option value={value}>{value}</option> : null}
          </select>
        </Field>
      );
    case "icon":
      return (
        <Field {...common}>
          <IconSelect id={id} value={value || "ShieldCheck"} onChange={onChange} />
        </Field>
      );
    case "asset":
      return (
        <Field {...common}>
          <AssetInput id={id} value={value ?? ""} onChange={onChange} />
        </Field>
      );
    case "image":
      return (
        <Field {...common}>
          <ImageInput id={id} value={value ?? { src: "", alt: "" }} onChange={onChange} />
        </Field>
      );
    case "gallery":
      return (
        <Field {...common}>
          <GalleryList items={value ?? []} onChange={onChange} />
        </Field>
      );
    case "list":
      return (
        <Field {...common}>
          <StringList items={value ?? []} onChange={onChange} placeholder={field.label.replace(/s$/, "")} max={field.max} />
        </Field>
      );
    case "pairs":
      return (
        <Field {...common}>
          <PairList items={value ?? []} onChange={onChange} labels={["Property", "Value"]} addLabel="Add row" max={field.max} />
        </Field>
      );
    case "seo":
      return (
        <Field {...common}>
          <div className="space-y-2">
            <input
              aria-label="SEO title"
              value={value?.title ?? ""}
              onChange={(e) => onChange({ ...value, title: e.target.value })}
              maxLength={70}
              placeholder="Page title in Google (optional)"
              className={inputClass}
            />
            <textarea
              aria-label="SEO description"
              value={value?.description ?? ""}
              onChange={(e) => onChange({ ...value, description: e.target.value })}
              maxLength={170}
              rows={2}
              placeholder="Description in Google results (optional)"
              className={cx(inputClass, "resize-y")}
            />
          </div>
        </Field>
      );
  }
}
