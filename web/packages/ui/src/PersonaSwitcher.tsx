import { useState, type CSSProperties } from "react";
import { Briefcase, ChevronDown, Handshake, ShieldCheck, type LucideIcon } from "lucide-react";
import { Icon } from "./Icon";

export type PersonaId = "investor" | "distributor" | "ops" | "issuer" | "admin";

export interface Persona {
  readonly id: PersonaId;
  readonly label: string;
  readonly url: string;
  readonly icon: LucideIcon;
}

function readEnv(envKey: string, fallback: string): string {
  const viteEnv = (import.meta as { env?: Record<string, string | undefined> }).env;
  if (viteEnv?.[envKey]) return viteEnv[envKey]!;
  return fallback;
}

// Default URLs are RELATIVE so they work for both local dev (each portal
// on its own Vite port; cross-portal nav opens a new origin which is fine
// for the demo) and the combined Railway deploy at web/portal-deploy/
// where all 5 portals live under one origin at /investor, /distributor,
// /ops, etc. Override per env if a portal needs to point somewhere else.
export const DEFAULT_PERSONAS: ReadonlyArray<Persona> = [
  {
    id: "investor",
    label: "Investor",
    url: readEnv("VITE_INVESTOR_URL", "/investor/products"),
    icon: Briefcase,
  },
  {
    id: "distributor",
    label: "Distributor",
    url: readEnv("VITE_DISTRIBUTOR_URL", "/distributor/approvals"),
    icon: Handshake,
  },
  {
    id: "ops",
    label: "Operator",
    url: readEnv("VITE_OPS_URL", "/ops/audit"),
    icon: ShieldCheck,
  },
];

interface PersonaSwitcherProps {
  readonly current: PersonaId;
  readonly personas?: ReadonlyArray<Persona>;
}

const triggerStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 10px",
  background: "var(--hydrax-color-surface)",
  border: "1px solid var(--hydrax-color-border)",
  borderRadius: "var(--hydrax-radius-sm)",
  color: "var(--hydrax-color-text-strong)",
  fontFamily: "var(--hydrax-font-sans)",
  fontSize: "var(--hydrax-type-bodySm-size)",
  cursor: "pointer",
};

const menuStyle: CSSProperties = {
  position: "absolute",
  top: "calc(100% + 4px)",
  right: 0,
  minWidth: 220,
  padding: 4,
  background: "var(--hydrax-color-surface)",
  border: "1px solid var(--hydrax-color-border)",
  borderRadius: "var(--hydrax-radius-sm)",
  boxShadow: "var(--hydrax-shadow-md)",
  display: "flex",
  flexDirection: "column",
  gap: 2,
  zIndex: 20,
};

const linkBaseStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 10px",
  textDecoration: "none",
  color: "var(--hydrax-color-text)",
  borderRadius: "var(--hydrax-radius-sm)",
  fontFamily: "var(--hydrax-font-sans)",
  fontSize: "var(--hydrax-type-bodySm-size)",
};

export function PersonaSwitcher({ current, personas = DEFAULT_PERSONAS }: PersonaSwitcherProps) {
  const [open, setOpen] = useState(false);
  const currentPersona = personas.find((p) => p.id === current) ?? personas[0];
  if (!currentPersona) return null;

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        aria-label="Switch persona"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={triggerStyle}
      >
        <Icon icon={currentPersona.icon} label={currentPersona.label} size={14} />
        <span>{currentPersona.label}</span>
        <Icon icon={ChevronDown} label="Open menu" size={12} />
      </button>
      {open ? (
        <div role="menu" style={menuStyle}>
          {personas.map((p) => (
            <a
              key={p.id}
              href={p.url}
              role="menuitem"
              style={{
                ...linkBaseStyle,
                background: p.id === current ? "var(--hydrax-color-bg)" : "transparent",
              }}
            >
              <Icon icon={p.icon} label={p.label} size={14} />
              <span>{p.label}</span>
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
