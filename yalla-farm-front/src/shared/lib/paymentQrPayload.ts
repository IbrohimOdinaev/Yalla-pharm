export function buildPaymentQrValue(deepLinkUrl: string): string {
  try {
    const url = new URL(deepLinkUrl);
    url.searchParams.delete("amount");
    url.searchParams.delete("summa");
    url.searchParams.delete("s");
    return url.toString();
  } catch {
    return deepLinkUrl;
  }
}

export function buildPaymentQrDescription(deepLinkUrl: string): string {
  const qrValue = buildPaymentQrValue(deepLinkUrl);
  if (qrValue === deepLinkUrl) {
    return "QR открывает приложение оплаты. Сумму введите вручную.";
  }
  return "QR открывает приложение оплаты без автоматического заполнения суммы.";
}
