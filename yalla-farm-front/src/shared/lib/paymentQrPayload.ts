export function buildPaymentQrValue(deepLinkUrl: string): string {
  const value = deepLinkUrl.trim();
  const legacyAlifPrefix = "alifmobi:///toMobi?";
  const legacyAlifHostPrefix = "alifmobi://toMobi?";
  const alifDynamicLinkPrefix = "https://alifmobi.page.link/toMobi?";
  if (value.toLowerCase().startsWith(legacyAlifPrefix.toLowerCase())) {
    return normalizeAlifAccountPlus(`${alifDynamicLinkPrefix}${value.slice(legacyAlifPrefix.length)}`);
  }
  if (value.toLowerCase().startsWith(legacyAlifHostPrefix.toLowerCase())) {
    return normalizeAlifAccountPlus(`${alifDynamicLinkPrefix}${value.slice(legacyAlifHostPrefix.length)}`);
  }
  if (value.toLowerCase().startsWith(alifDynamicLinkPrefix.toLowerCase())) {
    return normalizeAlifAccountPlus(value);
  }
  return value;
}

function normalizeAlifAccountPlus(value: string): string {
  return value.replace(/account=\+/i, "account=%2B");
}

export function buildPaymentQrDescription(deepLinkUrl: string): string {
  const qrValue = buildPaymentQrValue(deepLinkUrl);
  if (!qrValue) {
    return "QR для оплаты пока недоступен.";
  }
  return "QR открывает приложение оплаты с подготовленными реквизитами.";
}
