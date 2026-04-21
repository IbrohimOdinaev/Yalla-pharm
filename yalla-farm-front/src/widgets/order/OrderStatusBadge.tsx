import { Chip } from "@/shared/ui";
import type { IconName } from "@/shared/ui";

type Props = { status: string };

type Meta = { label: string; icon: IconName; tone: "primary" | "secondary" | "tertiary" | "warning" | "neutral" | "success" };

const META: Record<string, Meta> = {
  New: { label: "Новый", tone: "tertiary", icon: "clock" },
  UnderReview: { label: "Проверка", tone: "tertiary", icon: "clock" },
  Preparing: { label: "Собирается", tone: "warning", icon: "bag" },
  Ready: { label: "Готов", tone: "primary", icon: "check" },
  OnTheWay: { label: "В пути", tone: "warning", icon: "truck" },
  DriverArrived: { label: "Курьер у вас", tone: "warning", icon: "pin" },
  PickedUp: { label: "Выдан", tone: "primary", icon: "check" },
  Delivered: { label: "Доставлен", tone: "primary", icon: "check" },
  Cancelled: { label: "Отменён", tone: "neutral", icon: "close" },
  Returned: { label: "Возврат", tone: "tertiary", icon: "warning" },
};

export function OrderStatusBadge({ status }: Props) {
  const meta = META[status] ?? { label: status, tone: "neutral" as const, icon: "info" as IconName };
  return (
    <Chip asButton={false} leftIcon={meta.icon} tone={meta.tone}>
      {meta.label}
    </Chip>
  );
}
