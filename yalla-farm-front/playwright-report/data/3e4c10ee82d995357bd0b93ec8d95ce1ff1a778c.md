# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 02-search.spec.ts >> Catalog view (after category selection) >> back arrow exits catalog view to home
- Location: e2e/02-search.spec.ts:101:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Назад' }).first()
    - locator resolved to <button disabled type="button" class="stitch-button-secondary px-4 py-2 text-sm">Назад</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is not enabled
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is not enabled
    - retrying click action
      - waiting 100ms
    51 × waiting for element to be visible, enabled and stable
       - element is not enabled
     - retrying click action
       - waiting 500ms

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
              - button "Витамины и БАД" [ref=e55] [cursor=pointer]:
                - generic [ref=e56]: Витамины и БАД
                - img [ref=e57]
              - button "Гигиена" [ref=e60] [cursor=pointer]:
                - generic [ref=e61]: Гигиена
                - img [ref=e62]
              - button "Детское питание" [ref=e65] [cursor=pointer]:
                - generic [ref=e66]: Детское питание
              - button "Для Него" [ref=e68] [cursor=pointer]:
                - generic [ref=e69]: Для Него
              - button "Для Неё" [ref=e71] [cursor=pointer]:
                - generic [ref=e72]: Для Неё
              - button "Другое" [ref=e74] [cursor=pointer]:
                - generic [ref=e75]: Другое
              - button "Красота" [ref=e77] [cursor=pointer]:
                - generic [ref=e78]: Красота
                - img [ref=e79]
              - generic [ref=e81]:
                - button "Лекарственные средства" [ref=e82] [cursor=pointer]:
                  - generic [ref=e83]: Лекарственные средства
                  - img [ref=e84]
                - generic [ref=e86]:
                  - button "Акушерство и гинекология" [ref=e87] [cursor=pointer]
                  - button "Аллергия" [ref=e88] [cursor=pointer]
                  - button "Анестезия и реанимация" [ref=e89] [cursor=pointer]
                  - button "Антибиотики" [ref=e90] [cursor=pointer]
                  - button "Болезни крови" [ref=e91] [cursor=pointer]
                  - button "Болезни суставов" [ref=e92] [cursor=pointer]
                  - button "Боль и температура" [ref=e93] [cursor=pointer]
                  - button "Геморрой" [ref=e94] [cursor=pointer]
                  - button "Глаза" [ref=e95] [cursor=pointer]
                  - button "Глисты, вши и чесотка" [ref=e96] [cursor=pointer]
                  - button "Диабет" [ref=e97] [cursor=pointer]
                  - button "Дыхательная система" [ref=e98] [cursor=pointer]
                  - button "Желудок, кишечник и печень" [ref=e99] [cursor=pointer]
                  - button "Зубы и рот" [ref=e100] [cursor=pointer]
                  - button "Иммунная система" [ref=e101] [cursor=pointer]
                  - button "Кожа" [ref=e102] [cursor=pointer]
                  - button "Миорелаксант" [ref=e103] [cursor=pointer]
                  - button "Мочеполовая система" [ref=e104] [cursor=pointer]
                  - button "Нарушения обмена веществ" [ref=e105] [cursor=pointer]
                  - button "Неврология и психиатрия" [ref=e106] [cursor=pointer]
                  - button "Обеззараживающие средства" [ref=e107] [cursor=pointer]
                  - button "Онкология" [ref=e108] [cursor=pointer]
                  - button "Отравления" [ref=e109] [cursor=pointer]
                  - button "Противовирусные средства" [ref=e110] [cursor=pointer]
                  - button "Противовоспалительные средства" [ref=e111] [cursor=pointer]
                  - button "Противогрибковые средства" [ref=e112] [cursor=pointer]
                  - button "Разные средства" [ref=e113] [cursor=pointer]
                  - button "Сердечно-сосудистые" [ref=e114] [cursor=pointer]
                  - button "Трихомоноз и малярия" [ref=e115] [cursor=pointer]
                  - button "Ухо, горло и нос" [ref=e116] [cursor=pointer]
                  - button "Эндокринология" [ref=e117] [cursor=pointer]
              - button "Лечебные травы" [ref=e119] [cursor=pointer]:
                - generic [ref=e120]: Лечебные травы
                - img [ref=e121]
              - button "Мама и малыш" [ref=e124] [cursor=pointer]:
                - generic [ref=e125]: Мама и малыш
              - button "Медицинские изделия" [ref=e127] [cursor=pointer]:
                - generic [ref=e128]: Медицинские изделия
                - img [ref=e129]
              - button "Медицинские приборы" [ref=e132] [cursor=pointer]:
                - generic [ref=e133]: Медицинские приборы
                - img [ref=e134]
              - button "Оптика" [ref=e137] [cursor=pointer]:
                - generic [ref=e138]: Оптика
              - button "Ортопедия" [ref=e140] [cursor=pointer]:
                - generic [ref=e141]: Ортопедия
              - button "парфюмерия" [ref=e143] [cursor=pointer]:
                - generic [ref=e144]: парфюмерия
              - button "Парфюмерия" [ref=e146] [cursor=pointer]:
                - generic [ref=e147]: Парфюмерия
              - button "Первая помощь" [ref=e149] [cursor=pointer]:
                - generic [ref=e150]: Первая помощь
                - img [ref=e151]
        - generic [ref=e153]:
          - generic [ref=e154]:
            - button [ref=e155] [cursor=pointer]:
              - img [ref=e156]
            - heading "Сердечно-сосудистые" [level=1] [ref=e158]
          - generic [ref=e159]:
            - article [ref=e161] [cursor=pointer]:
              - img "Авторекс А тб №30" [ref=e163]
              - generic [ref=e167]:
                - paragraph [ref=e168]: Сердечно-сосудистые
                - heading "Авторекс А тб №30" [level=3] [ref=e169]
                - generic [ref=e170]:
                  - generic [ref=e171]: 57.00 TJS
                  - generic [ref=e172]: TJS
                - button "В корзину" [ref=e173]:
                  - img [ref=e174]
                  - text: В корзину
            - article [ref=e178] [cursor=pointer]:
              - img "Актовегин амп 2мл №1 (кор.№25)" [ref=e180]
              - generic [ref=e181]:
                - paragraph [ref=e182]: Сердечно-сосудистые
                - heading "Актовегин амп 2мл №1 (кор.№25)" [level=3] [ref=e183]
                - generic [ref=e184]:
                  - generic [ref=e185]: 11.00 TJS
                  - generic [ref=e186]: TJS
                - button "В корзину" [ref=e187]:
                  - img [ref=e188]
                  - text: В корзину
            - article [ref=e192] [cursor=pointer]:
              - img "Актовегин амп 40мг/мл 10мл №5" [ref=e194]
              - generic [ref=e195]:
                - paragraph [ref=e196]: Сердечно-сосудистые
                - heading "Актовегин амп 40мг/мл 10мл №5" [level=3] [ref=e197]
                - generic [ref=e198]:
                  - generic [ref=e199]: 135.00 TJS
                  - generic [ref=e200]: TJS
                - button "В корзину" [ref=e201]:
                  - img [ref=e202]
                  - text: В корзину
            - article [ref=e206] [cursor=pointer]:
              - img "Актовегин амп 40мг/мл 5мл №5" [ref=e208]
              - generic [ref=e212]:
                - paragraph [ref=e213]: Сердечно-сосудистые
                - heading "Актовегин амп 40мг/мл 5мл №5" [level=3] [ref=e214]
                - generic [ref=e215]:
                  - generic [ref=e216]: 42.00 TJS
                  - generic [ref=e217]: TJS
                - button "В корзину" [ref=e218]:
                  - img [ref=e219]
                  - text: В корзину
            - article [ref=e223] [cursor=pointer]:
              - img "Амлесса тб 4мг/5мг №30" [ref=e225]
              - generic [ref=e229]:
                - paragraph [ref=e230]: Сердечно-сосудистые
                - heading "Амлесса тб 4мг/5мг №30" [level=3] [ref=e231]
                - generic [ref=e232]:
                  - generic [ref=e233]: 69.00 TJS
                  - generic [ref=e234]: TJS
                - button "В корзину" [ref=e235]:
                  - img [ref=e236]
                  - text: В корзину
            - article [ref=e240] [cursor=pointer]:
              - img "Амлесса тб 8мг/10мг №30" [ref=e242]
              - generic [ref=e246]:
                - paragraph [ref=e247]: Сердечно-сосудистые
                - heading "Амлесса тб 8мг/10мг №30" [level=3] [ref=e248]
                - generic [ref=e249]:
                  - generic [ref=e250]: 118.80 TJS
                  - generic [ref=e251]: TJS
                - button "В корзину" [ref=e252]:
                  - img [ref=e253]
                  - text: В корзину
            - article [ref=e257] [cursor=pointer]:
              - img "Амлипин тб 5мг/5мг №30" [ref=e259]
              - generic [ref=e263]:
                - paragraph [ref=e264]: Сердечно-сосудистые
                - heading "Амлипин тб 5мг/5мг №30" [level=3] [ref=e265]
                - generic [ref=e266]:
                  - generic [ref=e267]: 89.00 TJS
                  - generic [ref=e268]: TJS
                - button "В корзину" [ref=e269]:
                  - img [ref=e270]
                  - text: В корзину
            - article [ref=e274] [cursor=pointer]:
              - img "Амлодипин тб 10мг №30" [ref=e276]
              - generic [ref=e280]:
                - paragraph [ref=e281]: Сердечно-сосудистые
                - heading "Амлодипин тб 10мг №30" [level=3] [ref=e282]
                - generic [ref=e283]:
                  - generic [ref=e284]: 4.00 TJS
                  - generic [ref=e285]: TJS
                - button "В корзину" [ref=e286]:
                  - img [ref=e287]
                  - text: В корзину
            - article [ref=e291] [cursor=pointer]:
              - img "Амлодипин тб 5мг №30" [ref=e293]
              - generic [ref=e297]:
                - paragraph [ref=e298]: Сердечно-сосудистые
                - heading "Амлодипин тб 5мг №30" [level=3] [ref=e299]
                - generic [ref=e300]:
                  - generic [ref=e301]: 4.00 TJS
                  - generic [ref=e302]: TJS
                - button "В корзину" [ref=e303]:
                  - img [ref=e304]
                  - text: В корзину
            - article [ref=e308] [cursor=pointer]:
              - img "Амод-5 тб №30" [ref=e310]
              - generic [ref=e314]:
                - paragraph [ref=e315]: Сердечно-сосудистые
                - heading "Амод-5 тб №30" [level=3] [ref=e316]
                - generic [ref=e317]:
                  - generic [ref=e318]: 48.00 TJS
                  - generic [ref=e319]: TJS
                - button "В корзину" [ref=e320]:
                  - img [ref=e321]
                  - text: В корзину
            - article [ref=e325] [cursor=pointer]:
              - img "Амприлан тб 10мг №30" [ref=e327]
              - generic [ref=e331]:
                - paragraph [ref=e332]: Сердечно-сосудистые
                - heading "Амприлан тб 10мг №30" [level=3] [ref=e333]
                - generic [ref=e334]:
                  - generic [ref=e335]: 67.00 TJS
                  - generic [ref=e336]: TJS
                - button "В корзину" [ref=e337]:
                  - img [ref=e338]
                  - text: В корзину
            - article [ref=e342] [cursor=pointer]:
              - img "Анаприлин тб 10мг №50" [ref=e344]
              - generic [ref=e348]:
                - paragraph [ref=e349]: Сердечно-сосудистые
                - heading "Анаприлин тб 10мг №50" [level=3] [ref=e350]
                - generic [ref=e351]:
                  - generic [ref=e352]: 6.00 TJS
                  - generic [ref=e353]: TJS
                - button "В корзину" [ref=e354]:
                  - img [ref=e355]
                  - text: В корзину
            - article [ref=e359] [cursor=pointer]:
              - img "Анаприлин тб 40мг №50" [ref=e361]
              - generic [ref=e365]:
                - paragraph [ref=e366]: Сердечно-сосудистые
                - heading "Анаприлин тб 40мг №50" [level=3] [ref=e367]
                - generic [ref=e368]:
                  - generic [ref=e369]: 8.00 TJS
                  - generic [ref=e370]: TJS
                - button "В корзину" [ref=e371]:
                  - img [ref=e372]
                  - text: В корзину
            - article [ref=e376] [cursor=pointer]:
              - img "Андипал тб №10" [ref=e378]
              - generic [ref=e382]:
                - paragraph [ref=e383]: Сердечно-сосудистые
                - heading "Андипал тб №10" [level=3] [ref=e384]
                - generic [ref=e385]:
                  - generic [ref=e386]: 4.00 TJS
                  - generic [ref=e387]: TJS
                - button "В корзину" [ref=e388]:
                  - img [ref=e389]
                  - text: В корзину
            - article [ref=e393] [cursor=pointer]:
              - img "Арваз-20 тб №14" [ref=e395]
              - generic [ref=e399]:
                - paragraph [ref=e400]: Сердечно-сосудистые
                - heading "Арваз-20 тб №14" [level=3] [ref=e401]
                - generic [ref=e402]:
                  - generic [ref=e403]: 44.00 TJS
                  - generic [ref=e404]: TJS
                - button "В корзину" [ref=e405]:
                  - img [ref=e406]
                  - text: В корзину
            - article [ref=e410] [cursor=pointer]:
              - img "Аргинин-Ликво 21,07% 20мл р-р фл" [ref=e412]
              - generic [ref=e416]:
                - paragraph [ref=e417]: Сердечно-сосудистые
                - heading "Аргинин-Ликво 21,07% 20мл р-р фл" [level=3] [ref=e418]
                - generic [ref=e419]:
                  - generic [ref=e420]: 54.00 TJS
                  - generic [ref=e421]: TJS
                - button "В корзину" [ref=e422]:
                  - img [ref=e423]
                  - text: В корзину
            - article [ref=e427] [cursor=pointer]:
              - img "Арифон тб 2,5мг №30" [ref=e429]
              - generic [ref=e433]:
                - paragraph [ref=e434]: Сердечно-сосудистые
                - heading "Арифон тб 2,5мг №30" [level=3] [ref=e435]
                - generic [ref=e436]:
                  - generic [ref=e437]: 33.00 TJS
                  - generic [ref=e438]: TJS
                - button "В корзину" [ref=e439]:
                  - img [ref=e440]
                  - text: В корзину
            - article [ref=e444] [cursor=pointer]:
              - img "Аспаркам тб №50" [ref=e446]
              - generic [ref=e450]:
                - paragraph [ref=e451]: Сердечно-сосудистые
                - heading "Аспаркам тб №50" [level=3] [ref=e452]
                - generic [ref=e453]:
                  - generic [ref=e454]: 7.00 TJS
                  - generic [ref=e455]: TJS
                - button "В корзину" [ref=e456]:
                  - img [ref=e457]
                  - text: В корзину
            - article [ref=e461] [cursor=pointer]:
              - img "Атенолол тб 100мг №30" [ref=e463]
              - generic [ref=e467]:
                - paragraph [ref=e468]: Сердечно-сосудистые
                - heading "Атенолол тб 100мг №30" [level=3] [ref=e469]
                - generic [ref=e470]:
                  - generic [ref=e471]: 5.00 TJS
                  - generic [ref=e472]: TJS
                - button "В корзину" [ref=e473]:
                  - img [ref=e474]
                  - text: В корзину
            - article [ref=e478] [cursor=pointer]:
              - img "АТФ амп 1% 1мл №10" [ref=e480]
              - generic [ref=e484]:
                - paragraph [ref=e485]: Сердечно-сосудистые
                - heading "АТФ амп 1% 1мл №10" [level=3] [ref=e486]
                - generic [ref=e487]:
                  - generic [ref=e488]: 19.00 TJS
                  - generic [ref=e489]: TJS
                - button "В корзину" [ref=e490]:
                  - img [ref=e491]
                  - text: В корзину
            - article [ref=e495] [cursor=pointer]:
              - img "Беландж тб 5мг №30" [ref=e497]
              - generic [ref=e501]:
                - paragraph [ref=e502]: Сердечно-сосудистые
                - heading "Беландж тб 5мг №30" [level=3] [ref=e503]
                - generic [ref=e504]:
                  - generic [ref=e505]: 50.00 TJS
                  - generic [ref=e506]: TJS
                - button "В корзину" [ref=e507]:
                  - img [ref=e508]
                  - text: В корзину
            - article [ref=e512] [cursor=pointer]:
              - img "Бисовега тб 2,5мг №30" [ref=e514]
              - generic [ref=e518]:
                - paragraph [ref=e519]: Сердечно-сосудистые
                - heading "Бисовега тб 2,5мг №30" [level=3] [ref=e520]
                - generic [ref=e521]:
                  - generic [ref=e522]: 38.00 TJS
                  - generic [ref=e523]: TJS
                - button "В корзину" [ref=e524]:
                  - img [ref=e525]
                  - text: В корзину
            - article [ref=e529] [cursor=pointer]:
              - img "Бисовега тб 5мг №30" [ref=e531]
              - generic [ref=e535]:
                - paragraph [ref=e536]: Сердечно-сосудистые
                - heading "Бисовега тб 5мг №30" [level=3] [ref=e537]
                - generic [ref=e538]:
                  - generic [ref=e539]: 50.00 TJS
                  - generic [ref=e540]: TJS
                - button "В корзину" [ref=e541]:
                  - img [ref=e542]
                  - text: В корзину
            - article [ref=e546] [cursor=pointer]:
              - img "Бисопролол Лек тб 10мг №30" [ref=e548]
              - generic [ref=e552]:
                - paragraph [ref=e553]: Сердечно-сосудистые
                - heading "Бисопролол Лек тб 10мг №30" [level=3] [ref=e554]
                - generic [ref=e555]:
                  - generic [ref=e556]: 52.00 TJS
                  - generic [ref=e557]: TJS
                - button "В корзину" [ref=e558]:
                  - img [ref=e559]
                  - text: В корзину
          - generic [ref=e562]:
            - button "Назад" [disabled] [ref=e563]
            - generic [ref=e564]: 1 / 5
            - button "Вперёд" [ref=e565] [cursor=pointer]
    - contentinfo [ref=e566]:
      - generic [ref=e567]:
        - generic [ref=e568]:
          - generic [ref=e569]:
            - generic [ref=e570]:
              - generic [ref=e571]: "Y"
              - generic [ref=e572]: Yalla Farm
            - paragraph [ref=e573]: Онлайн-аптека Душанбе. Тысячи лекарств из 120+ аптек с доставкой за 30–45 минут.
            - generic [ref=e574]:
              - link "Позвонить" [ref=e575] [cursor=pointer]:
                - /url: tel:+992000000000
                - img [ref=e576]
              - link "Telegram" [ref=e578] [cursor=pointer]:
                - /url: https://t.me/yallafarm
                - img [ref=e579]
              - generic [ref=e581]:
                - img [ref=e582]
                - text: 30-45 мин
          - generic [ref=e584]:
            - heading "Каталог" [level=4] [ref=e585]
            - list [ref=e586]:
              - listitem [ref=e587]:
                - link "Все товары" [ref=e588] [cursor=pointer]:
                  - /url: /
              - listitem [ref=e589]:
                - link "Карта аптек" [ref=e590] [cursor=pointer]:
                  - /url: /pharmacies/map
              - listitem [ref=e591]:
                - link "Поиск" [ref=e592] [cursor=pointer]:
                  - /url: /?search=
          - generic [ref=e593]:
            - heading "Аккаунт" [level=4] [ref=e594]
            - list [ref=e595]:
              - listitem [ref=e596]:
                - link "Мои заказы" [ref=e597] [cursor=pointer]:
                  - /url: /orders
              - listitem [ref=e598]:
                - link "Профиль" [ref=e599] [cursor=pointer]:
                  - /url: /profile
              - listitem [ref=e600]:
                - link "Вход" [ref=e601] [cursor=pointer]:
                  - /url: /login
          - generic [ref=e602]:
            - heading "Контакты" [level=4] [ref=e603]
            - list [ref=e604]:
              - listitem [ref=e605]: Душанбе, Таджикистан
              - listitem [ref=e606]:
                - link "support@yalla-farm.tj" [ref=e607] [cursor=pointer]:
                  - /url: mailto:support@yalla-farm.tj
              - listitem [ref=e608]:
                - link "+992 (000) 00-00-00" [ref=e609] [cursor=pointer]:
                  - /url: tel:+992000000000
        - generic [ref=e610]:
          - generic [ref=e611]: © 2026 Yalla Farm
          - generic [ref=e612]: Берегите здоровье — консультируйтесь с врачом перед приёмом лекарств
  - alert [ref=e613]
```

# Test source

```ts
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
  83  |     await expect(page.getByRole("heading", { name: "Каталог" })).toBeVisible();
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
> 103 |     await page.getByRole("button", { name: "Назад" }).first().click();
      |                                                               ^ Error: locator.click: Test timeout of 30000ms exceeded.
  104 |     await expect(page.getByRole("heading", { name: "Популярные товары" })).toBeVisible();
  105 |   });
  106 | });
  107 | 
```