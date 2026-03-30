"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function LoginForm({ username }: { username: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [adminUsername, setAdminUsername] = useState(username);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: adminUsername,
        password,
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;

    if (!response.ok) {
      setError(payload?.error ?? "Login failed.");
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="panel flex flex-col gap-5 p-6">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
          Shared Admin Login
        </p>
        <h2 className="text-2xl font-semibold text-slate-950">
          Authenticate against the Conduit control plane.
        </h2>
      </div>

      <label className="flex flex-col gap-2 text-sm text-slate-700">
        Username
        <input
          className="input"
          value={adminUsername}
          onChange={(event) => setAdminUsername(event.target.value)}
          autoComplete="username"
        />
      </label>

      <label className="flex flex-col gap-2 text-sm text-slate-700">
        Password
        <input
          className="input"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
        />
      </label>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <button className="button-primary" disabled={isPending}>
        {isPending ? "Signing In..." : "Enter Console"}
      </button>
    </form>
  );
}
