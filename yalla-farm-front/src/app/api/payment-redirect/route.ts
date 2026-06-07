const ALLOWED_PAYMENT_PROTOCOLS = new Set(["http:", "https:", "dushanbecity:", "alifmobi:", "eskhata:"]);

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

function isAllowedPaymentUrl(value: string): boolean {
  try {
    return ALLOWED_PAYMENT_PROTOCOLS.has(new URL(value).protocol);
  } catch {
    return false;
  }
}

function renderHtml(target: string, isAllowed: boolean): string {
  const href = escapeHtml(target);
  const scriptTarget = escapeScriptString(target);
  const redirectMarkup = isAllowed
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
    <p>Если приложение оплаты не открылось автоматически, нажмите кнопку ниже.</p>
    ${isAllowed ? `<a href="${href}" rel="noopener noreferrer">Открыть оплату</a>` : `<div class="error">Ссылка оплаты недоступна.</div>`}
  </main>
</body>
</html>`;
}

export function GET(request: Request) {
  const target = new URL(request.url).searchParams.get("to") ?? "";
  const isAllowed = Boolean(target) && isAllowedPaymentUrl(target);

  return new Response(renderHtml(target, isAllowed), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
