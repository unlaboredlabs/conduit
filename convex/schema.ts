import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  edgeNodeStatusValidator,
  frpsDesiredStateValidator,
  frpsRuntimeStateValidator,
  jobKindValidator,
  jobStatusValidator,
  publicIpStatusValidator,
} from "./validators";

export default defineSchema({
  edgeNodes: defineTable({
    label: v.string(),
    hostname: v.string(),
    vultrInstanceId: v.string(),
    region: v.string(),
    nodeTokenHash: v.string(),
    nodeTokenPreview: v.string(),
    agentVersion: v.string(),
    dockerVersion: v.optional(v.union(v.string(), v.null())),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_vultrInstanceId", ["vultrInstanceId"])
    .index("by_region", ["region"]),

  edgeNodePresence: defineTable({
    edgeNodeId: v.id("edgeNodes"),
    status: edgeNodeStatusValidator,
    lastHeartbeatAt: v.number(),
    hostname: v.string(),
    agentVersion: v.string(),
    dockerVersion: v.optional(v.union(v.string(), v.null())),
    runningContainers: v.number(),
    updatedAt: v.number(),
  })
    .index("by_edgeNodeId", ["edgeNodeId"])
    .index("by_status_and_lastHeartbeatAt", ["status", "lastHeartbeatAt"]),

  nodeRegistrationTokens: defineTable({
    label: v.string(),
    tokenHash: v.string(),
    tokenPreview: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
    consumedAt: v.optional(v.union(v.number(), v.null())),
    consumedByNodeId: v.optional(v.union(v.id("edgeNodes"), v.null())),
  }).index("by_tokenHash", ["tokenHash"]),

  publicIps: defineTable({
    reservedIpId: v.string(),
    address: v.string(),
    region: v.string(),
    edgeNodeId: v.id("edgeNodes"),
    frpsInstanceId: v.optional(v.union(v.id("frpsInstances"), v.null())),
    status: publicIpStatusValidator,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_reservedIpId", ["reservedIpId"])
    .index("by_edgeNodeId", ["edgeNodeId"])
    .index("by_frpsInstanceId", ["frpsInstanceId"]),

  frpsInstances: defineTable({
    name: v.string(),
    edgeNodeId: v.id("edgeNodes"),
    publicIpId: v.id("publicIps"),
    reservedIpId: v.string(),
    reservedIp: v.string(),
    bindPort: v.number(),
    proxyPortStart: v.number(),
    proxyPortEnd: v.number(),
    authToken: v.string(),
    desiredState: frpsDesiredStateValidator,
    runtimeState: frpsRuntimeStateValidator,
    containerName: v.string(),
    image: v.string(),
    lastError: v.optional(v.union(v.string(), v.null())),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.union(v.number(), v.null())),
  })
    .index("by_edgeNodeId", ["edgeNodeId"])
    .index("by_publicIpId", ["publicIpId"]),

  jobs: defineTable({
    kind: jobKindValidator,
    targetNodeId: v.id("edgeNodes"),
    frpsInstanceId: v.optional(v.union(v.id("frpsInstances"), v.null())),
    payload: v.any(),
    status: jobStatusValidator,
    attemptCount: v.number(),
    maxAttempts: v.number(),
    leaseExpiresAt: v.optional(v.union(v.number(), v.null())),
    leasedAt: v.optional(v.union(v.number(), v.null())),
    completedAt: v.optional(v.union(v.number(), v.null())),
    lastError: v.optional(v.union(v.string(), v.null())),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_targetNodeId_and_status", ["targetNodeId", "status"])
    .index("by_status_and_leaseExpiresAt", ["status", "leaseExpiresAt"])
    .index("by_frpsInstanceId", ["frpsInstanceId"]),

  jobEvents: defineTable({
    jobId: v.id("jobs"),
    frpsInstanceId: v.optional(v.union(v.id("frpsInstances"), v.null())),
    targetNodeId: v.id("edgeNodes"),
    status: jobStatusValidator,
    message: v.string(),
    createdAt: v.number(),
  })
    .index("by_jobId", ["jobId"])
    .index("by_frpsInstanceId", ["frpsInstanceId"]),
});
