interface AvatarProps {
  readonly name: string;
  readonly size?: number;
}

function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "??";
  const parts = trimmed.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export function Avatar({ name, size = 28 }: AvatarProps) {
  return (
    <span
      role="img"
      aria-label={`Avatar for ${name}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: "50%",
        background: "var(--hydrax-color-bg-raised)",
        border: "1px solid var(--hydrax-color-border)",
        color: "var(--hydrax-color-text-strong)",
        fontFamily: "var(--hydrax-font-sans)",
        fontSize: Math.round(size * 0.42),
        fontWeight: 600,
        userSelect: "none",
      }}
    >
      {initials(name)}
    </span>
  );
}
