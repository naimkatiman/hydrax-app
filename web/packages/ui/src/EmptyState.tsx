import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Icon } from "./Icon";
import { Heading } from "./Heading";
import { Text } from "./Text";
import { Stack } from "./Stack";

interface EmptyStateProps {
  readonly icon: LucideIcon;
  readonly iconLabel: string;
  readonly title: string;
  readonly body?: ReactNode;
  readonly action?: ReactNode;
  readonly imageSrc?: string;
  readonly imageAlt?: string;
}

export function EmptyState({
  icon,
  iconLabel,
  title,
  body,
  action,
  imageSrc,
  imageAlt,
}: EmptyStateProps) {
  return (
    <Stack
      align="center"
      justify="center"
      gap="md"
      style={{
        textAlign: "center",
        padding: "var(--hydrax-space-2xl) var(--hydrax-space-xl)",
        color: "var(--hydrax-color-text-muted)",
      }}
    >
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={imageAlt ?? ""}
          style={{
            maxWidth: 320,
            width: "100%",
            height: "auto",
            opacity: 0.85,
            borderRadius: "var(--hydrax-radius-md)",
          }}
        />
      ) : (
        <div
          style={{
            width: 48,
            height: 48,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "var(--hydrax-radius-lg)",
            background: "var(--hydrax-color-bg-raised)",
            border: "1px solid var(--hydrax-color-border)",
          }}
        >
          <Icon icon={icon} label={iconLabel} size={20} />
        </div>
      )}
      <Heading level="h2" as="h2">
        {title}
      </Heading>
      {body ? <Text tone="muted">{body}</Text> : null}
      {action ? <div style={{ marginTop: "var(--hydrax-space-sm)" }}>{action}</div> : null}
    </Stack>
  );
}
