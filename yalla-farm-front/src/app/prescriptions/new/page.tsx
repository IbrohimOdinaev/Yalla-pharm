"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/shared/lib/redux";
import {
  createPrescription,
  type PrescriptionPreferenceTier,
  PRESCRIPTION_TIER_LABEL_RU,
  PRESCRIPTION_TIER_DESCRIPTION_RU,
} from "@/entities/prescription/api";
import { AppShell } from "@/widgets/layout/AppShell";
import { TopBar } from "@/widgets/layout/TopBar";
import { Button, Icon, Input } from "@/shared/ui";

const MAX_PHOTOS = 2;
const ACCEPTED = "image/png,image/jpeg,image/jpg,image/webp";

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

// Camera capture modal — opens a live video stream, shows a shutter button,
// captures the current frame as a JPEG File. Built on getUserMedia, which
// asks for camera access via the browser's native permission prompt the
// first time the page calls it. After a "Block" the prompt won't reappear
// (browser-enforced), so we surface an actionable message that tells the
// user to unblock in site settings.
function CameraCaptureModal({
  onCapture,
  onClose,
}: {
  onCapture: (file: File) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let active: MediaStream | null = null;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) {
          setError("Камера не поддерживается этим браузером.");
          setLoading(false);
        }
        return;
      }
      try {
        // facingMode "environment" prefers the rear camera on phones; ignored
        // on desktops with a single front-facing camera.
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        active = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        const err = e as DOMException;
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          setError(
            "Доступ к камере заблокирован. Разрешите камеру в настройках сайта (значок замка слева от адреса) и нажмите «Сфотографировать» снова."
          );
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          setError("Камера не найдена на этом устройстве.");
        } else {
          setError(err.message || "Не удалось включить камеру.");
        }
        setLoading(false);
      }
    }

    start();
    return () => {
      cancelled = true;
      active?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function snap() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `recipe-${Date.now()}.jpg`, { type: "image/jpeg" });
        onCapture(file);
      },
      "image/jpeg",
      0.92,
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative mx-4 w-full max-w-2xl overflow-hidden rounded-2xl bg-black shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
          aria-label="Закрыть"
        >
          <Icon name="close" size={18} />
        </button>

        {error ? (
          <div className="flex flex-col items-center gap-3 p-6 text-center">
            <p className="text-sm text-white">{error}</p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-image-backdrop px-5 py-2 text-sm font-semibold text-on-surface"
            >
              Закрыть
            </button>
          </div>
        ) : (
          <div className="relative">
            <video
              ref={videoRef}
              className="block h-auto w-full bg-black"
              playsInline
              muted
              autoPlay
            />
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-white" />
              </div>
            ) : null}
            <div className="absolute inset-x-0 bottom-0 flex justify-center pb-6">
              <button
                type="button"
                onClick={snap}
                disabled={loading}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-2xl transition hover:bg-white/90 active:scale-95 disabled:opacity-50"
                aria-label="Сделать снимок"
              >
                <span className="block h-12 w-12 rounded-full border-4 border-on-surface" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

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
  const [cameraOpen, setCameraOpen] = useState(false);
  const [tier, setTier] = useState<PrescriptionPreferenceTier>("AsPrescribed");

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

  function onCameraCaptured(file: File) {
    setPhotos((prev) => [...prev, file].slice(0, MAX_PHOTOS));
    setCameraOpen(false);
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
        photos,
        preferenceTier: tier,
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

          {/* Layout switches based on how many photos are already attached:
              0 photos → single wide tile with the two pickers side-by-side
              (camera | file) so the empty state reads as one inviting card,
              not a cramped vertical strip; 1+ photos → 2-col grid where each
              tile is vertical (preview/preview or preview/next-picker). */}
          <div
            className={`mx-auto grid gap-3 ${
              photos.length === 0
                ? "grid-cols-1 max-w-[360px]"
                : "grid-cols-2 sm:max-w-[336px]"
            }`}
          >
            {previews.map((src, idx) => (
              <div
                key={src}
                className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-image-backdrop shadow-card"
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
              <div
                className={`flex gap-2 rounded-2xl border-2 border-dashed border-outline bg-surface-container-low p-2 ${
                  photos.length === 0
                    ? "h-40 flex-row sm:h-48"
                    : "aspect-[3/4] flex-col"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setCameraOpen(true)}
                  className="flex flex-1 flex-col items-center justify-center gap-1.5 rounded-xl text-on-surface-variant transition hover:bg-primary/10 hover:text-primary"
                >
                  <CameraIcon className="h-7 w-7" />
                  <span className="text-[11px] font-semibold leading-tight">Сфотографировать</span>
                </button>
                <label className="flex flex-1 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl text-on-surface-variant transition hover:bg-primary/10 hover:text-primary">
                  <Icon name="plus" size={26} />
                  <span className="text-[11px] font-semibold leading-tight">Из файлов</span>
                  <input
                    type="file"
                    accept={ACCEPTED}
                    multiple
                    className="hidden"
                    onChange={onPick}
                  />
                </label>
              </div>
            ) : null}
          </div>
        </section>

        {cameraOpen ? (
          <CameraCaptureModal onCapture={onCameraCaptured} onClose={() => setCameraOpen(false)} />
        ) : null}

        <section className="space-y-3">
          <h2 className="font-display text-base font-extrabold">Чек-лист</h2>
          <p className="text-xs text-on-surface-variant">
            Выберите, как фармацевту собирать список лекарств — этот выбор увидит фармацевт в работе над расшифровкой.
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {(["AsPrescribed", "GoldenMiddle", "MaxSavings"] as const).map((t) => {
              const active = tier === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTier(t)}
                  className={`rounded-2xl border p-3 text-left transition ${
                    active
                      ? "border-primary bg-primary-soft shadow-card"
                      : "border-outline bg-surface-container-lowest hover:border-primary/40"
                  }`}
                  aria-pressed={active}
                >
                  <p className={`text-sm font-bold ${active ? "text-primary" : "text-on-surface"}`}>
                    {PRESCRIPTION_TIER_LABEL_RU[t]}
                  </p>
                  <p className="mt-1 text-[11px] leading-snug text-on-surface-variant">
                    {PRESCRIPTION_TIER_DESCRIPTION_RU[t]}
                  </p>
                </button>
              );
            })}
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
