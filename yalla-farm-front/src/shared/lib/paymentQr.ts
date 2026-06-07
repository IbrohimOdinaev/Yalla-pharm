import QRCode from "qrcode";

type PaymentQrWindowInput = {
  deepLinkUrl: string;
  title: string;
  amountLabel?: string;
  walletLabel?: string;
};

function normalizePhone(value: string | null): string {
  return String(value ?? "").replace(/\D/g, "");
}

function buildQrPayloadUrl(deepLinkUrl: string): string {
  try {
    const parsed = new URL(deepLinkUrl);
    if (parsed.protocol === "alifmobi:" && typeof window !== "undefined" && window.location.origin) {
      const phone = normalizePhone(parsed.searchParams.get("account"));
      const amount = parsed.searchParams.get("summa")?.trim();
      if (phone && amount) {
        const redirectUrl = new URL("/api/payment/deeplink", window.location.origin);
        redirectUrl.searchParams.set("provider", "alif");
        redirectUrl.searchParams.set("phone", phone);
        redirectUrl.searchParams.set("amount", amount);
        return redirectUrl.toString();
      }
    }
  } catch {
    return deepLinkUrl;
  }

  return deepLinkUrl;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function renderQrHtml(input: PaymentQrWindowInput, qrDataUrl: string): string {
  const title = escapeHtml(input.title);
  const amount = input.amountLabel ? escapeHtml(input.amountLabel) : "";
  const wallet = input.walletLabel ? escapeHtml(input.walletLabel) : "";
  const deepLink = escapeHtml(input.deepLinkUrl);
  const qr = escapeHtml(qrDataUrl);

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    :root { color-scheme: light; }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f8faf8;
      color: #1a1c1b;
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    main {
      width: min(92vw, 440px);
      box-sizing: border-box;
      padding: 24px;
      border: 1px solid #d8dcd9;
      border-radius: 24px;
      background: white;
      text-align: center;
      box-shadow: 0 16px 40px rgba(26, 28, 27, 0.10);
    }
    h1 { margin: 0 0 8px; font-size: 20px; line-height: 1.2; }
    p { margin: 6px 0; color: #6f7572; font-size: 14px; }
    img {
      display: block;
      width: min(72vw, 320px);
      height: min(72vw, 320px);
      margin: 20px auto;
      image-rendering: pixelated;
    }
    a {
      display: inline-flex;
      max-width: 100%;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      background: #2f80ed;
      color: white;
      padding: 12px 18px;
      font-weight: 800;
      text-decoration: none;
    }
    code {
      display: block;
      margin-top: 14px;
      padding: 10px;
      border-radius: 12px;
      background: #f2f4f2;
      color: #1a1c1b;
      font-size: 11px;
      overflow-wrap: anywhere;
      text-align: left;
    }
  </style>
</head>
<body>
  <main>
    <h1>${title}</h1>
    ${amount ? `<p>${amount}</p>` : ""}
    ${wallet ? `<p>${wallet}</p>` : ""}
    <img src="${qr}" alt="QR для оплаты">
    <a href="${deepLink}" rel="noopener noreferrer">Открыть оплату</a>
    <code>${deepLink}</code>
  </main>
</body>
</html>`;
}

function renderLoadingHtml(title: string): string {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body style="font-family:system-ui,sans-serif;padding:24px">Генерируем QR...</body></html>`;
}

function renderErrorHtml(title: string, message: string): string {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body style="font-family:system-ui,sans-serif;padding:24px"><strong>Не удалось создать QR.</strong><p>${escapeHtml(message)}</p></body></html>`;
}

function writeWindowHtml(target: Window, html: string) {
  target.document.open();
  target.document.write(html);
  target.document.close();
}

export async function openPaymentQrWindow(input: PaymentQrWindowInput): Promise<boolean> {
  if (typeof window === "undefined" || !input.deepLinkUrl.trim()) return false;

  const paymentWindow = window.open("about:blank", "_blank");
  if (!paymentWindow) return false;
  paymentWindow.opener = null;
  writeWindowHtml(paymentWindow, renderLoadingHtml(input.title));

  try {
    const qrDataUrl = await QRCode.toDataURL(buildQrPayloadUrl(input.deepLinkUrl), {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 720,
      color: {
        dark: "#1A1C1B",
        light: "#FFFFFF",
      },
    });
    writeWindowHtml(paymentWindow, renderQrHtml(input, qrDataUrl));
    return true;
  } catch (err) {
    writeWindowHtml(paymentWindow, renderErrorHtml(input.title, err instanceof Error ? err.message : "Ошибка генерации."));
    return false;
  }
}
