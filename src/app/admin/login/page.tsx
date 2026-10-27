import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/login-form";
import { currentAdmin, safeNext } from "@/server/auth/current";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const raw = (await searchParams).next;
  const next = safeNext(Array.isArray(raw) ? raw[0] : raw);
  if (await currentAdmin()) redirect(next);

  return (
    <main className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-brand-950 px-4 py-12">
      <div aria-hidden className="absolute -top-40 -right-32 -z-10 size-[28rem] rounded-full bg-safety-500/20 blur-3xl" />
      <div aria-hidden className="absolute -bottom-40 -left-32 -z-10 size-[28rem] rounded-full bg-brand-500/20 blur-3xl" />
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image src="/media/navbrand.png" alt="Apex Care Technologies" width={190} height={48} priority className="h-10 w-auto brightness-0 invert" />
          <p className="mt-4 text-sm text-white/60">Admin panel</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface-raised p-6 shadow-2xl sm:p-8">
          <h1 className="font-display text-xl font-semibold text-foreground">Sign in</h1>
          <p className="mt-1 text-sm text-muted">Use your team account to manage the website and enquiries.</p>
          <LoginForm next={next} />
        </div>
        <p className="mt-6 text-center text-sm text-white/50">
          <Link href="/" className="hover:text-white">
            ← Back to the website
          </Link>
        </p>
      </div>
    </main>
  );
}
