export function buildPaymentQrValue(deepLinkUrl: string): string {
  return deepLinkUrl.trim();
}

export function buildPaymentQrDescription(deepLinkUrl: string): string {
  const qrValue = buildPaymentQrValue(deepLinkUrl);
  if (!qrValue) {
    return "QR для оплаты пока недоступен.";
  }
  return "QR открывает приложение оплаты с подготовленными реквизитами.";
}
