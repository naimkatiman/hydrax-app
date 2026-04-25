import { type LucideIcon } from "lucide-react";
import type { ComponentProps } from "react";

interface IconProps extends Omit<ComponentProps<LucideIcon>, "ref"> {
  readonly icon: LucideIcon;
  readonly label: string;
}

export function Icon({ icon: LucideIconComponent, label, size = 16, ...rest }: IconProps) {
  return <LucideIconComponent aria-label={label} role="img" size={size} {...rest} />;
}
