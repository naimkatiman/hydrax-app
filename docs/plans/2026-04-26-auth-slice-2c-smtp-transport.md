# Auth Slice 2c — Real Email Transport (SMTP via nodemailer)

## Goal

Replace `EMAIL_TRANSPORT=console` (slice 2b) with a production-shape `smtp` transport so magic-link emails actually reach inboxes. After this slice, `notify-svc` running with a real SMTP server (MailHog locally, SES/SendGrid/Resend/raw SMTP in prod) delivers magic-link mail end-to-end.

## Why nodemailer + raw SMTP

- **nodemailer** is the de-facto Node SMTP client (>20M weekly downloads, MIT, no deprecation history).
- Raw SMTP works against MailHog locally and AWS SES (SMTP endpoint), SendGrid (SMTP endpoint), Resend (SMTP endpoint), Postmark (SMTP endpoint), and any self-hosted Postfix/Sendmail. One transport, four-plus production options without per-vendor adapters in the codebase.
- Vendor-specific adapters (SES SDK, Resend SDK) are deliberately out of scope here — they're identical lines of code with one extra dep, easy to add later if a tenant needs OAuth-only auth (some Google Workspace deployments) or webhook reverse-channel.

## Non-goals

- **No HTML email.** Plain-text only — `text` field already mirrors slice 2b. HTML templates are a slice 2d/2e copy concern, not a transport concern.
- **No bounced-mail handling.** Out of scope; SMTP-level success ≠ inbox delivery, but the receipt path (Resend/SES webhooks) is its own future slice.
- **No per-tenant FROM addresses.** Single `SMTP_FROM` env. Tenant-specific senders land when the design partner asks for them.
- **No retries.** Slice 2c emits once per `/v1/notifications/email` call; rejection bubbles up as 502. Slice 2b's caller (integration-svc) already swallows errors so nothing user-facing breaks.

## In scope (4 tasks → 4 commits)

1. **Task 1** — `pnpm add nodemailer + @types/nodemailer` to `services/notify-svc/`. Single dep commit, no logic.
2. **Task 2** — `notify-svc/src/smtp-config.ts` + `email-config.ts` widens `EmailTransport` to include `"smtp"` + bounded SMTP env loader. Tests for new + existing paths.
3. **Task 3** — Sender abstraction. New `notify-svc/src/email-sender.ts` exports `EmailSender` interface + 3 impls (`consoleSender`, `noopSender`, `createSmtpSender(transport)`). `email-handlers.ts` accepts an `EmailSender` instead of branching on `transport` enum. `server.ts` builds the right sender from config (factory injected for testability). Mocked nodemailer in tests.
4. **Task 4** — `docs/env.md` extends Slice 2b section with the 6 SMTP vars; STATE.yaml verification log; integration smoke against MailHog (best-effort — if Docker not available, log skip).

## Endpoints + wire shape

No new endpoints. `POST /v1/notifications/email` body unchanged. The only observable difference is that with `EMAIL_TRANSPORT=smtp` and valid SMTP creds, the request results in a real outbound TCP connection on port 25/465/587 and the upstream SMTP server responds 250.

## Env vars

| Var | Service | Default | Purpose |
|---|---|---|---|
| `EMAIL_TRANSPORT` | notify-svc | `console` | Now accepts `console`, `noop`, **`smtp`**. |
| `SMTP_HOST` | notify-svc | — | SMTP server hostname. **Required** when `EMAIL_TRANSPORT=smtp`. |
| `SMTP_PORT` | notify-svc | `587` | Range 1-65535. Common: 25 (plain), 465 (TLS implicit), 587 (STARTTLS). |
| `SMTP_USER` | notify-svc | — | SMTP auth user. Optional (some local dev SMTPs accept anonymous). |
| `SMTP_PASS` | notify-svc | — | SMTP auth password. Optional, **must be paired with `SMTP_USER`** if set. |
| `SMTP_SECURE` | notify-svc | auto | `true` forces TLS implicit (port 465 default); `false` forces STARTTLS-or-plain; unset = auto-detect from port 465. |
| `SMTP_FROM` | notify-svc | `noreply@hydrax.local` | `From:` header value on outbound mail. |

`EMAIL_TRANSPORT=smtp` with `SMTP_HOST` unset → `loadSmtpConfig` throws at startup (fail-closed, matches the WebAuthn config pattern from slice 2a). Config validation is exhaustive: bad transport name throws, port out of range throws, `SMTP_USER` set without `SMTP_PASS` (or vice versa) throws.

## Acceptance criteria

- [ ] All 4 tasks ship as 4 single-concern commits (≤6 files each).
- [ ] `pnpm -r --if-present typecheck` green; `pnpm -r --if-present test -- --run` green; `pnpm -r --if-present build` green.
- [ ] `EmailTransport` union: `"console" | "noop" | "smtp"`.
- [ ] Default behavior unchanged: `EMAIL_TRANSPORT=` (unset) still uses console transport. Existing console + noop tests stay green.
- [ ] New tests: smtp config loader (≥6 cases — defaults, host required, bad port, user/pass pairing, secure auto, custom FROM); smtp sender (≥3 cases — happy path with mocked nodemailer, transport rejection bubbles, FROM header included).
- [ ] STATE.yaml `verification_log` entry covers config + sender + smoke.
- [ ] (If MailHog available locally) Smoke: `EMAIL_TRANSPORT=smtp SMTP_HOST=localhost SMTP_PORT=1025 pnpm dev`, then `curl POST /v1/notifications/email` returns 202 and the message appears in MailHog's inbox at `http://localhost:8025`. If MailHog not available, smoke is recorded as "skipped — environmental" not "failed".

## Out-of-scope follow-ups

- HTML email templates (slice 2e/copy)
- Per-tenant `SMTP_FROM` overrides
- Bounce / complaint webhook handlers
- Retry queue with exponential backoff (notify-svc would need durable storage; out of scope for v1)
- Vendor-native adapters (SES SDK, Resend SDK, SendGrid SDK)

## Self-review notes

- ✓ Spec coverage: every PRD-listed transport (SMTP / SES / Resend) hits SMTP via nodemailer's adapter — the same client speaks all three. No vendor lock-in.
- ✓ Type consistency: `EmailTransport` is the only union widened; everything that currently dispatches on it (`email-handlers`, `server.ts`) gets refactored to dispatch on a `EmailSender` instance instead, which keeps future transport additions zero-LOC inside handlers.
- ✓ Scope: 4 tasks, ≤6 files each, total <400 LOC. Commit cap respected.
- ✓ Backward compatibility: default unchanged, slice 2b's CLI smoke flow still works without re-doing.
