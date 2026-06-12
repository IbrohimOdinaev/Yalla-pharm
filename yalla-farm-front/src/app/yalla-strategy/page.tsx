"use client";

import { useState } from "react";
import {
  Activity,
  AlertCircle,
  Briefcase,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Database,
  Layers,
  Map,
  Sliders,
  Target,
  TrendingUp,
  Truck,
  Utensils,
} from "lucide-react";

type Dates = {
  phase1: string;
  phase2: string;
  phase3: string;
  phase4: string;
};

type Metrics = {
  mrr: string;
  mrrPeriod: string;
  b2bCount: string;
  dailyOrders: string;
  foodCost: string;
  deliveryTime: string;
};

type Tab = "roadmap" | "ecosystem" | "metrics" | "document";

const tabButtonBase =
  "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap";

export default function YallaStrategyPage() {
  const [dates, setDates] = useState<Dates>({
    phase1: "Q3 2026",
    phase2: "Q1 2027",
    phase3: "Q3 2027",
    phase4: "Q2 2028",
  });

  const [metrics, setMetrics] = useState<Metrics>({
    mrr: "150,000",
    mrrPeriod: "Q4 2027",
    b2bCount: "120",
    dailyOrders: "1,500",
    foodCost: "32",
    deliveryTime: "25",
  });

  const [activeTab, setActiveTab] = useState<Tab>("roadmap");
  const [selectedPhase, setSelectedPhase] = useState(0);
  const [copiedDoc, setCopiedDoc] = useState(false);

  const phases = [
    {
      id: 1,
      title: "Этап 1: Оптимизация и Пилот",
      time: dates.phase1,
      infra: "Гибридная модель: партнерские кухни + 1-я пилотная Dark Kitchen",
      target: "B2B (Подписки и запуск On-demand с наценкой 10-15%), пилот B2C в Душанбе",
      task: "Оптимизация ИТ-ядра app.yalla.tj, обкатка операционных процессов собственной пилотной кухни, фиксация базового фудкоста.",
      status: "Текущий / Пилот",
      color: "from-emerald-500 to-teal-600",
      details: {
        highlights: [
          "Минимизация CapEx за счет использования свободных мощностей партнеров",
          "Стандартизация блюд по строго регламентированным технологическим картам Yalla",
          "Запуск 1-й собственной Dark Kitchen для отработки скорости сборки",
          "Гибкие выплаты партнерам: ежедневно 1:1 или консолидировано раз в месяц",
        ],
        kpis: [
          "Тестирование динамического меню с наценкой 10-15%",
          "Фиксация базового фудкоста на партнерских мощностях",
          "Группировка заказов по кластерам (Batching) для доставки в интервал 11:30 - 12:30",
        ],
      },
    },
    {
      id: 2,
      title: "Этап 2: Локальное масштабирование",
      time: dates.phase2,
      infra: "Развертывание сети распределенных локальных Dark Kitchen",
      target: "B2B (Внедрение Конструктора), B2C (ПП-линейки, мил-киты)",
      task: "Покрытие Душанбе точками регенерации для сжатия времени доставки до < 30 минут. Запуск первых «Холодильников на доверии».",
      status: "В планах",
      color: "from-blue-500 to-indigo-600",
      details: {
        highlights: [
          "Открытие малых производственных точек в ключевых микрорайонах города",
          "Регенерация, финальная сборка и экспресс-передача курьерам на локациях",
          "Запуск ИТ-модуля «Конструктор меню» с лимитами бюджетов на сотрудников",
          "Старт направления ЗОЖ/ПП рационов по долгосрочным курсовым подпискам",
        ],
        kpis: [
          `Время ультрабыстрой доставки горячей еды до ${metrics.deliveryTime} минут`,
          "Развертывание сети первых умных микромаркетов («Холодильники на доверии») в БЦ",
          "Тестирование наборов подготовленных продуктов (мил-киты в формате Elementaree)",
        ],
      },
    },
    {
      id: 3,
      title: "Этап 3: Индустриализация и Фабрика-Кухня",
      time: dates.phase3,
      infra: "Запуск централизованной промышленной Фабрики-кухни",
      target: "Все сегменты + спец-ниши (Больницы, Строители), Catering & Events, KaaS",
      task: "Полный переход на централизованное снабжение, жесткое снижение себестоимости, запуск Yalla Academy, масштабирование B2C.",
      status: "В планах",
      color: "from-purple-500 to-pink-600",
      details: {
        highlights: [
          "Запуск крупного заготовочного цеха высокой мощности: Sous-Vide и шоковая заморозка",
          "Поставка полуфабрикатов высокой степени готовности на локальные Dark Kitchen",
          "Минимизация площадей и оборудования локальных кухонь: не нужны мясные и овощные цеха",
          "Запуск корпоративного учебного центра Yalla Academy для поваров и курьеров",
        ],
        kpis: [
          `Радикальное снижение фудкоста до целевых ${metrics.foodCost}%`,
          "Выход на специализированные ниши: питание пациентов в больницах и строителей",
          "Запуск полноценного аутсорсинга пищеблоков (Kitchen-as-a-Service) для школ и заводов",
        ],
      },
    },
    {
      id: 4,
      title: "Этап 4: SuperApp и Экспансия",
      time: dates.phase4,
      infra: "Инфраструктура Фабрики-кухни + сеть Dark Stores",
      target: "Международная экспансия: Узбекистан, Казахстан, Кыргызстан",
      task: "Трансформация в SuperApp (запуск Yalla Pharm, HealthTech), открытие зарубежных операционных хабов.",
      status: "В планах",
      color: "from-amber-500 to-orange-600",
      details: {
        highlights: [
          "Интеграция доставки товаров первой необходимости (Yalla Lavka) и лекарств (Yalla Pharm)",
          "HealthTech-модуль: синхронизация меню с медицинскими показателями и анализами пользователя",
          "Выход на международные рынки: Узбекистан (Ташкент), Казахстан (Алматы/Астана) и Кыргызстан",
          "Франчайзинг или совместные предприятия с крупными региональными партнерами",
        ],
        kpis: [
          `Достижение MRR в размере $${metrics.mrr} USD`,
          `Обслуживание более ${metrics.b2bCount} B2B-компаний на постоянной основе`,
          `Стабилизация операционного потока на уровне ${metrics.dailyOrders} доставок в сутки`,
        ],
      },
    },
  ];

  const generateDocumentText = () => `КОМПЛЕКСНАЯ КОНЦЕПЦИЯ РАЗВИТИЯ И МАСШТАБИРОВАНИЯ
FOODTECH-ПЛАТФОРМЫ YALLA V2

1. ИСПОЛНИТЕЛЬНОЕ РЕЗЮМЕ (EXECUTIVE SUMMARY)

Настоящий стратегический документ определяет долгосрочный вектор развития и операционную программу масштабирования FoodTech-платформы Yalla (app.yalla.tj) на рынке Таджикистана и Центральной Азии. Ключевое видение проекта заключается в эволюционной трансформации сервиса из текущей ИТ-платформы доставки готовых комплексных обедов в диверсифицированную экосистему супераппа (SuperApp), функционирующего на стыке готовой кулинарии (FoodTech), персонализированного питания (HealthTech) и ультрабыстрой доставки товаров первой необходимости (Dark Store).

Для достижения устойчивого конкурентного преимущества Yalla переходит от классической asset-light модели к контролируемой сквозной производственно-логистической вертикали. Программа включает четыре последовательных этапа развития кухонной инфраструктуры, глубокую сегментацию целевой аудитории, а также расширение продуктовой линейки для максимизации LTV и снижения OpEx и фудкоста.

2. ТЕКУЩЕЕ СОСТОЯНИЕ ПРОДУКТА, ОПЕРАЦИОННАЯ МОДЕЛЬ И БИЗНЕС-ПРОЦЕССЫ

Компания функционирует по гибридной операционной модели, успешно совмещая ИТ-функционал агрегатора, регламенты стандартизации качества готовой продукции и независимую внутреннюю службу логистики.

2.1. Взаимодействие с партнерами
- Модель сотрудничества: платформа подключает свободные мощности действующих ресторанов и пищевых производств.
- Стандартизация: партнерам передается утвержденное сбалансированное план-меню. Приготовление осуществляется по технологическим картам Yalla.
- Монетизация: фиксированная комиссия за генерацию заказов, клиентский сервис и сопровождение.
- Взаиморасчеты: ежедневные выплаты по транзакционной модели 1:1 либо консолидированный расчет раз в месяц.

2.2. Клиентские сегменты и финансовая логистика
- B2B: постоплата по консолидированному счету в конце месяца либо депозитное пополнение баланса.
- B2B2C: еженедельная коллективная подписка. Минимальный квант заказа — от 5 человек на срок от 5 рабочих дней.

2.3. Формат продукта и структура текущего меню
- Комбо-пакет 25: второе горячее блюдо, свежий салат, порционный хлеб, приборы. Доставка включена. Стоимость: 25 сомони.
- Комбо-пакет 35: первое горячее блюдо, второе горячее блюдо, свежий салат, порционный хлеб, приборы. Доставка включена. Стоимость: 35 сомони.

2.4. Доставка и логистическая модель
- Собственный штат курьеров.
- Пакетная сборка (Batching): ИТ-алгоритм группирует заказы по географическим кластерам.
- Тайминг: доставка в фиксированный интервал с 11:30 до 12:30.

3. СТРАТЕГИЯ РАЗВИТИЯ И ЭВОЛЮЦИЯ СЕГМЕНТОВ РЫНКА

3.1. Развитие B2B-сегмента
- Разовые On-demand заказы: покупка без подписки с ежедневным меню на выбор, наценка 10-15% относительно базовой подписки.
- ИТ-модуль «Конструктор меню»: гибкий конструктор с лимитами бюджетов на сотрудников.

3.2. Масштабирование B2C-направления
- ПП и ЗОЖ рационы: курсовые подписки на специализированное и функциональное питание.
- Крупноформатные и праздничные заказы: доставка весовых блюд и направление «Тагора».
- Массовые Ифтары: пакетные предложения с точной доставкой к минуте разговения в Рамадан.

3.3. Специализированные рыночные ниши
- «Мастера домов»: сытное и доступное меню для строительных бригад.
- «Забота о близких»: доставка специализированного диетического питания для пациентов в стационарах клиник.

4. СТРАТЕГИЯ РАЗВИТИЯ ПРОИЗВОДСТВЕННОЙ ИНФРАСТРУКТУРЫ

Стратегический KPI: сокращение плеча логистики и обеспечение времени доставки до ${metrics.deliveryTime} минут по всему городу.

- Этап 1 (${dates.phase1}): партнерские кухни + 1-я пилотная Dark Kitchen для минимизации CapEx и обкатки процессов.
- Этап 2 (${dates.phase2}): сеть распределенных локальных Dark Kitchen в микрорайонах города для быстрой сборки и регенерации горячих блюд.
- Этап 3 (${dates.phase3}): запуск централизованной промышленной Фабрики-кухни. Полный переход на заготовки высокой степени готовности: Sous-Vide и шоковая заморозка.
- Этап 4 (${dates.phase4}): SuperApp, Yalla Pharm, HealthTech и региональная экспансия.

Преимущества Фабрики-кухни:
- Абсолютная стандартизация вкуса и веса.
- Сокращение площадей и CapEx/OpEx локальных Dark Kitchen.
- Оптимизация фудкоста за счет оптовых прямых закупок.

5. НОВЫЕ ПРОДУКТОВЫЕ ВЕРТИКАЛИ И ЭКОСИСТЕМА УСЛУГ
- Мил-киты (Elementaree): наборы продуктов с соусами и инструкцией для готовки дома за 10-15 минут.
- Брендовые полуфабрикаты: пельмени, самса, манты, маринованное мясо.
- Catering & Events: обслуживание банкетов, кофе-брейков и пикников.
- Kitchen-as-a-Service (KaaS): аутсорсинг пищеблоков школ, строек и предприятий.
- Микромаркеты: брендированные умные холодильники с QR-оплатой в БЦ и ВУЗах.
- Yalla Lavka и Yalla Pharm: экспресс-доставка продуктов и аптечный маркетплейс.
- HealthTech-модуль: автоподбор меню на основе медицинских анализов и дефицитов нутриентов.
- Yalla Academy: обучение поваров и курьеров.

6. ГЕОГРАФИЧЕСКАЯ ЭКСПАНСИЯ
- Фаза 1: полное покрытие Душанбе и ключевых городов РТ, запуск Фабрики-кухни.
- Фаза 2: выход в Узбекистан, локализация ИТ-платформы, открытие хаба в Ташкенте.
- Фаза 3: Казахстан и Кыргызстан: Алматы, Астана, Бишкек через СП или франчайзинг.

7. ДОРОЖНАЯ КАРТА И ЦЕЛЕВЫЕ МЕТРИКИ (KPI)
- Сроки Этапа 1: ${dates.phase1}.
- Сроки Этапа 2: ${dates.phase2}.
- Сроки Этапа 3: ${dates.phase3}.
- Сроки Этапа 4: ${dates.phase4}.

ЦЕЛЕВЫЕ МЕТРИКИ К ПЕРИОДУ ${metrics.mrrPeriod}:
1. Ежемесячный повторяющийся доход (MRR): $${metrics.mrr} USD.
2. Количество активных B2B-компаний: ${metrics.b2bCount} организаций.
3. Объем заказов в сутки: ${metrics.dailyOrders} выполненных доставок в сутки.
4. Целевой совокупный фудкост: ${metrics.foodCost}% от розничной цены.
`;

  const handleCopyText = async () => {
    const textToCopy = generateDocumentText();

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedDoc(true);
      setTimeout(() => setCopiedDoc(false), 2000);
      return;
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = textToCopy;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopiedDoc(true);
      setTimeout(() => setCopiedDoc(false), 2000);
    }
  };

  const selected = phases[selectedPhase];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col antialiased selection:bg-emerald-500 selection:text-slate-900">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50 px-4 py-4 md:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500 text-slate-950 p-2.5 rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center font-black text-xl tracking-tight">
              Y
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider">
                  V2 Strategy
                </span>
                <span className="text-xs text-slate-500">Душанбе • Таджикистан</span>
              </div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                Yalla <span className="text-emerald-400">FoodTech Platform</span>
              </h1>
            </div>
          </div>

          <nav className="flex items-center bg-slate-950/60 p-1 rounded-xl border border-slate-800 self-start md:self-auto overflow-x-auto max-w-full">
            <TabButton active={activeTab === "roadmap"} icon={<Map className="w-4 h-4" />} onClick={() => setActiveTab("roadmap")}>
              Дорожная карта
            </TabButton>
            <TabButton active={activeTab === "ecosystem"} icon={<Layers className="w-4 h-4" />} onClick={() => setActiveTab("ecosystem")}>
              Экосистема SuperApp
            </TabButton>
            <TabButton active={activeTab === "metrics"} icon={<Sliders className="w-4 h-4" />} onClick={() => setActiveTab("metrics")}>
              Конструктор KPI
            </TabButton>
            <TabButton active={activeTab === "document"} icon={<Database className="w-4 h-4" />} onClick={() => setActiveTab("document")}>
              Готовый Документ
            </TabButton>
          </nav>
        </div>
      </header>

      <main className="page-reveal flex-1 max-w-7xl w-full mx-auto px-4 py-6 md:px-8 md:py-10">
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8 relative overflow-hidden shadow-xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white tracking-tight">Эволюция FoodTech в Центральной Азии</h2>
              <p className="text-slate-400 max-w-3xl text-sm leading-relaxed">
                Переход от классической <span className="text-emerald-400 font-semibold">asset-light</span> модели агрегатора к контролируемой сквозной производственно-логистической вертикали.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-6 md:divide-x md:divide-slate-800">
              <MetricTop label="Целевой Фудкост" value={`${metrics.foodCost}%`} />
              <MetricTop label="Доставка еды" value={`< ${metrics.deliveryTime} мин`} padded />
              <MetricTop label="Цель по MRR" value={`$${metrics.mrr}`} padded />
            </div>
          </div>
        </section>

        {activeTab === "roadmap" && (
          <div className="space-y-10">
            <section>
              <h3 className="text-lg font-bold text-slate-300 mb-6 flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-500" />
                Интерактивный Таймлайн Развития
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {phases.map((phase, index) => (
                  <button
                    key={phase.id}
                    type="button"
                    onClick={() => setSelectedPhase(index)}
                    className={`text-left cursor-pointer rounded-2xl border transition-all p-5 relative overflow-hidden group ${
                      selectedPhase === index
                        ? "bg-slate-900 border-emerald-500 shadow-lg shadow-emerald-500/10 scale-[1.02]"
                        : "bg-slate-900/50 border-slate-800 hover:border-slate-700 hover:bg-slate-900"
                    }`}
                  >
                    <div className="absolute top-0 left-0 h-1 bg-emerald-500 transition-all" style={{ width: selectedPhase === index ? "100%" : "20%" }} />
                    <div className="flex justify-between items-start mb-4">
                      <span className={`text-xs px-2 py-1 rounded font-bold tracking-wider uppercase ${index === 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-800 text-slate-400"}`}>
                        {phase.time}
                      </span>
                      <span className="text-slate-600 font-mono text-sm">0{phase.id}</span>
                    </div>
                    <h4 className="font-bold text-white text-base group-hover:text-emerald-400 transition-colors line-clamp-1">
                      {phase.title.split(": ")[1]}
                    </h4>
                    <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">{phase.infra}</p>
                    <div className="mt-4 flex items-center text-xs font-semibold text-emerald-400 gap-1 opacity-80 group-hover:opacity-100">
                      Подробнее <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 relative overflow-hidden">
              <div className={`absolute top-0 right-0 w-80 h-80 bg-gradient-to-br ${selected.color} opacity-5 rounded-full blur-3xl pointer-events-none`} />
              <div className="flex flex-col lg:flex-row gap-8 relative z-10">
                <div className="flex-1 space-y-6">
                  <div>
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      <span className="text-xs bg-emerald-500 text-slate-950 font-bold px-3 py-1 rounded-full uppercase tracking-wider">{selected.time}</span>
                      <span className="text-sm text-slate-500">Эволюционная фаза развития 0{selected.id}</span>
                    </div>
                    <h3 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">{selected.title}</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InfoPanel icon={<Utensils className="w-3.5 h-3.5 text-emerald-400" />} title="Инфраструктурная база" text={selected.infra} />
                    <InfoPanel icon={<Target className="w-3.5 h-3.5 text-emerald-400" />} title="Целевой сегмент рынка" text={selected.target} />
                  </div>
                  <div className="p-4 rounded-xl bg-emerald-950/10 border border-emerald-500/20 space-y-1">
                    <div className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">Ключевая задача этапа</div>
                    <p className="text-sm text-slate-300 leading-relaxed">{selected.task}</p>
                  </div>
                </div>

                <div className="lg:w-[450px] space-y-6 lg:border-l lg:border-slate-800 lg:pl-8">
                  <ListBlock title="Особенности фазы:" items={selected.details.highlights} checked />
                  <ListBlock title="Целевые фокусы (KPI):" items={selected.details.kpis} />
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === "ecosystem" && (
          <div className="space-y-8">
            <div className="text-center max-w-2xl mx-auto space-y-2 mb-4">
              <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full font-bold uppercase tracking-wider">
                Будущая Архитектура Yalla SuperApp
              </span>
              <h3 className="text-2xl font-extrabold text-white tracking-tight">Экосистема Взаимосвязанных Вертикалей</h3>
              <p className="text-sm text-slate-400">Единая платформа питания, заботы о здоровье и ультрабыстрой доставки.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <EcosystemCard
                color="emerald"
                icon={<Utensils className="w-5 h-5" />}
                title="FoodTech & Кулинария"
                subtitle="Собственные кухни и доставка"
                items={[
                  ["Мил-киты (Elementaree)", "Наборы подготовленных, вакуумированных продуктов с соусами и специями для быстрой готовки."],
                  ["Брендовые Полуфабрикаты", "Промышленное производство замороженных изделий: манты, самса, стейки."],
                  ["Catering & Events", "Выездное ресторанное обслуживание под ключ для конференций, свадеб и пикников."],
                ]}
              />
              <EcosystemCard
                color="blue"
                icon={<Truck className="w-5 h-5" />}
                title="Ритейл & Сети"
                subtitle="Каналы сбыта и экспресс-доставка"
                items={[
                  ["Микромаркеты доверия", "Умные холодильники с готовой едой от Yalla в офисах, банках и ВУЗах с QR-оплатой."],
                  ["Kitchen-as-a-Service", "Операционное управление и аутсорсинг пищеблоков школ и предприятий."],
                  ["Yalla Lavka & Pharm", "Модули экспресс-доставки товаров первой необходимости и безрецептурных лекарств."],
                ]}
              />
              <EcosystemCard
                color="purple"
                icon={<Activity className="w-5 h-5" />}
                title="HealthTech & Академия"
                subtitle="Интеллектуальные ИТ-сервисы"
                items={[
                  ["HealthTech-модуль", "Корректировка плана питания пользователя на основе данных медицинских анализов."],
                  ["Yalla Academy", "Учебный центр для обучения, сертификации и развития шеф-поваров и курьеров."],
                  ["Забота о близких", "Специализированное диетическое питание для пациентов в больницах."],
                ]}
              />
            </div>
          </div>
        )}

        {activeTab === "metrics" && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <section className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
                <div>
                  <h4 className="font-bold text-white text-lg mb-1 flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-emerald-400" />
                    Параметры KPI
                  </h4>
                  <p className="text-xs text-slate-400">Настройте даты и целевые метрики стратегии развития Yalla V2.</p>
                </div>

                <div className="space-y-4">
                  <FormSection title="Планируемые даты:">
                    <Input label="Срок Этапа 1 (Пилот DK)" value={dates.phase1} onChange={(value) => setDates({ ...dates, phase1: value })} />
                    <Input label="Срок Этапа 2 (Сеть DK)" value={dates.phase2} onChange={(value) => setDates({ ...dates, phase2: value })} />
                    <Input label="Срок Этапа 3 (Фабрика)" value={dates.phase3} onChange={(value) => setDates({ ...dates, phase3: value })} />
                    <Input label="Срок Этапа 4 (Экспансия)" value={dates.phase4} onChange={(value) => setDates({ ...dates, phase4: value })} />
                  </FormSection>

                  <FormSection title="Целевые бизнес-метрики:">
                    <Input label="Целевой MRR (USD)" value={metrics.mrr} prefix="$" onChange={(value) => setMetrics({ ...metrics, mrr: value })} />
                    <Input label="К какому периоду достичь MRR" value={metrics.mrrPeriod} onChange={(value) => setMetrics({ ...metrics, mrrPeriod: value })} />
                    <Input label="Активные B2B-компании" value={metrics.b2bCount} onChange={(value) => setMetrics({ ...metrics, b2bCount: value })} />
                    <Input label="Заказы в сутки (Объем)" value={metrics.dailyOrders} onChange={(value) => setMetrics({ ...metrics, dailyOrders: value })} />
                    <Input label="Целевой Фудкост (%)" value={metrics.foodCost} suffix="%" type="number" onChange={(value) => setMetrics({ ...metrics, foodCost: value })} />
                    <Input label="Скорость доставки (минуты)" value={metrics.deliveryTime} type="number" onChange={(value) => setMetrics({ ...metrics, deliveryTime: value })} />
                  </FormSection>
                </div>
              </section>

              <section className="lg:col-span-2 space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
                  <h4 className="font-bold text-white text-lg mb-4 flex items-center gap-2">
                    <Target className="w-5 h-5 text-emerald-400" />
                    Проекция стратегических KPI
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Projection icon={<TrendingUp className="w-6 h-6" />} tone="emerald" label="Повторяющийся доход (MRR)" value={`$${metrics.mrr} USD`} note={`Ожидаемо к ${metrics.mrrPeriod}`} />
                    <Projection icon={<Briefcase className="w-6 h-6" />} tone="blue" label="Корпоративный охват B2B" value={`${metrics.b2bCount} компаний`} note="На постоянных подписках" />
                    <Projection icon={<Utensils className="w-6 h-6" />} tone="purple" label="Операционный поток" value={`${metrics.dailyOrders} зак/сутки`} note="Среднесуточный объем" />
                    <Projection icon={<Activity className="w-6 h-6" />} tone="red" label="Целевой Фудкост" value={`${metrics.foodCost}%`} note="Оптимизация за счет Фабрики" />
                  </div>
                  <div className="mt-6 bg-slate-950/40 p-4 rounded-xl border border-slate-800/60 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Указанные параметры автоматически переносятся в итоговый бизнес-план. Перейдите во вкладку{" "}
                      <button type="button" className="text-emerald-400 font-bold" onClick={() => setActiveTab("document")}>
                        «Готовый Документ»
                      </button>
                      , чтобы скопировать структурированную версию концепции.
                    </p>
                  </div>
                </div>

                <div className="p-6 bg-emerald-950/10 border border-emerald-500/20 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h5 className="font-bold text-white text-base">Метрики заполнены и интегрированы</h5>
                    <p className="text-xs text-slate-400">Полный текст концепции с датами и цифрами готов к копированию.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab("document")}
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl transition-all shadow-lg shadow-emerald-500/15 flex items-center gap-2 text-sm"
                  >
                    Открыть готовый документ
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </section>
            </div>
          </div>
        )}

        {activeTab === "document" && (
          <section className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
              <div>
                <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  <Database className="w-5 h-5 text-emerald-400" />
                  Генератор Концепции (Формат V2)
                </h3>
                <p className="text-xs text-slate-400">Документ автоматически отформатирован и содержит все метрики из вкладки параметров.</p>
              </div>
              <button
                type="button"
                onClick={handleCopyText}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-500/10 flex items-center gap-2 text-sm"
              >
                {copiedDoc ? (
                  <>
                    <Check className="w-4 h-4" />
                    Скопировано!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Копировать весь документ
                  </>
                )}
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 md:p-10 font-mono text-xs md:text-sm text-slate-300 overflow-y-auto max-h-[600px] leading-relaxed relative">
              <div className="absolute top-4 right-4 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest">
                Готовый драфт
              </div>
              <pre className="whitespace-pre-wrap font-sans text-slate-300">{generateDocumentText()}</pre>
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-slate-800 bg-slate-950 py-6 px-4 md:px-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:justify-between items-center gap-4">
          <p>© 2026 FoodTech-платформа Yalla. Программа стратегического развития V2.</p>
          <p>Разработано для презентации и масштабирования</p>
        </div>
      </footer>
    </div>
  );
}

function TabButton({ active, icon, onClick, children }: { active: boolean; icon: React.ReactNode; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`${tabButtonBase} ${active ? "bg-emerald-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"}`}>
      {icon}
      {children}
    </button>
  );
}

function MetricTop({ label, value, padded = false }: { label: string; value: string; padded?: boolean }) {
  return (
    <div className={padded ? "md:pl-6" : ""}>
      <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">{label}</div>
      <div className="text-2xl font-black text-emerald-400">{value}</div>
    </div>
  );
}

function InfoPanel({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-1">
      <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider flex items-center gap-1.5">
        {icon}
        {title}
      </div>
      <p className="text-sm text-slate-200 leading-relaxed">{text}</p>
    </div>
  );
}

function ListBlock({ title, items, checked = false }: { title: string; items: string[]; checked?: boolean }) {
  return (
    <div className={checked ? "" : "pt-4 border-t border-slate-800/60"}>
      <h5 className="text-sm font-bold text-white mb-3 tracking-wider uppercase">{title}</h5>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-sm text-slate-400">
            {checked ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> : <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-2" />}
            <span className="leading-relaxed">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EcosystemCard({
  color,
  icon,
  title,
  subtitle,
  items,
}: {
  color: "emerald" | "blue" | "purple";
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  items: [string, string][];
}) {
  const colors = {
    emerald: {
      bar: "bg-emerald-500",
      icon: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      heading: "text-emerald-400",
    },
    blue: {
      bar: "bg-blue-500",
      icon: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      heading: "text-blue-400",
    },
    purple: {
      bar: "bg-purple-500",
      icon: "bg-purple-500/10 text-purple-400 border-purple-500/20",
      heading: "text-purple-400",
    },
  }[color];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 relative overflow-hidden">
      <div className={`absolute top-0 left-0 w-1.5 h-full ${colors.bar}`} />
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-xl border ${colors.icon}`}>{icon}</div>
        <div>
          <h4 className="font-bold text-white text-lg">{title}</h4>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
      </div>
      <div className="space-y-3">
        {items.map(([itemTitle, itemText]) => (
          <div key={itemTitle} className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
            <div className={`text-xs font-bold uppercase tracking-wide ${colors.heading}`}>{itemTitle}</div>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">{itemText}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-slate-800 pt-4 space-y-3">
      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{title}</span>
      {children}
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  prefix,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number";
  prefix?: string;
  suffix?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs text-slate-400 mb-1">{label}</span>
      <span className="relative block">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">{prefix}</span>}
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 text-sm focus:outline-none focus:border-emerald-500 text-white font-medium ${prefix ? "pl-7 pr-3" : "px-3"} ${suffix ? "pr-8" : ""}`}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">{suffix}</span>}
      </span>
    </label>
  );
}

function Projection({
  icon,
  tone,
  label,
  value,
  note,
}: {
  icon: React.ReactNode;
  tone: "emerald" | "blue" | "purple" | "red";
  label: string;
  value: string;
  note: string;
}) {
  const colors = {
    emerald: "bg-emerald-500/10 text-emerald-400",
    blue: "bg-blue-500/10 text-blue-400",
    purple: "bg-purple-500/10 text-purple-400",
    red: "bg-red-500/10 text-red-400",
  }[tone];

  const noteColors = {
    emerald: "text-emerald-400/80",
    blue: "text-blue-400/80",
    purple: "text-purple-400/80",
    red: "text-red-400/80",
  }[tone];

  return (
    <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${colors}`}>{icon}</div>
      <div>
        <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">{label}</span>
        <h5 className="text-2xl font-black text-white mt-0.5">{value}</h5>
        <p className={`text-xs mt-1 ${noteColors}`}>{note}</p>
      </div>
    </div>
  );
}
