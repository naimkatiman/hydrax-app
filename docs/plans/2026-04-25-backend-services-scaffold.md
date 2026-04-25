# Backend Services Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Ralph-loop compatible:** Each task is self-contained, has a clear DOD, and ends in a commit. Iterations are bounded; no task spans more than one commit.

**Goal:** Stand up the eight backend service skeletons (5 Go, 3 Node/TS) under `services/` with health endpoints, tests, Dockerfiles, and per-service READMEs — so the workflow stack has a deployable surface to grow into without touching prototype code.

**Architecture:** Each service is an independently buildable, independently deployable HTTP server exposing `/healthz` and a service-stub package showing where domain logic lands. Go services use `net/http` stdlib (no framework deps yet). Node services use `node:http` stdlib + TypeScript via `tsx` for dev / `tsc` for build (no runtime framework deps yet). pnpm workspace ties the Node services together; `go.work` ties the Go services together. Canton-adapter's existing Daml spike at `services/canton-adapter/daml/` is preserved untouched — the Go bridge lives alongside it under `services/canton-adapter/cmd/` + `internal/`.

**Tech Stack:**
- Go 1.22+ (stdlib `net/http`, `testing`)
- Node.js 20+ + TypeScript 5+ (stdlib `node:http`, `vitest`, `tsx`, pnpm workspace)
- Docker (multi-stage builds, distroless final image for Go; node:20-slim for TS)
- Railway NIXPACKS deploy target (one service per binary/app)

**Module path convention:** `github.com/naimkatiman/hydrax-app/services/<svc>` for Go.
**TS package name convention:** `@hydrax/<svc>` for Node services.

**Ports (loopback dev):**
| Service | Port | Lang |
|---|---|---|
| workflow-svc | 7001 | Go |
| approval-svc | 7002 | Go |
| audit-svc | 7003 | Go |
| hydrax-adapter | 7004 | Go |
| canton-adapter | 7005 | Go |
| notify-svc | 7101 | Node/TS |
| integration-svc | 7102 | Node/TS |
| bff | 7103 | Node/TS |

**Constraints (from CLAUDE.md):**
- ≤15 files per commit (each service is one commit; foundation is one commit)
- One concern per commit; lead with outcome in commit message
- TDD: failing test → implementation → passing test → commit
- No new runtime deps without flagging; only `typescript`, `tsx`, `vitest`, `@types/node` as TS devDeps
- No emoji anywhere; lucide icons only in UI (this plan ships zero UI)
- STATE.yaml `verification_log` updated after each service ships
- Verification gate per service: `go vet ./... && go test ./...` (Go) or `pnpm -F <svc> typecheck && pnpm -F <svc> test && pnpm -F <svc> build` (TS)

---

## File Structure (created across the plan)

```
hydrax-app/
  go.work                                  # NEW — multi-module workspace
  pnpm-workspace.yaml                      # NEW — Node workspace root
  package.json                             # MODIFIED — add workspaces field, devDeps
  tsconfig.base.json                       # NEW — shared TS config
  .gitignore                               # MODIFIED — add bin/, dist/, *.log
  docs/env.md                              # MODIFIED — document new vars
  services/
    workflow-svc/                          # Task 1
      cmd/server/main.go
      internal/workflow/workflow.go
      internal/handlers/health.go
      internal/handlers/health_test.go
      go.mod
      Dockerfile
      README.md
    approval-svc/                          # Task 2
      cmd/server/main.go
      internal/approvals/approvals.go
      internal/handlers/health.go
      internal/handlers/health_test.go
      go.mod
      Dockerfile
      README.md
    audit-svc/                             # Task 3
      cmd/server/main.go
      internal/audit/audit.go
      internal/handlers/health.go
      internal/handlers/health_test.go
      go.mod
      Dockerfile
      README.md
    hydrax-adapter/                        # Task 4 — mock-behind-interface
      cmd/server/main.go
      internal/hydraxrails/rails.go        # interface + MockRails impl
      internal/hydraxrails/rails_test.go
      internal/handlers/health.go
      internal/handlers/health_test.go
      go.mod
      Dockerfile
      README.md
    canton-adapter/                        # Task 5 — Go bridge alongside existing daml/
      cmd/server/main.go
      internal/canton/canton.go            # Daml command/event stub
      internal/handlers/health.go
      internal/handlers/health_test.go
      go.mod
      Dockerfile
      README.md
      daml/hydrax-governance/              # PRESERVED untouched
    notify-svc/                            # Task 6
      src/server.ts
      src/server.test.ts
      src/notify/notify.ts
      package.json
      tsconfig.json
      Dockerfile
      README.md
    integration-svc/                       # Task 7
      src/server.ts
      src/server.test.ts
      src/integrations/integrations.ts
      package.json
      tsconfig.json
      Dockerfile
      README.md
    bff/                                   # Task 8
      src/server.ts
      src/server.test.ts
      src/bff/bff.ts
      package.json
      tsconfig.json
      Dockerfile
      README.md
```

---

## Task 0: Foundation (workspace files + tsconfig + gitignore)

**Files:**
- Create: `go.work`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Modify: `package.json` (add devDependencies: `typescript`, `tsx`, `vitest`, `@types/node`)
- Modify: `.gitignore` (add Go + TS build artifacts)

- [ ] **Step 1: Create `go.work` referencing all five Go service modules**

```go
go 1.22

use (
	./services/workflow-svc
	./services/approval-svc
	./services/audit-svc
	./services/hydrax-adapter
	./services/canton-adapter
)
```

- [ ] **Step 2: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - 'services/notify-svc'
  - 'services/integration-svc'
  - 'services/bff'
```

- [ ] **Step 3: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "resolveJsonModule": true,
    "types": ["node"]
  }
}
```

- [ ] **Step 4: Modify `package.json` — add `devDependencies` and `engines.pnpm`**

Replace the file with:

```json
{
  "name": "hydrax-app",
  "version": "0.1.0",
  "private": true,
  "description": "HydraX institutional workflow platform — prototype + services workspace.",
  "scripts": {
    "start": "serve -s . -l tcp://0.0.0.0:${PORT:-3000} --no-clipboard",
    "typecheck": "pnpm -r typecheck",
    "test": "pnpm -r test",
    "build:services": "pnpm -r build"
  },
  "dependencies": {
    "serve": "^14.2.4"
  },
  "devDependencies": {
    "@types/node": "^20.12.0",
    "tsx": "^4.7.0",
    "typescript": "^5.4.0",
    "vitest": "^1.5.0"
  },
  "engines": {
    "node": ">=20",
    "pnpm": ">=9"
  },
  "packageManager": "pnpm@9.0.0"
}
```

Note: `start` script remains so Railway prototype deploy at `hydrax-prototype-production.up.railway.app` keeps working unchanged.

- [ ] **Step 5: Modify `.gitignore`**

Append to existing file:

```
# Go
bin/
*.test
*.out

# TypeScript / Node services
dist/
*.tsbuildinfo
.vite/
coverage/
```

- [ ] **Step 6: Verify foundation**

Run:
```bash
cd /home/naim/.openclaw/workspace/hydrax-app
pnpm install
node --check app.js   # prototype must still parse
test -f go.work && echo "go.work present"
test -f pnpm-workspace.yaml && echo "workspace present"
```

Expected: `pnpm install` succeeds, `node --check` passes, both files present.

- [ ] **Step 7: Commit**

```bash
git add go.work pnpm-workspace.yaml tsconfig.base.json package.json .gitignore
git commit -m "feat(services): scaffold Go + Node workspaces for backend services"
```

---

## Task 1: workflow-svc (Go, port 7001)

**Files:**
- Create: `services/workflow-svc/go.mod`
- Create: `services/workflow-svc/cmd/server/main.go`
- Create: `services/workflow-svc/internal/handlers/health.go`
- Create: `services/workflow-svc/internal/handlers/health_test.go`
- Create: `services/workflow-svc/internal/workflow/workflow.go`
- Create: `services/workflow-svc/Dockerfile`
- Create: `services/workflow-svc/README.md`

- [ ] **Step 1: Write the failing health handler test**

Create `services/workflow-svc/internal/handlers/health_test.go`:

```go
package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHealthHandler_ReturnsOK(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	rec := httptest.NewRecorder()

	Health("workflow-svc")(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d, want %d", rec.Code, http.StatusOK)
	}

	var body map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body["service"] != "workflow-svc" {
		t.Fatalf("service: got %q, want %q", body["service"], "workflow-svc")
	}
	if body["status"] != "ok" {
		t.Fatalf("status field: got %q, want %q", body["status"], "ok")
	}
}
```

- [ ] **Step 2: Create `go.mod`**

```
module github.com/naimkatiman/hydrax-app/services/workflow-svc

go 1.22
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd services/workflow-svc && go test ./...`
Expected: FAIL — `Health` undefined.

- [ ] **Step 4: Implement minimal handler in `internal/handlers/health.go`**

```go
package handlers

import (
	"encoding/json"
	"net/http"
)

// Health returns a handler that reports the service as healthy.
// Service name is captured at construction time so the response body
// identifies which binary answered.
func Health(service string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"service": service,
			"status":  "ok",
		})
	}
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd services/workflow-svc && go test ./...`
Expected: PASS — `ok  .../internal/handlers`.

- [ ] **Step 6: Create the workflow stub package `internal/workflow/workflow.go`**

```go
// Package workflow holds workflow-orchestration domain logic.
// Today this file declares the public surface only; concrete state
// machines land in follow-up tasks once the first product template is chosen
// (PRD-v2 §14 Q3).
package workflow

// Definition identifies a workflow template (e.g., "subscription.v1").
type Definition struct {
	ID      string
	Name    string
	Version string
}

// State is the runtime status of a workflow instance.
type State string

const (
	StatePending  State = "pending"
	StateRunning  State = "running"
	StateBlocked  State = "blocked"
	StateComplete State = "complete"
	StateFailed   State = "failed"
)
```

- [ ] **Step 7: Wire `cmd/server/main.go`**

```go
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/naimkatiman/hydrax-app/services/workflow-svc/internal/handlers"
)

const serviceName = "workflow-svc"

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "7001"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", handlers.Health(serviceName))

	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		log.Printf("%s listening on :%s", serviceName, port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("listen: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("shutdown: %v", err)
	}
}
```

- [ ] **Step 8: Create `Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1.7

FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/server /server
EXPOSE 7001
USER nonroot:nonroot
ENTRYPOINT ["/server"]
```

- [ ] **Step 9: Create `README.md`**

```markdown
# workflow-svc

Go service. Owns workflow orchestration, state machines, SLA tracking.

## Run locally

    go run ./cmd/server

Listens on `:7001` (override with `PORT`).

## Health

    curl -s http://localhost:7001/healthz
    # {"service":"workflow-svc","status":"ok"}

## Test

    go test ./...

## Deploy

Railway service `workflow-svc`. Build via Dockerfile.
```

- [ ] **Step 10: Verify**

Run:
```bash
cd /home/naim/.openclaw/workspace/hydrax-app/services/workflow-svc
go vet ./...
go test ./...
go build -o /tmp/workflow-svc ./cmd/server
```
Expected: vet clean, tests pass, binary builds.

- [ ] **Step 11: Commit**

```bash
git add services/workflow-svc go.work
git commit -m "feat(workflow-svc): scaffold workflow orchestration service with health endpoint"
```

---

## Task 2: approval-svc (Go, port 7002)

**Files:**
- Create: `services/approval-svc/go.mod`
- Create: `services/approval-svc/cmd/server/main.go`
- Create: `services/approval-svc/internal/handlers/health.go`
- Create: `services/approval-svc/internal/handlers/health_test.go`
- Create: `services/approval-svc/internal/approvals/approvals.go`
- Create: `services/approval-svc/Dockerfile`
- Create: `services/approval-svc/README.md`

- [ ] **Step 1: Write the failing health test**

Create `services/approval-svc/internal/handlers/health_test.go` — same shape as Task 1 Step 1, but assert `service == "approval-svc"`:

```go
package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHealthHandler_ReturnsOK(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	rec := httptest.NewRecorder()

	Health("approval-svc")(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d, want %d", rec.Code, http.StatusOK)
	}

	var body map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body["service"] != "approval-svc" {
		t.Fatalf("service: got %q, want %q", body["service"], "approval-svc")
	}
	if body["status"] != "ok" {
		t.Fatalf("status field: got %q, want %q", body["status"], "ok")
	}
}
```

- [ ] **Step 2: Create `go.mod`**

```
module github.com/naimkatiman/hydrax-app/services/approval-svc

go 1.22
```

- [ ] **Step 3: Run test — confirm FAIL (`Health` undefined)**

Run: `cd services/approval-svc && go test ./...`

- [ ] **Step 4: Implement `internal/handlers/health.go`**

```go
package handlers

import (
	"encoding/json"
	"net/http"
)

func Health(service string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"service": service,
			"status":  "ok",
		})
	}
}
```

- [ ] **Step 5: Run test — confirm PASS**

- [ ] **Step 6: Create `internal/approvals/approvals.go`**

```go
// Package approvals owns approval-chain definitions and runtime state.
// Concrete chain types land alongside the first product template (PRD-v2 §14 Q3).
package approvals

// Decision is the outcome of a single approver's vote.
type Decision string

const (
	DecisionPending  Decision = "pending"
	DecisionApproved Decision = "approved"
	DecisionRejected Decision = "rejected"
	DecisionEscalated Decision = "escalated"
)

// Step is a single rung in an approval chain.
type Step struct {
	ID         string
	ApproverID string
	Decision   Decision
}
```

- [ ] **Step 7: Create `cmd/server/main.go`**

Same shape as Task 1 Step 7, but with `serviceName = "approval-svc"`, default `PORT = "7002"`, and import path `github.com/naimkatiman/hydrax-app/services/approval-svc/internal/handlers`:

```go
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/naimkatiman/hydrax-app/services/approval-svc/internal/handlers"
)

const serviceName = "approval-svc"

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "7002"
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", handlers.Health(serviceName))
	srv := &http.Server{Addr: ":" + port, Handler: mux, ReadHeaderTimeout: 5 * time.Second}
	go func() {
		log.Printf("%s listening on :%s", serviceName, port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("listen: %v", err)
		}
	}()
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("shutdown: %v", err)
	}
}
```

- [ ] **Step 8: Create `Dockerfile`** — same as Task 1 Step 8 but `EXPOSE 7002`.

```dockerfile
# syntax=docker/dockerfile:1.7

FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/server /server
EXPOSE 7002
USER nonroot:nonroot
ENTRYPOINT ["/server"]
```

- [ ] **Step 9: Create `README.md`**

```markdown
# approval-svc

Go service. Owns approval chains and escalations.

## Run locally

    go run ./cmd/server

Listens on `:7002` (override with `PORT`).

## Health

    curl -s http://localhost:7002/healthz
    # {"service":"approval-svc","status":"ok"}

## Test

    go test ./...

## Deploy

Railway service `approval-svc`. Build via Dockerfile.
```

- [ ] **Step 10: Verify**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app/services/approval-svc
go vet ./...
go test ./...
go build -o /tmp/approval-svc ./cmd/server
```
Expected: clean, pass, build.

- [ ] **Step 11: Commit**

```bash
git add services/approval-svc
git commit -m "feat(approval-svc): scaffold approval-chain service with health endpoint"
```

---

## Task 3: audit-svc (Go, port 7003)

**Files:**
- Create: `services/audit-svc/go.mod`
- Create: `services/audit-svc/cmd/server/main.go`
- Create: `services/audit-svc/internal/handlers/health.go`
- Create: `services/audit-svc/internal/handlers/health_test.go`
- Create: `services/audit-svc/internal/audit/audit.go`
- Create: `services/audit-svc/Dockerfile`
- Create: `services/audit-svc/README.md`

- [ ] **Step 1: Write the failing health test**

Create `services/audit-svc/internal/handlers/health_test.go` (assert `service == "audit-svc"`):

```go
package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHealthHandler_ReturnsOK(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	rec := httptest.NewRecorder()

	Health("audit-svc")(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d, want %d", rec.Code, http.StatusOK)
	}
	var body map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body["service"] != "audit-svc" {
		t.Fatalf("service: got %q, want %q", body["service"], "audit-svc")
	}
	if body["status"] != "ok" {
		t.Fatalf("status field: got %q, want %q", body["status"], "ok")
	}
}
```

- [ ] **Step 2: Create `go.mod`**

```
module github.com/naimkatiman/hydrax-app/services/audit-svc

go 1.22
```

- [ ] **Step 3: Run test — confirm FAIL.**

- [ ] **Step 4: Implement `internal/handlers/health.go`** (identical body to Task 1 Step 4).

```go
package handlers

import (
	"encoding/json"
	"net/http"
)

func Health(service string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"service": service,
			"status":  "ok",
		})
	}
}
```

- [ ] **Step 5: Run test — confirm PASS.**

- [ ] **Step 6: Create `internal/audit/audit.go`**

```go
// Package audit holds the immutable action-log domain model.
// Append-only log entries land here; persistence backend (Postgres) wires
// in a follow-up once schema is finalized.
package audit

import "time"

// Event is one row in the audit log.
// All fields are immutable post-write; updates create new entries.
type Event struct {
	ID         string
	TenantID   string
	ActorID    string
	Action     string
	TargetType string
	TargetID   string
	OccurredAt time.Time
	Metadata   map[string]any
}
```

- [ ] **Step 7: Create `cmd/server/main.go`**

```go
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/naimkatiman/hydrax-app/services/audit-svc/internal/handlers"
)

const serviceName = "audit-svc"

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "7003"
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", handlers.Health(serviceName))
	srv := &http.Server{Addr: ":" + port, Handler: mux, ReadHeaderTimeout: 5 * time.Second}
	go func() {
		log.Printf("%s listening on :%s", serviceName, port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("listen: %v", err)
		}
	}()
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("shutdown: %v", err)
	}
}
```

- [ ] **Step 8: Create `Dockerfile`** (same as Task 1, `EXPOSE 7003`).

```dockerfile
# syntax=docker/dockerfile:1.7

FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/server /server
EXPOSE 7003
USER nonroot:nonroot
ENTRYPOINT ["/server"]
```

- [ ] **Step 9: Create `README.md`**

```markdown
# audit-svc

Go service. Owns the immutable action log and evidence trail.

## Run locally

    go run ./cmd/server

Listens on `:7003` (override with `PORT`).

## Health

    curl -s http://localhost:7003/healthz
    # {"service":"audit-svc","status":"ok"}

## Test

    go test ./...

## Deploy

Railway service `audit-svc`. Build via Dockerfile.
```

- [ ] **Step 10: Verify**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app/services/audit-svc
go vet ./... && go test ./... && go build -o /tmp/audit-svc ./cmd/server
```

- [ ] **Step 11: Commit**

```bash
git add services/audit-svc
git commit -m "feat(audit-svc): scaffold action-log service with health endpoint"
```

---

## Task 4: hydrax-adapter (Go, port 7004) — mock behind interface

Per Decision **2026-04-25** in CLAUDE.md, this service ships as a mock behind a stable interface so the workflow stack can build against it without waiting on HydraX engagement.

**Files:**
- Create: `services/hydrax-adapter/go.mod`
- Create: `services/hydrax-adapter/cmd/server/main.go`
- Create: `services/hydrax-adapter/internal/handlers/health.go`
- Create: `services/hydrax-adapter/internal/handlers/health_test.go`
- Create: `services/hydrax-adapter/internal/hydraxrails/rails.go`
- Create: `services/hydrax-adapter/internal/hydraxrails/rails_test.go`
- Create: `services/hydrax-adapter/Dockerfile`
- Create: `services/hydrax-adapter/README.md`

- [ ] **Step 1: Write failing health test**

Create `services/hydrax-adapter/internal/handlers/health_test.go`:

```go
package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHealthHandler_ReturnsOK(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	rec := httptest.NewRecorder()
	Health("hydrax-adapter")(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d, want %d", rec.Code, http.StatusOK)
	}
	var body map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body["service"] != "hydrax-adapter" || body["status"] != "ok" {
		t.Fatalf("body: %#v", body)
	}
}
```

- [ ] **Step 2: Create `go.mod`**

```
module github.com/naimkatiman/hydrax-app/services/hydrax-adapter

go 1.22
```

- [ ] **Step 3: Run test — confirm FAIL.**

- [ ] **Step 4: Implement `internal/handlers/health.go`** (identical body to Task 1 Step 4).

```go
package handlers

import (
	"encoding/json"
	"net/http"
)

func Health(service string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"service": service,
			"status":  "ok",
		})
	}
}
```

- [ ] **Step 5: Run test — confirm PASS.**

- [ ] **Step 6: Write failing rails test `internal/hydraxrails/rails_test.go`**

```go
package hydraxrails

import (
	"context"
	"testing"
)

func TestMockRails_IssueProduct_ReturnsDeterministicID(t *testing.T) {
	r := NewMockRails()
	ctx := context.Background()

	got, err := r.IssueProduct(ctx, IssueRequest{TenantID: "t1", ProductCode: "MMF-USD"})
	if err != nil {
		t.Fatalf("IssueProduct: %v", err)
	}
	if got.ProductID == "" {
		t.Fatalf("ProductID empty")
	}

	again, err := r.IssueProduct(ctx, IssueRequest{TenantID: "t1", ProductCode: "MMF-USD"})
	if err != nil {
		t.Fatalf("IssueProduct(again): %v", err)
	}
	if got.ProductID == again.ProductID {
		t.Fatalf("expected new ID per call, got %q twice", got.ProductID)
	}
}

func TestMockRails_IssueProduct_RejectsEmptyTenant(t *testing.T) {
	r := NewMockRails()
	_, err := r.IssueProduct(context.Background(), IssueRequest{ProductCode: "X"})
	if err == nil {
		t.Fatal("expected error on empty TenantID")
	}
}
```

- [ ] **Step 7: Run test — confirm FAIL (`NewMockRails` undefined).**

- [ ] **Step 8: Implement `internal/hydraxrails/rails.go`**

```go
// Package hydraxrails defines the workflow-layer interface to HydraX
// tokenisation, custody, and trading rails. Per CLAUDE.md decision
// 2026-04-25, v1 ships MockRails behind this interface so the workflow
// stack can build without blocking on HydraX engagement.
package hydraxrails

import (
	"context"
	"errors"
	"fmt"
	"sync/atomic"
)

// IssueRequest is the workflow-layer ask to mint a tokenised product on rails.
type IssueRequest struct {
	TenantID    string
	ProductCode string
}

// IssueResult is what rails returns once issuance is durably recorded.
type IssueResult struct {
	ProductID string
}

// Rails is the stable interface workflow-svc depends on.
// Real and mock implementations both satisfy it.
type Rails interface {
	IssueProduct(ctx context.Context, req IssueRequest) (IssueResult, error)
}

// MockRails is the in-memory implementation used in v1 until the real
// HydraX surface is wired (PRD-v2 §14 Q1).
type MockRails struct {
	counter atomic.Uint64
}

func NewMockRails() *MockRails {
	return &MockRails{}
}

func (m *MockRails) IssueProduct(_ context.Context, req IssueRequest) (IssueResult, error) {
	if req.TenantID == "" {
		return IssueResult{}, errors.New("hydraxrails: TenantID required")
	}
	n := m.counter.Add(1)
	return IssueResult{ProductID: fmt.Sprintf("mock-%s-%d", req.ProductCode, n)}, nil
}

// Compile-time guard: MockRails must satisfy Rails.
var _ Rails = (*MockRails)(nil)
```

- [ ] **Step 9: Run test — confirm PASS.**

```bash
cd services/hydrax-adapter && go test ./...
```

- [ ] **Step 10: Create `cmd/server/main.go`**

```go
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/naimkatiman/hydrax-app/services/hydrax-adapter/internal/handlers"
	"github.com/naimkatiman/hydrax-app/services/hydrax-adapter/internal/hydraxrails"
)

const serviceName = "hydrax-adapter"

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "7004"
	}

	// Mock-only in v1 per decision 2026-04-25; swap to a real impl
	// once the HydraX API surface is delivered.
	rails := hydraxrails.NewMockRails()
	_ = rails // wired into handlers in a follow-up task

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", handlers.Health(serviceName))

	srv := &http.Server{Addr: ":" + port, Handler: mux, ReadHeaderTimeout: 5 * time.Second}
	go func() {
		log.Printf("%s listening on :%s (mock rails)", serviceName, port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("listen: %v", err)
		}
	}()
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("shutdown: %v", err)
	}
}
```

- [ ] **Step 11: Create `Dockerfile`** (same shape, `EXPOSE 7004`).

```dockerfile
# syntax=docker/dockerfile:1.7

FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/server /server
EXPOSE 7004
USER nonroot:nonroot
ENTRYPOINT ["/server"]
```

- [ ] **Step 12: Create `README.md`**

```markdown
# hydrax-adapter

Go service. Workflow-layer adapter for HydraX tokenisation, custody, and trading rails.

**Status:** v1 ships `MockRails` behind the `Rails` interface per CLAUDE.md decision 2026-04-25. Real HydraX integration unblocks once the API surface is delivered (PRD-v2 §14 Q1).

## Run locally

    go run ./cmd/server

Listens on `:7004` (override with `PORT`).

## Health

    curl -s http://localhost:7004/healthz
    # {"service":"hydrax-adapter","status":"ok"}

## Test

    go test ./...

## Deploy

Railway service `hydrax-adapter`. Build via Dockerfile.
```

- [ ] **Step 13: Verify**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app/services/hydrax-adapter
go vet ./... && go test ./... && go build -o /tmp/hydrax-adapter ./cmd/server
```

- [ ] **Step 14: Commit**

```bash
git add services/hydrax-adapter
git commit -m "feat(hydrax-adapter): scaffold rails adapter with mock implementation behind stable interface"
```

---

## Task 5: canton-adapter (Go, port 7005) — Go bridge alongside existing Daml spike

Existing path `services/canton-adapter/daml/hydrax-governance/` (Daml spike) MUST be left untouched. The Go bridge lives in sibling subdirs.

**Files:**
- Create: `services/canton-adapter/go.mod`
- Create: `services/canton-adapter/cmd/server/main.go`
- Create: `services/canton-adapter/internal/handlers/health.go`
- Create: `services/canton-adapter/internal/handlers/health_test.go`
- Create: `services/canton-adapter/internal/canton/canton.go`
- Create: `services/canton-adapter/Dockerfile`
- Create: `services/canton-adapter/README.md`
- Preserve: `services/canton-adapter/daml/hydrax-governance/` (DO NOT touch)

- [ ] **Step 1: Write failing health test**

Create `services/canton-adapter/internal/handlers/health_test.go`:

```go
package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHealthHandler_ReturnsOK(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	rec := httptest.NewRecorder()
	Health("canton-adapter")(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d, want %d", rec.Code, http.StatusOK)
	}
	var body map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body["service"] != "canton-adapter" || body["status"] != "ok" {
		t.Fatalf("body: %#v", body)
	}
}
```

- [ ] **Step 2: Create `go.mod`**

```
module github.com/naimkatiman/hydrax-app/services/canton-adapter

go 1.22
```

- [ ] **Step 3: Run test — confirm FAIL.**

- [ ] **Step 4: Implement `internal/handlers/health.go`** (identical body to Task 1 Step 4).

```go
package handlers

import (
	"encoding/json"
	"net/http"
)

func Health(service string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"service": service,
			"status":  "ok",
		})
	}
}
```

- [ ] **Step 5: Run test — confirm PASS.**

- [ ] **Step 6: Create `internal/canton/canton.go`**

```go
// Package canton bridges the Daml ledger and the workflow stack.
// The Daml spike at services/canton-adapter/daml/hydrax-governance/
// defines the on-ledger contracts; this package will exchange commands
// and events with the participant node once that wiring lands.
package canton

// CommandKind identifies what the bridge is being asked to submit.
type CommandKind string

const (
	CommandCreate  CommandKind = "create"
	CommandExercise CommandKind = "exercise"
)

// Command is the workflow-layer request to submit to the participant.
type Command struct {
	Kind        CommandKind
	TemplateID  string
	ContractID  string
	Choice      string
	PayloadJSON []byte
}
```

- [ ] **Step 7: Create `cmd/server/main.go`**

```go
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/naimkatiman/hydrax-app/services/canton-adapter/internal/handlers"
)

const serviceName = "canton-adapter"

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "7005"
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", handlers.Health(serviceName))
	srv := &http.Server{Addr: ":" + port, Handler: mux, ReadHeaderTimeout: 5 * time.Second}
	go func() {
		log.Printf("%s listening on :%s", serviceName, port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("listen: %v", err)
		}
	}()
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("shutdown: %v", err)
	}
}
```

- [ ] **Step 8: Create `Dockerfile`** with a `.dockerignore`-style guard via context — to keep the daml/ tree out of the Go build context, copy only what's needed:

```dockerfile
# syntax=docker/dockerfile:1.7

FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY cmd ./cmd
COPY internal ./internal
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/server /server
EXPOSE 7005
USER nonroot:nonroot
ENTRYPOINT ["/server"]
```

- [ ] **Step 9: Create `README.md`**

```markdown
# canton-adapter

Go service. Bridges the workflow stack and the Canton/Daml participant node.

The Daml spike at `daml/hydrax-governance/` defines the on-ledger contracts and is built independently with `daml build`. This Go bridge is what `workflow-svc` and `approval-svc` call to submit commands and consume events.

## Run locally

    go run ./cmd/server

Listens on `:7005` (override with `PORT`).

## Health

    curl -s http://localhost:7005/healthz
    # {"service":"canton-adapter","status":"ok"}

## Test

    go test ./...

## Deploy

Railway service `canton-adapter`. Build via Dockerfile (Daml tree is excluded from the Go build context).
```

- [ ] **Step 10: Verify the Daml spike is untouched**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app
git status services/canton-adapter/daml/
```
Expected: zero changes inside `daml/`.

- [ ] **Step 11: Verify Go build**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app/services/canton-adapter
go vet ./... && go test ./... && go build -o /tmp/canton-adapter ./cmd/server
```

- [ ] **Step 12: Commit**

```bash
git add services/canton-adapter/cmd services/canton-adapter/internal services/canton-adapter/go.mod services/canton-adapter/Dockerfile services/canton-adapter/README.md
git commit -m "feat(canton-adapter): scaffold Go bridge alongside existing Daml governance spike"
```

Note: `git add` is scoped explicitly to keep the Daml spike out of this commit.

---

## Task 6: notify-svc (Node/TS, port 7101)

**Files:**
- Create: `services/notify-svc/package.json`
- Create: `services/notify-svc/tsconfig.json`
- Create: `services/notify-svc/src/server.ts`
- Create: `services/notify-svc/src/server.test.ts`
- Create: `services/notify-svc/src/notify/notify.ts`
- Create: `services/notify-svc/Dockerfile`
- Create: `services/notify-svc/README.md`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "@hydrax/notify-svc",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/server.js",
  "scripts": {
    "dev": "tsx src/server.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/server.js",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  },
  "engines": {
    "node": ">=20"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Run `pnpm install`**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app
pnpm install
```
Expected: success — workspace picks up the new package.

- [ ] **Step 4: Write failing test `src/server.test.ts`**

```typescript
import { describe, it, expect, afterAll, beforeAll } from "vitest";
import type { Server } from "node:http";
import { startServer } from "./server.js";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  ({ server, baseUrl } = await startServer({ port: 0, service: "notify-svc" }));
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
});

describe("notify-svc /healthz", () => {
  it("returns 200 with service identity", async () => {
    const res = await fetch(`${baseUrl}/healthz`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { service: string; status: string };
    expect(body.service).toBe("notify-svc");
    expect(body.status).toBe("ok");
  });
});
```

- [ ] **Step 5: Run test — confirm FAIL (`startServer` undefined).**

```bash
pnpm -F @hydrax/notify-svc test
```

- [ ] **Step 6: Implement `src/server.ts`**

```typescript
import http from "node:http";
import type { AddressInfo } from "node:net";

export interface StartOptions {
  port: number;
  service: string;
}

export interface StartResult {
  server: http.Server;
  baseUrl: string;
}

export function startServer(opts: StartOptions): Promise<StartResult> {
  const server = http.createServer((req, res) => {
    if (req.url === "/healthz" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ service: opts.service, status: "ok" }));
      return;
    }
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });

  return new Promise((resolve) => {
    server.listen(opts.port, () => {
      const addr = server.address() as AddressInfo;
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const port = Number(process.env.PORT ?? 7101);
  startServer({ port, service: "notify-svc" }).then(({ baseUrl }) => {
    console.log(`notify-svc listening on ${baseUrl}`);
  });
}
```

- [ ] **Step 7: Run test — confirm PASS.**

```bash
pnpm -F @hydrax/notify-svc test
```

- [ ] **Step 8: Create `src/notify/notify.ts`**

```typescript
// Owns the notification domain: email, in-app, webhook envelopes.
// Concrete transports land in follow-up tasks once the first tenant
// design partner is locked (PRD-v2 §14 Q4).

export type Channel = "email" | "in_app" | "webhook";

export interface Notification {
  id: string;
  tenantId: string;
  channel: Channel;
  recipient: string;
  subject: string;
  body: string;
}
```

- [ ] **Step 9: Verify build + typecheck**

```bash
pnpm -F @hydrax/notify-svc typecheck
pnpm -F @hydrax/notify-svc build
```
Expected: both succeed.

- [ ] **Step 10: Create `Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1.7

FROM node:20-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml tsconfig.base.json ./
COPY services/notify-svc ./services/notify-svc
RUN pnpm install --frozen-lockfile=false
RUN pnpm -F @hydrax/notify-svc build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/services/notify-svc/dist ./dist
COPY --from=build /app/services/notify-svc/package.json ./package.json
EXPOSE 7101
USER node
CMD ["node", "dist/server.js"]
```

Note: Dockerfile expects to be built with the repo root as context — `docker build -f services/notify-svc/Dockerfile .` from repo root.

- [ ] **Step 11: Create `README.md`**

```markdown
# notify-svc

Node/TS service. Owns email, in-app, and webhook notifications.

## Run locally

    pnpm -F @hydrax/notify-svc dev

Listens on `:7101` (override with `PORT`).

## Health

    curl -s http://localhost:7101/healthz
    # {"service":"notify-svc","status":"ok"}

## Test

    pnpm -F @hydrax/notify-svc test

## Build

    pnpm -F @hydrax/notify-svc build

## Deploy

Railway service `notify-svc`. Build with repo root as Docker context: `docker build -f services/notify-svc/Dockerfile .`
```

- [ ] **Step 12: Commit**

```bash
git add services/notify-svc pnpm-lock.yaml
git commit -m "feat(notify-svc): scaffold notification service with health endpoint"
```

---

## Task 7: integration-svc (Node/TS, port 7102)

**Files:**
- Create: `services/integration-svc/package.json`
- Create: `services/integration-svc/tsconfig.json`
- Create: `services/integration-svc/src/server.ts`
- Create: `services/integration-svc/src/server.test.ts`
- Create: `services/integration-svc/src/integrations/integrations.ts`
- Create: `services/integration-svc/Dockerfile`
- Create: `services/integration-svc/README.md`

- [ ] **Step 1: Create `package.json`** (replace `notify-svc` with `integration-svc`):

```json
{
  "name": "@hydrax/integration-svc",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/server.js",
  "scripts": {
    "dev": "tsx src/server.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/server.js",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  },
  "engines": {
    "node": ">=20"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: `pnpm install`**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app && pnpm install
```

- [ ] **Step 4: Write failing test `src/server.test.ts`**

```typescript
import { describe, it, expect, afterAll, beforeAll } from "vitest";
import type { Server } from "node:http";
import { startServer } from "./server.js";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  ({ server, baseUrl } = await startServer({ port: 0, service: "integration-svc" }));
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
});

describe("integration-svc /healthz", () => {
  it("returns 200 with service identity", async () => {
    const res = await fetch(`${baseUrl}/healthz`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { service: string; status: string };
    expect(body.service).toBe("integration-svc");
    expect(body.status).toBe("ok");
  });
});
```

- [ ] **Step 5: Run test — confirm FAIL.**

```bash
pnpm -F @hydrax/integration-svc test
```

- [ ] **Step 6: Implement `src/server.ts`** (identical shape to Task 6 Step 6, with `service: "integration-svc"` and default `PORT = 7102`):

```typescript
import http from "node:http";
import type { AddressInfo } from "node:net";

export interface StartOptions {
  port: number;
  service: string;
}

export interface StartResult {
  server: http.Server;
  baseUrl: string;
}

export function startServer(opts: StartOptions): Promise<StartResult> {
  const server = http.createServer((req, res) => {
    if (req.url === "/healthz" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ service: opts.service, status: "ok" }));
      return;
    }
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });

  return new Promise((resolve) => {
    server.listen(opts.port, () => {
      const addr = server.address() as AddressInfo;
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const port = Number(process.env.PORT ?? 7102);
  startServer({ port, service: "integration-svc" }).then(({ baseUrl }) => {
    console.log(`integration-svc listening on ${baseUrl}`);
  });
}
```

- [ ] **Step 7: Run test — confirm PASS.**

- [ ] **Step 8: Create `src/integrations/integrations.ts`**

```typescript
// Owns external-system integrations: KYC/KYB, SSO, CRM.
// Concrete adapters land once first tenant design partner is locked
// (PRD-v2 §14 Q4) — vendor selection depends on tenant requirements.

export type Provider = "kyc" | "kyb" | "sso" | "crm";

export interface ProviderConfig {
  tenantId: string;
  provider: Provider;
  endpoint: string;
}
```

- [ ] **Step 9: Verify**

```bash
pnpm -F @hydrax/integration-svc typecheck
pnpm -F @hydrax/integration-svc test
pnpm -F @hydrax/integration-svc build
```

- [ ] **Step 10: Create `Dockerfile`** (same shape as Task 6 with `EXPOSE 7102` and `-F @hydrax/integration-svc`):

```dockerfile
# syntax=docker/dockerfile:1.7

FROM node:20-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml tsconfig.base.json ./
COPY services/integration-svc ./services/integration-svc
RUN pnpm install --frozen-lockfile=false
RUN pnpm -F @hydrax/integration-svc build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/services/integration-svc/dist ./dist
COPY --from=build /app/services/integration-svc/package.json ./package.json
EXPOSE 7102
USER node
CMD ["node", "dist/server.js"]
```

- [ ] **Step 11: Create `README.md`**

```markdown
# integration-svc

Node/TS service. Owns external-system integrations: KYC/KYB, SSO, CRM.

## Run locally

    pnpm -F @hydrax/integration-svc dev

Listens on `:7102` (override with `PORT`).

## Health

    curl -s http://localhost:7102/healthz
    # {"service":"integration-svc","status":"ok"}

## Test

    pnpm -F @hydrax/integration-svc test

## Build

    pnpm -F @hydrax/integration-svc build

## Deploy

Railway service `integration-svc`. Build with repo root as Docker context: `docker build -f services/integration-svc/Dockerfile .`
```

- [ ] **Step 12: Commit**

```bash
git add services/integration-svc pnpm-lock.yaml
git commit -m "feat(integration-svc): scaffold KYC/SSO/CRM integration service with health endpoint"
```

---

## Task 8: bff (Node/TS, port 7103)

**Files:**
- Create: `services/bff/package.json`
- Create: `services/bff/tsconfig.json`
- Create: `services/bff/src/server.ts`
- Create: `services/bff/src/server.test.ts`
- Create: `services/bff/src/bff/bff.ts`
- Create: `services/bff/Dockerfile`
- Create: `services/bff/README.md`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "@hydrax/bff",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/server.js",
  "scripts": {
    "dev": "tsx src/server.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/server.js",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  },
  "engines": {
    "node": ">=20"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`** (identical shape to Task 6 Step 2).

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: `pnpm install`**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app && pnpm install
```

- [ ] **Step 4: Write failing test `src/server.test.ts`**

```typescript
import { describe, it, expect, afterAll, beforeAll } from "vitest";
import type { Server } from "node:http";
import { startServer } from "./server.js";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  ({ server, baseUrl } = await startServer({ port: 0, service: "bff" }));
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
});

describe("bff /healthz", () => {
  it("returns 200 with service identity", async () => {
    const res = await fetch(`${baseUrl}/healthz`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { service: string; status: string };
    expect(body.service).toBe("bff");
    expect(body.status).toBe("ok");
  });
});
```

- [ ] **Step 5: Run test — confirm FAIL.**

- [ ] **Step 6: Implement `src/server.ts`** (identical shape to Task 6 Step 6, with default `PORT = 7103` and `service: "bff"`):

```typescript
import http from "node:http";
import type { AddressInfo } from "node:net";

export interface StartOptions {
  port: number;
  service: string;
}

export interface StartResult {
  server: http.Server;
  baseUrl: string;
}

export function startServer(opts: StartOptions): Promise<StartResult> {
  const server = http.createServer((req, res) => {
    if (req.url === "/healthz" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ service: opts.service, status: "ok" }));
      return;
    }
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });

  return new Promise((resolve) => {
    server.listen(opts.port, () => {
      const addr = server.address() as AddressInfo;
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const port = Number(process.env.PORT ?? 7103);
  startServer({ port, service: "bff" }).then(({ baseUrl }) => {
    console.log(`bff listening on ${baseUrl}`);
  });
}
```

- [ ] **Step 7: Run test — confirm PASS.**

- [ ] **Step 8: Create `src/bff/bff.ts`**

```typescript
// Backend-for-frontend. Aggregates Go and Node services for the React portals.
// Concrete fan-out clients (workflow-svc, approval-svc, audit-svc, hydrax-adapter,
// notify-svc, integration-svc) wire in once each service exposes a stable JSON API.

export interface UpstreamConfig {
  workflowSvcUrl: string;
  approvalSvcUrl: string;
  auditSvcUrl: string;
  hydraxAdapterUrl: string;
  notifySvcUrl: string;
  integrationSvcUrl: string;
}

export function loadUpstreamConfig(env: NodeJS.ProcessEnv): UpstreamConfig {
  return {
    workflowSvcUrl: env.WORKFLOW_SVC_URL ?? "http://localhost:7001",
    approvalSvcUrl: env.APPROVAL_SVC_URL ?? "http://localhost:7002",
    auditSvcUrl: env.AUDIT_SVC_URL ?? "http://localhost:7003",
    hydraxAdapterUrl: env.HYDRAX_ADAPTER_URL ?? "http://localhost:7004",
    notifySvcUrl: env.NOTIFY_SVC_URL ?? "http://localhost:7101",
    integrationSvcUrl: env.INTEGRATION_SVC_URL ?? "http://localhost:7102",
  };
}
```

- [ ] **Step 9: Verify**

```bash
pnpm -F @hydrax/bff typecheck
pnpm -F @hydrax/bff test
pnpm -F @hydrax/bff build
```

- [ ] **Step 10: Create `Dockerfile`** (same shape as Task 6, `EXPOSE 7103`, `-F @hydrax/bff`):

```dockerfile
# syntax=docker/dockerfile:1.7

FROM node:20-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml tsconfig.base.json ./
COPY services/bff ./services/bff
RUN pnpm install --frozen-lockfile=false
RUN pnpm -F @hydrax/bff build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/services/bff/dist ./dist
COPY --from=build /app/services/bff/package.json ./package.json
EXPOSE 7103
USER node
CMD ["node", "dist/server.js"]
```

- [ ] **Step 11: Create `README.md`**

```markdown
# bff

Node/TS service. Backend-for-frontend that aggregates Go and Node services for the React portals.

## Run locally

    pnpm -F @hydrax/bff dev

Listens on `:7103` (override with `PORT`).

## Health

    curl -s http://localhost:7103/healthz
    # {"service":"bff","status":"ok"}

## Test

    pnpm -F @hydrax/bff test

## Build

    pnpm -F @hydrax/bff build

## Upstream URLs

| Env var | Default | Service |
|---|---|---|
| `WORKFLOW_SVC_URL` | http://localhost:7001 | workflow-svc |
| `APPROVAL_SVC_URL` | http://localhost:7002 | approval-svc |
| `AUDIT_SVC_URL` | http://localhost:7003 | audit-svc |
| `HYDRAX_ADAPTER_URL` | http://localhost:7004 | hydrax-adapter |
| `NOTIFY_SVC_URL` | http://localhost:7101 | notify-svc |
| `INTEGRATION_SVC_URL` | http://localhost:7102 | integration-svc |

## Deploy

Railway service `bff`. Build with repo root as Docker context: `docker build -f services/bff/Dockerfile .`
```

- [ ] **Step 12: Commit**

```bash
git add services/bff pnpm-lock.yaml
git commit -m "feat(bff): scaffold backend-for-frontend service with upstream-aggregation surface"
```

---

## Task 9: Documentation — docs/env.md

**Files:**
- Modify: `docs/env.md`

- [ ] **Step 1: Read current `docs/env.md`**

```bash
cat docs/env.md
```

- [ ] **Step 2: Append a "Service env vars" section**

Append (do not replace) to `docs/env.md`:

```markdown
## Service env vars (v1 scaffolding — added 2026-04-25)

Each service binary listens on `PORT` (defaulted per service below). All services expose `/healthz` returning `{"service":"<name>","status":"ok"}` with HTTP 200.

| Service | Default port | Notes |
|---|---|---|
| workflow-svc | 7001 | Go. Owns workflow orchestration + state machines. |
| approval-svc | 7002 | Go. Owns approval chains. |
| audit-svc | 7003 | Go. Owns the immutable action log. |
| hydrax-adapter | 7004 | Go. v1 ships `MockRails` per Decision 2026-04-25. |
| canton-adapter | 7005 | Go. Bridge to Canton/Daml participant. Daml spike at `services/canton-adapter/daml/`. |
| notify-svc | 7101 | Node/TS. Owns email + in-app + webhook notifications. |
| integration-svc | 7102 | Node/TS. Owns KYC/KYB, SSO, CRM. |
| bff | 7103 | Node/TS. Aggregates the above for React portals. |

### bff upstream URLs (set at deploy time)

| Env var | Default | Points at |
|---|---|---|
| `WORKFLOW_SVC_URL` | `http://localhost:7001` | workflow-svc |
| `APPROVAL_SVC_URL` | `http://localhost:7002` | approval-svc |
| `AUDIT_SVC_URL` | `http://localhost:7003` | audit-svc |
| `HYDRAX_ADAPTER_URL` | `http://localhost:7004` | hydrax-adapter |
| `NOTIFY_SVC_URL` | `http://localhost:7101` | notify-svc |
| `INTEGRATION_SVC_URL` | `http://localhost:7102` | integration-svc |

### Deferred

`DATABASE_URL`, `MONGODB_URI`, KYC/SSO/CRM provider credentials, HydraX rails credentials — all deferred until the corresponding domain logic lands. Document each here at the same commit that introduces the dependency.
```

- [ ] **Step 3: Verify the file is well-formed (manual read)**

```bash
cat docs/env.md | tail -40
```

- [ ] **Step 4: Commit**

```bash
git add docs/env.md
git commit -m "docs(env): document service env vars for v1 scaffolding"
```

---

## Task 10: Cross-service smoke + STATE.yaml update

**Files:**
- Modify: `STATE.yaml`

- [ ] **Step 1: Run the full Go test sweep**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app
for svc in workflow-svc approval-svc audit-svc hydrax-adapter canton-adapter; do
  echo "=== $svc ==="
  (cd services/$svc && go vet ./... && go test ./...)
done
```
Expected: every service prints `ok ...` lines and zero vet warnings.

- [ ] **Step 2: Run the full TS test + build sweep**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app
pnpm -r typecheck
pnpm -r test
pnpm -r build
```
Expected: all three commands pass for `@hydrax/notify-svc`, `@hydrax/integration-svc`, `@hydrax/bff`.

- [ ] **Step 3: Manual port smoke (optional, skip on CI)**

In separate terminals:
```bash
(cd services/workflow-svc && PORT=7001 go run ./cmd/server) &
(cd services/approval-svc && PORT=7002 go run ./cmd/server) &
(cd services/audit-svc && PORT=7003 go run ./cmd/server) &
(cd services/hydrax-adapter && PORT=7004 go run ./cmd/server) &
(cd services/canton-adapter && PORT=7005 go run ./cmd/server) &
pnpm -F @hydrax/notify-svc dev &
pnpm -F @hydrax/integration-svc dev &
pnpm -F @hydrax/bff dev &
sleep 2
for p in 7001 7002 7003 7004 7005 7101 7102 7103; do
  echo -n "  :$p -> "
  curl -fsS http://localhost:$p/healthz || echo "FAIL"
  echo
done
kill %1 %2 %3 %4 %5 %6 %7 %8
```
Expected: each port responds with its service identity.

- [ ] **Step 4: Update STATE.yaml**

Modify `STATE.yaml` — set `current_focus`, append to `verification_log`, advance `next_actions`:

```yaml
project: hydrax-app
updated: 2026-04-25T<HH:MM>:00+08:00
status: in_progress
summary: Backend service scaffolding landed — eight services (5 Go, 3 Node/TS) under services/ with health endpoints, tests, Dockerfiles, and per-service READMEs. Prototype unchanged. v1 build surface is now deployable.
current_focus:
  - services/workflow-svc Go binary on :7001 with /healthz + workflow stub
  - services/approval-svc Go binary on :7002 with /healthz + approvals stub
  - services/audit-svc Go binary on :7003 with /healthz + audit-event model
  - services/hydrax-adapter Go binary on :7004 with /healthz + MockRails behind Rails interface (Decision 2026-04-25)
  - services/canton-adapter Go binary on :7005 with /healthz + Canton command stub; existing Daml spike at services/canton-adapter/daml/ preserved
  - services/notify-svc Node/TS on :7101 with /healthz + Notification model
  - services/integration-svc Node/TS on :7102 with /healthz + ProviderConfig model
  - services/bff Node/TS on :7103 with /healthz + UpstreamConfig loader
  - go.work + pnpm-workspace.yaml + tsconfig.base.json wiring all 8 services
  - docs/env.md documents PORT defaults and bff upstream URLs
recently_verified:
  - go vet ./... clean for all 5 Go services
  - go test ./... passes for all 5 Go services
  - pnpm -r typecheck passes for all 3 Node/TS services
  - pnpm -r test passes for all 3 Node/TS services
  - pnpm -r build passes for all 3 Node/TS services
  - prototype prototype (index.html/app.js/styles.css) untouched
  - canton-adapter/daml/hydrax-governance/ untouched
next_actions:
  - Wire Postgres + Mongo (deferred until first product template + tenant design partner per PRD-v2 §14 Q3 + Q4)
  - Wire Canton participant client (deferred until participant deployment plan is locked)
  - Define real workflow definitions (gated on PRD-v2 §14 Q3)
verification_log:
  - 2026-04-25 — services scaffold: go vet ./... and go test ./... pass for workflow-svc, approval-svc, audit-svc, hydrax-adapter, canton-adapter; pnpm -r typecheck && pnpm -r test && pnpm -r build pass for notify-svc, integration-svc, bff; node --check app.js still passes; canton-adapter/daml/ unchanged per git status; git diff --stat confirms only services/, go.work, pnpm-workspace.yaml, tsconfig.base.json, package.json, .gitignore, docs/env.md, STATE.yaml touched
```

(Replace `<HH:MM>` with the actual commit time.)

- [ ] **Step 5: Final commit**

```bash
git add STATE.yaml
git commit -m "chore(state): record backend services scaffolding verification"
```

---

## Self-Review Checklist (run before declaring done)

- [ ] **Spec coverage** — every service the user asked for has a task that creates `cmd/server`, handlers, internal stub package, Dockerfile, README, and a passing test:
  - workflow-svc → Task 1 ✓
  - approval-svc → Task 2 ✓
  - audit-svc → Task 3 ✓
  - hydrax-adapter → Task 4 (with mock per Decision 2026-04-25) ✓
  - canton-adapter → Task 5 (Daml spike preserved) ✓
  - notify-svc → Task 6 ✓
  - integration-svc → Task 7 ✓
  - bff → Task 8 ✓

- [ ] **Placeholder scan** — zero "TBD", "implement later", "fill in details", "similar to Task N" without code, "add error handling" without showing how. All code blocks contain the actual content the engineer pastes.

- [ ] **Type consistency** — TS `startServer({ port, service })` signature is identical across notify-svc, integration-svc, bff. Go `Health(service string) http.HandlerFunc` signature is identical across all 5 Go services.

- [ ] **Commit cap** — every task ends in exactly one commit; largest commit is Task 1 (~7 files + go.work mutation = 8 files). All under the 15-file cap.

- [ ] **CLAUDE.md alignment** — module path uses `github.com/naimkatiman/hydrax-app/...`; ports allocated per service; no emoji; no UI work; hydrax-adapter ships as mock per Decision 2026-04-25; Daml spike preserved.

- [ ] **Verification gates** — every task has explicit `go vet ./... && go test ./...` (Go) or `pnpm -F <svc> typecheck && pnpm -F <svc> test && pnpm -F <svc> build` (TS) before commit.

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-04-25-backend-services-scaffold.md`. The user invoked `/ralph-loop:ralph-loop` for execution, so the next step is to feed this plan to Ralph Loop and let it iterate task-by-task.

Alternative execution paths if Ralph Loop is not preferred:

1. **Subagent-Driven** — dispatch one fresh subagent per task; review between tasks. Use `superpowers:subagent-driven-development`.
2. **Inline Execution** — execute tasks in the current session with checkpoints. Use `superpowers:executing-plans`.
