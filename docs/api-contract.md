# Conduit REST API

This document describes the REST API exposed by the Conduit controller.

Conduit has two API audiences:

- Admin clients that manage nodes, provisioning regions, and FRPS instances.
- Edge agents that register themselves, report liveness, claim work, and complete jobs.

## Base URL And Conventions

- Base path: `/api`
- Content type: JSON request and response bodies
- Success envelope:

```json
{
  "ok": true
}
```

- Error envelope:

```json
{
  "ok": false,
  "error": "Human-readable error message"
}
```

- All timestamps are Unix epoch milliseconds.
- All IDs are opaque Convex document IDs and must be treated as strings.
- Unsupported HTTP methods return `405 Method Not Allowed` through Next.js route handler behavior.
- List endpoints are not paginated today. They return bounded result sets with current server-side caps:
  - Nodes: up to 100
  - Registration tokens: up to 100
  - Provisioning regions: up to 100
  - FRPS instances: up to 200

## Authentication

### Admin Authentication

Admin endpoints use either of these mechanisms:

1. Session cookie created by `POST /api/auth/login`
2. Bearer token in the `Authorization` header

Bearer format:

```http
Authorization: Bearer <CONDUIT_ADMIN_API_TOKEN>
```

Behavior:

- Admin authorization checks the bearer token first.
- If the bearer token is not present or invalid, the server falls back to the admin session cookie.
- `POST /api/auth/logout` does not require an authenticated session. It simply clears the cookie if present.

Session cookie details:

- Cookie name: `conduit_session`
- JWT algorithm: `HS256`
- Subject: `admin`
- Role claim: `admin`
- Lifetime: 7 days
- `HttpOnly`: `true`
- `SameSite`: `lax`
- `Secure`: enabled in production
- Path: `/`

### Agent Authentication

Agent endpoints do not use headers or cookies. They authenticate with credentials sent in the JSON body:

```json
{
  "nodeId": "opaque-node-id",
  "agentToken": "opaque-agent-token"
}
```

The controller hashes the provided `agentToken` and matches it against the stored node credential.

## Operational Semantics

### Node Liveness

- A node is considered `online` if its last heartbeat is no older than 90 seconds.
- A background job runs every minute and marks stale nodes `offline`.

### Job Leasing

- Agent job claims lease a job for 60 seconds.
- Jobs default to `maxAttempts = 3`.
- A background job runs every minute and requeues expired leases until `maxAttempts` is reached.
- When lease expiry exceeds the retry limit, the job becomes `failed` and related FRPS state is moved to `error`.

### Provisioning Reservations

- `POST /api/frps/provision` reserves a target node inside the requested provisioning region before provisioning.
- Reservation TTL is 5 minutes.
- Reservations are released in a `finally` block after provisioning completes or fails.
- A background job also reaps expired reservations every minute.

### FRPS Lifecycle

FRPS operations are asynchronous:

- Create and region-provision endpoints create the database record and enqueue a `provision_frps` job.
- Start, stop, restart, retry, and delete endpoints enqueue jobs for the edge agent.
- `DELETE /api/frps/:id` queues deletion first. The reserved IP is removed only later, when the agent reports successful completion and the controller performs cleanup.

## Shared Types

### Enums

| Name | Values |
| --- | --- |
| `EdgeNode.status` | `online`, `offline` |
| `Frps.desiredState` | `running`, `stopped`, `deleted` |
| `Frps.runtimeState` | `pending`, `running`, `stopped`, `error`, `deleting`, `deleted` |
| `Job.kind` | `provision_frps`, `start_frps`, `stop_frps`, `restart_frps`, `delete_frps` |
| `Job.status` | `queued`, `leased`, `succeeded`, `failed`, `cancelled` |
| `PublicIp.status` | `allocated`, `attached`, `deleted`, `error` |

### EdgeNodeSummary

Returned by `GET /api/nodes`.

```json
{
  "_id": "string",
  "label": "string",
  "hostname": "string",
  "vultrInstanceId": "string",
  "region": "string",
  "provisioningRegionId": "string | null",
  "provisioningRegionName": "string | null",
  "status": "online | offline",
  "lastHeartbeatAt": "number | null",
  "agentVersion": "string",
  "dockerVersion": "string | null",
  "frpsCount": 0,
  "runningContainers": 0
}
```

Notes:

- `frpsCount` excludes FRPS instances already fully deleted.
- `agentVersion`, `dockerVersion`, `hostname`, and `runningContainers` prefer live presence data when available.

### EdgeNodeDetail

Returned by `GET /api/nodes/:id`.

```json
{
  "_id": "string",
  "label": "string",
  "hostname": "string",
  "vultrInstanceId": "string",
  "region": "string",
  "provisioningRegionId": "string | null",
  "provisioningRegionName": "string | null",
  "status": "online | offline",
  "lastHeartbeatAt": "number | null",
  "agentVersion": "string",
  "dockerVersion": "string | null",
  "frpsCount": 0,
  "runningContainers": 0,
  "frpsInstances": [
    {
      "_id": "string",
      "_creationTime": 0,
      "name": "string",
      "edgeNodeId": "string",
      "provisioningRegionId": "string | null",
      "publicIpId": "string",
      "reservedIpId": "string",
      "reservedIp": "string",
      "bindPort": 7000,
      "proxyPortStart": 1024,
      "proxyPortEnd": 49151,
      "authToken": "string",
      "desiredState": "running | stopped | deleted",
      "runtimeState": "pending | running | stopped | error | deleting | deleted",
      "containerName": "string",
      "image": "string",
      "lastError": "string | null",
      "createdAt": 0,
      "updatedAt": 0,
      "deletedAt": "number | null"
    }
  ]
}
```

Notes:

- `frpsInstances` is the raw `frpsInstances` table output, not the summarized FRPS shape used elsewhere.
- This list is not filtered. Fully deleted FRPS records can still appear here.

### RegistrationTokenSummary

Returned by `GET /api/nodes/registration-tokens`.

```json
{
  "_id": "string",
  "label": "string",
  "tokenPreview": "string",
  "expiresAt": 0,
  "createdAt": 0,
  "consumedAt": "number | null"
}
```

Notes:

- `tokenPreview` is only the leading preview, not the full registration secret.
- `consumedAt` is `null` until the token is exchanged by an agent.

### ProvisioningRegionSummary

Returned by `GET /api/provisioning-regions`.

```json
{
  "_id": "string",
  "name": "string",
  "slug": "string",
  "assignedNodeCount": 0,
  "onlineNodeCount": 0,
  "frpsCount": 0,
  "activeReservationCount": 0,
  "createdAt": 0,
  "updatedAt": 0
}
```

Notes:

- `frpsCount` excludes fully deleted FRPS instances.
- `activeReservationCount` counts non-expired provisioning reservations only.

### JobEventSummary

Embedded inside FRPS summaries.

```json
{
  "_id": "string",
  "status": "queued | leased | succeeded | failed | cancelled",
  "message": "string",
  "createdAt": 0
}
```

### FrpsSummary

Returned by `GET /api/frps`.

```json
{
  "_id": "string",
  "name": "string",
  "edgeNodeId": "string",
  "edgeNodeLabel": "string",
  "provisioningRegionId": "string | null",
  "provisioningRegionName": "string | null",
  "reservedIp": "string",
  "reservedIpId": "string",
  "bindPort": 7000,
  "proxyPortStart": 1024,
  "proxyPortEnd": 49151,
  "desiredState": "running | stopped | deleted",
  "runtimeState": "pending | running | stopped | error | deleting | deleted",
  "containerName": "string",
  "authToken": "string",
  "image": "string",
  "lastError": "string | null",
  "proxyPortRange": "1024-49151",
  "createdAt": 0,
  "updatedAt": 0,
  "recentEvents": []
}
```

Notes:

- `recentEvents` contains at most 5 entries, newest first.
- `GET /api/frps` filters out FRPS instances already fully deleted.

### FrpsDetail

Returned by `GET /api/frps/:id`.

```json
{
  "_id": "string",
  "name": "string",
  "edgeNodeId": "string",
  "edgeNodeLabel": "string",
  "provisioningRegionId": "string | null",
  "provisioningRegionName": "string | null",
  "reservedIp": "string",
  "reservedIpId": "string",
  "bindPort": 7000,
  "proxyPortStart": 1024,
  "proxyPortEnd": 49151,
  "desiredState": "running | stopped | deleted",
  "runtimeState": "pending | running | stopped | error | deleting | deleted",
  "containerName": "string",
  "authToken": "string",
  "image": "string",
  "lastError": "string | null",
  "proxyPortRange": "1024-49151",
  "createdAt": 0,
  "updatedAt": 0,
  "recentEvents": [],
  "publicIp": {
    "_id": "string",
    "_creationTime": 0,
    "reservedIpId": "string",
    "address": "string",
    "region": "string",
    "edgeNodeId": "string",
    "frpsInstanceId": "string | null",
    "status": "allocated | attached | deleted | error",
    "createdAt": 0,
    "updatedAt": 0
  }
}
```

### FrpsCreateResult

Returned by both FRPS creation endpoints.

```json
{
  "frpsId": "string",
  "edgeNodeId": "string",
  "edgeNodeLabel": "string",
  "provisioningRegionId": "string | null",
  "provisioningRegionName": "string | null",
  "connection": {
    "serverAddr": "string",
    "bindPort": 7000,
    "authToken": "string",
    "allowedPorts": "1024-49151"
  }
}
```

### AgentJob

Returned by `POST /api/agent/jobs/claim`.

```json
{
  "_id": "string",
  "kind": "provision_frps | start_frps | stop_frps | restart_frps | delete_frps",
  "payload": {
    "frpsId": "string",
    "name": "string",
    "containerName": "string",
    "reservedIp": "string",
    "bindPort": 7000,
    "proxyPortStart": 1024,
    "proxyPortEnd": 49151,
    "authToken": "string",
    "image": "string"
  },
  "attemptCount": 1
}
```

## Admin Endpoints

### `POST /api/auth/login`

Authenticate as an admin and create the session cookie.

- Auth: none
- Request body:

```json
{
  "username": "string",
  "password": "string"
}
```

- Success: `200 OK`

```json
{
  "ok": true
}
```

- Errors:
  - `400` if either field is missing or not a string
  - `401` if credentials do not match `CONDUIT_ADMIN_USERNAME` and `CONDUIT_ADMIN_PASSWORD`

### `POST /api/auth/logout`

Delete the admin session cookie.

- Auth: none
- Request body: none
- Success: `200 OK`

```json
{
  "ok": true
}
```

### `GET /api/nodes`

List edge nodes.

- Auth: admin session or admin bearer token
- Success: `200 OK`

```json
{
  "ok": true,
  "nodes": []
}
```

- Ordering: ascending by `label`
- Errors:
  - `401` if not authorized
  - `500` on internal failures

### `GET /api/nodes/:id`

Fetch one node and its FRPS records.

- Auth: admin session or admin bearer token
- Path params:
  - `id`: edge node ID
- Success: `200 OK`

```json
{
  "ok": true,
  "node": {}
}
```

- Errors:
  - `401` if not authorized
  - `404` if the node does not exist
  - `500` on internal failures

### `GET /api/nodes/registration-tokens`

List registration tokens used by edge agents.

- Auth: admin session or admin bearer token
- Success: `200 OK`

```json
{
  "ok": true,
  "registrationTokens": []
}
```

- Ordering: descending by `createdAt`
- Errors:
  - `401` if not authorized
  - `500` on internal failures

### `DELETE /api/nodes/registration-tokens/:id`

Delete a registration token.

- Auth: admin session or admin bearer token
- Path params:
  - `id`: registration token ID
- Success: `200 OK`

```json
{
  "ok": true,
  "deleted": true
}
```

- Notes:
  - this deletes the token record entirely
  - deleting a missing token currently surfaces as a generic server error response, not `404`

- Errors:
  - `401` if not authorized
  - `500` if the token does not exist or on other internal failures

### `POST /api/nodes/registration-tokens`

Create a single-use registration token for an edge agent.

- Auth: admin session or admin bearer token
- Request body:

```json
{
  "label": "string",
  "ttlHours": 24
}
```

- Request rules:
  - `label` is required, trimmed, and must be at least 2 characters
  - `ttlHours` is optional
  - if `ttlHours` is provided, it is clamped to the range `1..168`
  - default TTL is 24 hours

- Success: `201 Created`

```json
{
  "ok": true,
  "registrationToken": {
    "token": "string",
    "label": "string",
    "expiresAt": 0
  }
}
```

- Important:
  - The full token is only returned at creation time.
  - Later list calls only expose `tokenPreview`.

- Errors:
  - `400` for invalid `label`
  - `401` if not authorized
  - `500` on internal failures

### `GET /api/provisioning-regions`

List provisioning regions.

- Auth: admin session or admin bearer token
- Success: `200 OK`

```json
{
  "ok": true,
  "provisioningRegions": []
}
```

- Ordering: ascending by `name`
- Errors:
  - `401` if not authorized
  - `500` on internal failures

### `POST /api/provisioning-regions`

Create a provisioning region.

- Auth: admin session or admin bearer token
- Request body:

```json
{
  "name": "Amsterdam"
}
```

- Request rules:
  - `name` is required, trimmed, and must be at least 2 characters
  - the backend generates a lowercase slug from the name
  - the slug must be unique

- Success: `201 Created`

```json
{
  "ok": true,
  "provisioningRegionId": "string"
}
```

- Errors:
  - `400` for a missing or too-short `name`
  - `401` if not authorized
  - `500` for duplicate slugs or other backend validation failures

### `PATCH /api/provisioning-regions/:id`

Rename a provisioning region.

- Auth: admin session or admin bearer token
- Path params:
  - `id`: provisioning region ID
- Request body:

```json
{
  "name": "New Name"
}
```

- Request rules:
  - `name` is required, trimmed, and must be at least 2 characters
  - the new slug must remain unique

- Success: `200 OK`

```json
{
  "ok": true
}
```

- Errors:
  - `400` for a missing or too-short `name`
  - `401` if not authorized
  - `404` if the region does not exist
  - `500` for duplicate slugs or other backend validation failures

### `DELETE /api/provisioning-regions/:id`

Delete a provisioning region.

- Auth: admin session or admin bearer token
- Path params:
  - `id`: provisioning region ID
- Success: `200 OK`

```json
{
  "ok": true
}
```

- Deletion rules:
  - the region must exist
  - no edge nodes may still be assigned to it
  - no active FRPS instances may still reference it
  - expired or active reservations for the region are removed during deletion

- Errors:
  - `401` if not authorized
  - `404` if the region does not exist
  - `409` if nodes are still assigned to the region
  - `409` if active FRPS instances still belong to the region
  - `500` on other internal failures

### `POST /api/provisioning-regions/:id/nodes`

Assign an edge node to a provisioning region.

- Auth: admin session or admin bearer token
- Path params:
  - `id`: provisioning region ID
- Request body:

```json
{
  "nodeId": "string"
}
```

- Success: `200 OK`

```json
{
  "ok": true
}
```

- Side effects:
  - the node's `provisioningRegionId` is updated
  - any active FRPS instance already on that node and still missing a `provisioningRegionId` is patched to the same region

- Errors:
  - `400` if `nodeId` is missing or not a string
  - `401` if not authorized
  - `500` if the region or node does not exist, or on other internal failures

### `DELETE /api/provisioning-regions/:id/nodes/:nodeId`

Unassign an edge node from a provisioning region.

- Auth: admin session or admin bearer token
- Path params:
  - `id`: provisioning region ID
  - `nodeId`: edge node ID
- Success: `200 OK`

```json
{
  "ok": true
}
```

- Side effects:
  - only the node assignment is cleared
  - FRPS instances already associated with the region are not rewritten

- Errors:
  - `401` if not authorized
  - `500` if the node does not exist, is not assigned to that region, or on other internal failures

### `GET /api/frps`

List active FRPS instances.

- Auth: admin session or admin bearer token
- Success: `200 OK`

```json
{
  "ok": true,
  "frps": []
}
```

- Ordering: descending by `createdAt`
- Filtering: excludes instances whose `desiredState` and `runtimeState` are both `deleted`
- Errors:
  - `401` if not authorized
  - `500` on internal failures

### `POST /api/frps`

Provision a new FRPS instance on a specific edge node.

- Auth: admin session or admin bearer token
- Request body:

```json
{
  "name": "string",
  "edgeNodeId": "string"
}
```

- Request rules:
  - `name` is required, trimmed, and must be at least 2 characters
  - `edgeNodeId` is required
  - the target node must exist
  - the target node must currently be `online`

- Success: `201 Created`

```json
{
  "ok": true,
  "frpsId": "string",
  "edgeNodeId": "string",
  "edgeNodeLabel": "string",
  "provisioningRegionId": "string | null",
  "provisioningRegionName": "string | null",
  "connection": {
    "serverAddr": "string",
    "bindPort": 7000,
    "authToken": "string",
    "allowedPorts": "1024-49151"
  }
}
```

- Side effects:
  - allocates a Vultr reserved IPv4 in the node's provider region
  - attaches that IP to the target Vultr instance
  - creates `publicIps` and `frpsInstances` records
  - creates a `provision_frps` job for the node
  - initializes FRPS state as `desiredState=running` and `runtimeState=pending`

- Failure handling:
  - if Conduit fails after creating the FRPS record, it rolls back the FRPS record and deletes the reserved IP when possible

- Errors:
  - `400` for invalid request payload
  - `401` if not authorized
  - `500` if the node is missing, offline, or provider/database work fails

### `POST /api/frps/provision`

Provision a new FRPS instance by choosing a node from a provisioning region.

- Auth: admin session or admin bearer token
- Request body:

```json
{
  "name": "string",
  "provisioningRegionId": "string"
}
```

- Request rules:
  - `name` is required, trimmed, and must be at least 2 characters
  - `provisioningRegionId` is required

- Node selection rules:
  - only nodes assigned to the region and currently `online` are eligible
  - the controller computes `effectiveLoad = activeFrpsCount + activeReservationCount`
  - the lowest effective load wins
  - ties are broken by node label, then node ID

- Success: `201 Created`

```json
{
  "ok": true,
  "frpsId": "string",
  "edgeNodeId": "string",
  "edgeNodeLabel": "string",
  "provisioningRegionId": "string",
  "provisioningRegionName": "string",
  "connection": {
    "serverAddr": "string",
    "bindPort": 7000,
    "authToken": "string",
    "allowedPorts": "1024-49151"
  }
}
```

- Side effects:
  - creates a temporary provisioning reservation before provisioning
  - otherwise behaves like `POST /api/frps`

- Errors:
  - `400` for invalid request payload
  - `401` if not authorized
  - `404` if the provisioning region does not exist
  - `409` if no online nodes are assigned to the region
  - `500` on other provisioning failures

### `GET /api/frps/:id`

Fetch one FRPS instance and its linked public IP record.

- Auth: admin session or admin bearer token
- Path params:
  - `id`: FRPS instance ID
- Success: `200 OK`

```json
{
  "ok": true,
  "frps": {}
}
```

- Errors:
  - `401` if not authorized
  - `404` if the FRPS instance does not exist
  - `500` on internal failures

### `DELETE /api/frps/:id`

Queue FRPS deletion.

- Auth: admin session or admin bearer token
- Path params:
  - `id`: FRPS instance ID
- Success: `200 OK`

```json
{
  "ok": true
}
```

- Side effects:
  - sets FRPS state to `desiredState=deleted` and `runtimeState=deleting`
  - clears `lastError`
  - enqueues a `delete_frps` job for the edge node
  - actual reserved IP deletion happens later when the agent reports success and the controller finishes cleanup

- Errors:
  - `401` if not authorized
  - `500` if the FRPS instance is missing or on other internal failures

### `POST /api/frps/:id/start`

Queue an FRPS start action.

- Auth: admin session or admin bearer token
- Path params:
  - `id`: FRPS instance ID
- Success: `200 OK`

```json
{
  "ok": true
}
```

- Side effects:
  - sets FRPS state to `desiredState=running` and `runtimeState=pending`
  - enqueues a `start_frps` job

- Errors:
  - `401` if not authorized
  - `500` if the FRPS instance is missing or on other internal failures

### `POST /api/frps/:id/stop`

Queue an FRPS stop action.

- Auth: admin session or admin bearer token
- Path params:
  - `id`: FRPS instance ID
- Success: `200 OK`

```json
{
  "ok": true
}
```

- Side effects:
  - sets FRPS state to `desiredState=stopped` and `runtimeState=pending`
  - enqueues a `stop_frps` job

- Errors:
  - `401` if not authorized
  - `500` if the FRPS instance is missing or on other internal failures

### `POST /api/frps/:id/restart`

Queue an FRPS restart action.

- Auth: admin session or admin bearer token
- Path params:
  - `id`: FRPS instance ID
- Success: `200 OK`

```json
{
  "ok": true
}
```

- Side effects:
  - sets FRPS state to `desiredState=running` and `runtimeState=pending`
  - enqueues a `restart_frps` job

- Errors:
  - `401` if not authorized
  - `500` if the FRPS instance is missing or on other internal failures

### `POST /api/frps/:id/retry`

Retry the most appropriate FRPS action based on current desired state.

- Auth: admin session or admin bearer token
- Path params:
  - `id`: FRPS instance ID
- Success: `200 OK`

```json
{
  "ok": true
}
```

- Retry mapping:
  - if `desiredState` is `deleted`, queues `delete_frps` and sets `runtimeState=deleting`
  - if `desiredState` is `stopped`, queues `stop_frps` and sets `runtimeState=pending`
  - otherwise queues `provision_frps` and sets `desiredState=running`, `runtimeState=pending`

- Errors:
  - `401` if not authorized
  - `500` if the FRPS instance is missing or on other internal failures

## Agent Endpoints

### `POST /api/agent/register`

Exchange a registration token for a persistent node identity and agent token.

- Auth: none before registration
- Request body:

```json
{
  "registrationToken": "string",
  "label": "string",
  "hostname": "string",
  "vultrInstanceId": "string",
  "region": "string",
  "agentVersion": "string",
  "dockerVersion": "string | null"
}
```

- Required fields:
  - `registrationToken`
  - `label`
  - `hostname`
  - `vultrInstanceId`
  - `region`
  - `agentVersion`

- Success: `201 Created`

```json
{
  "ok": true,
  "nodeId": "string",
  "agentToken": "string"
}
```

- Behavior:
  - validates that the registration token exists, is unused, and is not expired
  - if a node with the same `vultrInstanceId` already exists, Conduit updates that node instead of creating a duplicate
  - rotates the node's stored agent credential to the newly issued `agentToken`
  - marks the node online immediately and initializes `runningContainers` to `0`
  - consumes the registration token

- Errors:
  - `400` for invalid payload shape
  - `400` for invalid, expired, or already-consumed registration tokens
  - `400` on other backend registration failures

### `POST /api/agent/heartbeat`

Record node liveness and runtime metadata.

- Auth: `nodeId` and `agentToken` in body
- Request body:

```json
{
  "nodeId": "string",
  "agentToken": "string",
  "hostname": "string",
  "agentVersion": "string",
  "dockerVersion": "string | null",
  "runningContainers": 0
}
```

- Success: `200 OK`

```json
{
  "ok": true
}
```

- Behavior:
  - validates the node credential
  - upserts presence data
  - sets node status to `online`
  - updates node metadata fields such as hostname and version

- Errors:
  - `400` for invalid payload shape
  - `401` for invalid node credentials
  - `500` on internal failures

### `POST /api/agent/jobs/claim`

Claim one queued job assigned to the node.

- Auth: `nodeId` and `agentToken` in body
- Request body:

```json
{
  "nodeId": "string",
  "agentToken": "string"
}
```

- Success: `200 OK`

```json
{
  "ok": true,
  "job": {}
}
```

The `job` field is either an `AgentJob` object or `null`.

- Behavior:
  - validates the node credential
  - if a queued job exists, marks it `leased`
  - increments `attemptCount`
  - sets the lease expiry to 60 seconds from claim time

- Errors:
  - `400` for invalid payload shape
  - `401` for invalid node credentials
  - `500` on internal failures

### `POST /api/agent/jobs/:id/complete`

Complete a claimed job.

- Auth: `nodeId` and `agentToken` in body
- Path params:
  - `id`: job ID
- Request body:

```json
{
  "nodeId": "string",
  "agentToken": "string",
  "status": "succeeded | failed",
  "message": "string",
  "containerName": "string"
}
```

- Required fields:
  - `nodeId`
  - `agentToken`
  - `status`

- Success: `200 OK`

```json
{
  "ok": true
}
```

- Authorization rules:
  - the node credentials must be valid
  - the job must exist
  - the job's `targetNodeId` must match the caller's `nodeId`

- Completion behavior:
  - all completions append a job event
  - on `failed`, the related FRPS instance moves to `runtimeState=error` and records `lastError`
  - on successful `stop_frps`, the FRPS instance becomes `desiredState=stopped` and `runtimeState=stopped`
  - on successful `delete_frps`, the FRPS instance and linked public IP are marked deleted
  - on successful `provision_frps`, `start_frps`, or `restart_frps`, the FRPS instance becomes `desiredState=running` and `runtimeState=running`
  - if `containerName` is supplied on a successful non-delete job, it replaces the stored FRPS container name

- Delete-specific cleanup:
  - before the job is marked successful, the controller deletes the provider reserved IP
  - if that cleanup fails, the controller records the job as failed and returns `500`

- Errors:
  - `400` for invalid payload shape
  - `401` for invalid node credentials
  - `403` if the job is not assigned to the caller node
  - `404` if the job does not exist
  - `500` on cleanup or other internal failures

## Example Flows

### Admin Login Then List Nodes

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "secret"
}
```

Then call:

```http
GET /api/nodes
Cookie: conduit_session=<jwt>
```

### Bearer-Protected Admin Call

```http
GET /api/frps
Authorization: Bearer <CONDUIT_ADMIN_API_TOKEN>
```

### Agent Bootstrap

1. Admin creates a registration token with `POST /api/nodes/registration-tokens`.
2. Agent calls `POST /api/agent/register` with that token.
3. Agent stores the returned `nodeId` and `agentToken`.
4. Agent sends periodic `POST /api/agent/heartbeat`.
5. Agent polls `POST /api/agent/jobs/claim`.
6. Agent reports job results through `POST /api/agent/jobs/:id/complete`.
