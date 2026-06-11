type ConnectRequestBody = {
  fullName?: unknown;
  phone?: unknown;
  pharmacyName?: unknown;
  hasOneC?: unknown;
};

type ValidConnectRequestBody = {
  fullName: string;
  phone: string;
  pharmacyName: string;
  hasOneC: boolean;
};

const TELEGRAM_API_URL = "https://api.telegram.org/bot";

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const isValidPayload = (
  body: ConnectRequestBody
): body is ValidConnectRequestBody => {
  if (
    typeof body.fullName !== "string" ||
    typeof body.phone !== "string" ||
    typeof body.pharmacyName !== "string" ||
    typeof body.hasOneC !== "boolean"
  ) {
    return false;
  }

  const fullName = body.fullName.trim();
  const phone = body.phone.trim();
  const pharmacyName = body.pharmacyName.trim();

  return (
    fullName.length > 0 &&
    /^[\p{L}\s]+$/u.test(fullName) &&
    phone.length > 0 &&
    /^\d+$/.test(phone) &&
    pharmacyName.length > 0
  );
};

export async function POST(request: Request) {
  let body: ConnectRequestBody;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!isValidPayload(body)) {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    return Response.json(
      { error: "Telegram integration is not configured" },
      { status: 500 }
    );
  }

  const text = [
    "<b>Новая заявка на подключение Yalla Pharm</b>",
    "",
    `<b>Имя и фамилия:</b> ${escapeHtml(body.fullName.trim())}`,
    `<b>Телефон:</b> ${escapeHtml(body.phone.trim())}`,
    `<b>Аптека:</b> ${escapeHtml(body.pharmacyName.trim())}`,
    `<b>1С в аптеке:</b> ${body.hasOneC ? "Да" : "Нет"}`,
  ].join("\n");

  const response = await fetch(`${TELEGRAM_API_URL}${botToken}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      parse_mode: "HTML",
      text,
    }),
  });

  if (!response.ok) {
    return Response.json(
      { error: "Telegram message was not sent" },
      { status: 502 }
    );
  }

  return Response.json({ ok: true });
}
