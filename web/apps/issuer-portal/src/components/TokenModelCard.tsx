import type { ReactNode, CSSProperties } from "react";
import { Heading, Stack, Text, Icon } from "@hydrax/ui";
import { FileText, Users, Workflow, Database } from "lucide-react";

const TERMINAL_STATES = new Set(["matured", "cancelled"]);

export interface TokenModelCardProps {
  readonly templateName: string;
  readonly stakeholders: ReadonlyArray<string>;
  readonly lifecycleStates: ReadonlyArray<string>;
  readonly offLedgerFields: ReadonlyArray<string>;
}

const sectionStyle: CSSProperties = {
  border: "1px solid var(--hydrax-color-border)",
  borderRadius: "var(--hydrax-radius-md)",
  padding: "var(--hydrax-space-md)",
  background: "var(--hydrax-color-bg-raised, var(--hydrax-color-bg))",
};

const stateChipStyle = (terminal: boolean): CSSProperties => ({
  display: "inline-block",
  padding: "2px 8px",
  marginRight: 6,
  marginBottom: 4,
  borderRadius: 4,
  fontFamily: "var(--hydrax-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)",
  fontSize: "var(--hydrax-type-body-sm-size)",
  border: terminal
    ? "1px dashed var(--hydrax-color-accent)"
    : "1px solid var(--hydrax-color-border)",
  color: terminal
    ? "var(--hydrax-color-accent)"
    : "var(--hydrax-color-text-strong)",
});

export function TokenModelCard({
  templateName,
  stakeholders,
  lifecycleStates,
  offLedgerFields,
}: TokenModelCardProps): ReactNode {
  return (
    <Stack gap="md" style={sectionStyle}>
      <Stack gap="xs">
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Icon icon={FileText} label="Token model" size={16} />
          <Heading level="h2">Token Model</Heading>
        </span>
        <Text tone="muted">
          Daml template · <strong>{templateName}</strong>
        </Text>
      </Stack>

      <Stack gap="xs">
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Icon icon={Users} label="Stakeholders" size={14} />
          <Text>
            <strong>{stakeholders.length} stakeholders</strong> · {stakeholders.join(", ")}
          </Text>
        </span>
      </Stack>

      <Stack gap="xs">
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Icon icon={Workflow} label="Lifecycle" size={14} />
          <Text>
            <strong>Lifecycle states</strong>
          </Text>
        </span>
        <div>
          {lifecycleStates.map((s) => {
            const terminal = TERMINAL_STATES.has(s);
            return (
              <span
                key={s}
                style={stateChipStyle(terminal)}
                data-terminal={terminal ? "true" : "false"}
              >
                {s}
              </span>
            );
          })}
        </div>
      </Stack>

      {offLedgerFields.length > 0 && (
        <Stack gap="xs">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Icon icon={Database} label="Off-ledger fields" size={14} />
            <Text>
              <strong>Off-ledger fields</strong> (workflow-svc owns)
            </Text>
          </span>
          <Text tone="muted">{offLedgerFields.join(" · ")}</Text>
        </Stack>
      )}
    </Stack>
  );
}
