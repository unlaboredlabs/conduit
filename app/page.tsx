import { Dashboard } from "@/app/_components/dashboard";
import { LoginForm } from "@/app/_components/login-form";
import { verifySession } from "@/app/lib/auth";
import { loadDashboardData } from "@/app/lib/controller";
import { env } from "@/app/lib/env";

export default async function IndexPage() {
  const session = await verifySession();

  if (!session) {
    return (
      <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-10">
        <div className="mx-auto grid min-h-[90vh] w-full max-w-7xl gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="panel flex flex-col justify-between overflow-hidden p-8 sm:p-10">
            <div className="space-y-6">
              <p className="text-xs uppercase tracking-[0.34em] text-orange-600">
                Conduit
              </p>
              <div className="space-y-4">
                <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
                  Control plane for FRPS capacity running at the edge.
                </h1>
                <p className="max-w-2xl text-lg leading-8 text-slate-600">
                  Provision FRPS containers onto existing Vultr hosts, attach
                  one public reserved IPv4 per instance, and let the Bun edge
                  agent keep runtime state in sync with the controller.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <article className="metric-card">
                <p className="metric-label">Transport</p>
                <p className="text-lg font-semibold text-slate-950">Polling Agent</p>
                <p className="metric-caption">Jobs are leased by `conduit-node`.</p>
              </article>
              <article className="metric-card">
                <p className="metric-label">Backend</p>
                <p className="text-lg font-semibold text-slate-950">Next + Convex</p>
                <p className="metric-caption">Ops API, sessions, inventory, queue.</p>
              </article>
              <article className="metric-card">
                <p className="metric-label">Edge Contract</p>
                <p className="text-lg font-semibold text-slate-950">IPv4 per FRPS</p>
                <p className="metric-caption">TCP/UDP ports `1024-49151`.</p>
              </article>
            </div>
          </section>

          <div className="flex items-center">
            <LoginForm username={env.adminUsername()} />
          </div>
        </div>
      </div>
    );
  }

  const { nodes, frps, registrationTokens } = await loadDashboardData();

  return (
    <Dashboard
      adminUsername={env.adminUsername()}
      nodes={nodes}
      frps={frps}
      registrationTokens={registrationTokens}
    />
  );
}
