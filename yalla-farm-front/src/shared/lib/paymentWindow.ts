export function preparePaymentWindow(): Window | null {
  if (typeof window === "undefined") return null;
  const paymentWindow = window.open("about:blank", "_blank");
  if (paymentWindow) {
    paymentWindow.opener = null;
    paymentWindow.document.title = "Dushanbe City";
    paymentWindow.document.body.innerHTML = "<p style=\"font-family:system-ui,sans-serif;padding:24px\">Открываем оплату...</p>";
  }
  return paymentWindow;
}

const ALLOWED_PAYMENT_PROTOCOLS = new Set(["http:", "https:", "dushanbecity:", "alifmobi:", "eskhata:"]);

export function isAllowedPaymentUrl(paymentUrl: string): boolean {
  try {
    const parsed = new URL(paymentUrl);
    return ALLOWED_PAYMENT_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}

export function openPaymentUrl(paymentUrl: string, paymentWindow?: Window | null): boolean {
  if (typeof window === "undefined" || !paymentUrl || !isAllowedPaymentUrl(paymentUrl)) {
    paymentWindow?.close();
    return false;
  }

  if (paymentWindow && !paymentWindow.closed) {
    paymentWindow.location.href = paymentUrl;
    return true;
  }

  return Boolean(window.open(paymentUrl, "_blank", "noopener,noreferrer"));
}
