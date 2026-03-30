import { v } from "convex/values";

export const edgeNodeStatusValidator = v.union(
  v.literal("online"),
  v.literal("offline"),
);

export const frpsDesiredStateValidator = v.union(
  v.literal("running"),
  v.literal("stopped"),
  v.literal("deleted"),
);

export const frpsRuntimeStateValidator = v.union(
  v.literal("pending"),
  v.literal("running"),
  v.literal("stopped"),
  v.literal("error"),
  v.literal("deleting"),
  v.literal("deleted"),
);

export const publicIpStatusValidator = v.union(
  v.literal("allocated"),
  v.literal("attached"),
  v.literal("deleted"),
  v.literal("error"),
);

export const jobKindValidator = v.union(
  v.literal("provision_frps"),
  v.literal("start_frps"),
  v.literal("stop_frps"),
  v.literal("restart_frps"),
  v.literal("delete_frps"),
);

export const jobStatusValidator = v.union(
  v.literal("queued"),
  v.literal("leased"),
  v.literal("succeeded"),
  v.literal("failed"),
  v.literal("cancelled"),
);
