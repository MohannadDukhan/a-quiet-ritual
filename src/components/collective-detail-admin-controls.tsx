"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type CollectiveDetailAdminControlsProps = {
  entryId: string;
};

type ApiResponse = {
  error?: string;
};

async function parseApiError(response: Response): Promise<string> {
  const data = (await response.json().catch(() => null)) as ApiResponse | null;
  return data?.error || "request failed.";
}

export function CollectiveDetailAdminControls({ entryId }: CollectiveDetailAdminControlsProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!window.confirm("remove this entry from collective and delete its replies?")) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/moderation/entry/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId }),
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      router.push("/collective?removed=1");
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "request failed.";
      setError(message);
      setPending(false);
    }
  }

  return (
    <div style={{ marginTop: 10 }}>
      <button className="bw-btnDanger" type="button" onClick={() => void handleDelete()} disabled={pending}>
        {pending ? "removing..." : "admin: delete from collective"}
      </button>
      {error && <div className="bw-hint">{error}</div>}
    </div>
  );
}
