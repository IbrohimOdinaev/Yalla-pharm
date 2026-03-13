Total output lines: 1108

const STORAGE_KEY = "yalla.apteka.session";
const DEFAULT_BASE_URL = window.location.origin?.startsWith("http")
  ? window.location.origin
  : "https://localhost:5001";
const TJ_PREFIX = "+992";
const MAX_MEDICINE_IMAGE_SIZE_BYTES = 50 * 1024 * 1024;

const ROLE = {
  CLIENT: "Client",
  ADMIN: "Admin",
  SUPER_ADMIN: "SuperAdmin"
};

const app = document.querySelector("#app");

const state = {
  baseUrl: DEFAULT_BASE_URL,
  token: "",
  currentUser: null,
  identity: null,
  route: { name: "catalog", medicineId: null },
  catalogItems: [],
  catalogMeta: { mode: "catalog", totalCount: 0, page: 1, pageSize: 24, query: "" },
  selectedProduct: null,
  basket: null,
  profile: null,
  workspace: {
    admin: null,
    superAdmin: null
  },
  adminOrderStatusFilter: "",
  superAdminSearch: {
    pharmacyAdmin: "",
    medicine: "",
    client: ""
  },
  medicineCache: new Map(),
  notice: null,
  loading: false,
  loadingLabel: "",
  pendingSearch: ""
};

document.addEventListener("DOMContentLoaded", () => {
  restoreSession();
  bindEvents();
  render();
  handleRouteChange();
});

function bindEvents() {
  window.addEventListener("hashchange", handleRouteChange);
  app.addEventListener("submit", handleSubmit);
  app.addEventListener("click", handleClick);
}

function restoreSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw);
    state.baseUrl = normalizeBaseUrl(parsed.baseUrl || DEFAULT_BASE_URL);
    state.token = parsed.token || "";
    state.currentUser = parsed.currentUser || null;
    syncIdentityFromToken();
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function persistSession() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    baseUrl: state.baseUrl,
    token: state.token,
    currentUser: state.currentUser
  }));
}

function normalizeBaseUrl(value) {
  const formType = form.dataset.form;

  try {
    if (formType === "settings") {
      const previousToken = state.token;
      state.baseUrl = normalizeBaseUrl(formData.get("baseUrl"));
      state.token = String(formData.get("token") || "").trim();
      if (!state.token || state.token !== previousToken) {
        state.currentUser = null;
      }
      syncIdentityFromToken();
      persistSession();
      showNotice("Настройки API сохранены.", "success");
      await refreshCurrentRoute();
      return;
    }

    if (formType === "login") {
      await login(formData);
      return;
    }

    if (formType === "register") {
      await register(formData);
      return;
    }

    if (formType === "catalog-search") {
      state.pendingSearch = String(formData.get("query") || "").trim();
      await fetchCatalog();
      return;
    }

    if (formType === "admin-order-filter") {
      state.adminOrderStatusFilter = String(formData.get("status") || "").trim();
      await fetchWorkspace();
      return;
    }

    if (formType === "superadmin-pharmacy-admin-search") {
      state.superAdminSearch.pharmacyAdmin = String(formData.get("query") || "").trim();
      await fetchWorkspace();
      return;
    }

    if (formType === "superadmin-medicine-search") {
      state.superAdminSearch.medicine = String(formData.get("query") || "").trim();
      await fetchWorkspace();
      return;
    }

    if (formType === "superadmin-client-search") {
      state.superAdminSearch.client = String(formData.get("query") || "").trim();
      await fetchWorkspace();
      return;
    }

    if (formType === "profile-update") {
      await updateClientProfile(formData);
      return;
    }

    if (formType === "password-change") {
      await changePassword(formData);
      return;
    }

    if (formType === "add-to-basket") {
      await addToBasket(formData);
      return;
    }

    if (formType === "admin-profile-update") {
      await updateAdminProfile(formData);
      return;
    }

    if (formType === "pharmacy-update") {
      await updatePharmacy(formData);
      return;
    }

    if (formType === "medicine-create") {
      await createMedicine(formData);
      return;
    }

    if (formType === "medicine-update") {
      await updateMedicine(formData);
      return;
    }

    if (formType === "medicine-delete") {
      await deleteMedicine(formData);
      return;
    }

    if (formType === "medicine-hard-delete") {
      await deleteMedicine(formData, { permanently: true });
      return;
    }

    if (formType === "medicine-image-upload") {
      await createMedicineImage(formData);
      return;
    }

    if (formType === "admin-create") {
      await createAdmin(formData);
      return;
    }

    if (formType === "admin-pharmacy-create") {
      await createAdminWithPharmacy(formData);
      return;
    }

    if (formType === "admin-update") {
      await updateAdmin(formData);
      return;
    }

    if (formType === "admin-delete") {
      await deleteAdmin(formData);
      return;
    }

    if (formType === "pharmacy-create") {
      await createPharmacy(formData);
      return;
    }
      return;
    }

    if (action === "go-workspace") {
      setRoute("/workspace");
      return;
    }

    if (action === "refresh-route") {
      await refreshCurrentRoute();
      return;
    }

    if (action === "product-open") {
      const medicineId = actionTarget.dataset.medicineId;
      if (medicineId) setRoute(`/product/${medicineId}`);
      return;
    }

    if (action === "medicine-card-deactivate") {
      const medicineId = actionTarget.dataset.medicineId;
      if (medicineId) {
        await deactivateMedicineById(medicineId);
      }
      return;
    }

    if (action === "medicine-card-delete") {
      const medicineId = actionTarget.dataset.medicineId;
      if (medicineId) {
        await hardDeleteMedicineById(medicineId);
      }
      return;
    }

    if (action === "basket-remove") {
      await removeFromBasket(actionTarget.dataset.positionId);
      return;
    }

    if (action === "basket-clear") {
      await clearBasket();
      return;
    }

    if (action === "basket-step") {
      const positionId = actionTarget.dataset.positionId;
      const delta = Number(actionTarget.dataset.delta || "0");
      const currentQuantity = Number(actionTarget.dataset.quantity || "0");
      const nextQuantity = currentQuantity + delta;
      if (nextQuantity <= 0) {
        await removeFromBasket(positionId);
        return;
      }

      await updateBasketQuantity(positionId, nextQuantity);
      return;
    }

    if (action === "order-start") {
      await performAdminOrderAction("/api/orders/assembly/start", actionTarget.dataset.orderId, "Сборка заказа запущена.");
      return;
    }

    if (action === "order-ready") {
      await performAdminOrderAction("/api/orders/ready", actionTarget.dataset.orderId, "Заказ отмечен как готовый.");
      return;
    }

    if (action === "order-on-the-way") {
      await performAdminOrderAction("/api/orders/on-the-way", actionTarget.dataset.orderId, "Заказ отмечен как отправленный.");
async function updateMedicine(formData) {
  await withLoading("Обновляем товар...", () => apiFetch("/api/medicines", {
    method: "PUT",
    body: {
      medicineId: String(formData.get("medicineId") || "").trim(),
      title: String(formData.get("title") || "").trim(),
      articul: String(formData.get("articul") || "").trim()
    }
  }));

  showNotice("Товар обновлен.", "success");
  await fetchWorkspaceOrCatalog();
}

async function deleteMedicine(formData, options = {}) {
  const medicineId = String(formData.get("medicineId") || "").trim();
  if (options.permanently) {
    const confirmed = window.confirm(
      "Удалить товар полностью? Будут удалены данные товара, картинки из MinIO и записи о картинках из БД."
    );
    if (!confirmed) return;
  }
  await deleteMedicineById(medicineId, { permanently: Boolean(options.permanently) });
}

async function deactivateMedicineById(medicineId) {
  if (!medicineId) return;
  const confirmed = window.confirm("Деактивировать этот товар? Он станет недоступен клиентам.");
  if (!confirmed) return;
  await deleteMedicineById(medicineId, { permanently: false });
}

async function hardDeleteMedicineById(medicineId) {
  if (!medicineId) return;
  const confirmed = window.confirm(
    "Удалить товар полностью? Будут удалены данные товара, картинки из MinIO и записи о картинках из БД."
  );
  if (!confirmed) return;
  await deleteMedicineById(medicineId, { permanently: true });
}

async function deleteMedicineById(medicineId, options = {}) {
  const permanently = Boolean(options.permanently);
  await withLoading(permanently ? "Удаляем товар полностью..." : "Деактивируем товар...", () => apiFetch("/api/medicines", {
    method: "DELETE",
    body: {
      medicineId,
      permanently
    }
  }));

  showNotice(permanently ? "Товар удален полностью." : "Товар деактивирован.", "success");
  await fetchWorkspaceOrCatalog();
}

async function createMedicineImage(formData) {
  const image = formData.get("image");
  if (!(image instanceof File) || !image.name) {
    showNotice("Выберите файл изображения.", "warning");
    return;
  }

  if (image.size > MAX_MEDICINE_IMAGE_SIZE_BYTES) {
    showNotice("Размер изображения не должен превышать 50 МБ.", "warning");
    return;
  }

  const uploadData = new FormData();
  uploadData.set("medicineId", String(formData.get("medicineId") || "").trim());
  uploadData.set("isMain", String(formData.get("isMain") || "false"));
  uploadData.set("isMinimal", String(formData.get("isMinimal") || "false"));
  uploadData.set("image", image);

  await withLoading("Загружаем изображение...", () => apiFetch("/api/medicines/images", {
    method: "POST",
    body: uploadData
  }));

  showNotice("Изображение товара загружено.", "success");
  await fetchWorkspaceOrCatalog();
}

async function createAdmin(formData) {
  await withLoading("Создаем администратора...", () => apiFetch("/api/admins/register", {
    method: "POST",
    body: {
      name: String(formData.get("name") || "").trim(),
      phoneNumber: normalizePhoneInputValue(formData.get("phoneNumber")),
      password: String(formData.get("password") || ""),
      pharmacyId: String(formData.get("pharmacyId") || "").trim()
    }
  }));

  showNotice("Администратор создан.", "success");
  await fetchWorkspace();
}

async function createAdminWithPharmacy(formData) {
  await withLoading("Создаем администратора и аптеку...", () => apiFetch("/api/admins/register-with-pharmacy", {
    method: "POST",
    body: {
      adminName: String(formData.get("adminName") || "").trim(),
      adminPhoneNumber: normalizePhoneInputValue(formData.get("adminPhoneNumber")),
      adminPassword: String(formData.get("adminPassword") || ""),
      pharmacyTitle: String(formData.get("pharmacyTitle") || "").trim(),
      pharmacyAddress: String(formData.get("pharmacyAddress") || "").trim()
    }
  }));

  showNotice("Администратор и аптека созданы.", "success");
  await fetchWorkspace();
}

async function updateAdmin(formData) {
  const adminId = String(formData.get("adminId") || "").trim();

  await withLoading("Обновляем администратора...", () => apiFetch(`/api/admins/${adminId}`, {
    method: "PUT",
    body: {
      name: String(formData.get("name") || "").trim(),
      phoneNumber: normalizePhoneInputValue(formData.get("phoneNumber"))
    }
  }));

  showNotice("Администратор обновлен.", "success");
  await fetchWorkspace();
}

async function deleteAdmin(formData) {
  await withLoading("Удаляем администратора...", () => apiFetch("/api/admins", {
    method: "DELETE",
  }

  const [pharmaciesResponse, ordersResponse] = await withLoading("Загружаем кабинет администратора...", () => Promise.all([
    apiFetch("/api/pharmacies"),
    apiFetch(`/api/orders/admin/history?${orderQuery.toString()}`)
  ]));

  const orders = ordersResponse.orders || [];
  orders.forEach(order => {
    (order.positions || []).forEach(position => rememberMedicine(position.medicine));
  });

  state.workspace.admin = {
    pharmacyId: identity?.pharmacyId || "",
    pharmacy: (pharmaciesResponse.pharmacies || []).find(item => item.id === identity?.pharmacyId) || null,
    pharmacies: pharmaciesResponse.pharmacies || [],
    orders,
    totalOrders: ordersResponse.totalCount || orders.length,
    workerId: ordersResponse.workerId || identity?.userId || ""
  };

  render();
}

async function fetchSuperAdminWorkspace() {
  const pharmacyAdminQuery = state.superAdminSearch.pharmacyAdmin.trim();
  const medicineQuery = state.superAdminSearch.medicine.trim();
  const clientQuery = state.superAdminSearch.client.trim();

  const adminsParams = new URLSearchParams({ page: "1", pageSize: "50" });
  const pharmaciesParams = new URLSearchParams({ page: "1", pageSize: "50" });
  const medicinesParams = new URLSearchParams({ page: "1", pageSize: "50" });
  const clientsParams = new URLSearchParams({ page: "1", pageSize: "50" });

  if (pharmacyAdminQuery) {
    adminsParams.set("query", pharmacyAdminQuery);
    pharmaciesParams.set("query", pharmacyAdminQuery);
  }

  if (medicineQuery) {
    medicinesParams.set("query", medicineQuery);
  }

  if (clientQuery) {
    clientsParams.set("query", clientQuery);
  }

  const [adminsResponse, pharmaciesResponse, ordersResponse, refundsResponse, catalogResponse, clientsResponse] = await withLoading(
    "Загружаем кабинет супер-админа...",
    () => Promise.all([
      apiFetch(`/api/admins?${adminsParams.toString()}`),
      apiFetch(`/api/pharmacies/all?${pharmaciesParams.toString()}`),
      apiFetch("/api/orders/all?page=1&pageSize=20"),
      apiFetch("/api/refund-requests?page=1&pageSize=20"),
      apiFetch(`/api/medicines/all?${medicinesParams.toString()}`),
      apiFetch(`/api/clients?${clientsParams.toString()}`)
    ])
  );

  const medicines = catalogResponse.medicines || [];
  medicines.forEach(rememberMedicine);

  const orders = ordersResponse.orders || [];
  orders.forEach(order => {
    (order.positions || []).forEach(position => rememberMedicine(position.medicine));
  });

  state.workspace.superAdmin = {
    admins: adminsResponse.admins || [],
    pharmacies: pharmaciesResponse.pharmacies || [],
    orders,
    refunds: refundsResponse.refundRequests || [],
    clients: clientsResponse.clients || [],
    medicineList: medicines,
    stats: {
      adminsTotal: Number(adminsResponse.totalCount ?? (adminsResponse.admins || []).length),
      pharmaciesTotal: Number(pharmaciesResponse.totalCount ?? (pharmaciesResponse.pharmacies || []).length),
      medicinesTotal: Number(catalogResponse.totalCount ?? medicines.length),
      clientsTotal: Number(clientsResponse.totalCount ?? (clientsResponse.clients || []).length)
    }
  };

  render();
}

async function hydrateMedicineDetails(medicineIds) {
  const uniqueIds = [...new Set((medicineIds || []).filter(Boolean))];
  const missingIds = uniqueIds.filter(id => {
    const cached = state.medicineCache.get(id);
    return !cached || !cached.atributes;
  });

  await Promise.all(missingIds.map(async medicineId => {
    try {
      const response = await apiFetch(`/api/medicines/${medicineId}`);
      rememberMedicine(response.medicine);
    } catch {
      if (!state.medicineCache.has(medicineId)) {
        state.medicineCache.set(medicineId, {
          id: medicineId,
          title: "Товар недоступен",
          articul: medicineId.slice(0, 8),
          images: [],
          atributes: []
        });
      }
  return payload;
}

function extractErrorMessage(payload) {
  if (!payload) return "";
  if (typeof payload === "string…2128 tokens truncated…атора
                <input name="adminName" type="text" placeholder="Admin" required>
              </label>
              <label>
                Телефон администратора
                ${renderPhoneField({ name: "adminPhoneNumber", placeholder: "900100009" })}
              </label>
              <label>
                Пароль администратора
                <input name="adminPassword" type="password" placeholder="Pass123!" required>
              </label>
              <label>
                Название новой аптеки
                <input name="pharmacyTitle" type="text" placeholder="Pharmacy Downtown" required>
              </label>
              <label>
                Адрес новой аптеки
                <input name="pharmacyAddress" type="text" placeholder="Dushanbe, Center 10" required>
              </label>
              <button class="btn btn-primary" type="submit">Создать Admin + Pharmacy</button>
            </form>

            <form class="stack-form" data-form="admin-create">
              <label>
                Имя администратора
                <input name="name" type="text" placeholder="Admin" required>
              </label>
              <label>
                Телефон
                ${renderPhoneField({ name: "phoneNumber", placeholder: "900100009" })}
              </label>
              <label>
                Пароль
                <input name="password" type="password" placeholder="Pass123!" required>
              </label>
              <label>
                PharmacyId
                <select name="pharmacyId" required>
                  <option value="">Выберите аптеку</option>
                  ${renderPharmacyOptions(workspace.pharmacies)}
                </select>
              </label>
              <button class="btn btn-primary" type="submit">Создать администратора</button>
            </form>

            <form class="stack-form" data-form="admin-update">
              <label>
                AdminId
                <select name="adminId" required>
                  <option value="">Выберите администратора</option>
                  ${renderAdminOptions(workspace.admins)}
                </select>
              </label>
              <label>
                Новое имя
                <input name="name" type="text" placeholder="Updated Admin" required>
              </label>
              <label>
                Новый телефон
                ${renderPhoneField({ name: "phoneNumber", placeholder: "900100010" })}
              </label>
              <button class="btn btn-secondary" type="submit">Обновить администратора</button>
            </form>

            <form class="stack-form" data-form="admin-delete">
              <label>
                PharmacyWorkerId
                <select name="pharmacyWorkerId" required>
                  <option value="">Выберите администратора</option>
                  ${renderAdminOptions(workspace.admins)}
                </select>
              </label>
              <button class="btn btn-secondary" type="submit">Удалить администратора</button>
            </form>

            <form class="stack-form" data-form="pharmacy-create">
              <label>
                Название аптеки
                <input name="title" type="text" placeholder="Pharmacy Downtown" required>
              </label>
              <label>
                Адрес
                <input name="address" type="text" placeholder="Dushanbe, Center 10" required>
              </label>
              <label>
                AdminId
                <select name="adminId" required>
                  <option value="">Выберите администратора</option>
                  ${renderAdminOptions(workspace.admins)}
                </select>
              </label>
              <button class="btn btn-primary" type="submit">Создать аптеку</button>
            </form>

            <form class="stack-form" data-form="pharmacy-update">
              <label>
                PharmacyId
                <select name="pharmacyId" required>
                  <option value="">Выберите аптеку</option>
                  ${renderPharmacyOptions(workspace.pharmacies)}
                </select>
              </label>
              <label>
                Название
                <input name="title" type="text" placeholder="Updated Pharmacy" required>
              </label>
              <label>
                Адрес
                <input name="address" type="text" placeholder="New address" required>
              </label>
              <label>
                AdminId
                <select name="adminId" required>
                  <option value="">Выберите администратора</option>
                  ${renderAdminOptions(workspace.admins)}
                </select>
              </label>
              <label class="checkbox-row">
                <input name="isActive" type="checkbox" checked>
                <span>Аптека активна</span>
              </label>
              <button class="btn btn-secondary" type="submit">Обновить аптеку</button>
            </form>

            <form class="stack-form" data-form="pharmacy-delete">
              <label>
                PharmacyId
                <select name="pharmacyId" required>
                  <option value="">Выберите аптеку</option>
                  ${renderPharmacyOptions(workspace.pharmacies)}
                </select>
              </label>
              <button class="btn btn-secondary" type="submit">Удалить аптеку</button>
            </form>
          </div>
        </article>

        ${renderMedicineManager("superadmin", workspace.medicineList)}

        <article class="panel workspace-panel workspace-panel-wide">
          <div class="section-headline">
            <h3>Управление Client</h3>
            <span class="muted">${escapeHtml(String(workspace.clients.length))} клиентов</span>
          </div>
          <form class="workspace-inline-filter" data-form="superadmin-client-search">
            <label>
              Поиск по имени клиента
              <input
                name="query"
                type="search"
                value="${escapeHtml(state.superAdminSearch.client)}"
                placeholder="Например: Rustam">
            </label>
            <button class="btn btn-secondary" type="submit">Найти</button>
          </form>
          <div class="workspace-list">
            ${workspace.clients.length
              ? workspace.clients.map(client => renderClientCard(client)).join("")
              : `<p class="muted">По текущему фильтру клиенты не найдены.</p>`}
          </div>
          <div class="workspace-form-grid">
            <form class="stack-form" data-form="client-update">
              <label>
                ClientId
                <select name="clientId" required>
                  <option value="">Выберите клиента</option>
                  ${renderClientOptions(workspace.clients)}
                </select>
              </label>
              <label>
                Новое имя
                <input name="name" type="text" placeholder="Updated Client" required>
              </label>
              <label>
                Новый телефон
                ${renderPhoneField({ name: "phoneNumber", placeholder: "900100011" })}
              </label>
              <button class="btn btn-secondary" type="submit">Обновить клиента</button>
            </form>

            <form class="stack-form" data-form="client-delete">
              <label>
                ClientId
                <select name="clientId" required>
                  <option value="">Выберите клиента</option>
                  ${renderClientOptions(workspace.clients)}
                </select>
              </label>
              <button class="btn btn-secondary" type="submit">Удалить клиента</button>
            </form>
          </div>
        </article>

        <article class="panel workspace-panel workspace-panel-wide">
          <div class="section-headline">
            <h3>Все заказы</h3>
            <span class="muted">${escapeHtml(String(workspace.orders.length))} заказов</span>
          </div>
          ${workspace.orders.length
            ? `<div class="workspace-order-list">${workspace.orders.map(order => renderSuperAdminOrderCard(order)).join("")}</div>`
            : `<p class="muted">Заказов пока нет.</p>`}
        </article>

        <article class="panel workspace-panel workspace-panel-wide">
          <div class="section-headline">
            <h3>Запросы на возврат</h3>
            <span class="muted">${escapeHtml(String(workspace.refunds.length))} запросов</span>
          </div>
          ${workspace.refunds.length
            ? `<div class="workspace-list">${workspace.refunds.map(refund => renderRefundCard(refund)).join("")}</div>`
            : `<p class="muted">Возвратов пока нет.</p>`}
        </article>
      </section>
    </section>
  `;
}

function renderMedicineManager(scope, medicines) {
  const title = "Управление Medicine";
  return `
    <article class="panel workspace-panel workspace-panel-wide">
      <div class="section-headline">
        <h3>${title}</h3>
        <span class="muted">Создание, обновление, деактивация и полное удаление</span>
      </div>
      ${scope === "superadmin" ? `
        <form class="workspace-inline-filter" data-form="superadmin-medicine-search">
          <label>
            Поиск по названию Medicine
            <input
              name="query"
              type="search"
              value="${escapeHtml(state.superAdminSearch.medicine)}"
              placeholder="Например: Paracetamol">
          </label>
}

function renderRefundCard(refund) {
  return `
    <div class="workspace-list-item refund-item">
      <div>
        <strong>Refund ${escapeHtml(String(refund.refundRequestId).slice(0, 8))}</strong>
        <p class="muted">${escapeHtml(refund.reason || "Без причины")}</p>
      </div>
      <span>${escapeHtml(formatMoney(refund.amount))} ${escapeHtml(refund.currency || "")}</span>
      <span>${escapeHtml(formatRefundStatusLabel(refund.status))}</span>
      <button class="btn btn-secondary" type="button" data-action="refund-initiate" data-refund-request-id="${escapeHtml(refund.refundRequestId)}">
        Инициировать возврат
      </button>
    </div>
  `;
}

function renderClientCard(client) {
  return `
    <div class="workspace-list-item">
      <strong>${escapeHtml(client.name)}</strong>
      <span>${escapeHtml(formatPhoneNumber(client.phoneNumber))}</span>
      <span>Позиций в корзине: ${escapeHtml(String((client.basketPositions || []).length))}</span>
      <span>Заказов: ${escapeHtml(String((client.orders || []).length))}</span>
      <span class="mono-text">${escapeHtml(client.id)}</span>
      ${(client.orders || []).length ? `
        <div class="workspace-sublist">
          ${(client.orders || []).slice(0, 4).map(order => `
            <span>
              ${escapeHtml(formatStatusLabel(order.status))} · ${escapeHtml(formatMoney(order.cost))} · ${escapeHtml(formatDate(order.orderPlacedAt))}
            </span>
          `).join("")}
        </div>
      ` : ""}
    </div>
  `;
}

function renderProductCard(item, role, options = {}) {
  const showSuperAdminManage = role === ROLE.SUPER_ADMIN && options.superAdminManage === true;
  const imageSource = getMedicineImageSource(item.images);
  const attributes = Array.isArray(item.atributes) ? item.atributes.slice(0, 2) : [];
  return `
    <article class="product-card ${role === ROLE.CLIENT ? "product-card-shop" : ""}">
      <div class="product-media">
        ${imageSource
          ? `<img src="${escapeHtml(imageSource)}" alt="${escapeHtml(item.title || "Товар")}">`
          : `<div class="image-fallback">${escapeHtml(getInitials(item.title))}</div>`}
      </div>
      <div class="product-body">
        <div class="product-topline">
          <span class="product-articul">${escapeHtml(item.articul || "Без артикула")}</span>
          ${role === ROLE.CLIENT ? `<span class="product-state">${item.isActive === false ? "Скрыт" : "В наличии"}</span>` : ""}
        </div>
        <h3>${escapeHtml(item.title || "Без названия")}</h3>
        ${attributes.length ? `
          <div class="product-attribute-preview">
            ${attributes.map(attribute => `<span>${escapeHtml(attribute.name)}: ${escapeHtml(attribute.option)}</span>`).join("")}
          </div>
        ` : ""}
        <p class="muted">${role === ROLE.CLIENT ? "Нажмите, чтобы открыть карточку товара и добавить в корзину." : "Товар можно открыть и редактировать через кабинет."}</p>
      </div>
      <div class="product-actions">
        <button class="btn btn-secondary" type="button" data-action="product-open" data-medicine-id="${escapeHtml(item.id)}">Подробнее</button>
        ${role === ROLE.CLIENT ? `
          <form class="inline-add-form" data-form="add-to-basket">
            <input type="hidden" name="medicineId" value="${escapeHtml(item.id)}">
            <input type="hidden" name="quantity" value="1">
            <button class="btn btn-primary" type="submit">В корзину</button>
          </form>
        ` : showSuperAdminManage ? `
          <button class="btn btn-secondary" type="button" data-action="medicine-card-deactivate" data-medicine-id="${escapeHtml(item.id)}">Деактивировать</button>
          <button class="btn btn-secondary" type="button" data-action="medicine-card-delete" data-medicine-id="${escapeHtml(item.id)}">Удалить полностью</button>
        ` : `
          <button class="btn btn-secondary" type="button" data-action="go-workspace">В кабинет</button>
        `}
      </div>
    </article>
  `;
}

function renderCompactBasketItem(item) {
  const medicine = state.medicineCache.get(item.medicineId) || {};
  return `
    <a class="compact-item" href="#/product/${escapeHtml(item.medicineId)}">
      <div class="compact-item-copy">
        <strong>${escapeHtml(medicine.title || "Товар")}</strong>
        <span>${escapeHtml(medicine.articul || item.medicineId)}</span>
      </div>
      <span class="compact-qty">x${escapeHtml(String(item.quantity || 0))}</span>
    </a>
  `;
}

function renderBasketItem(item) {
  const medicine = state.medicineCache.get(item.medicineId) || {};
  const imageSource = getMedicineImageSource(medicine.images);
  const quantity = Number(item.quantity || 0);

  return `
    <div class="basket-item">
      <a class="basket-item-media" href="#/product/${escapeHtml(item.medicineId)}">
        ${imageSource
          ? `<img src="${escapeHtml(imageSource)}" alt="${escapeHtml(medicine.title || "Товар")}">`
          : `<div class="image-fallback">${escapeHtml(getInitials(medicine.title || "Товар"))}</div>`}
  ];

  return statuses
    .map(status => `<option value="${status}" ${selectedStatus === status ? "selected" : ""}>${status}</option>`)
    .join("");
}

function renderAdminOptions(admins) {
  return (admins || [])
    .map(admin => `<option value="${escapeHtml(admin.adminId)}">${escapeHtml(admin.name)} · ${escapeHtml(formatPhoneNumber(admin.phoneNumber))}</option>`)
    .join("");
}

function renderPharmacyOptions(pharmacies) {
  return (pharmacies || [])
    .map(pharmacy => `<option value="${escapeHtml(pharmacy.id)}">${escapeHtml(pharmacy.title)} · ${escapeHtml(pharmacy.address)}</option>`)
    .join("");
}

function renderMedicineOptions(medicines) {
  return (medicines || [])
    .map(medicine => `<option value="${escapeHtml(medicine.id)}">${escapeHtml(medicine.title)} · ${escapeHtml(medicine.articul || "")}</option>`)
    .join("");
}

function renderClientOptions(clients) {
  return (clients || [])
    .map(client => `<option value="${escapeHtml(client.id)}">${escapeHtml(client.name)} · ${escapeHtml(formatPhoneNumber(client.phoneNumber))}</option>`)
    .join("");
}

function formatRoleLabel(value) {
  const normalized = normalizeRole(value);
  if (normalized === ROLE.SUPER_ADMIN) return "SuperAdmin";
  if (normalized === ROLE.ADMIN) return "Admin";
  return "Client";
}

function formatStatusLabel(value) {
  const labels = {
    0: "New",
    1: "UnderReview",
    2: "Preparing",
    3: "Ready",
    4: "OnTheWay",
    5: "Delivered",
    6: "Cancelled",
    7: "Returned",
    New: "New",
    UnderReview: "UnderReview",
    Preparing: "Preparing",
