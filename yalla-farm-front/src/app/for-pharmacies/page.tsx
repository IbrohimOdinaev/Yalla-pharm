"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AppShell } from "@/widgets/layout/AppShell";
import { Icon } from "@/shared/ui";

type LeadFormState = {
  pharmacyName: string;
  contactName: string;
  phone: string;
  city: string;
  system: string;
  comment: string;
};

const initialForm: LeadFormState = {
  pharmacyName: "",
  contactName: "",
  phone: "",
  city: "Душанбе",
  system: "",
  comment: "",
};

const benefits = [
  {
    icon: "pharmacy" as const,
    title: "Витрина аптеки онлайн",
    text: "Товары, цены и остатки попадают в каталог Yalla Pharm, где клиенты уже ищут лекарства.",
  },
  {
    icon: "bolt" as const,
    title: "Быстрые заказы",
    text: "Аптека получает понятный поток заказов без ручной переписки по каждому товару.",
  },
  {
    icon: "settings" as const,
    title: "Интеграция под ваш учет",
    text: "Обсудим формат обмена: 1C, Excel, API или другой удобный способ передачи данных.",
  },
];

const steps = [
  "Оставляете заявку с контактами аптеки.",
  "Команда Yalla уточняет каталог, остатки и формат обмена.",
  "Подключаем аптеку и проверяем первые заказы.",
];

function buildMailtoHref(form: LeadFormState) {
  const subject = `Заявка на интеграцию аптеки: ${form.pharmacyName || "Новая аптека"}`;
  const body = [
    "Здравствуйте! Хочу подключить аптеку к Yalla Pharm.",
    "",
    `Аптека: ${form.pharmacyName}`,
    `Контактное лицо: ${form.contactName}`,
    `Телефон: ${form.phone}`,
    `Город: ${form.city}`,
    `Учетная система: ${form.system || "Не указана"}`,
    "",
    `Комментарий: ${form.comment || "Без комментария"}`,
  ].join("\n");

  return `mailto:info@yalla.tj?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default function ForPharmaciesPage() {
  const [form, setForm] = useState<LeadFormState>(initialForm);
  const [submitted, setSubmitted] = useState(false);

  const mailtoHref = useMemo(() => buildMailtoHref(form), [form]);
  const isValid = Boolean(form.pharmacyName.trim() && form.contactName.trim() && form.phone.trim());

  function updateField<K extends keyof LeadFormState>(key: K, value: LeadFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setSubmitted(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValid) return;
    setSubmitted(true);
    window.location.href = mailtoHref;
  }

  return (
    <AppShell>
      <div className="space-y-10 sm:space-y-14">
        <section className="relative min-h-[520px] overflow-hidden rounded-3xl bg-on-surface text-white sm:min-h-[560px]">
          <Image
            src="/pharmacy-integration-banner.png"
            alt="Фармацевт работает с цифровым каталогом аптеки на планшете"
            fill
            priority
            unoptimized
            sizes="100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-on-surface/90 via-on-surface/58 to-on-surface/10" />
          <div className="relative z-10 flex min-h-[520px] max-w-3xl flex-col justify-center px-5 py-10 sm:min-h-[560px] sm:px-9 lg:px-12">
            <Link
              href="/"
              className="mb-8 inline-flex w-fit items-center gap-2 rounded-full bg-white/12 px-3 py-2 text-xs font-bold text-white backdrop-blur transition hover:bg-white/18"
            >
              <Icon name="arrow-left" size={14} />
              На главную
            </Link>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-white/75">Для аптек и сетей</p>
            <h1 className="mt-4 font-display text-4xl font-black leading-[1.02] sm:text-5xl lg:text-6xl">
              Интеграция аптек с Yalla Pharm
            </h1>
            <p className="mt-5 max-w-2xl text-base font-medium leading-relaxed text-white/86 sm:text-lg">
              Подключите каталог, остатки и заказы к онлайн-витрине. Клиенты смогут находить ваши товары, выбирать аптеку и оформлять покупку быстрее.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href="#application"
                className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 text-sm font-black text-on-primary transition active:scale-[0.98] hover:bg-primary-container"
              >
                Оставить заявку
              </a>
              <a
                href="https://t.me/yalla_tj"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white/14 px-6 text-sm font-black text-white backdrop-blur transition active:scale-[0.98] hover:bg-white/20"
              >
                <Icon name="telegram" size={17} />
                Telegram
              </a>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          {benefits.map((benefit) => (
            <article key={benefit.title} className="rounded-2xl border border-outline/60 bg-surface-container-low p-5">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-soft text-primary">
                <Icon name={benefit.icon} size={21} />
              </span>
              <h2 className="mt-4 font-display text-lg font-black text-on-surface">{benefit.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">{benefit.text}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.86fr_1.14fr] lg:items-start" id="application">
          <div className="space-y-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Как подключаем</p>
              <h2 className="mt-2 font-display text-3xl font-black text-on-surface sm:text-4xl">
                Минимум ручной работы для аптеки
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-on-surface-variant sm:text-base">
                Начинаем с короткой заявки, затем подбираем формат обмена данными и запускаем аптеку в каталоге.
              </p>
            </div>

            <ol className="space-y-3">
              {steps.map((step, index) => (
                <li key={step} className="flex gap-3 rounded-2xl bg-surface-container-low p-4">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary text-sm font-black text-on-primary">
                    {index + 1}
                  </span>
                  <span className="pt-1 text-sm font-semibold text-on-surface">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <form onSubmit={handleSubmit} className="rounded-3xl border border-outline/70 bg-surface-container-lowest p-4 shadow-card sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-black text-on-surface">Заявка на интеграцию</h2>
                <p className="mt-1 text-sm text-on-surface-variant">Ответим и согласуем детали подключения.</p>
              </div>
              <span className="hidden h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-secondary-soft text-secondary sm:flex">
                <Icon name="message" size={21} />
              </span>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Название аптеки" required>
                <input
                  value={form.pharmacyName}
                  onChange={(event) => updateField("pharmacyName", event.target.value)}
                  className="stitch-input"
                  placeholder="Например, Дору Фарм"
                  required
                />
              </Field>
              <Field label="Контактное лицо" required>
                <input
                  value={form.contactName}
                  onChange={(event) => updateField("contactName", event.target.value)}
                  className="stitch-input"
                  placeholder="Имя и должность"
                  required
                />
              </Field>
              <Field label="Телефон" required>
                <input
                  value={form.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                  className="stitch-input"
                  placeholder="+992 ..."
                  inputMode="tel"
                  required
                />
              </Field>
              <Field label="Город">
                <input
                  value={form.city}
                  onChange={(event) => updateField("city", event.target.value)}
                  className="stitch-input"
                  placeholder="Душанбе"
                />
              </Field>
              <Field label="Учетная система" className="sm:col-span-2">
                <input
                  value={form.system}
                  onChange={(event) => updateField("system", event.target.value)}
                  className="stitch-input"
                  placeholder="1C, Excel, API, другое"
                />
              </Field>
              <Field label="Комментарий" className="sm:col-span-2">
                <textarea
                  value={form.comment}
                  onChange={(event) => updateField("comment", event.target.value)}
                  className="stitch-input min-h-28 resize-none"
                  placeholder="Количество точек, примерный размер каталога, удобное время для связи"
                />
              </Field>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="submit"
                disabled={!isValid}
                className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 text-sm font-black text-on-primary transition disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] hover:bg-primary-container"
              >
                Отправить заявку
              </button>
              <a
                href={mailtoHref}
                className="inline-flex h-12 items-center justify-center rounded-full bg-surface-container px-6 text-sm font-black text-on-surface transition active:scale-[0.98] hover:bg-surface-container-high"
              >
                Открыть в почте
              </a>
            </div>

            {submitted ? (
              <p className="mt-4 rounded-2xl bg-primary-soft px-4 py-3 text-sm font-semibold text-primary">
                Заявка подготовлена в почтовом клиенте. Если письмо не открылось, отправьте данные на info@yalla.tj или в Telegram.
              </p>
            ) : null}
          </form>
        </section>
      </div>
    </AppShell>
  );
}

function Field({
  label,
  required,
  className = "",
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-on-surface-variant">
        {label}
        {required ? <span className="text-secondary"> *</span> : null}
      </span>
      {children}
    </label>
  );
}
