"use client";

import type { FormEvent } from "react";
import Image from "next/image";
import {
  BarChart3,
  ClipboardCheck,
  CreditCard,
  Database,
  FileCode2,
  Pill,
  RefreshCw,
  Search,
  Store,
  Truck,
} from "lucide-react";
import { useEffect, useState } from "react";

type ConnectFormData = {
  fullName: string;
  phone: string;
  pharmacyName: string;
  hasOneC: "yes" | "no" | "";
};

type ConnectFormErrors = Partial<Record<keyof ConnectFormData, string>>;
type ConnectTextField = Exclude<keyof ConnectFormData, "hasOneC">;

const PHONE_COUNTRY_CODE = "992";
const PHONE_LOCAL_DIGIT_LIMIT = 9;

const initialConnectForm: ConnectFormData = {
  fullName: "",
  phone: "",
  pharmacyName: "",
  hasOneC: "",
};

const marqueeItems = [
  { icon: Search, label: "Поиск лекарств онлайн" },
  { icon: Truck, label: "Быстрая доставка" },
  { icon: Pill, label: "Тысячи препаратов" },
  { icon: ClipboardCheck, label: "Расшифровка рецептов" },
  { icon: Store, label: "Партнёрская сеть аптек" },
  { icon: CreditCard, label: "Прозрачные выплаты" },
  { icon: BarChart3, label: "Аналитика и дашборды" },
];

type EcosystemItem = {
  name: string;
  image: string;
  active?: boolean;
};

const partnerAsset = (path: string) => `/for-pharmacies-assets/${path}`;

const yallaEcosystemItems: EcosystemItem[] = [
  { name: "Yalla Pharm", image: partnerAsset("yal.png"), active: true },
  { name: "Yalla Lunch", image: partnerAsset("lunch.png") },
  { name: "Yalla Eats", image: partnerAsset("eats.png") }
];

const partnerItems = [
  { name: "JURA", image: partnerAsset("po (2).png") },
  { name: "Alif", image: partnerAsset("po (1).png") },
];

const oneCLogoSrc =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/1C_Company_logo.svg/250px-1C_Company_logo.svg.png";

const sanitizeConnectValue = (
  field: ConnectTextField,
  value: string
) => {
  if (field === "fullName") {
    return value.replace(/[^\p{L}\s]/gu, "");
  }

  if (field === "phone") {
    const digits = value.replace(/\D/g, "");
    const localDigits = digits.startsWith(PHONE_COUNTRY_CODE)
      ? digits.slice(PHONE_COUNTRY_CODE.length)
      : digits;

    return localDigits.slice(0, PHONE_LOCAL_DIGIT_LIMIT);
  }

  return value;
};

const formatConnectPhone = (phone: string) => {
  const firstPart = phone.slice(0, 3);
  const secondPart = phone.slice(3, 5);
  const thirdPart = phone.slice(5, 9);
  const parts = [firstPart, secondPart, thirdPart].filter(Boolean);

  return parts.length > 0
    ? `+${PHONE_COUNTRY_CODE} ${parts.join(" ")}`
    : `+${PHONE_COUNTRY_CODE}`;
};

export function PharmacyPartnerLanding() {
  const [connectForm, setConnectForm] = useState(initialConnectForm);
  const [connectErrors, setConnectErrors] = useState<ConnectFormErrors>({});
  const [isConnectSubmitted, setIsConnectSubmitted] = useState(false);
  const [isConnectSubmitting, setIsConnectSubmitting] = useState(false);
  const [connectSubmitError, setConnectSubmitError] = useState("");

  const updateConnectField = (
    field: ConnectTextField,
    value: string
  ) => {
    setConnectForm((current) => ({
      ...current,
      [field]: sanitizeConnectValue(field, value),
    }));
    setConnectErrors((current) => ({ ...current, [field]: undefined }));
    setConnectSubmitError("");
  };

  const updateConnectOneC = (value: ConnectFormData["hasOneC"]) => {
    setConnectForm((current) => ({
      ...current,
      hasOneC: value,
    }));
    setConnectErrors((current) => ({ ...current, hasOneC: undefined }));
    setConnectSubmitError("");
  };

  const validateConnectForm = () => {
    const nextErrors: ConnectFormErrors = {};
    const fullName = connectForm.fullName.trim();
    const phone = connectForm.phone.trim();
    const pharmacyName = connectForm.pharmacyName.trim();

    if (!fullName) {
      nextErrors.fullName = "Заполните имя и фамилию";
    }

    if (!phone) {
      nextErrors.phone = "Введите номер телефона";
    }

    if (!pharmacyName) {
      nextErrors.pharmacyName = "Введите название аптеки";
    }

    if (!connectForm.hasOneC) {
      nextErrors.hasOneC = "Выберите, имеется ли 1С в аптеке";
    }

    return nextErrors;
  };

  const handleConnectSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors = validateConnectForm();
    setConnectErrors(nextErrors);
    setConnectSubmitError("");

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsConnectSubmitting(true);

    try {
      const response = await fetch("/api/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: connectForm.fullName.trim(),
          phone: `${PHONE_COUNTRY_CODE}${connectForm.phone.trim()}`,
          pharmacyName: connectForm.pharmacyName.trim(),
          hasOneC: connectForm.hasOneC === "yes",
        }),
      });

      if (!response.ok) {
        throw new Error("Request failed");
      }

      setIsConnectSubmitted(true);
    } catch {
      setConnectSubmitError(
        "Не удалось отправить заявку. Проверьте Telegram-настройки и попробуйте снова."
      );
    } finally {
      setIsConnectSubmitting(false);
    }
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.1 }
    );

    const elements = document.querySelectorAll(".reveal");
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* NAVBAR */}
      <nav>
        <button
          type="button"
          className="nav-logo"
          aria-label="Обновить страницу"
          onClick={() => window.location.reload()}
        >
          <Image src={partnerAsset("yal.png")} alt="Yalla Pharm" width={240} height={76} />
        </button>
        <ul className="nav-links">
          <li>
            <a href="#how">Как работает</a>
          </li>
          <li>
            <a href="#benefits">Преимущества</a>
          </li>
          <li>
            <a href="#partners">Экосистема</a>
          </li>
        </ul>
        <a href="#connect" className="nav-cta">
          Подключить аптеку
        </a>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-bg">
          <div className="hero-grid"></div>
          <div className="hero-blob1"></div>
          <div className="hero-blob2"></div>
        </div>

        <div className="hero-content">

          <h1>
            Подключите аптеку <span className="text-[#0d1b2a]">к</span><br />
            <span className="highlight-blue">онлайн-продажам</span>
            <br />
             <span className="highlight-red">без лишних</span>
            <br />
            <span className="highlight-red">затрат</span>
          </h1>

          <p className="hero-sub">
            Yalla Pharm — платформа, которая приводит онлайн-клиентов прямо в
            вашу аптеку. Вы собираете заказ, мы берём на себя всё остальное.
          </p>

          <div className="hero-actions">
            <a href="#connect" className="btn-primary">
              Стать партнёром
            </a>
            <a href="#how" className="btn-outline">
              Как это работает →
            </a>
          </div>

          <div className="hero-stats">
            <div className="stat-item">
              <div className="stat-num">
                5<span>+</span>
              </div>
              <div className="stat-label">Лет на рынке</div>
            </div>

            <div className="stat-item">
              <div className="stat-num">0 сом </div>
              <div className="stat-label">Затрат на IT</div>
            </div>
          </div>
        </div>

        {/* Phone Mockup */}
        <div className="hero-visual">
          <div className="phone-mockup">
            <div className="phone-screen">
              <div className="phone-top">
                <Image
                  src={partnerAsset("yal.png")}
                  alt="Yalla Pharm"
                  className="phone-top-logo"
                  width={112}
                  height={34}
                />
                <div className="phone-search">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.35-4.35" />
                  </svg>
                  Поиск лекарств...
                </div>
              </div>
              <div className="phone-body">
                <div className="pill-card">
                  <div className="pill-icon" style={{ background: "#EEF3F4" }}>
                    💊
                  </div>
                  <div className="pill-info">
                    <div className="pill-name">Парацетамол 500мг</div>
                    <div className="pill-price">от 3.50 TJS</div>
                  </div>
                  <div className="pill-badge green">В наличии</div>
                </div>
                <div className="pill-card">
                  <div className="pill-icon" style={{ background: "#fdebed" }}>
                    🩺
                  </div>
                  <div className="pill-info">
                    <div className="pill-name">Ибупрофен 400мг</div>
                    <div className="pill-price">от 5.20 TJS</div>
                  </div>
                  <div className="pill-badge green">В наличии</div>
                </div>
                <div className="pill-card">
                  <div className="pill-icon" style={{ background: "#EEF3F4" }}>
                    💉
                  </div>
                  <div className="pill-info">
                    <div className="pill-name">Амоксициллин 250мг</div>
                    <div className="pill-price">от 12.00 TJS</div>
                  </div>
                  <div className="pill-badge red">2 аптеки</div>
                </div>
                <div className="pill-card">
                  <div className="pill-icon" style={{ background: "#e8f3fe" }}>
                    🔬
                  </div>
                  <div className="pill-info">
                    <div className="pill-name">Витамин C 1000мг</div>
                    <div className="pill-price">от 8.90 TJS</div>
                  </div>
                  <div className="pill-badge green">Доставка</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MARQUEE */}
      <div className="marquee-section">
        <div className="marquee-track">
          {[...marqueeItems, ...marqueeItems].map(({ icon: Icon, label }, i) => (
            <span key={i} className="marquee-item">
              <Icon className="marquee-icon" aria-hidden="true" />
              {label}
              <span className="marquee-dot"></span>
            </span>
          ))}
        </div>
      </div>

      {/* HOW IT WORKS */}
      <section className="section" id="how">
        <div className="section-label">Процесс</div>
        <h2 className="section-title reveal">
          Как работает <br />
          Yalla Pharm
        </h2>
        <p className="section-sub reveal reveal-delay-1">
          Простой и прозрачный процесс — от поиска до доставки лекарства
          клиенту.
        </p>

        <div className="steps-grid">
          {[
            {
              num: "01",
              icon: Search,
              title: "Клиент ищет лекарство",
              desc: "Клиент находит нужный препарат или отправляет рецепт через Yalla Pharm. Сервис показывает наличие в подключённых аптеках.",
              delay: "reveal-delay-1",
            },
            {
              num: "02",
              icon: ClipboardCheck,
              title: "Выбор и оформление заказа",
              desc: "Клиент выбирает удобную аптеку, сравнивает цены и оформляет заказ онлайн за несколько секунд.",
              delay: "reveal-delay-2",
            },
            {
              num: "03",
              icon: Store,
              title: "Аптека собирает заказ",
              desc: "Сотрудник вашей аптеки видит заказ в интерфейсе, собирает и упаковывает его. Всё остальное — на нас.",
              delay: "reveal-delay-3",
            },
            {
              num: "04",
              icon: Truck,
              title: "Jura забирает и везёт",
              desc: "Курьер Jura приезжает в аптеку, забирает готовый заказ и доставляет клиенту в удобное место.",
              delay: "reveal-delay-1",
            },
            {
              num: "05",
              icon: CreditCard,
              title: "Выплата аптеке",
              desc: "После выполнения заказа средства отображаются в вашем финансовом разделе. Выплату можно запросить онлайн.",
              delay: "reveal-delay-2",
            },
            {
              num: "06",
              icon: BarChart3,
              title: "Аналитика и рост",
              desc: "Следите за статистикой заказов, дашбордами и историей. Используйте данные для роста вашего бизнеса.",
              delay: "reveal-delay-3",
            },
          ].map((step) => {
            const Icon = step.icon;

            return (
            <div key={step.num} className={`step-card reveal ${step.delay}`}>
              <div className="step-num">{step.num}</div>
              <div className="step-icon">
                <Icon aria-hidden="true" />
              </div>
              <div className="step-title">{step.title}</div>
              <p className="step-desc">{step.desc}</p>
            </div>
            );
          })}
        </div>
      </section>

      {/* BENEFITS */}
      <section className="benefits-section" id="benefits">
        <div className="benefits-poster">
          <div className="benefits-poster-visual reveal">
            <div className="section-label">Преимущества</div>
            <div className="benefits-poster-number">06</div>
            <h2 className="benefits-title">
              Причин подключить аптеку к Yalla Pharm
            </h2>
            <div className="benefits-photo-stack" aria-hidden="true">
              <span>
                <Image src={partnerAsset("a.webp")} alt="" width={240} height={180} />
              </span>
              <span>
                <Image src={partnerAsset("b.webp")} alt="" width={240} height={180} />
              </span>
              <span>
                <Image src={partnerAsset("d.webp")} alt="" width={240} height={180} />
              </span>
            </div>
          </div>

          <div className="benefits-ribbons">
            {[
              {
                icon: Search,
                title: "Больше клиентов",
                desc: "Аптека появляется там, где клиенты уже ищут лекарства.",
                delay: "reveal-delay-1",
              },
              {
                icon: FileCode2,
                title: "Онлайн без IT",
                desc: "Не нужен свой сайт, приложение или отдельная система заказов.",
                delay: "reveal-delay-2",
              },
              {
                icon: Truck,
                title: "Доставка готова",
                desc: "Аптека собирает заказ, курьерская служба забирает доставку.",
                delay: "reveal-delay-3",
              },
              {
                icon: CreditCard,
                title: "Прозрачные выплаты",
                desc: "Финансы, отчёты и история заказов доступны онлайн.",
                delay: "reveal-delay-1",
              },
              {
                icon: Store,
                title: "Команда вовлечена",
                desc: "Сотрудники получают дополнительную мотивацию за заказы.",
                delay: "reveal-delay-2",
              },
              {
                icon: BarChart3,
                title: "Экосистема Yalla",
                desc: "Аптека получает продвижение внутри партнёрской сети.",
                delay: "reveal-delay-3",
              },
            ].map((b, index) => {
              const Icon = b.icon;

              return (
                <div key={b.title} className={`benefit-ribbon reveal ${b.delay}`}>
                  <span className="benefit-ribbon-num">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="benefit-ribbon-icon">
                    <Icon aria-hidden="true" />
                  </span>
                  <div>
                    <h3>{b.title}</h3>
                    <p>{b.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ECOSYSTEM */}
      <section className="ecosystem-section" id="partners">
        <div className="section-label">Экосистема</div>
        <h2 className="section-title reveal">
          Часть мощной
          <br />
          экосистемы Yalla
        </h2>
        <p className="section-sub reveal reveal-delay-1">
          Yalla развивается как широкая экосистема сервисов. Ваша аптека
          получает доступ ко всей аудитории платформы.
        </p>

        <div className="ecosystem-layout">
          <div className="ecosystem-group ecosystem-group-main reveal reveal-delay-2">
            <div className="ecosystem-logos ecosystem-logos-yalla">
              {yallaEcosystemItems.map((item) => (
                <div
                  key={item.name}
                  className={`eco-logo${item.active ? " active" : ""}`}
                >
                  <span>{item.name}</span>
                  <Image
                    src={item.image}
                    alt={item.name}
                    className="eco-image eco-image-large"
                    width={260}
                    height={140}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="partners-panel reveal reveal-delay-3">
          <div className="partners-copy">
            <div className="section-label">Партнёрство</div>
            <h3>
              Сильные партнёры
              <br />
              усиливают аптечный канал
            </h3>
            <p>
              JURA и Alif помогают расширять охват, подключать финансовые
              сценарии и делать сервис удобнее для клиентов и аптек.
            </p>
          </div>
          <div className="ecosystem-logos ecosystem-logos-partners">
            {partnerItems.map((item) => (
              <div key={item.name} className="eco-logo partner">
                <span>{item.name}</span>
                <Image
                  src={item.image}
                  alt={item.name}
                  className="eco-image"
                  width={180}
                  height={72}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 1C INTEGRATION */}
      <section className="one-c-section">
        <div className="one-c-copy reveal">
          <div className="section-label">Раздел 1С</div>
          <h2 className="section-title">
            Интеграция с 1С
            <br />
            партнёрской аптеки
          </h2>
          <p className="section-sub">
            Для подключения партнёрской аптеки необходима интеграция с её 1С,
            чтобы получать данные об офферах вашей аптеки: цене и остатке.
          </p>
          <p>
            Мы получаем данные в виде XML-файлов, обрабатываем их и показываем
            в нашей системе как офферы вашей аптеки для соответствующих товаров.
          </p>
          <div className="one-c-points">
            {[
              { icon: FileCode2, label: "XML-файлы" },
              { icon: Database, label: "Цена и остаток" },
              { icon: RefreshCw, label: "Актуальные офферы" },
            ].map(({ icon: Icon, label }) => (
              <span key={label}>
                <Icon aria-hidden="true" />
                {label}
              </span>
            ))}
          </div>
        </div>
        <div
          className="one-c-visual reveal reveal-delay-2"
          aria-label="Схема интеграции 1С с Yalla Pharm"
        >
          <div className="one-c-node one-c-node-source">
            <Image
              src={oneCLogoSrc}
              alt="Логотип 1C"
              className="one-c-logo"
              width={120}
              height={58}
            />
            <strong>1С аптеки</strong>
            <small>учётная система</small>
          </div>

          <div className="one-c-flow" aria-hidden="true">
            <span></span>
            <div className="one-c-xml-card">
              <FileCode2 aria-hidden="true" />
              XML
            </div>
          </div>

          <div className="one-c-node one-c-node-target">
            <Image src={partnerAsset("yal.png")} alt="Yalla Pharm" width={150} height={48} />
            <strong>Yalla Pharm</strong>
            <small>витрина офферов</small>
          </div>

          <div className="one-c-data one-c-data-price">
            <small>Цена</small>
            <strong>24.90 TJS</strong>
          </div>
          <div className="one-c-data one-c-data-stock">
            <small>Остаток</small>
            <strong>3 шт.</strong>
          </div>
          <div className="one-c-offers">
            {["Парацетамол", "Ибупрофен", "Витамин C"].map((name, index) => (
              <div key={name} style={{ animationDelay: `${index * 0.35}s` }}>
                <span>{name}</span>
                <b>Оффер</b>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section" id="connect">
        <div className="cta-bg-red"></div>
        <div className="cta-inner">
          <div
            className="section-label"
            style={{ justifyContent: "center" }}
          >
            Подключение
          </div>
          <h2 className="section-title reveal">
            Готовы начать
            <br />
            продавать онлайн?
          </h2>
          <p className="section-sub reveal reveal-delay-1">
            Аптеки, которые подключаются сейчас, раньше конкурентов занимают
            место в главном онлайн-канале продаж Таджикистана.
          </p>
          {isConnectSubmitted ? (
            <div className="connect-form connect-done reveal visible">
              <span className="connect-success-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M5 12.5l4.2 4.2L19 6.8" />
                </svg>
              </span>
              <div className="connect-done-copy">
                <small>Заявка принята</small>
                <strong>Мы скоро ответим</strong>
                <p>
                  Команда Yalla Pharm свяжется с вами в ближайшее время.
                </p>
              </div>
            </div>
          ) : (
            <form
              className="connect-form reveal reveal-delay-2"
              noValidate
              onSubmit={handleConnectSubmit}
            >
              <div className="connect-form-head">
                <div>
                  <small>Партнерская заявка</small>
                  <span>Заявка на подключение</span>
                </div>
                <p>Оставьте данные, и команда свяжется с аптекой.</p>
              </div>
              <div className="connect-fields">
                <label
                  className={`connect-field${
                    connectErrors.fullName ? " has-error" : ""
                  }`}
                >
                  <span>Имя и фамилия</span>
                  <input
                    name="fullName"
                    type="text"
                    placeholder="Например: Саида Каримова"
                    value={connectForm.fullName}
                    onChange={(event) =>
                      updateConnectField("fullName", event.target.value)
                    }
                    required
                  />
                  {connectErrors.fullName && (
                    <small>{connectErrors.fullName}</small>
                  )}
                </label>
                <label
                  className={`connect-field${
                    connectErrors.phone ? " has-error" : ""
                  }`}
                >
                  <span>Номер телефона</span>
                  <input
                    name="phone"
                    type="tel"
                    inputMode="numeric"
                    placeholder="+992 00 000 000"
                    value={formatConnectPhone(connectForm.phone)}
                    onChange={(event) =>
                      updateConnectField("phone", event.target.value)
                    }
                    required
                  />
                  {connectErrors.phone && <small>{connectErrors.phone}</small>}
                </label>
                <label
                  className={`connect-field connect-field-wide${
                    connectErrors.pharmacyName ? " has-error" : ""
                  }`}
                >
                  <span>Название аптеки</span>
                  <input
                    name="pharmacyName"
                    type="text"
                    placeholder="Например: Аптека Сино"
                    value={connectForm.pharmacyName}
                    onChange={(event) =>
                      updateConnectField("pharmacyName", event.target.value)
                    }
                    required
                  />
                  {connectErrors.pharmacyName && (
                    <small>{connectErrors.pharmacyName}</small>
                  )}
                </label>
                <fieldset
                  className={`connect-choice connect-field-wide${
                    connectErrors.hasOneC ? " has-error" : ""
                  }`}
                >
                  <legend>Имеется ли у вас 1С?</legend>
                  <div className="connect-choice-options">
                    <label className="connect-checkbox">
                      <input
                        name="hasOneC"
                        type="radio"
                        value="yes"
                        checked={connectForm.hasOneC === "yes"}
                        onChange={() => updateConnectOneC("yes")}
                        required
                      />
                      <span>Да</span>
                    </label>
                    <label className="connect-checkbox">
                      <input
                        name="hasOneC"
                        type="radio"
                        value="no"
                        checked={connectForm.hasOneC === "no"}
                        onChange={() => updateConnectOneC("no")}
                        required
                      />
                      <span>Нет</span>
                    </label>
                  </div>
                  {connectErrors.hasOneC && (
                    <small>{connectErrors.hasOneC}</small>
                  )}
                </fieldset>
              </div>
              <button
                type="submit"
                className="connect-submit"
                disabled={isConnectSubmitting}
              >
                <span>
                  {isConnectSubmitting ? "Отправляем..." : "Отправить"}
                </span>
                <span aria-hidden="true">→</span>
              </button>
              {connectSubmitError && (
                <p className="connect-submit-error" role="alert">
                  {connectSubmitError}
                </p>
              )}
            </form>
          )}
        </div>
      </section>

    </>
  );
}
