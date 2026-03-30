export type EdgeNodeStatus = "online" | "offline";
export type FrpsDesiredState = "running" | "stopped" | "deleted";
export type FrpsRuntimeState =
  | "pending"
  | "running"
  | "stopped"
  | "error"
  | "deleting"
  | "deleted";
export type JobKind =
  | "provision_frps"
  | "start_frps"
  | "stop_frps"
  | "restart_frps"
  | "delete_frps";

export type JobStatus =
  | "queued"
  | "leased"
  | "succeeded"
  | "failed"
  | "cancelled";

export type EdgeNodeSummary = {
  _id: string;
  label: string;
  hostname: string;
  vultrInstanceId: string;
  region: string;
  status: EdgeNodeStatus;
  lastHeartbeatAt: number | null;
  agentVersion: string;
  dockerVersion: string | null;
  frpsCount: number;
  runningContainers: number;
};

export type RegistrationTokenSummary = {
  _id: string;
  label: string;
  tokenPreview: string;
  expiresAt: number;
  consumedAt: number | null;
  createdAt: number;
};

export type JobEventSummary = {
  _id: string;
  status: JobStatus;
  message: string;
  createdAt: number;
};

export type FrpsConnectionDetails = {
  serverAddr: string;
  bindPort: number;
  authToken: string;
  allowedPorts: string;
};

export type FrpsSummary = {
  _id: string;
  name: string;
  edgeNodeId: string;
  edgeNodeLabel: string;
  reservedIp: string;
  reservedIpId: string;
  bindPort: number;
  proxyPortStart: number;
  proxyPortEnd: number;
  desiredState: FrpsDesiredState;
  runtimeState: FrpsRuntimeState;
  containerName: string;
  authToken: string;
  image: string;
  lastError: string | null;
  proxyPortRange: string;
  createdAt: number;
  updatedAt: number;
  recentEvents: JobEventSummary[];
};

export type AgentJobPayload = {
  frpsId: string;
  name: string;
  containerName: string;
  reservedIp: string;
  bindPort: number;
  proxyPortStart: number;
  proxyPortEnd: number;
  authToken: string;
  image: string;
};

export type AgentJob = {
  _id: string;
  kind: JobKind;
  payload: AgentJobPayload;
  attemptCount: number;
};
