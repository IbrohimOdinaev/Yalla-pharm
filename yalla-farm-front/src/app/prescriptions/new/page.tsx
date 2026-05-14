"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/shared/lib/redux";
import { createPrescription } from "@/entities/prescription/api";
import { getPrivacyPolicyStatus } from "@/entities/legal/api";
import { AppShell } from "@/widgets/layout/AppShell";
import { TopBar } from "@/widgets/layout/TopBar";
import { PrivacyPolicyAcceptanceModal } from "@/widgets/legal/PrivacyPolicyAcceptanceModal";
import { Button, Icon, Input } from "@/shared/ui";

const MAX_PHOTOS = 2;
const ACCEPTED = "image/png,image/jpeg,image/jpg,image/webp";

// Guest-flow draft: stashed in localStorage when an unauthenticated user
// hits "Отправить рецепт", so after they finish /login we can drop them
// right back here with everything already filled in (including photos).
const DRAFT_KEY = "yalla.prescription.new.draft.v1";

type DraftPhoto = { name: string; type: string; dataUrl: string };
type Draft = {
  age: string;
  comment: string;
  contacts: string;
  photos: DraftPhoto[];
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function dataUrlToFile(dataUrl: string, name: string, type: string): File {
  // data:image/jpeg;base64,...  →  File reconstructed from the base64
  // payload so we can re-submit the same photos after the OTP flow.
  const comma = dataUrl.indexOf(",");
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const bytes = atob(b64);
  const buf = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
  return new File([buf], name, { type });
}

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
          className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white transition active:scale-95 hover:bg-black/80"
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
  const [contacts, setContacts] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  // Privacy-policy gate state. `policyAccepted` is null while we're
  // waiting for the status round-trip; true/false once known. When the
  // user hits submit before accepting, we pop the modal and pause the
  // submit until they accept. `pendingSubmit` flags "submit was
  // attempted, resume after acceptance".
  const [policyVersion, setPolicyVersion] = useState<string | null>(null);
  const [policyAccepted, setPolicyAccepted] = useState<boolean | null>(null);
  const [policyModalOpen, setPolicyModalOpen] = useState(false);
  const pendingSubmitRef = useRef(false);

  // Auth gate — only staff roles are bounced. Guests are intentionally
  // allowed to fill the form; the submit handler stashes their draft
  // and redirects them to /login when they actually try to send, then
  // /login restores the draft on return.
  useEffect(() => {
    if (!hydrated) return;
    if (role && role !== "Client") router.replace("/");
  }, [hydrated, role, router]);

  // Rehydrate the guest draft once auth state is known. Two-stage:
  //  • If a draft exists on first visit, restore it regardless of auth
  //    state — covers the user editing on the same device across a
  //    refresh. Photos come back as real File objects so submit can
  //    POST them as-is.
  //  • If a draft exists AND the user is now authenticated, also clear
  //    the draft so a subsequent fresh visit doesn't re-prefill it.
  const draftRestoredRef = useRef(false);
  useEffect(() => {
    if (!hydrated || draftRestoredRef.current) return;
    draftRestoredRef.current = true;
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as Partial<Draft>;
      if (typeof draft.age === "string") setAge(draft.age);
      if (typeof draft.comment === "string") setComment(draft.comment);
      if (typeof draft.contacts === "string") setContacts(draft.contacts);
      if (Array.isArray(draft.photos)) {
        const restored: File[] = [];
        for (const p of draft.photos) {
          if (p && typeof p.name === "string" && typeof p.type === "string" && typeof p.dataUrl === "string") {
            restored.push(dataUrlToFile(p.dataUrl, p.name, p.type));
          }
        }
        if (restored.length > 0) setPhotos(restored.slice(0, MAX_PHOTOS));
      }
      // Once authenticated, drop the draft — its job is done.
      if (token) window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      // Corrupt draft is not worth crashing the form over.
      window.localStorage.removeItem(DRAFT_KEY);
    }
  }, [hydrated, token]);

  // Privacy-policy status — fire-and-forget on mount. The result
  // gates the submit button below; while we're waiting we treat
  // `policyAccepted` as null and let the button work — backend's 412
  // is the source of truth and will pop the modal on failure too.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    getPrivacyPolicyStatus(token)
      .then((status) => {
        if (cancelled) return;
        setPolicyVersion(status.currentVersion);
        setPolicyAccepted(status.accepted);
      })
      .catch(() => {
        // Soft fail: leave both null so submit still works; if
        // policy is actually required, the server will 412 and we
        // catch it in onSubmit.
      });
    return () => { cancelled = true; };
  }, [token]);

  const handlePolicyAccepted = useCallback(() => {
    setPolicyAccepted(true);
    setPolicyModalOpen(false);
    // Resume the in-flight submit if the user had clicked submit first.
    if (pendingSubmitRef.current) {
      pendingSubmitRef.current = false;
      // Use a microtask to let state flush before re-entering submit.
      Promise.resolve().then(() => {
        // Trigger a synthetic submit. The real handler reads state
        // directly, so a no-op event is fine.
        document.querySelector("form")?.requestSubmit();
      });
    }
  }, []);

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

    const ageNum = Number(age);
    if (!Number.isFinite(ageNum) || ageNum <= 0 || ageNum > 150) {
      setError("Введите корректный возраст пациента.");
      return;
    }
    if (photos.length === 0) {
      setError("Добавьте хотя бы одно фото рецепта.");
      return;
    }

    // Guest flow: serialize the form (including photo bytes) into
    // localStorage and bounce to /login. The `next` param brings them
    // back here on success, and the rehydrate effect above will refill
    // the form so they only have to tap "Отправить рецепт" once more.
    if (!token) {
      try {
        setSubmitting(true);
        const draftPhotos: DraftPhoto[] = await Promise.all(
          photos.map(async (file) => ({
            name: file.name,
            type: file.type,
            dataUrl: await fileToDataUrl(file),
          })),
        );
        const draft: Draft = {
          age,
          comment,
          contacts,
          photos: draftPhotos,
        };
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch {
        // Storage write can fail (quota exceeded with very large
        // photos). Fall through to the login redirect anyway — the
        // user can re-pick photos after logging in.
      } finally {
        setSubmitting(false);
      }
      router.push("/login?redirect=/prescriptions/new");
      return;
    }

    // Privacy-policy gate. We do a client-side check first to avoid a
    // round-trip when we already know acceptance is missing; backend
    // still re-validates (returns 412) so a stale `policyAccepted`
    // doesn't let anyone slip through.
    if (policyAccepted === false) {
      pendingSubmitRef.current = true;
      setPolicyModalOpen(true);
      return;
    }

    setSubmitting(true);
    try {
      const created = await createPrescription(token, {
        patientAge: ageNum,
        clientComment: comment.trim() || null,
        clientContacts: contacts.trim() || null,
        photos,
        preferenceTier: "AsPrescribed",
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
      const message = err instanceof Error ? err.message : "Не удалось отправить рецепт.";
      // Backend rejects unsupported privacy version with a
      // 412/machine-readable code; surface the accept-modal instead
      // of a raw error.
      if (message.includes("privacy_policy_acceptance_required")) {
        setPolicyAccepted(false);
        pendingSubmitRef.current = true;
        setPolicyModalOpen(true);
      } else {
        setError(message);
      }
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
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-surface/90 text-on-surface shadow-card transition active:scale-95 hover:bg-secondary-soft hover:text-secondary"
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
                  className="flex flex-1 flex-col items-center justify-center gap-1.5 rounded-xl text-on-surface-variant transition active:scale-95 hover:bg-primary/10 hover:text-primary"
                >
                  <CameraIcon className="h-7 w-7" />
                  <span className="text-[11px] font-semibold leading-tight">Сфотографировать</span>
                </button>
                <label className="flex flex-1 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl text-on-surface-variant transition active:scale-95 hover:bg-primary/10 hover:text-primary">
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

        <section className="space-y-3">
          <h2 className="font-display text-base font-extrabold">
            Контакты для связи <span className="text-on-surface-variant/60">(необязательно)</span>
          </h2>
          <textarea
            value={contacts}
            onChange={(e) => setContacts(e.target.value)}
            placeholder="Например: +992 ••• •• •• ••, @telegram, WhatsApp"
            rows={2}
            maxLength={256}
            className="w-full rounded-2xl border border-outline bg-surface-container-lowest p-3 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:outline-none"
          />
          <p className="text-xs text-on-surface-variant">
            Эти контакты нужны, чтобы фармацевт связался с вами в случае
            необходимости или для уточнения данных о рецепте.
          </p>
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

      {/* Privacy-policy gate. Opens automatically when submit is
          attempted before the client has accepted the current
          version, or when the backend returns 412 because the gate
          was bypassed. */}
      {token && policyVersion ? (
        <PrivacyPolicyAcceptanceModal
          open={policyModalOpen}
          token={token}
          version={policyVersion}
          onAccepted={handlePolicyAccepted}
          onClose={() => {
            setPolicyModalOpen(false);
            pendingSubmitRef.current = false;
          }}
        />
      ) : null}
    </AppShell>
  );
}
