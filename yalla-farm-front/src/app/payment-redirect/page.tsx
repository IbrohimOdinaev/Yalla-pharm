type PaymentRedirectPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const ALLOWED_PAYMENT_PROTOCOLS = new Set(["http:", "https:", "dushanbecity:", "alifmobi:", "eskhata:"]);

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function isAllowedPaymentUrl(value: string): boolean {
  try {
    return ALLOWED_PAYMENT_PROTOCOLS.has(new URL(value).protocol);
  } catch {
    return false;
  }
}

export default async function PaymentRedirectPage({ searchParams }: PaymentRedirectPageProps) {
  const params = await searchParams;
  const target = firstValue(params?.to);
  const isAllowed = target ? isAllowedPaymentUrl(target) : false;
  const isCustomScheme = isAllowed && !/^https?:\/\//i.test(target);

  return (
    <main className="page-reveal flex min-h-dvh items-center justify-center bg-surface p-4 text-on-surface">
      <section className="w-full max-w-sm rounded-3xl border border-outline/60 bg-surface-container-lowest p-5 text-center shadow-xl">
        <h1 className="font-display text-lg font-extrabold">Открываем оплату</h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          {isCustomScheme
            ? "Нажмите кнопку ниже, чтобы открыть приложение оплаты."
            : "Если приложение не открылось автоматически, нажмите кнопку ниже."}
        </p>
        {isAllowed ? (
          <a
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-extrabold text-white"
            href={target}
            rel="noopener noreferrer"
          >
            Открыть оплату
          </a>
        ) : (
          <p className="mt-5 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">
            Ссылка оплаты недоступна.
          </p>
        )}
      </section>
    </main>
  );
}
