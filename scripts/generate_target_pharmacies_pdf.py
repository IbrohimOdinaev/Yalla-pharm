#!/usr/bin/env python3
import csv
import html
from datetime import datetime
from pathlib import Path


SOURCE = Path("/home/agony/doru_dushanbe_active_all_fields.csv")
OUTPUT = Path("target.html")


FIELD_LABELS = {
    "№": "Исходный №",
    "Интегрирована": "Интеграция",
    "Последняя синхронизация": "Последняя синхронизация",
    "Доставка": "Доставка",
    "Найдено товаров в проверке": "Товаров в проверке",
    "Сумма товаров в проверке": "Сумма в проверке",
    "orgID": "orgID",
    "orgName": "Название",
    "orgTel": "Телефон",
    "orgTelApteka": "Телефон аптеки",
    "orgEmail": "Email",
    "orgAddress": "Адрес",
    "orgRegion": "Код региона",
    "REGIONNAME": "Регион",
    "orgLandmark": "Ориентир",
    "orgLat": "Широта",
    "orgLng": "Долгота",
    "orgStartDate": "Открытие",
    "orgEndDate": "Закрытие",
    "orgDate": "Дата записи",
    "orgStatus": "Статус",
    "orgFileName": "Файл",
    "orgState": "Состояние",
    "orgType": "Тип",
    "allow_phone_number": "Разрешен телефон",
    "allow_video_call": "Видео-звонок",
    "allow_audio_video_call": "Аудио/видео",
    "IS_OPEN": "Открыта",
    "IS_24_TIME": "24/7",
    "__integration_comment": "Комментарий",
}


PRIMARY_FIELDS = [
    "orgTel",
    "orgTelApteka",
    "orgAddress",
    "orgLandmark",
    "REGIONNAME",
    "orgStartDate",
    "orgEndDate",
]

INTEGRATION_FIELDS = [
    "Интегрирована",
    "__integration_comment",
    "Последняя синхронизация",
    "Доставка",
    "Найдено товаров в проверке",
    "Сумма товаров в проверке",
    "orgStatus",
    "IS_OPEN",
    "IS_24_TIME",
]

INTEGRATION_COMMENTS = {
    "Дорухона Ромашка": "у них база доруи ман 1c не присутствует.",
}


def esc(value):
    text = "" if value is None else str(value).strip()
    return html.escape(text if text else "-")


def field(row, key):
    classes = ["field"]
    if key == "Интегрирована" and row.get("__integration_comment"):
        classes.append("field-alert")
    if key == "__integration_comment" and row.get("__integration_comment"):
        classes.append("field-note")

    return f"""
        <div class="{' '.join(classes)}">
          <div class="label">{esc(FIELD_LABELS.get(key, key))}</div>
          <div class="value">{esc(row.get(key, ""))}</div>
        </div>
    """


def section(title, row, keys):
    visible_keys = [
        key for key in keys if not key.startswith("__") or row.get(key)
    ]

    return f"""
      <section class="section">
        <h3>{esc(title)}</h3>
        <div class="grid">
          {''.join(field(row, key) for key in visible_keys)}
        </div>
      </section>
    """


def main():
    with SOURCE.open("r", encoding="utf-8-sig", newline="") as fh:
        rows = list(csv.DictReader(fh))

    targets = [row for row in rows if row.get("Интегрирована") == "Да"]
    all_fields = list(rows[0].keys()) if rows else []
    remaining_fields = [
        key
        for key in all_fields
        if key
        not in {"orgName", "orgID", *PRIMARY_FIELDS, *INTEGRATION_FIELDS}
    ]

    cards = []
    for index, row in enumerate(targets, start=1):
        row["__integration_comment"] = INTEGRATION_COMMENTS.get(
            row.get("orgName", "").strip(), ""
        )
        title = esc(row.get("orgName", ""))
        org_id = esc(row.get("orgID", ""))
        last_sync = esc(row.get("Последняя синхронизация", ""))
        cards.append(
            f"""
            <article class="card">
              <header class="card-head">
                <div>
                  <div class="number">#{index} / исходный № {esc(row.get("№", ""))}</div>
                  <h2>{title}</h2>
                </div>
                <div class="meta">
                  <div>orgID: <strong>{org_id}</strong></div>
                  <div>sync: <strong>{last_sync}</strong></div>
                </div>
              </header>
              {section("Контакты и адрес", row, PRIMARY_FIELDS)}
              {section("Интеграция и статус", row, INTEGRATION_FIELDS)}
              {section("Остальные поля", row, remaining_fields)}
            </article>
            """
        )

    generated_at = datetime.now().strftime("%Y-%m-%d %H:%M")
    document = f"""<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <title>target - 48 интегрированных аптек</title>
  <style>
    @page {{
      size: A4;
      margin: 10mm;
    }}
    * {{
      box-sizing: border-box;
    }}
    body {{
      margin: 0;
      color: #182026;
      font-family: Arial, "DejaVu Sans", sans-serif;
      font-size: 10px;
      line-height: 1.32;
      background: #fff;
    }}
    .cover {{
      border-bottom: 2px solid #243746;
      margin-bottom: 8px;
      padding-bottom: 8px;
    }}
    h1 {{
      margin: 0 0 4px;
      font-size: 22px;
      line-height: 1.15;
      letter-spacing: 0;
    }}
    .subtitle {{
      display: flex;
      justify-content: space-between;
      gap: 12px;
      color: #4b5862;
      font-size: 10px;
    }}
    .card {{
      break-inside: avoid;
      page-break-inside: avoid;
      border: 1px solid #b9c2ca;
      border-radius: 6px;
      margin: 0 0 7px;
      padding: 7px;
    }}
    .card-head {{
      display: flex;
      justify-content: space-between;
      gap: 10px;
      border-bottom: 1px solid #d8dee3;
      margin-bottom: 6px;
      padding-bottom: 5px;
    }}
    .number {{
      color: #63717d;
      font-size: 9px;
      margin-bottom: 2px;
    }}
    h2 {{
      margin: 0;
      color: #111820;
      font-size: 14px;
      line-height: 1.15;
      letter-spacing: 0;
    }}
    .meta {{
      min-width: 122px;
      color: #3a4650;
      font-size: 9px;
      text-align: right;
      white-space: nowrap;
    }}
    .section {{
      margin-top: 5px;
    }}
    h3 {{
      margin: 0 0 3px;
      color: #23313c;
      font-size: 10px;
      line-height: 1.2;
      letter-spacing: 0;
    }}
    .grid {{
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 3px 5px;
    }}
    .field {{
      min-height: 22px;
      padding: 3px 4px;
      border: 1px solid #e2e7eb;
      border-radius: 4px;
      background: #f8fafb;
      overflow-wrap: anywhere;
    }}
    .label {{
      color: #66737e;
      font-size: 8px;
      line-height: 1.15;
    }}
    .value {{
      margin-top: 1px;
      color: #17202a;
      font-size: 9px;
      line-height: 1.22;
    }}
    .field-alert {{
      border-color: #d33a2c;
      background: #fff0ee;
    }}
    .field-alert .label,
    .field-alert .value {{
      color: #b42318;
      font-weight: 700;
    }}
    .field-note {{
      border-color: #d33a2c;
      background: #fff7f6;
    }}
    .field-note .label {{
      color: #b42318;
      font-weight: 700;
    }}
    @media print {{
      body {{
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }}
    }}
  </style>
</head>
<body>
  <div class="cover">
    <h1>Target: 48 интегрированных аптек Душанбе</h1>
    <div class="subtitle">
      <div>Источник: {esc(str(SOURCE))}</div>
      <div>Сформировано: {esc(generated_at)}</div>
    </div>
  </div>
  {''.join(cards)}
</body>
</html>
"""
    OUTPUT.write_text(document, encoding="utf-8")
    print(f"Wrote {OUTPUT} with {len(targets)} integrated pharmacies")


if __name__ == "__main__":
    main()
