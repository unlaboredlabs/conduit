"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type {
  FrpsConnectionDetails,
  FrpsSummary,
  ProvisioningRegionSummary,
} from "@/app/lib/contracts";
import { requestJson } from "@/app/lib/request";
import {
  EmptyState,
  formatDate,
  PageHeader,
  StatusBadge,
} from "@/app/_components/console-ui";

type FrpsCreateResponse = {
  ok: true;
  frpsId: string;
  edgeNodeId: string;
  edgeNodeLabel: string;
  provisioningRegionId: string | null;
  provisioningRegionName: string | null;
  connection: FrpsConnectionDetails;
};

export function FrpsPage({
  frps,
  provisioningRegions,
}: {
  frps: FrpsSummary[];
  provisioningRegions: ProvisioningRegionSummary[];
}) {
  const router = useRouter();
  const provisionableRegions = provisioningRegions.filter(
    (region) => region.onlineNodeCount > 0,
  );
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [frpsName, setFrpsName] = useState("");
  const [selectedProvisioningRegionId, setSelectedProvisioningRegionId] = useState(
    provisionableRegions[0]?._id ?? provisioningRegions[0]?._id ?? "",
  );
  const [deleteTarget, setDeleteTarget] = useState<FrpsSummary | null>(null);
  const [createdConnection, setCreatedConnection] = useState<{
    frpsId: string;
    edgeNodeId: string;
    edgeNodeLabel: string;
    provisioningRegionId: string | null;
    provisioningRegionName: string | null;
    connection: FrpsConnectionDetails;
  } | null>(null);

  useEffect(() => {
    const fallback =
      provisionableRegions[0]?._id ?? provisioningRegions[0]?._id ?? "";
    if (
      fallback &&
      (
        !selectedProvisioningRegionId ||
        !provisioningRegions.some(
          (region) => region._id === selectedProvisioningRegionId,
        )
      )
    ) {
      setSelectedProvisioningRegionId(fallback);
    }
  }, [
    provisioningRegions,
    provisionableRegions,
    selectedProvisioningRegionId,
  ]);

  const refresh = () => router.refresh();

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setError(null);
      setPendingAction("create");
      const payload = await requestJson<FrpsCreateResponse>("/api/frps/provision", {
        method: "POST",
        body: JSON.stringify({
          name: frpsName,
          provisioningRegionId: selectedProvisioningRegionId,
        }),
      });
      setCreateOpen(false);
      setCreatedConnection(payload);
      setFrpsName("");
      refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to provision FRPS.",
      );
    } finally {
      setPendingAction(null);
    }
  };

  const runAction = async (frpsId: string, action: string) => {
    try {
      setError(null);
      setPendingAction(`${action}:${frpsId}`);
      if (action === "delete") {
        await requestJson(`/api/frps/${frpsId}`, { method: "DELETE" });
        setDeleteTarget(null);
      } else {
        await requestJson(`/api/frps/${frpsId}/${action}`, { method: "POST" });
      }
      refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Action failed.",
      );
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="FRPS"
        description="Managed server instances across provisioning regions and edge nodes."
        action={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={provisionableRegions.length === 0}>
                New instance
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Provision FRPS</DialogTitle>
                <DialogDescription>
                  Place a new instance in a provisioning region and let Conduit
                  pick the least-loaded online node.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="mt-4 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="frps-name">Name</Label>
                  <Input
                    id="frps-name"
                    value={frpsName}
                    onChange={(e) => setFrpsName(e.target.value)}
                    placeholder="fra-primary"
                    minLength={2}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="frps-region">Provisioning region</Label>
                  <Select
                    id="frps-region"
                    value={selectedProvisioningRegionId}
                    onChange={(e) => setSelectedProvisioningRegionId(e.target.value)}
                    required
                  >
                    {provisioningRegions.map((region) => (
                      <option
                        key={region._id}
                        value={region._id}
                        disabled={region.onlineNodeCount === 0}
                      >
                        {region.name} · {region.onlineNodeCount}/
                        {region.assignedNodeCount} online · {region.frpsCount} FRPS
                      </option>
                    ))}
                  </Select>
                  <p className="text-[12px] text-zinc-500">
                    Regions without online assigned nodes are unavailable here.
                  </p>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="ghost">
                      Cancel
                    </Button>
                  </DialogClose>
                  <Button type="submit" disabled={pendingAction === "create"}>
                    {pendingAction === "create" ? "Provisioning..." : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {error && (
        <p className="text-[13px] text-red-600">{error}</p>
      )}

      {provisioningRegions.length === 0 && (
        <p className="text-[13px] text-amber-600">
          No provisioning regions configured.{" "}
          <Link href="/regions" className="underline underline-offset-2">
            Create a region
          </Link>{" "}
          before provisioning.
        </p>
      )}

      {provisioningRegions.length > 0 && provisionableRegions.length === 0 && (
        <p className="text-[13px] text-amber-600">
          No provisioning region currently has an online assigned node.{" "}
          <Link href="/regions" className="underline underline-offset-2">
            Update region assignments
          </Link>{" "}
          or bring nodes online before provisioning.
        </p>
      )}

      {frps.length === 0 ? (
        <EmptyState
          title="No FRPS instances"
          description="Create the first instance once a provisioning region has online capacity."
        />
      ) : (
        <div className="divide-y divide-zinc-100">
          {frps.map((instance) => {
            const showDesired =
              instance.desiredState !== instance.runtimeState &&
              instance.runtimeState !== "pending";

            return (
              <div
                key={instance._id}
                className="flex flex-col gap-3 py-5 first:pt-0 xl:flex-row xl:items-start xl:justify-between"
              >
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">
                      {instance.name}
                    </span>
                    <StatusBadge status={instance.runtimeState} />
                    {showDesired && (
                      <span className="text-[12px] text-zinc-400">
                        → {instance.desiredState}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[13px] text-zinc-500">
                    <span>{instance.provisioningRegionName ?? "Unassigned"}</span>
                    <span>{instance.edgeNodeLabel}</span>
                    <span className="font-mono">
                      {instance.reservedIp}:{instance.bindPort}
                    </span>
                    <span className="font-mono">
                      {instance.proxyPortRange}
                    </span>
                  </div>
                  <p className="font-mono text-[12px] text-zinc-400">
                    {instance.containerName} · updated{" "}
                    {formatDate(instance.updatedAt)}
                  </p>
                  {instance.lastError && (
                    <p className="text-[13px] text-red-600">
                      {instance.lastError}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 flex-wrap gap-1">
                  {instance.runtimeState === "error" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => runAction(instance._id, "retry")}
                      disabled={pendingAction !== null}
                    >
                      Retry
                    </Button>
                  )}
                  {instance.desiredState !== "running" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => runAction(instance._id, "start")}
                      disabled={pendingAction !== null}
                    >
                      Start
                    </Button>
                  )}
                  {instance.desiredState !== "stopped" &&
                    instance.desiredState !== "deleted" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => runAction(instance._id, "stop")}
                        disabled={pendingAction !== null}
                      >
                        Stop
                      </Button>
                    )}
                  {instance.desiredState !== "deleted" && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => runAction(instance._id, "restart")}
                        disabled={pendingAction !== null}
                      >
                        Restart
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => setDeleteTarget(instance)}
                        disabled={pendingAction !== null}
                      >
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Provisioned dialog */}
      <Dialog
        open={createdConnection !== null}
        onOpenChange={(open) => {
          if (!open) setCreatedConnection(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>FRPS provisioning queued</DialogTitle>
            <DialogDescription>
              Conduit accepted the request and queued it for the assigned node.
              The instance is usable once its runtime state reaches running.
            </DialogDescription>
          </DialogHeader>
          {createdConnection && (
            <dl className="mt-4 divide-y divide-zinc-100 text-sm">
              <div className="flex justify-between gap-4 py-2.5">
                <dt className="text-zinc-500">Server</dt>
                <dd className="font-mono">
                  {createdConnection.connection.serverAddr}
                </dd>
              </div>
              <div className="flex justify-between gap-4 py-2.5">
                <dt className="text-zinc-500">Provisioning region</dt>
                <dd>{createdConnection.provisioningRegionName ?? "Unassigned"}</dd>
              </div>
              <div className="flex justify-between gap-4 py-2.5">
                <dt className="text-zinc-500">Assigned node</dt>
                <dd>{createdConnection.edgeNodeLabel}</dd>
              </div>
              <div className="flex justify-between gap-4 py-2.5">
                <dt className="text-zinc-500">Bind port</dt>
                <dd className="font-mono">
                  {createdConnection.connection.bindPort}
                </dd>
              </div>
              <div className="flex justify-between gap-4 py-2.5">
                <dt className="text-zinc-500">Auth token</dt>
                <dd className="break-all font-mono">
                  {createdConnection.connection.authToken}
                </dd>
              </div>
              <div className="flex justify-between gap-4 py-2.5">
                <dt className="text-zinc-500">Allowed ports</dt>
                <dd className="font-mono">
                  {createdConnection.connection.allowedPorts}
                </dd>
              </div>
            </dl>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button>Done</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete FRPS</DialogTitle>
            <DialogDescription>
              This removes the instance and releases its reserved IPv4.
            </DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm">
              <p className="font-medium">{deleteTarget.name}</p>
              <p className="mt-0.5 text-zinc-500">
                {deleteTarget.reservedIp}:{deleteTarget.bindPort} ·{" "}
                {deleteTarget.provisioningRegionName ?? "Unassigned"} ·{" "}
                {deleteTarget.edgeNodeLabel}
              </p>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              disabled={!deleteTarget || pendingAction !== null}
              onClick={() =>
                deleteTarget
                  ? runAction(deleteTarget._id, "delete")
                  : undefined
              }
            >
              Delete instance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
