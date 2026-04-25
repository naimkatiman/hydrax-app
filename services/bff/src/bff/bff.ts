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
