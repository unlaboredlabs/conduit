"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type {
  EdgeNodeSummary,
  FrpsSummary,
  FrpsConnectionDetails,
  RegistrationTokenSummary,
} from "@/app/lib/contracts";

type DashboardProps = {
  adminUsername: string;
  nodes: EdgeNodeSummary[];
  frps: FrpsSummary[];
  registrationTokens: RegistrationTokenSummary[];
};

type RegistrationTokenResponse = {
  ok: true;
  registrationToken: {
    label: string;
    token: string;
    expiresAt: number;
  };
};

type FrpsCreateResponse = {
  ok: true;
  frpsId: string;
  connection: FrpsConnectionDetails;
};

const formatDate = (timestamp: number | null) => {
  if (!timestamp) {
    return "Never";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
};

const statusTone = (status: string) => {
  switch (status) {
    case "online":
    case "running":
    case "succeeded":
      return "status-pill status-pill--good";
    case "pending":
    case "leased":
    case "deleting":
      return "status-pill status-pill--warn";
    case "error":
    case "failed":
      return "status-pill status-pill--bad";
    default:
      return "status-pill";
  }
};

export function Dashboard({
  adminUsername,
  nodes,
  frps,
  registrationTokens,
}: DashboardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tokenLabel, setTokenLabel] = useState("edge-node");
  const [tokenTtlHours, setTokenTtlHours] = useState("24");
  const [frpsName, setFrpsName] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState(nodes[0]?._id ?? "");
  const [createdToken, setCreatedToken] = useState<{
    label: string;
    token: string;
    expiresAt: number;
  } | null>(null);
  const [createdConnection, setCreatedConnection] = useState<{
    frpsId: string;
    connection: FrpsConnectionDetails;
  } | null>(null);

  const onlineNodes = nodes.filter((node) => node.status === "online");
  const runningFrps = frps.filter((instance) => instance.runtimeState === "running").length;
  const errorFrps = frps.filter((instance) => instance.runtimeState === "error").length;

  const refresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  const request = async <T,>(url: string, init?: RequestInit): Promise<T> => {
    setError(null);

    const response = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });

    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | T
      | null;

    if (!response.ok) {
      throw new Error(
        payload && typeof payload === "object" && "error" in payload
          ? payload.error ?? "Request failed."
          : `Request failed with ${response.status}.`,
      );
    }

    return payload as T;
  };

  const handleLogout = async () => {
    try {
      await request("/api/auth/logout", { method: "POST" });
      refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Logout failed.",
      );
    }
  };

  const handleRegistrationTokenCreate = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    try {
      const payload = await request<RegistrationTokenResponse>(
        "/api/nodes/registration-tokens",
        {
          method: "POST",
          body: JSON.stringify({
            label: tokenLabel,
            ttlHours: Number(tokenTtlHours),
          }),
        },
      );

      setCreatedToken(payload.registrationToken);
      refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to create registration token.",
      );
    }
  };

  const handleFrpsCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const payload = await request<FrpsCreateResponse>("/api/frps", {
        method: "POST",
        body: JSON.stringify({
          name: frpsName,
          edgeNodeId: selectedNodeId,
        }),
      });

      setCreatedConnection(payload);
      setFrpsName("");
      refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to provision FRPS.",
      );
    }
  };

  const handleFrpsAction = async (frpsId: string, action: string) => {
    const shouldDelete =
      action === "delete" &&
      !window.confirm("Delete this FRPS and release its reserved IPv4?");

    if (shouldDelete) {
      return;
    }

    try {
      if (action === "delete") {
        await request(`/api/frps/${frpsId}`, { method: "DELETE" });
      } else {
        await request(`/api/frps/${frpsId}/${action}`, { method: "POST" });
      }

      refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to dispatch FRPS action.",
      );
    }
  };

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="panel relative overflow-hidden p-6 sm:p-8">
          <div className="absolute inset-y-0 right-0 hidden w-72 bg-[radial-gradient(circle_at_top,#f97316_0,transparent_60%)] opacity-70 blur-3xl lg:block" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-4">
              <p className="text-xs uppercase tracking-[0.32em] text-orange-600">
                Conduit Controller
              </p>
              <div className="space-y-3">
                <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                  Provision FRPS capacity on existing Vultr edge servers.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-slate-600">
                  Single-tenant ops console for onboarding edge nodes, attaching
                  one reserved IPv4 per FRPS, and driving the FRPS lifecycle
                  through the polling Bun agent.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 text-sm text-slate-600">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-4 py-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Authenticated as <span className="font-medium">{adminUsername}</span>
              </div>
              <button
                className="button-secondary"
                onClick={handleLogout}
                disabled={isPending}
              >
                Sign Out
              </button>
            </div>
          </div>
        </section>

        {error ? (
          <section className="panel border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-700">
            {error}
          </section>
        ) : null}

        <section className="grid gap-4 md:grid-cols-3">
          <article className="metric-card">
            <p className="metric-label">Online Nodes</p>
            <p className="metric-value">{onlineNodes.length}</p>
            <p className="metric-caption">{nodes.length} total registered</p>
          </article>

          <article className="metric-card">
            <p className="metric-label">Running FRPS</p>
            <p className="metric-value">{runningFrps}</p>
            <p className="metric-caption">{frps.length} managed instances</p>
          </article>

          <article className="metric-card">
            <p className="metric-label">Needs Attention</p>
            <p className="metric-value">{errorFrps}</p>
            <p className="metric-caption">Runtime state reported as error</p>
          </article>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
          <div className="grid gap-6">
            <article className="panel p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="section-kicker">Edge Fleet</p>
                  <h2 className="section-title">Registered nodes</h2>
                </div>
                <button className="button-secondary" onClick={refresh} disabled={isPending}>
                  Refresh
                </button>
              </div>

              <div className="mt-5 grid gap-4">
                {nodes.length === 0 ? (
                  <div className="empty-state">No edge nodes have been registered yet.</div>
                ) : (
                  nodes.map((node) => (
                    <div key={node._id} className="rounded-3xl border border-slate-200 bg-white/90 p-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <h3 className="text-lg font-semibold text-slate-950">
                              {node.label}
                            </h3>
                            <span className={statusTone(node.status)}>{node.status}</span>
                          </div>
                          <p className="font-mono text-xs text-slate-500">
                            {node.hostname} • {node.vultrInstanceId} • {node.region}
                          </p>
                        </div>

                        <dl className="grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
                          <div>
                            <dt className="text-xs uppercase tracking-[0.24em] text-slate-400">
                              Last heartbeat
                            </dt>
                            <dd>{formatDate(node.lastHeartbeatAt)}</dd>
                          </div>
                          <div>
                            <dt className="text-xs uppercase tracking-[0.24em] text-slate-400">
                              Docker
                            </dt>
                            <dd>{node.dockerVersion ?? "Unknown"}</dd>
                          </div>
                          <div>
                            <dt className="text-xs uppercase tracking-[0.24em] text-slate-400">
                              FRPS count
                            </dt>
                            <dd>
                              {node.frpsCount} managed / {node.runningContainers} running
                            </dd>
                          </div>
                        </dl>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </article>

            <article className="panel p-6">
              <div>
                <p className="section-kicker">FRPS Inventory</p>
                <h2 className="section-title">Managed server instances</h2>
              </div>

              <div className="mt-5 grid gap-4">
                {frps.length === 0 ? (
                  <div className="empty-state">No FRPS instances have been provisioned yet.</div>
                ) : (
                  frps.map((instance) => (
                    <div key={instance._id} className="rounded-3xl border border-slate-200 bg-white/90 p-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-lg font-semibold text-slate-950">
                              {instance.name}
                            </h3>
                            <span className={statusTone(instance.runtimeState)}>
                              {instance.runtimeState}
                            </span>
                            <span className="status-pill">{instance.desiredState}</span>
                          </div>

                          <div className="grid gap-1 text-sm text-slate-600">
                            <p>
                              Node <span className="font-medium text-slate-900">{instance.edgeNodeLabel}</span>
                            </p>
                            <p className="font-mono text-xs text-slate-500">
                              {instance.reservedIp}:{instance.bindPort} • {instance.containerName}
                            </p>
                            <p className="font-mono text-xs text-slate-500">
                              token {instance.authToken.slice(0, 12)}... • ports {instance.proxyPortRange}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            className="button-secondary"
                            onClick={() => handleFrpsAction(instance._id, "start")}
                            disabled={isPending}
                          >
                            Start
                          </button>
                          <button
                            className="button-secondary"
                            onClick={() => handleFrpsAction(instance._id, "stop")}
                            disabled={isPending}
                          >
                            Stop
                          </button>
                          <button
                            className="button-secondary"
                            onClick={() => handleFrpsAction(instance._id, "restart")}
                            disabled={isPending}
                          >
                            Restart
                          </button>
                          <button
                            className="button-secondary"
                            onClick={() => handleFrpsAction(instance._id, "retry")}
                            disabled={isPending}
                          >
                            Retry
                          </button>
                          <button
                            className="button-danger"
                            onClick={() => handleFrpsAction(instance._id, "delete")}
                            disabled={isPending}
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {instance.lastError ? (
                        <p className="mt-4 rounded-2xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
                          {instance.lastError}
                        </p>
                      ) : null}

                      {instance.recentEvents.length > 0 ? (
                        <div className="mt-4 grid gap-2">
                          {instance.recentEvents.map((event) => (
                            <div
                              key={event._id}
                              className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-600"
                            >
                              <div className="flex items-center gap-3">
                                <span className={statusTone(event.status)}>{event.status}</span>
                                <span>{event.message}</span>
                              </div>
                              <span className="font-mono text-xs text-slate-400">
                                {formatDate(event.createdAt)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </article>
          </div>

          <div className="grid gap-6">
            <article className="panel p-6">
              <p className="section-kicker">Onboarding</p>
              <h2 className="section-title">Mint a node registration token</h2>

              <form className="mt-5 flex flex-col gap-4" onSubmit={handleRegistrationTokenCreate}>
                <label className="flex flex-col gap-2 text-sm text-slate-700">
                  Label
                  <input
                    className="input"
                    value={tokenLabel}
                    onChange={(event) => setTokenLabel(event.target.value)}
                  />
                </label>

                <label className="flex flex-col gap-2 text-sm text-slate-700">
                  TTL hours
                  <input
                    className="input"
                    value={tokenTtlHours}
                    onChange={(event) => setTokenTtlHours(event.target.value)}
                    inputMode="numeric"
                  />
                </label>

                <button className="button-primary" disabled={isPending}>
                  Create Token
                </button>
              </form>

              {createdToken ? (
                <div className="mt-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-emerald-700">
                    One-Time Registration Token
                  </p>
                  <p className="mt-3 break-all font-mono text-sm text-emerald-950">
                    {createdToken.token}
                  </p>
                  <p className="mt-2 text-sm text-emerald-700">
                    Expires {formatDate(createdToken.expiresAt)}
                  </p>
                </div>
              ) : null}

              <div className="mt-5 grid gap-3">
                {registrationTokens.map((token) => (
                  <div
                    key={token._id}
                    className="rounded-2xl border border-slate-200 bg-white/80 px-3 py-3 text-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-slate-900">{token.label}</span>
                      <span
                        className={
                          token.consumedAt
                            ? "status-pill status-pill--warn"
                            : "status-pill status-pill--good"
                        }
                      >
                        {token.consumedAt ? "consumed" : "ready"}
                      </span>
                    </div>
                    <p className="mt-2 font-mono text-xs text-slate-500">
                      {token.tokenPreview}...
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      Expires {formatDate(token.expiresAt)}
                    </p>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel p-6">
              <p className="section-kicker">Provisioning</p>
              <h2 className="section-title">Create a new FRPS instance</h2>

              <form className="mt-5 flex flex-col gap-4" onSubmit={handleFrpsCreate}>
                <label className="flex flex-col gap-2 text-sm text-slate-700">
                  FRPS name
                  <input
                    className="input"
                    value={frpsName}
                    onChange={(event) => setFrpsName(event.target.value)}
                    placeholder="production-edge-eu"
                  />
                </label>

                <label className="flex flex-col gap-2 text-sm text-slate-700">
                  Target edge node
                  <select
                    className="input"
                    value={selectedNodeId}
                    onChange={(event) => setSelectedNodeId(event.target.value)}
                  >
                    {onlineNodes.length === 0 ? (
                      <option value="">No online nodes</option>
                    ) : (
                      onlineNodes.map((node) => (
                        <option key={node._id} value={node._id}>
                          {node.label} ({node.region})
                        </option>
                      ))
                    )}
                  </select>
                </label>

                <button
                  className="button-primary"
                  disabled={isPending || onlineNodes.length === 0}
                >
                  Provision FRPS
                </button>
              </form>

              {createdConnection ? (
                <div className="mt-5 rounded-3xl border border-orange-200 bg-orange-50 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-orange-700">
                    New Connection Details
                  </p>
                  <div className="mt-3 space-y-2 font-mono text-sm text-orange-950">
                    <p>serverAddr = &quot;{createdConnection.connection.serverAddr}&quot;</p>
                    <p>serverPort = {createdConnection.connection.bindPort}</p>
                    <p>auth.token = &quot;{createdConnection.connection.authToken}&quot;</p>
                    <p>ports = &quot;{createdConnection.connection.allowedPorts}&quot;</p>
                  </div>
                </div>
              ) : null}
            </article>
          </div>
        </section>
      </div>
    </div>
  );
}
