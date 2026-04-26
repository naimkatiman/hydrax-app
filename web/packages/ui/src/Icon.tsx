import type { LucideIcon } from "lucide-react";
import type { ComponentProps, ComponentType } from "react";

type AnimatedIconComponent = ComponentType<{ className?: string; size?: number }>;

interface BaseIconProps {
  readonly label: string;
  readonly size?: number;
  readonly className?: string;
}

interface LucideIconProps extends BaseIconProps, Omit<ComponentProps<LucideIcon>, "ref" | "size" | "className"> {
  readonly icon: LucideIcon;
  readonly animated?: never;
}

interface AnimatedIconProps extends BaseIconProps {
  readonly icon: AnimatedIconComponent;
  readonly animated: true;
}

export type IconProps = LucideIconProps | AnimatedIconProps;

export function Icon(props: IconProps) {
  if (props.animated) {
    const { icon: AnimatedComponent, label, size = 16, className } = props;
    return (
      <span aria-label={label} role="img" className={className}>
        <AnimatedComponent size={size} />
      </span>
    );
  }
  const { icon: LucideIconComponent, label, size = 16, className, animated: _animated, ...rest } = props;
  return (
    <LucideIconComponent aria-label={label} role="img" size={size} className={className} {...rest} />
  );
}
