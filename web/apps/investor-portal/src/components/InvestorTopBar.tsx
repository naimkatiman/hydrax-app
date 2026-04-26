import { Search, Bell } from "lucide-react";
import { Avatar, Icon, PersonaSwitcher, Stack } from "@hydrax/ui";

interface InvestorTopBarProps {
  readonly userName: string;
}

export function InvestorTopBar({ userName }: InvestorTopBarProps) {
  return (
    <Stack direction="row" align="center" gap="md" style={{ flex: 1 }}>
      <div
        role="search"
        style={{
          flex: 1,
          maxWidth: 480,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 10px",
          background: "var(--hydrax-color-surface)",
          border: "1px solid var(--hydrax-color-border)",
          borderRadius: "var(--hydrax-radius-md)",
          color: "var(--hydrax-color-text-muted)",
          fontFamily: "var(--hydrax-font-sans)",
          fontSize: "var(--hydrax-type-body-size)",
        }}
      >
        <Icon icon={Search} label="Search" size={14} />
        <span aria-hidden="true">Search holdings, subscriptions, notices…</span>
      </div>
      <div style={{ flex: 1 }} />
      <button
        type="button"
        aria-label="Notifications"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 32,
          height: 32,
          borderRadius: "var(--hydrax-radius-sm)",
          background: "transparent",
          border: "1px solid transparent",
          color: "var(--hydrax-color-text-muted)",
          cursor: "pointer",
        }}
      >
        <Icon icon={Bell} label="Notifications" size={16} />
      </button>
      <PersonaSwitcher current="investor" />
      <Avatar name={userName} />
    </Stack>
  );
}
