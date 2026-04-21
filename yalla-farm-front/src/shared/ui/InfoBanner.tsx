import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

type Tone = "info" | "success" | "warning" | "danger";

type Props = {
  text: string;
  icon?: IconName;
  tone?: Tone;
  action?: ReactNode;
};

const tones: Record<Tone, string> = {
  info: "bg-accent-sky text-tertiary",
  success: "bg-accent-mint text-primary",
  warning: "bg-warning-soft text-warning",
  danger: "bg-secondary/15 text-secondary",
};

const defaultIcons: Record<Tone, IconName> = {
  info: "bolt",
  success: "check",
  warning: "warning",
  danger: "warning",
};

export function InfoBanner({ text, icon, tone = "info", action }: Props) {
  const IconName = icon ?? defaultIcons[tone];
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold ${tones[tone]}`}
    >
      <Icon name={IconName} size={14} />
      <span>{text}</span>
      {action}
    </div>
  );
}
