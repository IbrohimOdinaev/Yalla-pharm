# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 05-auth.spec.ts >> Admin login — UI structure >> password eye-toggle hides/shows password
- Location: e2e/05-auth.spec.ts:66:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('input[type="password"], input[type="text"]').nth(1)

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
    - banner [ref=e42]:
      - generic [ref=e44]:
        - button "Назад" [ref=e45] [cursor=pointer]:
          - img [ref=e46]
        - heading "Вход для персонала" [level=1] [ref=e48]
    - main [ref=e50]:
      - generic [ref=e51]:
        - generic [ref=e52]:
          - img [ref=e54]
          - heading "Кабинет персонала" [level=1] [ref=e57]
          - paragraph [ref=e58]:
            - text: Клиенты входят через
            - link "SMS-код" [ref=e59] [cursor=pointer]:
              - /url: /login
            - text: . Для доступа к кабинету используйте пароль.
        - generic [ref=e60]:
          - generic [ref=e61]:
            - button "Администратор" [ref=e62] [cursor=pointer]
            - button "Суперадмин" [ref=e63] [cursor=pointer]
          - generic [ref=e64]:
            - generic [ref=e65]: Номер телефона
            - generic [ref=e66]:
              - generic [ref=e67]: 🇹🇯
              - generic [ref=e68]: "+992"
              - textbox "Номер телефона 🇹🇯 +992" [ref=e69]:
                - /placeholder: 93 •••• •• ••
          - generic [ref=e70]:
            - generic [ref=e71]: Пароль
            - generic [ref=e72]:
              - textbox "Пароль Показать пароль" [ref=e73]:
                - /placeholder: ••••••••
              - button "Показать пароль" [ref=e74] [cursor=pointer]:
                - img [ref=e75]
          - button "Войти как администратор" [ref=e78] [cursor=pointer]:
            - text: Войти как администратор
            - img [ref=e79]
  - alert [ref=e81]
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | import { resetSession } from "./fixtures/auth";
  3  | 
  4  | test.beforeEach(async ({ page }) => {
  5  |   await resetSession(page);
  6  | });
  7  | 
  8  | test.describe("Client login — UI structure", () => {
  9  |   test.beforeEach(async ({ page }) => {
  10 |     await page.goto("/login");
  11 |   });
  12 | 
  13 |   test("shows welcome hero, phone input, primary + Telegram buttons", async ({ page }) => {
  14 |     await expect(page.getByRole("heading", { name: "Добро пожаловать" })).toBeVisible();
  15 |     await expect(page.getByPlaceholder(/\+\+\+\+|93\s*/)).toBeVisible();
  16 |     await expect(page.getByRole("button", { name: /Получить код/ })).toBeVisible();
  17 |     await expect(page.getByRole("button", { name: /Войти через Telegram/i })).toBeVisible();
  18 |   });
  19 | 
  20 |   test("+992 prefix is hardcoded; input accepts only digits", async ({ page }) => {
  21 |     const input = page.getByPlaceholder(/93\s*/);
  22 |     await input.fill("abc123def456");
  23 |     // Only digits should remain, max 9 chars.
  24 |     const val = await input.inputValue();
  25 |     expect(val).toMatch(/^\d{0,9}$/);
  26 |   });
  27 | 
  28 |   test("submitting with short phone shows validation error", async ({ page }) => {
  29 |     await page.getByPlaceholder(/93\s*/).fill("123");
  30 |     await page.getByRole("button", { name: /Получить код/ }).click();
  31 |     await expect(page.getByText(/9 цифр/i)).toBeVisible({ timeout: 5_000 });
  32 |   });
  33 | 
  34 |   test("bonus/benefit chips are visible", async ({ page }) => {
  35 |     await expect(page.getByText(/Быстрая регистрация/i)).toBeVisible();
  36 |     await expect(page.getByText(/Безопасно/i)).toBeVisible();
  37 |     await expect(page.getByText(/Бонус/i)).toBeVisible();
  38 |   });
  39 | 
  40 |   test("admin login link is present at the bottom", async ({ page }) => {
  41 |     const adminLink = page.getByRole("link", { name: /Вход для администратора/i });
  42 |     await expect(adminLink).toBeVisible();
  43 |     await adminLink.click();
  44 |     await expect(page).toHaveURL(/\/login\/admin/);
  45 |   });
  46 | });
  47 | 
  48 | test.describe("Admin login — UI structure", () => {
  49 |   test.beforeEach(async ({ page }) => {
  50 |     await page.goto("/login/admin");
  51 |   });
  52 | 
  53 |   test("role tabs Admin/SuperAdmin are visible and toggleable", async ({ page }) => {
  54 |     const adminTab = page.getByRole("button", { name: /^Администратор$/ });
  55 |     const superTab = page.getByRole("button", { name: /^Суперадмин$/ });
  56 |     await expect(adminTab).toBeVisible();
  57 |     await expect(superTab).toBeVisible();
  58 | 
  59 |     await superTab.click();
  60 |     await expect(page.getByRole("button", { name: /Войти как суперадмин/ })).toBeVisible();
  61 | 
  62 |     await adminTab.click();
  63 |     await expect(page.getByRole("button", { name: /Войти как администратор/ })).toBeVisible();
  64 |   });
  65 | 
  66 |   test("password eye-toggle hides/shows password", async ({ page }) => {
  67 |     const pwd = page.locator('input[type="password"], input[type="text"]').nth(1);
> 68 |     await pwd.fill("secret123");
     |               ^ Error: locator.fill: Test timeout of 30000ms exceeded.
  69 |     expect(await pwd.getAttribute("type")).toBe("password");
  70 | 
  71 |     const toggle = page.getByRole("button", { name: "Показать пароль" });
  72 |     await toggle.click();
  73 |     expect(await pwd.getAttribute("type")).toBe("text");
  74 |   });
  75 | 
  76 |   test("back link to client login exists", async ({ page }) => {
  77 |     await expect(page.getByRole("link", { name: /SMS-код/ })).toBeVisible();
  78 |   });
  79 | });
  80 | 
  81 | test.describe("Register page", () => {
  82 |   test("shows SMS-redirect notice and CTA to /login", async ({ page }) => {
  83 |     await page.goto("/register");
  84 |     await expect(page.getByRole("heading", { name: "Регистрация теперь по SMS" })).toBeVisible();
  85 |     await expect(page.getByRole("link", { name: /Перейти ко входу/ })).toBeVisible();
  86 |   });
  87 | });
  88 | 
  89 | test.describe("Profile page as guest", () => {
  90 |   test("shows login-required empty state, not the profile form", async ({ page }) => {
  91 |     await page.goto("/profile");
  92 |     await expect(page.getByRole("heading", { name: /авторизация/i })).toBeVisible();
  93 |     await expect(page.getByRole("link", { name: /Войти по SMS/ })).toBeVisible();
  94 |   });
  95 | });
  96 | 
```