import {
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

const appendJobEvent = async (
  ctx: MutationCtx,
  jobId: Id<"jobs">,
  frpsInstanceId: Id<"frpsInstances"> | null,
  targetNodeId: Id<"edgeNodes">,
  status: "queued" | "leased" | "succeeded" | "failed" | "cancelled",
  message: string,
) => {
  await ctx.db.insert("jobEvents", {
    jobId,
    frpsInstanceId,
    targetNodeId,
    status,
    message,
    createdAt: Date.now(),
  });
};

export const enqueueJob = internalMutation({
  args: {
    kind: v.union(
      v.literal("provision_frps"),
      v.literal("start_frps"),
      v.literal("stop_frps"),
      v.literal("restart_frps"),
      v.literal("delete_frps"),
    ),
    targetNodeId: v.id("edgeNodes"),
    frpsInstanceId: v.optional(v.union(v.id("frpsInstances"), v.null())),
    payload: v.any(),
    maxAttempts: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const jobId = await ctx.db.insert("jobs", {
      kind: args.kind,
      targetNodeId: args.targetNodeId,
      frpsInstanceId: args.frpsInstanceId ?? null,
      payload: args.payload,
      status: "queued",
      attemptCount: 0,
      maxAttempts: args.maxAttempts ?? 3,
      leaseExpiresAt: null,
      leasedAt: null,
      completedAt: null,
      lastError: null,
      createdAt: now,
      updatedAt: now,
    });

    await appendJobEvent(
      ctx,
      jobId,
      args.frpsInstanceId ?? null,
      args.targetNodeId,
      "queued",
      `${args.kind} queued`,
    );

    return { jobId };
  },
});

export const getJob = internalQuery({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => await ctx.db.get(args.jobId),
});

export const claimNextJob = internalMutation({
  args: {
    targetNodeId: v.id("edgeNodes"),
    leaseDurationMs: v.number(),
  },
  handler: async (ctx, args) => {
    const nextJob = await ctx.db
      .query("jobs")
      .withIndex("by_targetNodeId_and_status", (q) =>
        q.eq("targetNodeId", args.targetNodeId).eq("status", "queued"),
      )
      .take(1);

    if (nextJob.length === 0) {
      return null;
    }

    const job = nextJob[0];
    const now = Date.now();
    await ctx.db.patch("jobs", job._id, {
      status: "leased",
      attemptCount: job.attemptCount + 1,
      leasedAt: now,
      leaseExpiresAt: now + args.leaseDurationMs,
      updatedAt: now,
    });

    await appendJobEvent(
      ctx,
      job._id,
      job.frpsInstanceId ?? null,
      job.targetNodeId,
      "leased",
      `${job.kind} leased to node`,
    );

    return {
      _id: job._id,
      kind: job.kind,
      payload: job.payload,
      attemptCount: job.attemptCount + 1,
    };
  },
});

export const completeJob = internalMutation({
  args: {
    jobId: v.id("jobs"),
    status: v.union(v.literal("succeeded"), v.literal("failed")),
    message: v.optional(v.string()),
    containerName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error("Job not found.");
    }

    const now = Date.now();
    await ctx.db.patch("jobs", job._id, {
      status: args.status,
      leaseExpiresAt: null,
      completedAt: now,
      lastError: args.status === "failed" ? (args.message ?? "Job failed") : null,
      updatedAt: now,
    });

    await appendJobEvent(
      ctx,
      job._id,
      job.frpsInstanceId ?? null,
      job.targetNodeId,
      args.status,
      args.message ??
        (args.status === "succeeded"
          ? `${job.kind} completed`
          : `${job.kind} failed`),
    );

    if (!job.frpsInstanceId) {
      return { ok: true };
    }

    const instance = await ctx.db.get(job.frpsInstanceId);
    if (!instance) {
      return { ok: true };
    }

    if (args.status === "failed") {
      await ctx.db.patch("frpsInstances", instance._id, {
        runtimeState: "error",
        lastError: args.message ?? "Job failed",
        updatedAt: now,
      });
      return { ok: true };
    }

    if (job.kind === "stop_frps") {
      await ctx.db.patch("frpsInstances", instance._id, {
        desiredState: "stopped",
        runtimeState: "stopped",
        lastError: null,
        updatedAt: now,
      });
      return { ok: true };
    }

    if (job.kind === "delete_frps") {
      await ctx.db.delete(instance.publicIpId);
      await ctx.db.delete(instance._id);
      return { ok: true };
    }

    await ctx.db.patch("frpsInstances", instance._id, {
      desiredState: "running",
      runtimeState: "running",
      containerName: args.containerName ?? instance.containerName,
      lastError: null,
      updatedAt: now,
    });

    return { ok: true };
  },
});

export const reapExpiredLeases = internalMutation({
  args: {
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const expired = await ctx.db
      .query("jobs")
      .withIndex("by_status_and_leaseExpiresAt", (q) =>
        q.eq("status", "leased").lt("leaseExpiresAt", now),
      )
      .take(args.limit);

    for (const job of expired) {
      const shouldRetry = job.attemptCount < job.maxAttempts;
      await ctx.db.patch("jobs", job._id, {
        status: shouldRetry ? "queued" : "failed",
        leaseExpiresAt: null,
        leasedAt: null,
        completedAt: shouldRetry ? null : now,
        lastError: shouldRetry
          ? "Lease expired; requeued."
          : "Lease expired too many times.",
        updatedAt: now,
      });

      await appendJobEvent(
        ctx,
        job._id,
        job.frpsInstanceId ?? null,
        job.targetNodeId,
        shouldRetry ? "queued" : "failed",
        shouldRetry ? "Lease expired; requeued." : "Lease expired too many times.",
      );

      if (!shouldRetry && job.frpsInstanceId) {
        await ctx.db.patch("frpsInstances", job.frpsInstanceId, {
          runtimeState: "error",
          lastError: "Lease expired too many times.",
          updatedAt: now,
        });
      }
    }

    return { scanned: expired.length };
  },
});
