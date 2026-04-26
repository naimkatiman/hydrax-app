# Mock Canton Testnet + HydraX Rails Expansion + Q3 Credit Lifecycle Plan

> **For agentic workers:** Three independent slices dispatched in parallel via `superpowers:dispatching-parallel-agents`. Each slice ships its own commit. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the previously needs-approval items 6 (Q3 short-duration credit lifecycle), 7 (synchronizer + party allocation), and 8 (HydraX rails) demo-able as in-process mocks so the workflow stack can run end-to-end without real Canton infra, real HydraX engagement, or a Q3 product-type commitment.

**Architecture:** Three independent service-scoped slices.
- Slice A — `services/canton-adapter` becomes a runnable mock-testnet HTTP service: in-memory synchronizer, party allocation, command submission, event log. Replaces the 22-line interface stub.
- Slice B — `services/hydrax-adapter` adds Subscribe / Custody / Settle / NAV operations to the existing `MockRails` and exposes them over HTTP. Existing IssueProduct path unchanged.
- Slice C — `services/workflow-svc/internal/credit` defines a short-duration credit FSM as a sibling to `lifecycle` (product) and `sublifecycle` (subscription). No HTTP yet, no schema migration. Codified per the Q3 default proposal in [docs/plans/2026-04-25-q3-default-short-duration-credit.md](2026-04-25-q3-default-short-duration-credit.md).

**Tech Stack:** Go 1.26 (per-service modules tied by `go.work`), `net/http` only — no new deps. Tests use `httptest` + table-driven `t.Run`. Per-service `go vet ./... && go test ./...` is the gate.

**Out of scope (intentional, to keep this within auto-mode reversibility):**
- Real Canton / Daml participant connection. The mock is RAM-only and resets on restart.
- Real HydraX API credentials, real settlement rails. Mock returns deterministic IDs only.
- Schema migrations. Q3 credit FSM is pure code; persistence + handlers wait for a separate plan once Q3 is accepted.
- workflow-svc → canton-adapter / hydrax-adapter HTTP wire-up at lifecycle events. That follow-up exists in `STATE.yaml.next_actions` and remains there.
- Frontend changes. No portal touches.

---

## Slice A — Canton Testnet Mock (canton-adapter)

**Why a mock and not a real synchronizer:** real Canton requires a JVM participant + synchronizer + 5–10s startup + Daml dar deployment. The interview deck (`docs/demo/canton-interview.html`) is shipping today; we need Slide 8 M1 ("synchronizer + party allocation") visible behind a stable HTTP surface so the rest of the stack can wire to it. When real Canton lands, the same HTTP shape stays — the in-memory ledger gets swapped for a real participant client.

**Files:**
- Create: `services/canton-adapter/internal/ledger/ledger.go`
- Create: `services/canton-adapter/internal/ledger/ledger_test.go`
- Create: `services/canton-adapter/internal/handlers/parties.go`
- Create: `services/canton-adapter/internal/handlers/parties_test.go`
- Create: `services/canton-adapter/internal/handlers/commands.go`
- Create: `services/canton-adapter/internal/handlers/commands_test.go`
- Create: `services/canton-adapter/internal/handlers/events.go`
- Create: `services/canton-adapter/internal/handlers/events_test.go`
- Modify: `services/canton-adapter/cmd/server/main.go` (mount the new routes)
- Modify: `services/canton-adapter/README.md` (document the surface)

**HTTP surface (mock-only):**
```
POST /v1/parties             { "hint": "issuer-acme" }            -> { "party": "issuer-acme::mock-testnet" }
GET  /v1/parties                                                  -> { "parties": ["..."] }
POST /v1/commands            { "kind": "create"|"exercise", ... } -> { "contract_id": "...", "offset": 17 }
GET  /v1/events?after=N      (party-filtered if ?party= given)    -> { "events": [...], "next_offset": M }
GET  /healthz                                                     -> existing
```

**Steps:**

- [ ] **A1: Write ledger.go failing tests first**

```go
// services/canton-adapter/internal/ledger/ledger_test.go
package ledger

import (
	"strings"
	"testing"
)

func TestAllocateParty(t *testing.T) {
	l := New()
	p, err := l.AllocateParty("issuer-acme")
	if err != nil {
		t.Fatalf("allocate: %v", err)
	}
	if !strings.HasPrefix(p, "issuer-acme::") {
		t.Fatalf("party hint not honoured: %q", p)
	}
	if got := l.Parties(); len(got) != 1 || got[0] != p {
		t.Fatalf("Parties() = %v, want [%q]", got, p)
	}
}

func TestAllocatePartyEmptyHint(t *testing.T) {
	l := New()
	if _, err := l.AllocateParty(""); err == nil {
		t.Fatal("expected error for empty hint")
	}
}

func TestSubmitCreateAssignsOffset(t *testing.T) {
	l := New()
	cid, off, err := l.SubmitCreate("Daml.Hydrax:ProductCommitment", []byte(`{"sponsor":"x"}`))
	if err != nil {
		t.Fatalf("submit: %v", err)
	}
	if cid == "" {
		t.Fatal("contract id empty")
	}
	if off != 1 {
		t.Fatalf("first offset = %d, want 1", off)
	}
}

func TestEventsAfterOffset(t *testing.T) {
	l := New()
	for i := 0; i < 3; i++ {
		if _, _, err := l.SubmitCreate("T", []byte("{}")); err != nil {
			t.Fatalf("submit %d: %v", i, err)
		}
	}
	evs, next := l.EventsAfter(1)
	if len(evs) != 2 {
		t.Fatalf("EventsAfter(1) returned %d events, want 2", len(evs))
	}
	if next != 3 {
		t.Fatalf("next offset = %d, want 3", next)
	}
}
```

- [ ] **A2: Implement ledger.go**

```go
// services/canton-adapter/internal/ledger/ledger.go
// Package ledger is the in-memory mock testnet synchronizer.
// Replaces a real Canton participant for v1 demo. Same HTTP shape
// as the eventual real adapter — just RAM-backed.
package ledger

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"sync"
)

// Event is one ledger event in the mock synchronizer log.
type Event struct {
	Offset      uint64 `json:"offset"`
	Kind        string `json:"kind"`        // "create" or "exercise"
	TemplateID  string `json:"template_id"`
	ContractID  string `json:"contract_id"`
	PayloadJSON []byte `json:"payload_json,omitempty"`
}

// Ledger is the synchronizer + participant state in one struct.
// Goroutine-safe; all mutating methods take the mutex.
type Ledger struct {
	mu      sync.Mutex
	parties map[string]struct{}
	events  []Event
	offset  uint64
}

func New() *Ledger {
	return &Ledger{parties: map[string]struct{}{}}
}

func (l *Ledger) AllocateParty(hint string) (string, error) {
	if hint == "" {
		return "", errors.New("ledger: party hint required")
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	suffix := randHex(4)
	party := fmt.Sprintf("%s::mock-%s", hint, suffix)
	l.parties[party] = struct{}{}
	return party, nil
}

func (l *Ledger) Parties() []string {
	l.mu.Lock()
	defer l.mu.Unlock()
	out := make([]string, 0, len(l.parties))
	for p := range l.parties {
		out = append(out, p)
	}
	return out
}

func (l *Ledger) SubmitCreate(templateID string, payloadJSON []byte) (string, uint64, error) {
	if templateID == "" {
		return "", 0, errors.New("ledger: template_id required")
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	cid := "cid-" + randHex(8)
	l.offset++
	l.events = append(l.events, Event{
		Offset: l.offset, Kind: "create", TemplateID: templateID,
		ContractID: cid, PayloadJSON: payloadJSON,
	})
	return cid, l.offset, nil
}

func (l *Ledger) SubmitExercise(templateID, contractID, choice string, payloadJSON []byte) (uint64, error) {
	if templateID == "" || contractID == "" || choice == "" {
		return 0, errors.New("ledger: template_id, contract_id, choice required")
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	l.offset++
	l.events = append(l.events, Event{
		Offset: l.offset, Kind: "exercise", TemplateID: templateID,
		ContractID: contractID, PayloadJSON: payloadJSON,
	})
	return l.offset, nil
}

// EventsAfter returns events with Offset > after, plus the highest
// offset returned. If no new events, returns ([], after).
func (l *Ledger) EventsAfter(after uint64) ([]Event, uint64) {
	l.mu.Lock()
	defer l.mu.Unlock()
	out := []Event{}
	next := after
	for _, e := range l.events {
		if e.Offset > after {
			out = append(out, e)
			if e.Offset > next {
				next = e.Offset
			}
		}
	}
	return out, next
}

func randHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
```

- [ ] **A3: Run ledger tests, verify GREEN.** `cd services/canton-adapter && go test ./internal/ledger/...`

- [ ] **A4: Write parties handler tests, then implement handler.** `POST /v1/parties` accepts `{"hint": "..."}`, returns `{"party": "..."}`. `GET /v1/parties` returns `{"parties": [...]}`. Empty hint → 400 with `{"error": "bad_hint"}`.

- [ ] **A5: Write commands handler tests, then implement handler.** `POST /v1/commands` body `{"kind":"create"|"exercise", "template_id":"...", "contract_id":"...", "choice":"...", "payload_json":...}` (string-or-object accepted as raw bytes). Returns `{"contract_id":"...", "offset": N}`. Bad kind → 400.

- [ ] **A6: Write events handler tests, then implement handler.** `GET /v1/events?after=N` (default 0). Returns `{"events":[...], "next_offset": M}`. Tolerates `?party=` query (filter only events whose payload mentions the party — keep mock loose). Negative `after` → 400.

- [ ] **A7: Mount routes in `cmd/server/main.go`.**

Add `ledger := ledger.New()` before mux. Mount POST/GET pairs. Log `(mock testnet)` at start.

- [ ] **A8: Per-service gate — `cd services/canton-adapter && go vet ./... && go test ./...` GREEN.**

- [ ] **A9: README update.** Document the four endpoints + that this is mock-only, RAM-backed, resets on restart, will swap to real participant when Canton infra approved.

- [ ] **A10: Commit single-concern.**

```
feat(canton-adapter): mock testnet with party allocation + command submission + event log
```

Files: 8 new + 2 modified = 10 total, under the 15-file cap.

---

## Slice B — HydraX Rails Mock Expansion (hydrax-adapter)

**Why expand:** the existing mock has Issue only. Slide 8 M2 ("HydraX rails") implies the v1 platform also drives subscription, custody movement, settlement, and NAV reads. Without those, the workflow can't trace through the full lifecycle even with a mock canton.

**Files:**
- Modify: `services/hydrax-adapter/internal/hydraxrails/rails.go` (add 4 methods to `Rails` interface + MockRails impls)
- Modify: `services/hydrax-adapter/internal/hydraxrails/rails_test.go` (add table tests for new methods)
- Create: `services/hydrax-adapter/internal/handlers/subscribe.go`
- Create: `services/hydrax-adapter/internal/handlers/subscribe_test.go`
- Create: `services/hydrax-adapter/internal/handlers/custody.go`
- Create: `services/hydrax-adapter/internal/handlers/custody_test.go`
- Create: `services/hydrax-adapter/internal/handlers/settle.go`
- Create: `services/hydrax-adapter/internal/handlers/settle_test.go`
- Create: `services/hydrax-adapter/internal/handlers/nav.go`
- Create: `services/hydrax-adapter/internal/handlers/nav_test.go`
- Modify: `services/hydrax-adapter/cmd/server/main.go` (mount 4 new routes)
- Modify: `services/hydrax-adapter/README.md`

**Surface added (existing /v1/issue unchanged):**
```
POST /v1/subscribe   {tenant_id, product_id, investor_ref, units}     -> {subscription_id}
POST /v1/custody/transfer {tenant_id, from, to, units, asset_ref}    -> {transfer_id}
POST /v1/settle      {tenant_id, subscription_id}                     -> {settlement_id, status:"settled"}
GET  /v1/nav/{product_id}                                             -> {product_id, nav: "1.0235", as_of: "2026-04-26T00:00:00Z"}
```

**Steps:**

- [ ] **B1: Extend Rails interface in `rails.go` with 4 method signatures.**

```go
type Rails interface {
	IssueProduct(ctx context.Context, req IssueRequest) (IssueResult, error)
	Subscribe(ctx context.Context, req SubscribeRequest) (SubscribeResult, error)
	TransferCustody(ctx context.Context, req CustodyRequest) (CustodyResult, error)
	Settle(ctx context.Context, req SettleRequest) (SettleResult, error)
	NAV(ctx context.Context, productID string) (NAVResult, error)
}
```

Add request/result structs immediately above. Each Subscribe/Transfer/Settle gets a counter-derived deterministic ID. NAV is a stable function of `productID` (e.g., `1.00 + (hash(productID) % 5000) / 10000`) so the same product always returns the same fake NAV — keeps demo screenshots reproducible.

- [ ] **B2: Implement on MockRails. TenantID validation mirrors IssueProduct.** Empty `tenant_id` → error in every method. Settle requires non-empty `subscription_id`. NAV requires non-empty `product_id`.

- [ ] **B3: Table-driven tests in `rails_test.go` covering happy path + empty-tenant rejection per method. NAV determinism asserted (same input, same output).**

- [ ] **B4: 4 handler files + 4 handler test files. Each handler is ~25 lines, mirrors `issue.go` shape (decode JSON, call Rails, return JSON).**

- [ ] **B5: Mount in `cmd/server/main.go`.** Routes added in alphabetical order under existing `POST /v1/issue`. NAV uses Go 1.22+ method-route syntax `GET /v1/nav/{product_id}`.

- [ ] **B6: Per-service gate — `cd services/hydrax-adapter && go vet ./... && go test ./...` GREEN.**

- [ ] **B7: README update.** Document the 5 endpoints, MockRails determinism, and the swap-to-real path.

- [ ] **B8: Commit single-concern.**

```
feat(hydrax-adapter): mock subscribe + custody transfer + settle + NAV behind stable interface
```

Files: 8 new + 3 modified = 11 total.

---

## Slice C — Q3 Short-Duration Credit Lifecycle FSM (workflow-svc)

**Why a sibling FSM, not an extension of `lifecycle`:** product `lifecycle` and subscription `sublifecycle` are deliberately separate (per `sublifecycle.go` doc comment). Adding credit-specific edges to product `lifecycle` would conflate two domains. Credit FSM follows the same shape — `Transition(from, to) error`, `AllowedNext(from) []State`, `IsTerminal(s) bool` — so the eventual handler/persistence wiring matches the existing pattern verbatim.

**The FSM (matches Q3 plan §3 of [docs/plans/2026-04-25-q3-default-short-duration-credit.md](2026-04-25-q3-default-short-duration-credit.md)):**

```
draft -> kyc_pending -> terms_locked -> subscription_open -> funded -> accruing -> matured -> settled
                            |                |                  |          |
                            v                v                  v          v
                        cancelled         cancelled          defaulted   defaulted
```

Terminal: `settled`, `cancelled`, `defaulted`.

**Important:** This is **pure code only**. No DB migration. No new HTTP route. No schema change. Q3 still requires user accept/override before any of this gets persisted; this slice locks down the state machine so the rest of the stack can compile against it without committing to a product type.

**Files:**
- Create: `services/workflow-svc/internal/credit/credit.go`
- Create: `services/workflow-svc/internal/credit/credit_test.go`

**Steps:**

- [ ] **C1: Write the FSM tests first.**

```go
// services/workflow-svc/internal/credit/credit_test.go
package credit

import (
	"errors"
	"sort"
	"testing"
)

func TestTransitionAllowed(t *testing.T) {
	cases := []struct {
		from, to State
	}{
		{StateDraft, StateKYCPending},
		{StateKYCPending, StateTermsLocked},
		{StateKYCPending, StateCancelled},
		{StateTermsLocked, StateSubscriptionOpen},
		{StateTermsLocked, StateCancelled},
		{StateSubscriptionOpen, StateFunded},
		{StateSubscriptionOpen, StateCancelled},
		{StateFunded, StateAccruing},
		{StateFunded, StateDefaulted},
		{StateAccruing, StateMatured},
		{StateAccruing, StateDefaulted},
		{StateMatured, StateSettled},
	}
	for _, c := range cases {
		if err := Transition(c.from, c.to); err != nil {
			t.Errorf("Transition(%s,%s) = %v, want nil", c.from, c.to, err)
		}
	}
}

func TestTransitionRejected(t *testing.T) {
	cases := []struct {
		from, to State
	}{
		{StateDraft, StateFunded},          // skipping
		{StateSettled, StateAccruing},      // terminal -> non-terminal
		{StateCancelled, StateDraft},       // terminal -> anything
		{StateDefaulted, StateSettled},     // defaulted is terminal in this FSM
		{StateDraft, StateDraft},           // self-loop
		{State("ghost"), StateDraft},       // unknown from
	}
	for _, c := range cases {
		err := Transition(c.from, c.to)
		if !errors.Is(err, ErrInvalidTransition) {
			t.Errorf("Transition(%s,%s) = %v, want ErrInvalidTransition", c.from, c.to, err)
		}
	}
}

func TestAllowedNext(t *testing.T) {
	got := AllowedNext(StateFunded)
	sort.Slice(got, func(i, j int) bool { return got[i] < got[j] })
	want := []State{StateAccruing, StateDefaulted}
	if len(got) != len(want) || got[0] != want[0] || got[1] != want[1] {
		t.Fatalf("AllowedNext(funded) = %v, want %v", got, want)
	}
	if got := AllowedNext(StateSettled); len(got) != 0 {
		t.Errorf("AllowedNext(settled) = %v, want empty", got)
	}
	if got := AllowedNext(State("ghost")); len(got) != 0 {
		t.Errorf("AllowedNext(unknown) = %v, want empty", got)
	}
}

func TestIsTerminal(t *testing.T) {
	for _, s := range []State{StateSettled, StateCancelled, StateDefaulted} {
		if !IsTerminal(s) {
			t.Errorf("IsTerminal(%s) = false, want true", s)
		}
	}
	for _, s := range []State{StateDraft, StateFunded, StateAccruing} {
		if IsTerminal(s) {
			t.Errorf("IsTerminal(%s) = true, want false", s)
		}
	}
	if IsTerminal(State("ghost")) {
		t.Error("IsTerminal(unknown) = true, want false")
	}
}
```

- [ ] **C2: Implement `credit.go` mirroring the `lifecycle` package shape.**

```go
// Package credit codifies the short-duration credit product FSM.
// Mirrors internal/lifecycle and internal/sublifecycle in shape; kept
// separate because credit edges (defaulted, accruing, matured) do not
// match the generic product or subscription FSM.
//
// This package is pure logic. No schema, no HTTP wiring. Once Q3
// (product type) is accepted by the user — see docs/plans/2026-04-25-q3-default-short-duration-credit.md —
// a separate plan adds persistence + handlers using this FSM.
package credit

import (
	"errors"
	"fmt"
)

type State string

const (
	StateDraft            State = "draft"
	StateKYCPending       State = "kyc_pending"
	StateTermsLocked      State = "terms_locked"
	StateSubscriptionOpen State = "subscription_open"
	StateFunded           State = "funded"
	StateAccruing         State = "accruing"
	StateMatured          State = "matured"
	StateSettled          State = "settled"
	StateCancelled        State = "cancelled"
	StateDefaulted        State = "defaulted"
)

var ErrInvalidTransition = errors.New("credit: invalid transition")

var allowed = map[State]map[State]bool{
	StateDraft:            {StateKYCPending: true},
	StateKYCPending:       {StateTermsLocked: true, StateCancelled: true},
	StateTermsLocked:      {StateSubscriptionOpen: true, StateCancelled: true},
	StateSubscriptionOpen: {StateFunded: true, StateCancelled: true},
	StateFunded:           {StateAccruing: true, StateDefaulted: true},
	StateAccruing:         {StateMatured: true, StateDefaulted: true},
	StateMatured:          {StateSettled: true},
	StateSettled:          {},
	StateCancelled:        {},
	StateDefaulted:        {},
}

func Transition(from, to State) error {
	successors, ok := allowed[from]
	if !ok {
		return fmt.Errorf("%w: unknown from state %q", ErrInvalidTransition, from)
	}
	if from == to {
		return fmt.Errorf("%w: self-loop %s -> %s rejected", ErrInvalidTransition, from, to)
	}
	if !successors[to] {
		return fmt.Errorf("%w: %s -> %s not allowed", ErrInvalidTransition, from, to)
	}
	return nil
}

func AllowedNext(from State) []State {
	successors, ok := allowed[from]
	if !ok {
		return []State{}
	}
	out := make([]State, 0, len(successors))
	for s := range successors {
		out = append(out, s)
	}
	return out
}

func IsTerminal(s State) bool {
	successors, ok := allowed[s]
	if !ok {
		return false
	}
	return len(successors) == 0
}
```

- [ ] **C3: Per-service gate — `cd services/workflow-svc && go vet ./... && go test ./...` GREEN. Existing 18+ handler tests + lifecycle/sublifecycle/etc. all stay green.**

- [ ] **C4: Commit single-concern.**

```
feat(workflow-svc): codify short-duration credit FSM as pure package
```

Files: 2 new = 2 total.

---

## Integration & Verification

After all three slices land:

- [ ] **I1: Per-service gates run again from clean state.**

```bash
cd services/canton-adapter && go vet ./... && go test ./...
cd services/hydrax-adapter && go vet ./... && go test ./...
cd services/workflow-svc   && go vet ./... && go test ./...
```

All three GREEN.

- [ ] **I2: Smoke run the two HTTP services.**

```bash
# Terminal 1
cd services/canton-adapter && go run ./cmd/server &
# Terminal 2
cd services/hydrax-adapter && go run ./cmd/server &

# Allocate a party
curl -sX POST http://localhost:7005/v1/parties -d '{"hint":"issuer-acme"}'
# -> {"party":"issuer-acme::mock-XXXX"}

# Submit a create command
curl -sX POST http://localhost:7005/v1/commands \
  -d '{"kind":"create","template_id":"Daml.Hydrax:ProductCommitment","payload_json":{}}'
# -> {"contract_id":"cid-...", "offset": 1}

# Read events
curl -s http://localhost:7005/v1/events?after=0
# -> {"events":[...], "next_offset": 1}

# HydraX subscribe
curl -sX POST http://localhost:7004/v1/subscribe \
  -d '{"tenant_id":"t1","product_id":"p1","investor_ref":"i1","units":1000}'
# -> {"subscription_id":"sub-..."}

# NAV
curl -s http://localhost:7004/v1/nav/p1
# -> {"product_id":"p1","nav":"1.XXXX","as_of":"..."}
```

- [ ] **I3: Update STATE.yaml verification_log with all three commit SHAs and the smoke evidence above. Move the three items from `next_actions` into `recently_verified`. Bump `updated`.**

- [ ] **I4: Update CLAUDE.md "Decisions (Recent)" with one entry for the trio:**

```
- 2026-04-26 — Mock Canton testnet + expanded HydraX rails mock + Q3 credit FSM landed.
  Items 6, 7, 8 from the recommendation table are now demo-able as in-process mocks.
  canton-adapter exposes parties/commands/events HTTP surface (RAM-backed). hydrax-adapter
  adds subscribe/custody/settle/NAV. workflow-svc/internal/credit codifies the short-duration
  credit FSM as pure code (no schema yet — Q3 user accept still required).
  Plan: docs/plans/2026-04-26-mock-canton-testnet-and-rails.md.
```

---

## Self-Review

**Spec coverage:** Item 6 (Q3 credit lifecycle) → Slice C. Item 7 (synchronizer + party allocation) → Slice A. Item 8 (HydraX rails) → Slice B. Items 10/11/12/13/14 are user-only or shared infra and stay needs-approval — they are **not** in this plan and the plan must not ship code that pretends to resolve them.

**Placeholder scan:** Every code block is complete. No "TODO", no "implement later", no placeholder error handling. Every test in C1 is fully written. Every state in the FSM matches the doc comment.

**Type consistency:** `Rails` interface in Slice B has 5 methods (Issue + 4 new), naming consistent (`Subscribe`, `TransferCustody`, `Settle`, `NAV`). FSM in Slice C uses `State` typed string with `State*` constants — same shape as `lifecycle` and `sublifecycle`. Ledger in Slice A uses `uint64` for offsets consistently across `SubmitCreate`, `SubmitExercise`, `EventsAfter`.

**File count per commit:** A=10, B=11, C=2. All under the 15-file cap.

**Honest scope:** This plan does NOT mark items 10–14 as resolved. It does NOT promise real Canton, real HydraX, or real persistence. It explicitly calls out the swap-to-real path so the next plan can pick it up cleanly.

---

## Execution

Three slices are independent (different services, no shared files). Dispatched in parallel via `Agent({subagent_type: "general-purpose"})` with one slice each. Main session reviews + integrates.
