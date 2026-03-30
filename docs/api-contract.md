# Conduit API Contract

## Admin Auth

- `POST /api/auth/login`
  - Body: `{ "username": string, "password": string }`
  - Response: `{ "ok": true }`
- `POST /api/auth/logout`
  - Response: `{ "ok": true }`

All admin APIs also accept `Authorization: Bearer <CONDUIT_ADMIN_API_TOKEN>`.

## Admin Ops API

- `GET /api/nodes`
- `GET /api/nodes/:id`
- `GET /api/nodes/registration-tokens`
- `POST /api/nodes/registration-tokens`
  - Body: `{ "label": string, "ttlHours"?: number }`
- `GET /api/frps`
- `POST /api/frps`
  - Body: `{ "name": string, "edgeNodeId": string }`
- `GET /api/frps/:id`
- `DELETE /api/frps/:id`
- `POST /api/frps/:id/start`
- `POST /api/frps/:id/stop`
- `POST /api/frps/:id/restart`
- `POST /api/frps/:id/retry`

## Agent API

- `POST /api/agent/register`
  - Body: `{ "registrationToken": string, "label": string, "vultrInstanceId": string, "region": string, "hostname": string, "agentVersion": string, "dockerVersion": string | null }`
  - Response: `{ "nodeId": string, "agentToken": string }`
- `POST /api/agent/heartbeat`
  - Body: `{ "nodeId": string, "agentToken": string, "hostname": string, "agentVersion": string, "dockerVersion": string | null, "runningContainers": number }`
- `POST /api/agent/jobs/claim`
  - Body: `{ "nodeId": string, "agentToken": string }`
  - Response: `{ "job": AgentJob | null }`
- `POST /api/agent/jobs/:id/complete`
  - Body: `{ "nodeId": string, "agentToken": string, "status": "succeeded" | "failed", "message"?: string, "containerName"?: string }`

## Resource Shape Notes

- `EdgeNode.status`: `online` or `offline`
- `FrpsInstance.desiredState`: `running`, `stopped`, or `deleted`
- `FrpsInstance.runtimeState`: `pending`, `running`, `stopped`, `error`, `deleting`, or `deleted`
- `Job.kind`: `provision_frps`, `start_frps`, `stop_frps`, `restart_frps`, or `delete_frps`
