"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/shared/lib/redux";
import { createPrescription } from "@/entities/prescription/api";
import { AppShell } from "@/widgets/layout/AppShell";
import { TopBar } from "@/widgets/layout/TopBar";
import { Button, Icon, Input } from "@/shared/ui";

const MAX_PHOTOS = 2;
const ACCEPTED = "image/png,image/jpeg,image/jpg,image/webp";

export default function NewPrescriptionPage() {
  const token = useAppSelector((s) => s.auth.token);
  const role = useAppSelector((s) => s.auth.role);
  const hydrated = useAppSelector((s) => s.auth.hydrated);
  const router = useRouter();

  const [photos, setPhotos] = useState<File[]>([]);
  const [age, setAge] = useState<string>("");
  const [comment, setComment] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auth gate — same pattern as /prescriptions. Wait for the auth slice
  // to hydrate from localStorage so a refresh doesn't kick the user out.
  useEffect(() => {
    if (!hydrated) return;
    if (!token) { router.replace("/login?next=/prescriptions/new"); return; }
    if (role && role !== "Client") router.replace("/");
  }, [hydrated, token, role, router]);

  // Object URLs for inline previews; revoke on photos[] change to avoid leaks.
  const previews = useMemo(
    () => photos.map((file) => URL.createObjectURL(file)),
    [photos]
  );
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    const merged = [...photos, ...picked].slice(0, MAX_PHOTOS);
    setPhotos(merged);
    event.target.value = "";
  }

  function onRemovePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!token) return;

    const ageNum = Number(age);
    if (!Number.isFinite(ageNum) || ageNum <= 0 || ageNum > 150) {
      setError("Введите корректный возраст пациента.");
      return;
    }
    if (photos.length === 0) {
      setError("Добавьте хотя бы одно фото рецепта.");
      return;
    }

    setSubmitting(true);
    try {
      const created = await createPrescription(token, {
        patientAge: ageNum,
        clientComment: comment.trim() || null,
        photos
      });
      // Если бэк выдал DC payment URL — отправляем клиента на оплату 3 TJS.
      // Перед редиректом подменяем текущий URL на /prescriptions, чтобы
      // браузерный «Назад» с DC-страницы привёл клиента сразу в список
      // «Мои рецепты», а не обратно на пустую форму загрузки.
      // После возврата клиент нажмёт «Я оплатил» на странице деталей,
      // что переведёт заявку в AwaitingConfirmation для SuperAdmin'а.
      if (created.paymentUrl) {
        window.history.replaceState({}, "", "/prescriptions");
        window.location.href = created.paymentUrl;
        return;
      }
      router.push(`/prescriptions/${created.prescriptionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить рецепт.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell top={<TopBar title="Новый рецепт" backHref="back" />}>
      <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-5">
        <section className="space-y-3">
          <h2 className="font-display text-base font-extrabold">Фото рецепта</h2>
          <p className="text-xs text-on-surface-variant">
            До 2 фото, png/jpg/webp. Нужны разборчивые фотографии — это поможет
            фармацевту правильно расшифровать рецепт.
          </p>

          <div className="grid grid-cols-2 gap-3">
            {previews.map((src, idx) => (
              <div
                key={src}
                className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-surface-container shadow-card"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => onRemovePhoto(idx)}
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-surface/90 text-on-surface shadow-card transition hover:bg-secondary-soft hover:text-secondary"
                  aria-label="Удалить фото"
                >
                  <Icon name="close" size={14} />
                </button>
              </div>
            ))}

            {photos.length < MAX_PHOTOS ? (
              <label className="flex aspect-[3/4] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-outline bg-surface-container-low text-on-surface-variant transition hover:border-primary hover:text-primary">
                <Icon name="plus" size={28} />
                <span className="text-xs font-semibold">Добавить фото</span>
                <input
                  type="file"
                  accept={ACCEPTED}
                  multiple
                  className="hidden"
                  onChange={onPick}
                />
              </label>
            ) : null}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-base font-extrabold">Возраст пациента</h2>
          <Input
            type="number"
            min={0}
            max={150}
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="Например, 35"
            required
          />
          <p className="text-xs text-on-surface-variant">
            Нужен фармацевту для подбора дозировки.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-base font-extrabold">
            Комментарий <span className="text-on-surface-variant/60">(необязательно)</span>
          </h2>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Уточнения для фармацевта: аллергии, замены, форма выпуска…"
            rows={4}
            maxLength={1000}
            className="w-full rounded-2xl border border-outline bg-surface-container-lowest p-3 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:outline-none"
          />
        </section>

        {error ? (
          <div className="rounded-2xl bg-secondary/10 p-3 text-sm font-semibold text-secondary">
            {error}
          </div>
        ) : null}

        <div className="rounded-2xl bg-accent-soft p-4 text-sm text-on-surface">
          <p className="font-bold">Услуга платная — 3 TJS</p>
          <p className="mt-1 text-xs text-on-surface-variant">
            После отправки система выставит счёт. Расшифровка начнётся, когда
            оплата будет подтверждена.
          </p>
        </div>

        <Button type="submit" size="lg" fullWidth loading={submitting} disabled={submitting}>
          Отправить рецепт
        </Button>
      </form>
    </AppShell>
  );
}
