# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 02-search.spec.ts >> Catalog view (after category selection) >> sidebar categories are visible on desktop
- Location: e2e/02-search.spec.ts:80:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Каталог' })
Expected: visible
Error: strict mode violation: getByRole('heading', { name: 'Каталог' }) resolved to 2 elements:
    1) <h2 class="text-lg font-bold mb-3">Каталог</h2> aka locator('h2')
    2) <h4 class="font-display text-sm font-extrabold text-on-surface">Каталог</h4> aka getByRole('contentinfo').getByRole('heading', { name: 'Каталог' })

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByRole('heading', { name: 'Каталог' })

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - banner [ref=e3]:
      - generic [ref=e4]:
        - button "Yalla Yalla Farm" [ref=e5] [cursor=pointer]:
          - img "Yalla" [ref=e6]
          - generic [ref=e7]: Yalla Farm
        - button "Найти лекарства, витамины, тесты" [ref=e8] [cursor=pointer]:
          - img [ref=e9]
          - generic [ref=e12]: Найти лекарства, витамины, тесты
          - img [ref=e13]
        - link "Корзина" [ref=e16] [cursor=pointer]:
          - /url: /cart
          - img [ref=e17]
        - button "Аккаунт" [ref=e21] [cursor=pointer]:
          - img [ref=e22]
      - generic [ref=e26]:
        - button "Выберите адрес" [ref=e27] [cursor=pointer]:
          - img [ref=e28]
          - generic [ref=e31]: Выберите адрес
          - img [ref=e32]
        - button "Все аптеки" [ref=e34] [cursor=pointer]:
          - img [ref=e36]
          - generic [ref=e38]: Все аптеки
          - img [ref=e39]
    - main [ref=e42]:
      - generic [ref=e43]:
        - complementary [ref=e44]:
          - generic [ref=e45]:
            - heading "Каталог" [level=2] [ref=e46]
            - navigation [ref=e47]:
              - button "Все товары" [ref=e48] [cursor=pointer]
              - button "Анализы на дому" [ref=e50] [cursor=pointer]:
                - generic [ref=e51]: Анализы на дому
                - img [ref=e52]
              - generic [ref=e54]:
                - button "Витамины и БАД" [ref=e55] [cursor=pointer]:
                  - generic [ref=e56]: Витамины и БАД
                  - img [ref=e57]
                - generic [ref=e59]:
                  - button "Биологически активные добавки" [ref=e60] [cursor=pointer]
                  - button "Витамины и минералы" [ref=e61] [cursor=pointer]
              - button "Гигиена" [ref=e63] [cursor=pointer]:
                - generic [ref=e64]: Гигиена
                - img [ref=e65]
              - button "Детское питание" [ref=e68] [cursor=pointer]:
                - generic [ref=e69]: Детское питание
              - button "Для Него" [ref=e71] [cursor=pointer]:
                - generic [ref=e72]: Для Него
              - button "Для Неё" [ref=e74] [cursor=pointer]:
                - generic [ref=e75]: Для Неё
              - button "Другое" [ref=e77] [cursor=pointer]:
                - generic [ref=e78]: Другое
              - button "Красота" [ref=e80] [cursor=pointer]:
                - generic [ref=e81]: Красота
                - img [ref=e82]
              - button "Лекарственные средства" [ref=e85] [cursor=pointer]:
                - generic [ref=e86]: Лекарственные средства
                - img [ref=e87]
              - button "Лечебные травы" [ref=e90] [cursor=pointer]:
                - generic [ref=e91]: Лечебные травы
                - img [ref=e92]
              - button "Мама и малыш" [ref=e95] [cursor=pointer]:
                - generic [ref=e96]: Мама и малыш
              - button "Медицинские изделия" [ref=e98] [cursor=pointer]:
                - generic [ref=e99]: Медицинские изделия
                - img [ref=e100]
              - button "Медицинские приборы" [ref=e103] [cursor=pointer]:
                - generic [ref=e104]: Медицинские приборы
                - img [ref=e105]
              - button "Оптика" [ref=e108] [cursor=pointer]:
                - generic [ref=e109]: Оптика
              - button "Ортопедия" [ref=e111] [cursor=pointer]:
                - generic [ref=e112]: Ортопедия
              - button "парфюмерия" [ref=e114] [cursor=pointer]:
                - generic [ref=e115]: парфюмерия
              - button "Парфюмерия" [ref=e117] [cursor=pointer]:
                - generic [ref=e118]: Парфюмерия
              - button "Первая помощь" [ref=e120] [cursor=pointer]:
                - generic [ref=e121]: Первая помощь
                - img [ref=e122]
        - generic [ref=e124]:
          - generic [ref=e125]:
            - button [ref=e126] [cursor=pointer]:
              - img [ref=e127]
            - heading "Витамины и БАД" [level=1] [ref=e129]
          - generic [ref=e130]:
            - button "Биологически активные добавки" [ref=e131] [cursor=pointer]
            - button "Витамины и минералы" [ref=e132] [cursor=pointer]
          - generic [ref=e133]:
            - article [ref=e135] [cursor=pointer]:
              - img "California Eagle - Resetest / 60 caps" [ref=e137]
              - generic [ref=e138]:
                - paragraph [ref=e139]: Биологически активные добавки
                - heading "California Eagle - Resetest / 60 caps" [level=3] [ref=e140]
                - generic [ref=e141]:
                  - generic [ref=e142]: 91.00 TJS
                  - generic [ref=e143]: TJS
                - button "В корзину" [ref=e144]:
                  - img [ref=e145]
                  - text: В корзину
            - article [ref=e149] [cursor=pointer]:
              - img "California Gold Nutrition - Vitamin C / 1000 mg / 60 vcaps" [ref=e151]
              - generic [ref=e152]:
                - paragraph [ref=e153]: Биологически активные добавки
                - heading "California Gold Nutrition - Vitamin C / 1000 mg / 60 vcaps" [level=3] [ref=e154]
                - generic [ref=e155]:
                  - generic [ref=e156]: 15.00 TJS
                  - generic [ref=e157]: TJS
                - button "В корзину" [ref=e158]:
                  - img [ref=e159]
                  - text: В корзину
            - article [ref=e163] [cursor=pointer]:
              - img "California Golg Nutrition - Baby Vitamin D3 / 400 IU / 10 ml" [ref=e165]
              - generic [ref=e166]:
                - paragraph [ref=e167]: Биологически активные добавки
                - heading "California Golg Nutrition - Baby Vitamin D3 / 400 IU / 10 ml" [level=3] [ref=e168]
                - generic [ref=e169]:
                  - generic [ref=e170]: 85.00 TJS
                  - generic [ref=e171]: TJS
                - button "В корзину" [ref=e172]:
                  - img [ref=e173]
                  - text: В корзину
            - article [ref=e177] [cursor=pointer]:
              - img "Debavit - Calcium + K 2 / 90 tabs" [ref=e179]
              - generic [ref=e180]:
                - paragraph [ref=e181]: Биологически активные добавки
                - heading "Debavit - Calcium + K 2 / 90 tabs" [level=3] [ref=e182]
                - generic [ref=e183]:
                  - generic [ref=e184]: 68.00 TJS
                  - generic [ref=e185]: TJS
                - button "В корзину" [ref=e186]:
                  - img [ref=e187]
                  - text: В корзину
            - article [ref=e191] [cursor=pointer]:
              - img "Debavit - Kelp Potassium lodide & Selenium / 90 Caps" [ref=e193]
              - generic [ref=e194]:
                - paragraph [ref=e195]: Биологически активные добавки
                - heading "Debavit - Kelp Potassium lodide & Selenium / 90 Caps" [level=3] [ref=e196]
                - generic [ref=e197]:
                  - generic [ref=e198]: 33.00 TJS
                  - generic [ref=e199]: TJS
                - button "В корзину" [ref=e200]:
                  - img [ref=e201]
                  - text: В корзину
            - article [ref=e205] [cursor=pointer]:
              - img "Debavit - Omega-3 / 1000 mg / 100 softgels" [ref=e207]
              - generic [ref=e208]:
                - paragraph [ref=e209]: Биологически активные добавки
                - heading "Debavit - Omega-3 / 1000 mg / 100 softgels" [level=3] [ref=e210]
                - generic [ref=e211]:
                  - generic [ref=e212]: 10.00 TJS
                  - generic [ref=e213]: TJS
                - button "В корзину" [ref=e214]:
                  - img [ref=e215]
                  - text: В корзину
            - article [ref=e219] [cursor=pointer]:
              - img "Debavit - Vitamin C & Cofactors / 500 mg / 90 tabl" [ref=e221]
              - generic [ref=e222]:
                - paragraph [ref=e223]: Биологически активные добавки
                - heading "Debavit - Vitamin C & Cofactors / 500 mg / 90 tabl" [level=3] [ref=e224]
                - generic [ref=e225]:
                  - generic [ref=e226]: 72.00 TJS
                  - generic [ref=e227]: TJS
                - button "В корзину" [ref=e228]:
                  - img [ref=e229]
                  - text: В корзину
            - article [ref=e233] [cursor=pointer]:
              - img "Life - Collagen + Vitamin C" [ref=e235]
              - generic [ref=e236]:
                - paragraph [ref=e237]: Биологически активные добавки
                - heading "Life - Collagen + Vitamin C" [level=3] [ref=e238]
                - generic [ref=e239]:
                  - generic [ref=e240]: 280.00 TJS
                  - generic [ref=e241]: TJS
                - button "В корзину" [ref=e242]:
                  - img [ref=e243]
                  - text: В корзину
            - article [ref=e247] [cursor=pointer]:
              - img "MST - Комплекс Витамин B300 100 таб" [ref=e249]
              - generic [ref=e253]:
                - paragraph [ref=e254]: Биологически активные добавки
                - heading "MST - Комплекс Витамин B300 100 таб" [level=3] [ref=e255]
                - generic [ref=e256]:
                  - generic [ref=e257]: 14.00 TJS
                  - generic [ref=e258]: TJS
                - button "В корзину" [ref=e259]:
                  - img [ref=e260]
                  - text: В корзину
            - article [ref=e264] [cursor=pointer]:
              - img "MXL - Iron / 25 mg / 90 caps" [ref=e266]
              - generic [ref=e267]:
                - paragraph [ref=e268]: Биологически активные добавки
                - heading "MXL - Iron / 25 mg / 90 caps" [level=3] [ref=e269]
                - generic [ref=e270]:
                  - generic [ref=e271]: 134.00 TJS
                  - generic [ref=e272]: TJS
                - button "В корзину" [ref=e273]:
                  - img [ref=e274]
                  - text: В корзину
            - article [ref=e278] [cursor=pointer]:
              - img "Nature's Plus - Hema-Plex / 60 Chewable" [ref=e280]
              - generic [ref=e281]:
                - paragraph [ref=e282]: Биологически активные добавки
                - heading "Nature's Plus - Hema-Plex / 60 Chewable" [level=3] [ref=e283]
                - generic [ref=e284]:
                  - generic [ref=e285]: 155.00 TJS
                  - generic [ref=e286]: TJS
                - button "В корзину" [ref=e287]:
                  - img [ref=e288]
                  - text: В корзину
            - article [ref=e292] [cursor=pointer]:
              - img "Nature's Plus - Pedi-Active / 60 Chewables" [ref=e294]
              - generic [ref=e295]:
                - paragraph [ref=e296]: Биологически активные добавки
                - heading "Nature's Plus - Pedi-Active / 60 Chewables" [level=3] [ref=e297]
                - generic [ref=e298]:
                  - generic [ref=e299]: 8.00 TJS
                  - generic [ref=e300]: TJS
                - button "В корзину" [ref=e301]:
                  - img [ref=e302]
                  - text: В корзину
            - article [ref=e306] [cursor=pointer]:
              - img "NOW - Acetyl L-Carnitine Powder / 3 oz" [ref=e308]
              - generic [ref=e309]:
                - paragraph [ref=e310]: Биологически активные добавки
                - heading "NOW - Acetyl L-Carnitine Powder / 3 oz" [level=3] [ref=e311]
                - generic [ref=e312]:
                  - generic [ref=e313]: 77.00 TJS
                  - generic [ref=e314]: TJS
                - button "В корзину" [ref=e315]:
                  - img [ref=e316]
                  - text: В корзину
            - article [ref=e320] [cursor=pointer]:
              - img "Now ADAM MALE MULTI, 90 капсула" [ref=e322]
              - generic [ref=e323]:
                - paragraph [ref=e324]: Биологически активные добавки
                - heading "Now ADAM MALE MULTI, 90 капсула" [level=3] [ref=e325]
                - generic [ref=e326]:
                  - generic [ref=e327]: 43.00 TJS
                  - generic [ref=e328]: TJS
                - button "В корзину" [ref=e329]:
                  - img [ref=e330]
                  - text: В корзину
            - article [ref=e334] [cursor=pointer]:
              - img "NOW - Aloe Vera / 10,000 mg / 100 softgels" [ref=e336]
              - generic [ref=e337]:
                - paragraph [ref=e338]: Биологически активные добавки
                - heading "NOW - Aloe Vera / 10,000 mg / 100 softgels" [level=3] [ref=e339]
                - generic [ref=e340]:
                  - generic [ref=e341]: 71.00 TJS
                  - generic [ref=e342]: TJS
                - button "В корзину" [ref=e343]:
                  - img [ref=e344]
                  - text: В корзину
            - article [ref=e348] [cursor=pointer]:
              - img "NOW American Ginseng, 500мг, 100шт." [ref=e350]
              - generic [ref=e354]:
                - paragraph [ref=e355]: Биологически активные добавки
                - heading "NOW American Ginseng, 500мг, 100шт." [level=3] [ref=e356]
                - generic [ref=e357]:
                  - generic [ref=e358]: 9.00 TJS
                  - generic [ref=e359]: TJS
                - button "В корзину" [ref=e360]:
                  - img [ref=e361]
                  - text: В корзину
            - article [ref=e365] [cursor=pointer]:
              - img "NOW - Arginine & Ornithine / 100 vcaps" [ref=e367]
              - generic [ref=e368]:
                - paragraph [ref=e369]: Биологически активные добавки
                - heading "NOW - Arginine & Ornithine / 100 vcaps" [level=3] [ref=e370]
                - generic [ref=e371]:
                  - generic [ref=e372]: 56.00 TJS
                  - generic [ref=e373]: TJS
                - button "В корзину" [ref=e374]:
                  - img [ref=e375]
                  - text: В корзину
            - article [ref=e379] [cursor=pointer]:
              - img "NOW - Boron / 3 mg / 100 vcaps" [ref=e381]
              - generic [ref=e382]:
                - paragraph [ref=e383]: Биологически активные добавки
                - heading "NOW - Boron / 3 mg / 100 vcaps" [level=3] [ref=e384]
                - generic [ref=e385]:
                  - generic [ref=e386]: 54.00 TJS
                  - generic [ref=e387]: TJS
                - button "В корзину" [ref=e388]:
                  - img [ref=e389]
                  - text: В корзину
            - article [ref=e393] [cursor=pointer]:
              - img "NOW - Brain Elevate / 60 vcaps" [ref=e395]
              - generic [ref=e396]:
                - paragraph [ref=e397]: Биологически активные добавки
                - heading "NOW - Brain Elevate / 60 vcaps" [level=3] [ref=e398]
                - generic [ref=e399]:
                  - generic [ref=e400]: 60.00 TJS
                  - generic [ref=e401]: TJS
                - button "В корзину" [ref=e402]:
                  - img [ref=e403]
                  - text: В корзину
            - article [ref=e407] [cursor=pointer]:
              - img "NOW - Calcium Hydroxyapatite Caps / 120 vcaps" [ref=e409]
              - generic [ref=e410]:
                - paragraph [ref=e411]: Биологически активные добавки
                - heading "NOW - Calcium Hydroxyapatite Caps / 120 vcaps" [level=3] [ref=e412]
                - generic [ref=e413]:
                  - generic [ref=e414]: 62.00 TJS
                  - generic [ref=e415]: TJS
                - button "В корзину" [ref=e416]:
                  - img [ref=e417]
                  - text: В корзину
            - article [ref=e421] [cursor=pointer]:
              - img "NOW - Calcium & Magnesium / 500мг & 250мг / 100тб" [ref=e423]
              - generic [ref=e427]:
                - paragraph [ref=e428]: Биологически активные добавки
                - heading "NOW - Calcium & Magnesium / 500мг & 250мг / 100тб" [level=3] [ref=e429]
                - generic [ref=e430]:
                  - generic [ref=e431]: 62.00 TJS
                  - generic [ref=e432]: TJS
                - button "В корзину" [ref=e433]:
                  - img [ref=e434]
                  - text: В корзину
            - article [ref=e438] [cursor=pointer]:
              - img "NOW - Calcium & Magnesium + D3 / 120 vcaps" [ref=e440]
              - generic [ref=e441]:
                - paragraph [ref=e442]: Биологически активные добавки
                - heading "NOW - Calcium & Magnesium + D3 / 120 vcaps" [level=3] [ref=e443]
                - generic [ref=e444]:
                  - generic [ref=e445]: 56.00 TJS
                  - generic [ref=e446]: TJS
                - button "В корзину" [ref=e447]:
                  - img [ref=e448]
                  - text: В корзину
            - article [ref=e452] [cursor=pointer]:
              - img "NOW - Calcium & Magnesium & D3 and Zinc / 120капс" [ref=e454]
              - generic [ref=e459]:
                - paragraph [ref=e460]: Биологически активные добавки
                - heading "NOW - Calcium & Magnesium & D3 and Zinc / 120капс" [level=3] [ref=e461]
                - generic [ref=e462]:
                  - generic [ref=e463]: 102.00 TJS
                  - generic [ref=e464]: TJS
                - button "В корзину" [ref=e465]:
                  - img [ref=e466]
                  - text: В корзину
            - article [ref=e470] [cursor=pointer]:
              - img "NOW - Chlorella / 1000 mg / 60 tabs" [ref=e472]
              - generic [ref=e473]:
                - paragraph [ref=e474]: Биологически активные добавки
                - heading "NOW - Chlorella / 1000 mg / 60 tabs" [level=3] [ref=e475]
                - generic [ref=e476]:
                  - generic [ref=e477]: 29.00 TJS
                  - generic [ref=e478]: TJS
                - button "В корзину" [ref=e479]:
                  - img [ref=e480]
                  - text: В корзину
          - generic [ref=e483]:
            - button "Назад" [disabled] [ref=e484]
            - generic [ref=e485]: 1 / 9
            - button "Вперёд" [ref=e486] [cursor=pointer]
    - contentinfo [ref=e487]:
      - generic [ref=e488]:
        - generic [ref=e489]:
          - generic [ref=e490]:
            - generic [ref=e491]:
              - generic [ref=e492]: "Y"
              - generic [ref=e493]: Yalla Farm
            - paragraph [ref=e494]: Онлайн-аптека Душанбе. Тысячи лекарств из 120+ аптек с доставкой за 30–45 минут.
            - generic [ref=e495]:
              - link "Позвонить" [ref=e496] [cursor=pointer]:
                - /url: tel:+992000000000
                - img [ref=e497]
              - link "Telegram" [ref=e499] [cursor=pointer]:
                - /url: https://t.me/yallafarm
                - img [ref=e500]
              - generic [ref=e502]:
                - img [ref=e503]
                - text: 30-45 мин
          - generic [ref=e505]:
            - heading "Каталог" [level=4] [ref=e506]
            - list [ref=e507]:
              - listitem [ref=e508]:
                - link "Все товары" [ref=e509] [cursor=pointer]:
                  - /url: /
              - listitem [ref=e510]:
                - link "Карта аптек" [ref=e511] [cursor=pointer]:
                  - /url: /pharmacies/map
              - listitem [ref=e512]:
                - link "Поиск" [ref=e513] [cursor=pointer]:
                  - /url: /?search=
          - generic [ref=e514]:
            - heading "Аккаунт" [level=4] [ref=e515]
            - list [ref=e516]:
              - listitem [ref=e517]:
                - link "Мои заказы" [ref=e518] [cursor=pointer]:
                  - /url: /orders
              - listitem [ref=e519]:
                - link "Профиль" [ref=e520] [cursor=pointer]:
                  - /url: /profile
              - listitem [ref=e521]:
                - link "Вход" [ref=e522] [cursor=pointer]:
                  - /url: /login
          - generic [ref=e523]:
            - heading "Контакты" [level=4] [ref=e524]
            - list [ref=e525]:
              - listitem [ref=e526]: Душанбе, Таджикистан
              - listitem [ref=e527]:
                - link "support@yalla-farm.tj" [ref=e528] [cursor=pointer]:
                  - /url: mailto:support@yalla-farm.tj
              - listitem [ref=e529]:
                - link "+992 (000) 00-00-00" [ref=e530] [cursor=pointer]:
                  - /url: tel:+992000000000
        - generic [ref=e531]:
          - generic [ref=e532]: © 2026 Yalla Farm
          - generic [ref=e533]: Берегите здоровье — консультируйтесь с врачом перед приёмом лекарств
  - alert [ref=e534]
```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test";
  2   | import { dismissAddressModal } from "./fixtures/helpers";
  3   | import { resetSession } from "./fixtures/auth";
  4   | 
  5   | test.beforeEach(async ({ page }) => {
  6   |   await resetSession(page);
  7   |   await page.goto("/");
  8   |   await dismissAddressModal(page);
  9   | });
  10  | 
  11  | test.describe("Search — opening from TopBar", () => {
  12  |   test("clicking the top-bar search pill navigates to ?search=", async ({ page }) => {
  13  |     await page.getByRole("button", { name: /Найти лекарства/ }).or(
  14  |       page.getByRole("link", { name: /Найти лекарства/ }),
  15  |     ).first().click();
  16  |     await expect(page).toHaveURL(/\/\?search=/);
  17  |   });
  18  | 
  19  |   test("in search view, the top-bar search pill is hidden", async ({ page }) => {
  20  |     await page.goto("/?search=");
  21  |     // The page-level search input is visible…
  22  |     await expect(page.getByPlaceholder(/Название лекарства/i)).toBeVisible();
  23  |     // …but the top-bar one with `Найти лекарства` placeholder should be gone.
  24  |     const topBarSearch = page.getByText("Найти лекарства, витамины, тесты");
  25  |     expect(await topBarSearch.count()).toBe(0);
  26  |   });
  27  | 
  28  |   test("popular queries shown when query is empty", async ({ page }) => {
  29  |     await page.goto("/?search=");
  30  |     await expect(page.getByText("Популярные запросы")).toBeVisible();
  31  |     const popular = ["Парацетамол", "Ибупрофен", "Амоксициллин"];
  32  |     for (const q of popular) {
  33  |       await expect(page.getByRole("button", { name: q })).toBeVisible();
  34  |     }
  35  |   });
  36  | 
  37  |   test("clicking a popular query fills the input and updates URL", async ({ page }) => {
  38  |     await page.goto("/?search=");
  39  |     await page.getByRole("button", { name: "Парацетамол" }).click();
  40  |     await expect(page.getByPlaceholder(/Название лекарства/i)).toHaveValue("Парацетамол");
  41  |   });
  42  | });
  43  | 
  44  | test.describe("Search — back navigation", () => {
  45  |   test("back button in search view returns to home", async ({ page }) => {
  46  |     await page.goto("/?search=");
  47  |     const backBtn = page.getByRole("button", { name: "Назад" }).first();
  48  |     await backBtn.click();
  49  |     // URL should no longer have search param.
  50  |     await expect(page).not.toHaveURL(/\?search=/);
  51  |   });
  52  | 
  53  |   test("browser back from search restores home view (no stale chips)", async ({ page }) => {
  54  |     await page.goto("/");
  55  |     await dismissAddressModal(page);
  56  |     await page.getByRole("button", { name: /Найти лекарства/ }).or(
  57  |       page.getByRole("link", { name: /Найти лекарства/ }),
  58  |     ).first().click();
  59  |     await expect(page).toHaveURL(/\?search=/);
  60  |     await page.goBack();
  61  |     await expect(page).not.toHaveURL(/\?search=/);
  62  |     // The home categories should be back.
  63  |     await expect(page.getByRole("heading", { name: "Популярные товары" })).toBeVisible();
  64  |   });
  65  | });
  66  | 
  67  | test.describe("Search — suggestions", () => {
  68  |   test("typing shows debounced suggestions or results area", async ({ page }) => {
  69  |     await page.goto("/?search=");
  70  |     const input = page.getByPlaceholder(/Название лекарства/i);
  71  |     await input.fill("пар");
  72  |     // We expect either a suggestions dropdown or a search-loading indicator.
  73  |     // Results may take time; give it 5s then assert URL updated to include query.
  74  |     await page.waitForTimeout(800);
  75  |     await expect(page).toHaveURL(/\?search=%D0%BF%D0%B0%D1%80|\?search=пар/);
  76  |   });
  77  | });
  78  | 
  79  | test.describe("Catalog view (after category selection)", () => {
  80  |   test("sidebar categories are visible on desktop", async ({ page, viewport }) => {
  81  |     test.skip(!viewport || viewport.width < 640, "Sidebar only on ≥ sm");
  82  |     await page.getByRole("button", { name: /^Витамины$/ }).first().click();
> 83  |     await expect(page.getByRole("heading", { name: "Каталог" })).toBeVisible();
      |                                                                  ^ Error: expect(locator).toBeVisible() failed
  84  |     await expect(page.getByRole("button", { name: "Все товары" })).toBeVisible();
  85  |   });
  86  | 
  87  |   test("pagination appears when >1 page and next/prev work", async ({ page }) => {
  88  |     await page.getByRole("button", { name: /^Все категории$/ }).first().click();
  89  |     // Wait for either data or no-results state.
  90  |     await page.waitForLoadState("networkidle").catch(() => undefined);
  91  |     const nextBtn = page.getByRole("button", { name: "Вперёд" });
  92  |     if (await nextBtn.isVisible().catch(() => false)) {
  93  |       await nextBtn.click();
  94  |       await page.waitForLoadState("networkidle").catch(() => undefined);
  95  |       await expect(page.getByRole("button", { name: "Назад" })).toBeEnabled();
  96  |     } else {
  97  |       test.skip(true, "Single page of results — pagination not applicable");
  98  |     }
  99  |   });
  100 | 
  101 |   test("back arrow exits catalog view to home", async ({ page }) => {
  102 |     await page.getByRole("button", { name: /^Сердце$/ }).first().click();
  103 |     await page.getByRole("button", { name: "Назад" }).first().click();
  104 |     await expect(page.getByRole("heading", { name: "Популярные товары" })).toBeVisible();
  105 |   });
  106 | });
  107 | 
```