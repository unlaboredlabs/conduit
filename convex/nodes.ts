import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";

const NODE_OFFLINE_AFTER_MS = 90_000;

const isNodeOnline = (lastHeartbeatAt: number) =>
  Date.now() - lastHeartbeatAt <= NODE_OFFLINE_AFTER_MS;

type ReadCtx = QueryCtx | MutationCtx;

const getPresenceByNodeId = async (ctx: ReadCtx, edgeNodeId: Id<"edgeNodes">) =>
  await ctx.db
    .query("edgeNodePresence")
    .withIndex("by_edgeNodeId", (q) => q.eq("edgeNodeId", edgeNodeId))
    .unique();

const countNodeFrps = async (ctx: ReadCtx, edgeNodeId: Id<"edgeNodes">) => {
  const frps = await ctx.db
    .query("frpsInstances")
    .withIndex("by_edgeNodeId", (q) => q.eq("edgeNodeId", edgeNodeId))
    .take(100);

  return frps.filter(
    (instance: Doc<"frpsInstances">) =>
      !(instance.desiredState === "deleted" && instance.runtimeState === "deleted"),
  ).length;
};

const projectNodeSummary = async (ctx: ReadCtx, node: Doc<"edgeNodes">) => {
  const presence = await getPresenceByNodeId(ctx, node._id);
  const frpsCount = await countNodeFrps(ctx, node._id);
  const online = presence ? isNodeOnline(presence.lastHeartbeatAt) : false;
  const status: "online" | "offline" = online ? "online" : "offline";

  return {
    _id: node._id,
    label: node.label,
    hostname: node.hostname,
    vultrInstanceId: node.vultrInstanceId,
    region: node.region,
    status,
    lastHeartbeatAt: presence?.lastHeartbeatAt ?? null,
    agentVersion: presence?.agentVersion ?? node.agentVersion,
    dockerVersion: presence?.dockerVersion ?? node.dockerVersion ?? null,
    frpsCount,
    runningContainers: presence?.runningContainers ?? 0,
  };
};

export const listNodes = internalQuery({
  args: {},
  handler: async (ctx) => {
    const nodes = await ctx.db.query("edgeNodes").take(100);
    const results = [];

    for (const node of nodes) {
      results.push(await projectNodeSummary(ctx, node));
    }

    return results.sort((left, right) => left.label.localeCompare(right.label));
  },
});

export const getNode = internalQuery({
  args: {
    nodeId: v.id("edgeNodes"),
  },
  handler: async (ctx, args) => {
    const node = await ctx.db.get(args.nodeId);
    if (!node) {
      return null;
    }

    const summary = await projectNodeSummary(ctx, node);
    const frpsInstances = await ctx.db
      .query("frpsInstances")
      .withIndex("by_edgeNodeId", (q) => q.eq("edgeNodeId", args.nodeId))
      .take(100);

    return {
      ...summary,
      frpsInstances,
    };
  },
});

export const listRegistrationTokens = internalQuery({
  args: {},
  handler: async (ctx) => {
    const tokens = await ctx.db.query("nodeRegistrationTokens").take(100);
    return tokens
      .map((token) => ({
        _id: token._id,
        label: token.label,
        tokenPreview: token.tokenPreview,
        expiresAt: token.expiresAt,
        createdAt: token.createdAt,
        consumedAt: token.consumedAt ?? null,
      }))
      .sort((left, right) => right.createdAt - left.createdAt);
  },
});

export const createRegistrationToken = internalMutation({
  args: {
    label: v.string(),
    tokenHash: v.string(),
    tokenPreview: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("nodeRegistrationTokens", {
      label: args.label,
      tokenHash: args.tokenHash,
      tokenPreview: args.tokenPreview,
      expiresAt: args.expiresAt,
      createdAt: Date.now(),
      consumedAt: null,
      consumedByNodeId: null,
    });
  },
});

export const exchangeRegistrationToken = internalMutation({
  args: {
    tokenHash: v.string(),
    label: v.string(),
    hostname: v.string(),
    vultrInstanceId: v.string(),
    region: v.string(),
    agentVersion: v.string(),
    dockerVersion: v.optional(v.union(v.string(), v.null())),
    nodeTokenHash: v.string(),
    nodeTokenPreview: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const registrationToken = await ctx.db
      .query("nodeRegistrationTokens")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", args.tokenHash))
      .unique();

    if (!registrationToken) {
      throw new Error("Invalid registration token.");
    }

    if (registrationToken.consumedAt) {
      throw new Error("Registration token has already been used.");
    }

    if (registrationToken.expiresAt < now) {
      throw new Error("Registration token has expired.");
    }

    const existingNode = await ctx.db
      .query("edgeNodes")
      .withIndex("by_vultrInstanceId", (q) =>
        q.eq("vultrInstanceId", args.vultrInstanceId),
      )
      .unique();

    let edgeNodeId: Id<"edgeNodes">;

    if (existingNode) {
      edgeNodeId = existingNode._id;
      await ctx.db.patch("edgeNodes", existingNode._id, {
        label: args.label,
        hostname: args.hostname,
        region: args.region,
        nodeTokenHash: args.nodeTokenHash,
        nodeTokenPreview: args.nodeTokenPreview,
        agentVersion: args.agentVersion,
        dockerVersion: args.dockerVersion ?? null,
        updatedAt: now,
      });
    } else {
      edgeNodeId = await ctx.db.insert("edgeNodes", {
        label: args.label,
        hostname: args.hostname,
        vultrInstanceId: args.vultrInstanceId,
        region: args.region,
        nodeTokenHash: args.nodeTokenHash,
        nodeTokenPreview: args.nodeTokenPreview,
        agentVersion: args.agentVersion,
        dockerVersion: args.dockerVersion ?? null,
        createdAt: now,
        updatedAt: now,
      });
    }

    const existingPresence = await ctx.db
      .query("edgeNodePresence")
      .withIndex("by_edgeNodeId", (q) => q.eq("edgeNodeId", edgeNodeId))
      .unique();

    if (existingPresence) {
      await ctx.db.patch("edgeNodePresence", existingPresence._id, {
        status: "online",
        lastHeartbeatAt: now,
        hostname: args.hostname,
        agentVersion: args.agentVersion,
        dockerVersion: args.dockerVersion ?? null,
        runningContainers: 0,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("edgeNodePresence", {
        edgeNodeId,
        status: "online",
        lastHeartbeatAt: now,
        hostname: args.hostname,
        agentVersion: args.agentVersion,
        dockerVersion: args.dockerVersion ?? null,
        runningContainers: 0,
        updatedAt: now,
      });
    }

    await ctx.db.patch("nodeRegistrationTokens", registrationToken._id, {
      consumedAt: now,
      consumedByNodeId: edgeNodeId,
    });

    return { edgeNodeId };
  },
});

export const authenticateNode = internalQuery({
  args: {
    nodeId: v.id("edgeNodes"),
    nodeTokenHash: v.string(),
  },
  handler: async (ctx, args) => {
    const node = await ctx.db.get(args.nodeId);
    if (!node || node.nodeTokenHash !== args.nodeTokenHash) {
      return null;
    }

    return {
      _id: node._id,
      label: node.label,
      hostname: node.hostname,
      vultrInstanceId: node.vultrInstanceId,
      region: node.region,
      agentVersion: node.agentVersion,
      dockerVersion: node.dockerVersion ?? null,
    };
  },
});

export const recordHeartbeat = internalMutation({
  args: {
    nodeId: v.id("edgeNodes"),
    hostname: v.string(),
    agentVersion: v.string(),
    dockerVersion: v.optional(v.union(v.string(), v.null())),
    runningContainers: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const presence = await ctx.db
      .query("edgeNodePresence")
      .withIndex("by_edgeNodeId", (q) => q.eq("edgeNodeId", args.nodeId))
      .unique();

    if (presence) {
      await ctx.db.patch("edgeNodePresence", presence._id, {
        status: "online",
        lastHeartbeatAt: now,
        hostname: args.hostname,
        agentVersion: args.agentVersion,
        dockerVersion: args.dockerVersion ?? null,
        runningContainers: args.runningContainers,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("edgeNodePresence", {
        edgeNodeId: args.nodeId,
        status: "online",
        lastHeartbeatAt: now,
        hostname: args.hostname,
        agentVersion: args.agentVersion,
        dockerVersion: args.dockerVersion ?? null,
        runningContainers: args.runningContainers,
        updatedAt: now,
      });
    }

    await ctx.db.patch("edgeNodes", args.nodeId, {
      hostname: args.hostname,
      agentVersion: args.agentVersion,
      dockerVersion: args.dockerVersion ?? null,
      updatedAt: now,
    });

    return { ok: true };
  },
});

export const markOfflineNodes = internalMutation({
  args: {
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const onlineNodes = await ctx.db
      .query("edgeNodePresence")
      .withIndex("by_status_and_lastHeartbeatAt", (q) => q.eq("status", "online"))
      .take(args.limit);

    for (const presence of onlineNodes) {
      if (now - presence.lastHeartbeatAt > NODE_OFFLINE_AFTER_MS) {
        await ctx.db.patch("edgeNodePresence", presence._id, {
          status: "offline",
          updatedAt: now,
        });
      }
    }

    return { scanned: onlineNodes.length };
  },
});
