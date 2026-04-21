import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

type Props = {
  icon?: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ icon = "bag", title, description, action, className = "" }: Props) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 rounded-3xl bg-surface-container-low p-8 text-center ${className}`}>
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon name={icon} size={28} />
      </span>
      <h3 className="font-display text-lg font-bold text-on-surface">{title}</h3>
      {description ? (
        <p className="max-w-xs text-sm text-on-surface-variant">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
