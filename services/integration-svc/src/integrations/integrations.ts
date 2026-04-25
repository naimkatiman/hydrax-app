// Owns external-system integrations: KYC/KYB, SSO, CRM.
// Concrete adapters land once first tenant design partner is locked
// (PRD-v2 §14 Q4) — vendor selection depends on tenant requirements.

export type Provider = "kyc" | "kyb" | "sso" | "crm";

export interface ProviderConfig {
  tenantId: string;
  provider: Provider;
  endpoint: string;
}
