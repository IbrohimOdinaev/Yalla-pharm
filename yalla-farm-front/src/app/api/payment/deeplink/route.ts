const ESKHATA_SERVICE_ID = "96e8b785-b1b9-11e8-904b-b06ebfbfa715";
const ESKHATA_PAYMENT_CODE = "DA00126FM";

type PaymentProvider = "dc" | "alif" | "eskhata";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeScriptString(value: string): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c").replaceAll(">", "\\u003e").replaceAll("&", "\\u0026");
}

function normalizeProvider(value: string | null): PaymentProvider | null {
  const provider = String(value ?? "").trim().toLowerCase();
  if (provider === "dc" || provider === "dushanbe" || provider === "dushanbecity" || provider === "dushanbe-city") {
    return "dc";
  }
  if (provider === "alif" || provider === "alifmobi") return "alif";
  if (provider === "eskhata" || provider === "esxata" || provider === "eskxata") return "eskhata";
  return null;
}

function normalizePhone(value: string | null): string | null {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 15 ? digits : null;
}

function normalizeAmount(value: string | null): string | null {
  const normalized = String(value ?? "").trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;

  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  return amount.toFixed(2);
}

function buildPaymentDeepLink(provider: PaymentProvider, phone: string, amount: string): string {
  switch (provider) {
    case "dc":
      return `dushanbecity://transfer?phone=${phone}&amount=${amount}`;
    case "alif":
      return `alifmobi:///toMobi?account=%2B${phone}&summa=${amount}&_imcp=1`;
    case "eskhata":
      return `eskhata://service/${ESKHATA_SERVICE_ID}/${phone}/${amount}/${ESKHATA_PAYMENT_CODE}`;
  }
}

function renderHtml(deepLink: string | null): string {
  const href = escapeHtml(deepLink ?? "");
  const scriptTarget = escapeScriptString(deepLink ?? "");
  const redirectMarkup = deepLink
    ? `<meta http-equiv="refresh" content="0;url=${href}">
  <script>
    (function () {
      var target = ${scriptTarget};
      function openPayment() {
        window.location.href = target;
      }
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", openPayment, { once: true });
      } else {
        openPayment();
      }
      window.setTimeout(openPayment, 250);
    }());
  </script>`
    : "";

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Открыть оплату</title>
  ${redirectMarkup}
  <style>
    body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f8faf8;color:#1a1c1b;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:16px;box-sizing:border-box}
    main{width:min(100%,380px);padding:22px;border:1px solid #d8dcd9;border-radius:24px;background:#fff;text-align:center;box-shadow:0 16px 40px rgba(26,28,27,.10)}
    h1{margin:0;font-size:20px;line-height:1.2}
    p{margin:10px 0 0;color:#6f7572;font-size:14px;line-height:1.45}
    a{display:inline-flex;min-height:46px;align-items:center;justify-content:center;margin-top:20px;border-radius:999px;background:#2f80ed;color:#fff;padding:0 20px;font-weight:800;text-decoration:none}
    .error{margin-top:18px;border-radius:16px;background:#fff1f1;color:#b42318;padding:12px;font-weight:700}
  </style>
</head>
<body>
  <main>
    <h1>Открываем оплату</h1>
    ${deepLink
      ? `<p>Если приложение оплаты не открылось автоматически, нажмите кнопку ниже.</p><a href="${href}" rel="noopener noreferrer">Открыть оплату</a>`
      : `<div class="error">Недостаточно данных для оплаты.</div>`}
  </main>
</body>
</html>`;
}

export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const provider = normalizeProvider(params.get("provider") ?? params.get("bank") ?? params.get("method"));
  const phone = normalizePhone(params.get("phone") ?? params.get("account") ?? params.get("wallet"));
  const amount = normalizeAmount(params.get("amount") ?? params.get("summa") ?? params.get("s"));
  const deepLink = provider && phone && amount ? buildPaymentDeepLink(provider, phone, amount) : null;

  return new Response(renderHtml(deepLink), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
