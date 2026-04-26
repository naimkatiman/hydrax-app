import type { ReactNode, CSSProperties } from "react";
import { Card, Heading, Stack, Text, Icon } from "@hydrax/ui";
import { Network, UserPlus } from "lucide-react";

interface Stakeholder {
  readonly party: string;
  readonly addedByWorkflow: string;
}

interface ContractTemplate {
  readonly name: string;
  readonly stakeholders: ReadonlyArray<Stakeholder>;
}

const TEMPLATES: ReadonlyArray<ContractTemplate> = [
  {
    name: "ShortDurationCreditNote",
    stakeholders: [
      { party: "Issuer", addedByWorkflow: "issuance" },
      { party: "Distributor", addedByWorkflow: "distribution-onboarding" },
      { party: "Investor", addedByWorkflow: "subscription" },
      { party: "Custodian", addedByWorkflow: "custody-binding" },
    ],
  },
  {
    name: "SubscriptionRequest",
    stakeholders: [
      { party: "Issuer", addedByWorkflow: "issuance" },
      { party: "Investor", addedByWorkflow: "subscription" },
      { party: "Approver", addedByWorkflow: "subscription-approval" },
    ],
  },
  {
    name: "DistributionAgreement",
    stakeholders: [
      { party: "Issuer", addedByWorkflow: "issuance" },
      { party: "Distributor", addedByWorkflow: "distribution-onboarding" },
      { party: "Compliance", addedByWorkflow: "compliance-attestation" },
    ],
  },
];

const cardGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: "var(--hydrax-space-md)",
};

const contractCardStyle: CSSProperties = {
  border: "1px solid var(--hydrax-color-border)",
  borderRadius: "var(--hydrax-radius-md)",
  padding: "var(--hydrax-space-md)",
  background: "var(--hydrax-color-bg)",
};

const stakeholderRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 10px",
  borderRadius: 6,
  background: "var(--hydrax-color-bg-raised, rgba(255,255,255,0.02))",
  border: "1px solid var(--hydrax-color-border)",
  fontSize: "var(--hydrax-type-body-sm-size)",
};

const workflowChipStyle: CSSProperties = {
  marginLeft: "auto",
  fontFamily: "var(--hydrax-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)",
  fontSize: "calc(var(--hydrax-type-body-sm-size) * 0.92)",
  color: "var(--hydrax-color-accent)",
};

export function ComposabilityRoute(): ReactNode {
  return (
    <Card
      title={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Icon icon={Network} label="Composability map" size={18} />
          <Heading level="h1">Composability map</Heading>
        </span>
      }
    >
      <Stack gap="md">
        <Text tone="muted">
          Each Daml template declares its stakeholder set at modelling time. The
          orchestration plane is responsible for adding the right principals at
          issuance so downstream choices are reachable. This view enumerates the
          active templates and the workflows that materialise each stakeholder.
        </Text>
        <div style={cardGridStyle}>
          {TEMPLATES.map((t) => (
            <div
              key={t.name}
              data-testid={`contract-card-${t.name}`}
              style={contractCardStyle}
            >
              <Stack gap="sm">
                <Heading level="h2" as="h3">
                  {t.name}
                </Heading>
                <Stack gap="xs">
                  {t.stakeholders.map((s) => (
                    <div key={s.party} style={stakeholderRowStyle}>
                      <Icon icon={UserPlus} label="add stakeholder" size={12} />
                      <span>{s.party}</span>
                      <span style={workflowChipStyle}>
                        added by {s.addedByWorkflow}
                      </span>
                    </div>
                  ))}
                </Stack>
              </Stack>
            </div>
          ))}
        </div>
      </Stack>
    </Card>
  );
}
