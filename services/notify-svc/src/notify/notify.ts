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
