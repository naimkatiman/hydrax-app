# Agent Teams — Eval for hydrax-app

**Date:** 2026-04-26
**Source:** [code.claude.com/docs/en/agent-teams](https://code.claude.com/docs/en/agent-teams)
**Status:** Decision doc. Not enabled. No code change.
**Verdict:** **Don't enable globally yet. Trial on a throwaway repo first; reconsider after hydrax-app has a stable v1 web build and the past concurrent-staging risk is mitigated.**

## What it is

Real Anthropic feature, experimental, off by default. Multi-session orchestration: a "lead" Claude Code session spawns full Claude Code sessions as "teammates," each with its own context window. Coordination is via a shared task list (with file-locked claim), automatic mailbox messaging between teammates, and idle notifications back to the lead. Distinct from subagents (the `Agent` tool) — subagents only report back to caller, never message peers, and live in one session.

**Requires Claude Code v2.1.32+.** Check with `claude --version`.

## How to enable

```jsonc
// ~/.claude/settings.json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  },
  "teammateMode": "in-process"   // or "tmux" / "auto"
}
```

In-process mode works in any terminal (Shift+Down to cycle teammates). Split-pane mode needs tmux or iTerm2 + `it2` CLI — VS Code integrated terminal, Windows Terminal, and Ghostty are unsupported for split panes. WSL2 here = in-process only unless we install tmux (`apt-get` requires user-level approval per past mistake 2026-04-25).

## State on disk

- Team config: `~/.claude/teams/{team-name}/config.json` (auto-generated, do not hand-edit — overwritten on next state update)
- Task list: `~/.claude/tasks/{team-name}/`
- No project-level `.claude/teams/teams.json` is honored — teams are user-scoped only

The two empty UUID dirs in `~/.claude/tasks/` from April 11/16 are leftovers from prior tooling, not agent-teams state.

## Cost model

Linear scaling per teammate. Each teammate is a separate Claude Code session with its own context window (CLAUDE.md + MCP + skills load fresh per teammate, no conversation-history inheritance). Doc explicitly: "Agent teams use significantly more tokens than a single session." For 3-5 teammates that's roughly 3-5x baseline burn. Recommended sweet spot per doc: 3-5 teammates, 5-6 tasks each.

## Hydrax-app fit

| Workflow | Verdict |
|---|---|
| Cross-portal frontend polish (issuer + distributor + investor + ops + admin in parallel) | **Strong fit** — independent app dirs, no shared mutable state mid-task, matches "new modules" use case |
| Backend-services scaffold expansion (Go services in `services/`) | **Moderate fit** — go.work workspace allows per-service isolation, but Docker/Compose changes touch cross-service files |
| Prototype work ([index.html](../../index.html) + [app.js](../../app.js) + [styles.css](../../styles.css)) | **Anti-fit** — the three files must change in lockstep per CLAUDE.md "Prototype" gotchas; parallel teammates would race the lockstep audit |
| Plan-doc + STATE.yaml updates | **Anti-fit** — STATE.yaml is already a known concurrent-edit hotspot (past mistake 2026-04-25) |
| BFF ↔ web/api-client ↔ portal slices (auth foundation work in flight) | **Anti-fit for now** — these slices already showed concurrent-staging bugs in commit `78da9a4`; adding multi-session coordination on top compounds the failure mode |
| Adversarial code review on a finished PR | **Strong fit** — matches doc's "competing hypotheses" pattern, read-only |

## Hydrax-specific risks

1. **Concurrent staging compounds the past mistake (2026-04-25, commit `78da9a4`).** That bug — path-scoped `git add` not unstaging unrelated index entries — happened with two sessions. Five teammates writing to the same working tree multiplies the surface. Mitigation: use git worktrees per teammate (one branch each), not a shared tree.
2. **`go.work` + Docker divergence (past mistake feedback memory).** Each teammate runs `GOWORK=off go build`-style verification independently. If five teammates each touch a different `services/<svc>/`, no single one will catch a workspace-wide go.work breakage. Mitigation: lead runs the cross-service verification gate after teammate completion.
3. **STATE.yaml + plan docs.** Multi-teammate edits to STATE.yaml will collide. Rule: only the lead writes STATE.yaml, teammates report back via mailbox.
4. **No session resumption.** `/resume` and `/rewind` do NOT restore in-process teammates. Long-running multi-day work loses the team on every resume. Treat agent teams as single-session, ephemeral.
5. **`skills` and `mcpServers` frontmatter on subagent definitions are NOT applied when spawned as a teammate** — they load from project + user settings only. Any skill-locked subagent recipe behaves differently as a teammate.
6. **One team per session, no nesting.** Teammates can't spawn teammates. The lead is fixed for the team's lifetime.

## Verification gates the lead must run

Before any teammate-driven commit, the lead must execute the existing hydrax-app gates — these do not run automatically inside teammates:

- Per-service: `cd services/<svc> && go vet ./... && go test ./...` (workspace-wide `go test ./...` from repo root still fails on Go 1.26 + go.work — past mistake 2026-04-25)
- Web: `pnpm -r --if-present typecheck && pnpm -r --if-present test -- --run && pnpm -r --if-present build`
- Prototype (if touched): `node --check app.js`, id audit, css audit, `wc -l`, `git diff --stat`

## Recommendation

**Do not enable on this machine yet.** Reasons:
1. v1 web build is mid-flight (auth-foundation, workflow-lifecycle-http plans active 2026-04-25/26). Adding multi-session orchestration during active layered commits is the worst possible time.
2. Concurrent-staging mitigation (mandatory worktree-per-teammate) isn't yet a documented workflow in CLAUDE.md.
3. Cost — 3-5x token burn on routine work outweighs benefit for the current single-developer cadence.

**Enable when** all four are true:
- v1 web scaffold + auth foundation are committed and verified
- A `git worktree`-per-teammate convention is added to CLAUDE.md and rehearsed once on a non-hydrax repo
- Claude Code is confirmed ≥ v2.1.32 (`claude --version`)
- A specific use case justifies it — cross-portal parallel frontend polish OR adversarial multi-reviewer code review on a finished PR

**Trial plan when ready:**
1. Throwaway repo: `mkdir /tmp/agent-teams-trial && cd $_ && git init`
2. Set env var in `~/.claude/settings.json`
3. Restart Claude Code, run `claude --version` ≥ 2.1.32
4. Prompt: "Create an agent team with 3 teammates to draft a README from three angles (technical, marketing, contributor onboarding). Use Sonnet."
5. Verify mailbox + task list behavior, observe token burn in `/cost`
6. `Clean up the team`, then `tmux ls` to check for orphaned sessions

If trial passes, first hydrax-app use should be a **read-only adversarial review** on a finished PR — never an implementation slice — until the worktree-per-teammate convention is proven.

## Out of scope

- Comparing against `claude-devfleet` or `superpowers:dispatching-parallel-agents` — both already work without the experimental flag
- Splitting hydrax-app into separate Claude Code projects to enable per-project teams
- Building tooling on top of `~/.claude/teams/` or `~/.claude/tasks/` — Anthropic explicitly warns against hand-editing
