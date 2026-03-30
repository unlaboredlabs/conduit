import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "reap expired job leases",
  { minutes: 1 },
  internal.jobs.reapExpiredLeases,
  { limit: 50 },
);

crons.interval(
  "mark offline nodes",
  { minutes: 1 },
  internal.nodes.markOfflineNodes,
  { limit: 50 },
);

export default crons;
