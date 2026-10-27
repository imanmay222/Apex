"use client";

import { useEffect } from "react";
import { ErrorNotice } from "@/components/admin/ui";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg py-16">
      <ErrorNotice error={`This page failed to load.${error.digest ? ` Reference: ${error.digest}.` : ""}`} onRetry={reset} />
    </div>
  );
}
