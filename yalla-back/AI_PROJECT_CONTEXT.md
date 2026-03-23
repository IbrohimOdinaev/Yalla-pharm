# AI Project Context: Yalla Farm Apteka

Дата актуализации: 2026-03-13

## 1) Что это за проект

Это full-stack e-commerce для аптеки:
- Backend: ASP.NET Core Web API (`Api`) на .NET 9.
- Слои: `Domain` + `Application` + `Infrastructure` + `Api`.
- База данных: PostgreSQL (через EF Core/Npgsql).
- Хранилище изображений лекарств: MinIO (S3-совместимое).
- Frontend (фактически используемый): статический SPA в `Api/wwwroot` (`app.js` + `styles.css`).

Роли в системе:
- `Client` (покупатель)
- `Admin` (администратор аптеки)
- `SuperAdmin` (глобальный администратор)

## 2) Актуальная структура репозитория

Ключевые каталоги:
- `Api` — веб-слой (Program, Controllers, middleware, валидация, статика UI в `wwwroot`).
- `Application` — use-case сервисы, DTO, маппинги, политики ввода.
- `Domain` — доменные сущности, enum-ы, исключения, value objects.
- `Infrastructure` — EF Core DbContext, конфигурации БД, миграции, JWT, MinIO.
- `tests/Yalla.Api.IntegrationTests` — активные интеграционные тесты.
- `tests/Yalla.Application.UnitTests` — активные unit-тесты.

Важно:
- В репозитории есть дополнительные тестовые/восстановленные каталоги и legacy-файлы, которые не подключены в `.sln` и/или исключены из компиляции.
- В `client/` есть только собранные артефакты (`dist`) и `node_modules`; исходников фронта (`src/*.jsx|ts`) сейчас нет.

## 3) Runtime и startup

Точка входа: `Api/Program.cs`.

На старте:
- Подключается Serilog.
- Подключаются контроллеры + глобальный фильтр `ValidateRequestDtoFilter`.
- Кастомный `InvalidModelStateResponseFactory` для `400 ValidationProblemDetails`.
- JWT bearer auth + authorization.
- Ограничение multipart size: `50 MB` (`UserInputPolicy.MaxMedicineImageFileSizeBytes`).
- DI:
  - `AddApplication()`
  - `AddInfrastructure(configuration)`
- Опционально применяются миграции при старте, если `Database:ApplyMigrationsOnStartup=true`.

HTTP pipeline:
- `UseDefaultFiles()`
- `UseStaticFiles()`
- `UseSerilogRequestLogging()`
- `ExceptionHandlingMiddleware`
- `UseHttpsRedirection()`
- `UseAuthentication()` / `UseAuthorization()`
- `MapControllers()`
- `MapFallbackToFile("index.html")` (SPA fallback)

Вывод:
- UI обслуживается прямо из `Api/wwwroot`.
- OpenAPI включается только в Development (`app.MapOpenApi()`).

## 4) Auth, JWT, роли

JWT генерируется в `Infrastructure/Security/JwtTokenProvider.cs`.

Claims:
- `sub` + `nameidentifier` = `userId`
- `name`
- `mobilephone`
- `role`
- для `Admin` обязательно добавляется `pharmacy_id`

Если у Admin нет `pharmacy_id` в токене, protected admin endpoints будут возвращать `401`.

Срок жизни access token:
- `Jwt:AccessTokenMinutes` (по умолчанию 43200 минут, ~30 дней).

Refresh token механизма нет.

## 5) Доменная модель (актуально используемое)

Основные сущности:
- `User` (база), наследники: `Client`, `PharmacyWorker`.
- `Pharmacy`
- `Medicine`
- `MedicineImage`
- `Offer` (цена/остаток лекарства в конкретной аптеке)
- `BasketPosition`
- `Order`
- `OrderPosition` (с `OfferSnapshot` внутри)
- `RefundRequest`
- `CheckoutRequest` (есть в модели/БД, но в текущем checkout-потоке практически не используется)

Enum-ы:
- `Role`: `Client`, `Admin`, `SuperAdmin`
- `Status` заказа: `New -> UnderReview -> Preparing -> Ready -> OnTheWay -> Delivered -> Returned`, отдельно `Cancelled`
- `RefundRequestStatus`: `Created`, `InitiatedBySuperAdmin`, `Completed`, `Rejected`

Особенность времени заказа:
- `Order.OrderPlacedAt` сохраняется как local-time без timezone, нормализуется в UTC+5 до секунд.

## 6) Бизнес-функционал по модулям

### 6.1 Client функционал

1. Регистрация клиента:
- `POST /api/clients/register`
- Проверка уникальности телефона.
- Пароль валидируется по политике и хешируется bcrypt.

2. Логин:
- `POST /api/auth/login`
- По номеру телефона + паролю.
- Возвращается JWT и профильные данные.

3. Профиль:
- `GET /api/clients/me`
- `PUT /api/clients/me`
- `DELETE /api/clients/me` (удаление запрещено, если есть заказы)

4. Корзина:
- `GET /api/basket`
- `POST /api/basket/items`
- `PATCH /api/basket/items/quantity`
- `DELETE /api/basket/items`
- `DELETE /api/basket`

5. Каталог и карточка:
- `GET /api/medicines`
- `POST /api/medicines/search`
- `GET /api/medicines/{id}`

6. Checkout:
- `POST /api/clients/checkout/preview`
- `POST /api/clients/checkout`
- Требуется `IdempotencyKey` (body или header `Idempotency-Key`).

Что делает checkout:
- Берет корзину клиента.
- Проверяет активность аптеки.
- Проверяет по каждой позиции:
  - лекарство активно,
  - offer существует в выбранной аптеке,
  - хватает остатка.
- Декрементирует `offers.stock_quantity` атомарным `ExecuteUpdateAsync`.
- Создает `Order` + `OrderPosition` с snapshot цены.
- Переводит заказ `New -> UnderReview`.
- Удаляет из корзины только принятые позиции.

### 6.2 Admin функционал

1. Профиль администратора:
- `PUT /api/admins/me`

2. Работа со своей аптекой:
- `GET /api/pharmacies` (активные)
- `PUT /api/pharmacies` (admin scope ограничивается своей аптекой)

3. Управление offer своей аптеки:
- `POST /api/offers` (upsert по `medicineId + pharmacyId`)

4. Заказы своей аптеки:
- `GET /api/orders/worker/new`
- `GET /api/orders/admin/pharmacy`
- `GET /api/orders/admin/history`
- `POST /api/orders/assembly/start`
- `POST /api/orders/positions/reject`
- `POST /api/orders/ready`
- `POST /api/orders/on-the-way`

### 6.3 SuperAdmin функционал

1. Пользователи:
- `GET /api/users` (агрегированная витрина пользователей/ролей/заказов)

2. Клиенты:
- `GET /api/clients`
- `GET /api/clients/with-basket`
- `GET /api/clients/by-phone`
- `GET /api/clients/{clientId}`
- `PUT /api/clients`
- `DELETE /api/clients`

3. Админы/сотрудники:
- `GET /api/admins`
- `POST /api/admins/register`
- `POST /api/admins/register-with-pharmacy`
- `PUT /api/admins/{adminId}`
- `DELETE /api/admins`
- `POST /api/pharmacy-workers`
- `DELETE /api/pharmacy-workers`

4. Аптеки:
- `GET /api/pharmacies/all`
- `POST /api/pharmacies`
- `PUT /api/pharmacies`
- `DELETE /api/pharmacies`

5. Лекарства:
- `GET /api/medicines/all`
- `POST /api/medicines`
- `PUT /api/medicines`
- `DELETE /api/medicines`
- `POST /api/medicines/images`
- `DELETE /api/medicines/images`

6. Заказы и возвраты:
- `GET /api/orders/all`
- `POST /api/orders/delivered`
- `GET /api/refund-requests`
- `POST /api/refund-requests/initiate`

## 7) Workflow статусов заказа

Переходы в домене (`Order.NextStage`):
- `New -> UnderReview`
- `UnderReview -> Preparing`
- `Preparing -> Ready`
- `Ready -> OnTheWay`
- `OnTheWay -> Delivered`
- `Delivered -> Returned`

Через API сейчас реализовано:
- checkout: `New -> UnderReview`
- admin start assembly: `UnderReview -> Preparing`
- admin ready: `Preparing -> Ready`
- admin on-the-way: `Ready -> OnTheWay`
- superadmin delivered: `OnTheWay -> Delivered`

Отмена:
- `Cancel()` запрещена для `Delivered` и `Returned`.
- На отмене восстанавливается stock по непринятым позициям.

Отклонение позиций (`RejectOrderPositions`):
- Разрешено только в статусе `Preparing`.
- Отмечает выбранные позиции как `IsRejected=true`.
- Восстанавливает остаток по отклоненным позициям.
- Пересчитывает `Cost` и `ReturnCost`.
- Если отклонены все позиции, заказ автопереходит в `Cancelled`.

## 8) Возвраты

Есть два разных механизма:

1) Реальные `RefundRequest` в БД:
- Листинг + перевод `Created -> InitiatedBySuperAdmin`.
- Используется `RefundRequestsController` + `RefundRequestService`.

2) Stub-возвраты в order-flow:
- При `CancelOrder` и `RejectOrderPositions` формируется `RefundRequestStubResponse`.
- Это не запись в БД, а только response-объект для UI/клиента.

## 9) Работа с лекарствами и изображениями

Лекарства:
- Создание/обновление с проверкой уникальности `Articul`.
- Мягкое удаление: `IsActive=false`.
- Полное удаление: запрещено, если есть `OrderPosition` в истории.

Изображения:
- Загрузка только для superadmin через multipart.
- Проверки:
  - размер <= 50MB,
  - расширение: `.png`, `.jpg`, `.jpeg`, `.webp`,
  - `content-type` согласован с расширением,
  - проверка сигнатуры файла (magic bytes).
- Ограничение: одно `IsMain=true` и одно `IsMinimal=true` на лекарство.
- Контент отдается через анонимный endpoint:
  - `GET /api/medicines/images/{medicineImageId}/content`

MinIO key формат:
- `medicines/yyyy/MM/dd/{guid}{ext}`

## 10) Валидация и обработка ошибок

Два слоя валидации DTO:
- `Api/Validation/RequestDtoValidator` + `ValidateRequestDtoFilter` (реально в pipeline API).
- `Application/Validation/RequestDtoValidator` + `RequestDtoFluentValidator` (зарегистрирован DI, полезен для unit-тестов и потенциальной интеграции).

`ExceptionHandlingMiddleware` маппит исключения в `ProblemDetails`:
- `DomainArgumentException` -> 400 `validation_error`
- `ConflictException` -> 409 `conflict`
- `DomainException` -> 400 `domain_error`
- `InvalidOperationException` -> 400 `invalid_operation`
- `UnauthorizedAccessException` -> 401 `unauthorized`
- `OperationCanceledException` -> 499 `request_canceled`
- остальные -> 500 `internal_error`

Ответы намеренно sanitized (без внутренних stack details).

## 11) Frontend (`Api/wwwroot`) как работает

Файл: `Api/wwwroot/app.js`.

Это SPA на чистом JS без framework runtime.

Состояние (`state`):
- `token`, `currentUser`, `identity`
- `catalogItems`, `selectedProduct`
- `basket`, `profile`
- `workspace.admin`, `workspace.superAdmin`
- фильтры для заказов/поиска
- `checkoutDraft`
- `medicineCache`
- UI flags (`notice`, `loading`)

Роутинг через hash:
- `#/login`
- `#/register`
- `#/catalog`
- `#/product/:id`
- `#/profile` (client only)
- `#/basket` (client only)
- `#/workspace` (admin/superadmin only)

Сессия:
- хранится в `localStorage` (`yalla.apteka.session`).
- роль/identity парсятся из JWT payload.

UI по ролям:
- Client: каталог, карточка, корзина, профиль, checkout, cancel order.
- Admin: профиль admin, аптека, offer, лента заказов и статусные переходы.
- SuperAdmin: вкладки управления admin/pharmacy, medicine, client; глобальные заказы и refunds.

Важно:
- `Api/wwwroot/index.html` подключает `app.js` и `styles.css`.
- Файлы в `Api/wwwroot/assets/` сейчас не подключены этим `index.html` (похоже на оставшиеся артефакты другой сборки).

## 12) База данных: основные таблицы и ограничения

Основные таблицы:
- `users` (TPH discriminator `user_type`)
- `pharmacies`
- `medicines`
- `medicine_attributes` (owned коллекция)
- `medicine_images`
- `offers`
- `basket_positions`
- `orders`
- `order_positions`
- `checkout_requests`
- `refund_requests`

Критичные индексы/уникальности:
- `users.phone_number` unique
- `medicines.articul` unique
- `offers (medicine_id, pharmacy_id)` unique
- `orders (client_id, idempotency_key)` unique
- `checkout_requests (client_id, idempotency_key)` unique
- уникальность main/minimal image по `medicine_id`

## 13) Конфигурация и запуск

Локально (`Development`):
- API: `https://localhost:7040` и `http://localhost:5227` (launchSettings)
- PostgreSQL: обычно `localhost:5432`
- MinIO: обычно `localhost:9000`

Docker:
- `docker-compose.yml` поднимает:
  - `yalla-postgres`
  - `yalla-minio`
  - `yalla-api`
- Для `yalla-api` по умолчанию миграции включены (`Database__ApplyMigrationsOnStartup=true`).

## 14) Текущий статус сборки и тестов (проверено)

В этой ревизии выполнено:
- `dotnet build yalla-farm.sln` -> успешно, 0 ошибок.
- `dotnet test yalla-farm.sln --no-build` -> успешно.

Результаты тестов:
- `Yalla.Api.IntegrationTests`: 89 passed
- `Yalla.Application.UnitTests`: 156 passed

## 15) Важные расхождения / технический долг

1. `CheckoutRequest` сущность и таблица есть, но текущий `ClientService.CheckoutBasketAsync` не использует полноценный idempotency workflow через `checkout_requests`.
2. `IPaymentService` и `PayForOrderRequest` присутствуют, но реальная оплата в checkout-пайплайне не вызывается.
3. `AddProductToBasketRequest.PharmacyId` и `Create/UpdateMedicineRequest.Url` есть в DTO, но по текущему коду не участвуют в основной логике.
4. Есть два валидатора DTO (Api и Application), частично дублирующие друг друга.
5. В репозитории есть legacy/архивные файлы и тесты (не в активной solution/compilation path).
6. Есть дубликаты конфигов с расширением `.js` (`appsettings.js`, `launchSettings.js`) наряду с `.json`.
7. Параллельно присутствуют несколько фронтовых артефактов (`Api/wwwroot` и `client/dist`), но runtime API сейчас обслуживает `Api/wwwroot/index.html`.
8. Во frontend-лейблах возвратов есть несовпадение терминов (`Processed` в UI vs `Completed` в backend enum).

## 16) Где править при будущих задачах (быстрая карта)

Если задача про API endpoint/доступ:
- `Api/Controllers/*`
- `Api/Extensions/ClaimsPrincipalExtensions.cs`

Если задача про бизнес-логику:
- `Application/Services/*`
- `Application/Extensions/*`

Если задача про модель и БД:
- `Domain/Entities/*`
- `Infrastructure/Configurations/*`
- `Infrastructure/Migrations/*`

Если задача про auth/JWT:
- `Infrastructure/Security/JwtTokenProvider.cs`
- `Api/Program.cs`

Если задача про изображения:
- `Application/Services/MedicineService.cs`
- `Infrastructure/Storage/MinIoMedicineImageStorage.cs`
- `Api/Controllers/MedicinesController.cs`

Если задача про UI:
- `Api/wwwroot/app.js`
- `Api/wwwroot/styles.css`
- `Api/wwwroot/index.html`

Если нужна проверка поведения:
- Интеграционные: `tests/Yalla.Api.IntegrationTests/*`
- Unit: `tests/Yalla.Application.UnitTests/*`
