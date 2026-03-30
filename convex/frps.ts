import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";

const listRecentEventsForFrps = async (
  ctx: QueryCtx | MutationCtx,
  frpsId: Id<"frpsInstances">,
) => {
  const events = await ctx.db
    .query("jobEvents")
    .withIndex("by_frpsInstanceId", (q) => q.eq("frpsInstanceId", frpsId))
    .order("desc")
    .take(5);

  return events.map((event) => ({
    _id: event._id,
    status: event.status,
    message: event.message,
    createdAt: event.createdAt,
  }));
};

const projectFrpsSummary = async (
  ctx: QueryCtx | MutationCtx,
  instance: Doc<"frpsInstances">,
) => {
  const edgeNode = await ctx.db.get(instance.edgeNodeId);
  const recentEvents = await listRecentEventsForFrps(ctx, instance._id);

  return {
    _id: instance._id,
    name: instance.name,
    edgeNodeId: instance.edgeNodeId,
    edgeNodeLabel: edgeNode?.label ?? "Unknown node",
    reservedIp: instance.reservedIp,
    reservedIpId: instance.reservedIpId,
    bindPort: instance.bindPort,
    proxyPortStart: instance.proxyPortStart,
    proxyPortEnd: instance.proxyPortEnd,
    desiredState: instance.desiredState,
    runtimeState: instance.runtimeState,
    containerName: instance.containerName,
    authToken: instance.authToken,
    image: instance.image,
    lastError: instance.lastError ?? null,
    proxyPortRange: `${instance.proxyPortStart}-${instance.proxyPortEnd}`,
    createdAt: instance.createdAt,
    updatedAt: instance.updatedAt,
    recentEvents,
  };
};

export const listFrps = internalQuery({
  args: {},
  handler: async (ctx) => {
    const instances = await ctx.db.query("frpsInstances").take(200);
    const active = instances.filter(
      (instance) =>
        !(instance.desiredState === "deleted" && instance.runtimeState === "deleted"),
    );

    const result = [];
    for (const instance of active) {
      result.push(await projectFrpsSummary(ctx, instance));
    }

    return result.sort((left, right) => right.createdAt - left.createdAt);
  },
});

export const getFrps = internalQuery({
  args: {
    frpsId: v.id("frpsInstances"),
  },
  handler: async (ctx, args) => {
    const instance = await ctx.db.get(args.frpsId);
    if (!instance) {
      return null;
    }

    const publicIp = await ctx.db.get(instance.publicIpId);
    return {
      ...(await projectFrpsSummary(ctx, instance)),
      publicIp,
    };
  },
});

export const createFrpsProvisioning = internalMutation({
  args: {
    name: v.string(),
    edgeNodeId: v.id("edgeNodes"),
    reservedIpId: v.string(),
    reservedIp: v.string(),
    region: v.string(),
    bindPort: v.number(),
    proxyPortStart: v.number(),
    proxyPortEnd: v.number(),
    authToken: v.string(),
    image: v.string(),
    containerName: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const publicIpId = await ctx.db.insert("publicIps", {
      reservedIpId: args.reservedIpId,
      address: args.reservedIp,
      region: args.region,
      edgeNodeId: args.edgeNodeId,
      frpsInstanceId: null,
      status: "attached",
      createdAt: now,
      updatedAt: now,
    });

    const frpsId = await ctx.db.insert("frpsInstances", {
      name: args.name,
      edgeNodeId: args.edgeNodeId,
      publicIpId,
      reservedIpId: args.reservedIpId,
      reservedIp: args.reservedIp,
      bindPort: args.bindPort,
      proxyPortStart: args.proxyPortStart,
      proxyPortEnd: args.proxyPortEnd,
      authToken: args.authToken,
      desiredState: "running",
      runtimeState: "pending",
      containerName: args.containerName,
      image: args.image,
      lastError: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });

    await ctx.db.patch("publicIps", publicIpId, {
      frpsInstanceId: frpsId,
      updatedAt: now,
    });

    return {
      frpsId,
      publicIpId,
    };
  },
});

export const setFrpsState = internalMutation({
  args: {
    frpsId: v.id("frpsInstances"),
    desiredState: v.union(
      v.literal("running"),
      v.literal("stopped"),
      v.literal("deleted"),
    ),
    runtimeState: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("stopped"),
      v.literal("error"),
      v.literal("deleting"),
      v.literal("deleted"),
    ),
    lastError: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch("frpsInstances", args.frpsId, {
      desiredState: args.desiredState,
      runtimeState: args.runtimeState,
      lastError: args.lastError ?? null,
      updatedAt: Date.now(),
    });

    return { ok: true };
  },
});

export const setFrpsError = internalMutation({
  args: {
    frpsId: v.id("frpsInstances"),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch("frpsInstances", args.frpsId, {
      runtimeState: "error",
      lastError: args.message,
      updatedAt: Date.now(),
    });

    return { ok: true };
  },
});

export const markDeletedAfterCleanup = internalMutation({
  args: {
    frpsId: v.id("frpsInstances"),
  },
  handler: async (ctx, args) => {
    const instance = await ctx.db.get(args.frpsId);
    if (!instance) {
      return { ok: true };
    }

    const now = Date.now();
    await ctx.db.patch("frpsInstances", args.frpsId, {
      desiredState: "deleted",
      runtimeState: "deleted",
      deletedAt: now,
      lastError: null,
      updatedAt: now,
    });

    await ctx.db.patch("publicIps", instance.publicIpId, {
      status: "deleted",
      updatedAt: now,
    });

    return { ok: true };
  },
});
