"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/shared/lib/redux";
import { getPharmacistQueue } from "@/entities/pharmacist/api";
import { type ApiPrescription } from "@/entities/prescription/api";
import { AppShell } from "@/widgets/layout/AppShell";
import { TopBar } from "@/widgets/layout/TopBar";
import { AuthedImage } from "@/shared/ui";

export default function PharmacistQueuePage() {
  const token = useAppSelector((s) => s.auth.token);
  const role = useAppSelector((s) => s.auth.role);
  const hydrated = useAppSelector((s) => s.auth.hydrated);
  const router = useRouter();

  const [items, setItems] = useState<ApiPrescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) { router.replace("/login?next=/pharmacist"); return; }
    if (role && role !== "Pharmacist") router.replace("/");
  }, [hydrated, token, role, router]);

  useEffect(() => {
    if (!token || role !== "Pharmacist") return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getPharmacistQueue(token)
      .then((data) => { if (!cancelled) { setItems(data); setLoading(false); } })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Не удалось загрузить очередь.");
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [token, role]);

  return (
    <AppShell hideGlobalNav top={<TopBar title="Кабинет фармацевта" showLogout />}>
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="rounded-2xl bg-gradient-to-br from-primary to-primary-container p-5 text-white">
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Pharmacist</p>
          <h1 className="text-xl font-extrabold">Очередь рецептов на расшифровку</h1>
          <p className="mt-1 text-sm opacity-80">
            Возьмите любую заявку в работу — у вас откроется &laquo;активная корзина&raquo; для составления чек-листа.
          </p>
        </div>

        {error ? (
          <div className="rounded-2xl bg-secondary/10 p-3 text-sm font-semibold text-secondary">{error}</div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl bg-surface-container-low p-6 text-sm text-on-surface-variant">
            Загружаем очередь…
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl bg-surface-container-low p-6 text-sm text-on-surface-variant">
            Очередь пуста. Новые заявки появятся, как только SuperAdmin подтвердит оплату.
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((p) => {
              const created = new Date(p.createdAtUtc).toLocaleString("ru-RU");
              return (
                <li key={p.prescriptionId}>
                  <Link
                    href={`/pharmacist/${p.prescriptionId}`}
                    className="flex items-start gap-3 rounded-2xl bg-surface-container-lowest p-3 shadow-card transition hover:bg-surface-container xs:p-4"
                  >
                    <div className="flex flex-shrink-0 gap-2">
                      {p.images.slice(0, 2).map((img) => (
                        <AuthedImage
                          key={img.id}
                          src={img.url}
                          alt=""
                          className="h-20 w-16 rounded-lg object-cover bg-surface-container"
                        />
                      ))}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">Возраст: {p.patientAge}</p>
                      {p.clientComment ? (
                        <p className="mt-1 line-clamp-2 text-xs text-on-surface-variant">
                          {p.clientComment}
                        </p>
                      ) : null}
                      <p className="mt-1 text-[11px] text-on-surface-variant">{created}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
