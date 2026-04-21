type Props = {
  className?: string;
  rounded?: "md" | "lg" | "xl" | "2xl" | "3xl" | "full";
};

const roundeds = {
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
  "3xl": "rounded-3xl",
  full: "rounded-full",
};

export function Skeleton({ className = "", rounded = "2xl" }: Props) {
  return (
    <div
      className={`animate-pulse bg-surface-container-high ${roundeds[rounded]} ${className}`}
    />
  );
}
