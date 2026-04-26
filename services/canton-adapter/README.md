# canton-adapter

Go service. Bridges the workflow stack and the Canton/Daml participant node.

The Daml spike at `daml/hydrax-governance/` defines the on-ledger contracts and is built independently with `daml build`. This Go bridge is what `workflow-svc` and `approval-svc` call to submit commands and consume events.

## Run locally

    go run ./cmd/server

Listens on `:7005` (override with `PORT`).

## Health

    curl -s http://localhost:7005/healthz
    # {"service":"canton-adapter","status":"ok"}

## Mock Testnet Surface

v1 ships an in-memory mock testnet behind a stable HTTP shape so the rest of the workflow stack can wire to "Canton" without the real participant + synchronizer (PRD-v2 §14 Q1, plan: `docs/plans/2026-04-26-mock-canton-testnet-and-rails.md`). The mock is **RAM-backed and resets on restart** — no persistence, no replication, no signature verification. When real Canton infra is approved the same HTTP shape stays and the in-memory ledger is swapped for a real participant client.

| Method | Path           | Purpose                                |
|--------|----------------|----------------------------------------|
| POST   | `/v1/parties`  | Allocate a party (hint-prefixed)       |
| GET    | `/v1/parties`  | List currently-allocated parties       |
| POST   | `/v1/commands` | Submit a `create` or `exercise`        |
| GET    | `/v1/events`   | Read the synchronizer event log        |

### Examples

Allocate a party:

    curl -sX POST http://localhost:7005/v1/parties \
      -H 'Content-Type: application/json' \
      -d '{"hint":"issuer-acme"}'
    # {"party":"issuer-acme::mock-a52971cc"}

List parties:

    curl -s http://localhost:7005/v1/parties
    # {"parties":["issuer-acme::mock-a52971cc"]}

Submit a create command (any JSON value is accepted as `payload_json`):

    curl -sX POST http://localhost:7005/v1/commands \
      -H 'Content-Type: application/json' \
      -d '{"kind":"create","template_id":"Daml.Hydrax:ProductCommitment","payload_json":{"sponsor":"issuer-acme"}}'
    # {"contract_id":"cid-c93dd932773670fa","offset":1}

Submit an exercise command:

    curl -sX POST http://localhost:7005/v1/commands \
      -H 'Content-Type: application/json' \
      -d '{"kind":"exercise","template_id":"Daml.Hydrax:ProductCommitment","contract_id":"cid-c93dd932773670fa","choice":"Approve","payload_json":{}}'
    # {"contract_id":"cid-c93dd932773670fa","offset":2}

Read the event log (long-poll style by `after` offset):

    curl -s 'http://localhost:7005/v1/events?after=0'
    # {"events":[{"offset":1,"kind":"create",...}],"next_offset":2}

Optional `party=<name>` filter applies a loose substring match against each event's `payload_json`. A real Canton adapter would filter on declared signatories/observers; the mock is intentionally lax.

### Error shape

All `4xx` responses use the same JSON envelope:

    {"error":"<code>","message":"<human readable>"}

Error codes returned by this surface:

| Code                  | When                                                                 |
|-----------------------|----------------------------------------------------------------------|
| `bad_json`            | Body did not parse as JSON                                           |
| `bad_hint`            | `POST /v1/parties` hint was empty                                    |
| `bad_kind`            | `POST /v1/commands` kind was not `create` or `exercise`              |
| `bad_command`         | `create` missing `template_id`, or `exercise` missing required field |
| `bad_after`           | `GET /v1/events?after=` was negative or non-integer                  |
| `method_not_allowed`  | Wrong HTTP method on a `/v1/*` route                                 |

### Swap-to-real path

Replace `internal/ledger.Ledger` (the in-memory state) with a participant-backed implementation that exposes the same exported method set: `AllocateParty`, `Parties`, `SubmitCreate`, `SubmitExercise`, `EventsAfter`. The handler layer (`internal/handlers/{parties,commands,events}.go`) takes only the `*ledger.Ledger` pointer and stays unchanged, so callers, request shapes, and response shapes are stable across the swap.

## Test

    go test ./...

## Deploy

Railway service `canton-adapter`. Build via Dockerfile (Daml tree is excluded from the Go build context).
