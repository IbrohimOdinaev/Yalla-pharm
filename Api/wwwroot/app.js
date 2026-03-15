const STORAGE_KEY = "yalla.apteka.session";
const DEFAULT_BASE_URL = window.location.origin?.startsWith("http")
  ? window.location.origin
  : "https://localhost:5001";
const TJ_PREFIX = "+992";
const MAX_MEDICINE_IMAGE_SIZE_BYTES = 50 * 1024 * 1024;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_ALLOWED_CHARS_REGEX = /^[A-Za-z0-9!@#$%^&*()\-_=.,?]+$/;
const LIVE_SEARCH_DEBOUNCE_MS = 260;

const ROLE = {
  CLIENT: "Client",
  ADMIN: "Admin",
  SUPER_ADMIN: "SuperAdmin"
};

const SUPERADMIN_INTERFACE = {
  PHARMACY_ADMIN: "pharmacy-admin",
  MEDICINE: "medicine",
  CLIENT: "client"
};

const SUPERADMIN_OPERATIONS_INTERFACE = {
  ORDERS: "orders",
  REFUNDS: "refunds"
};

const ADMIN_INTERFACE = {
  PHARMACY: "pharmacy",
  OFFER: "offer",
  ORDERS: "orders"
};

const app = document.querySelector("#app");
let catalogLiveSearchTimer = 0;
let adminMedicineLiveSearchTimer = 0;
let superAdminMedicineLiveSearchTimer = 0;
let catalogFetchRequestId = 0;
let superAdminMedicineDetailsRequestId = 0;

const state = {
  baseUrl: DEFAULT_BASE_URL,
  token: "",
  currentUser: null,
  identity: null,
  route: { name: "catalog", medicineId: null, orderId: null },
  catalogItems: [],
  catalogMeta: { mode: "catalog", totalCount: 0, page: 1, pageSize: 24, query: "" },
  selectedProduct: null,
  basket: null,
  profile: null,
  clientOrderHistory: [],
  clientOrderDetailsCache: new Map(),
  clientOrderDetailsLoading: new Set(),
  expandedClientOrders: new Set(),
  pharmacies: [],
  workspace: {
    admin: null,
    superAdmin: null
  },
  expandedAdminOrders: new Set(),
  adminMedicineSearch: "",
  adminOrderStatusFilter: "",
  superAdminOrderStatusFilter: "",
  superAdminSearch: {
    pharmacyAdmin: "",
    medicine: "",
    client: ""
  },
  adminInterface: ADMIN_INTERFACE.PHARMACY,
  superAdminInterface: SUPERADMIN_INTERFACE.PHARMACY_ADMIN,
  superAdminOperationsInterface: SUPERADMIN_OPERATIONS_INTERFACE.ORDERS,
  superAdminSelectedMedicineId: "",
  superAdminMedicineDetailsLoading: false,
  checkoutDraft: {
    pharmacyId: "",
    deliveryAddress: ""
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
  app.addEventListener("input", handleInput);
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
  const normalized = String(value || "").trim();
  if (!normalized) return DEFAULT_BASE_URL;
  return normalized.replace(/\/+$/, "");
}

function normalizePhoneInputValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const digitsOnly = raw.replace(/\D+/g, "");
  if (digitsOnly.startsWith("992") && digitsOnly.length === 12) {
    return digitsOnly.slice(3);
  }

  return digitsOnly;
}

function formatPhoneNumber(value) {
  const normalized = normalizePhoneInputValue(value);
  return normalized.length === 9
    ? `${TJ_PREFIX} ${normalized}`
    : normalized;
}

function renderPhoneField({ name, value = "", autocomplete = "tel", placeholder = "900123456", required = true }) {
  const requiredAttribute = required ? "required" : "";

  return `
    <div class="phone-input">
      <span class="phone-input-prefix">${escapeHtml(TJ_PREFIX)}</span>
      <input
        name="${escapeHtml(name)}"
        type="text"
        inputmode="numeric"
        pattern="[0-9]{9}"
        minlength="9"
        maxlength="9"
        title="Введите 9 цифр номера без +992"
        autocomplete="${escapeHtml(autocomplete)}"
        value="${escapeHtml(normalizePhoneInputValue(value))}"
        placeholder="${escapeHtml(placeholder)}"
        ${requiredAttribute}>
    </div>
  `;
}

function validatePhoneNumberInput(value, fieldName = "Телефон") {
  const normalized = normalizePhoneInputValue(value);
  if (!normalized) {
    return `${fieldName}: введите 9 цифр номера.`;
  }

  return /^\d{9}$/.test(normalized)
    ? ""
    : `${fieldName}: номер должен содержать ровно 9 цифр (без +992).`;
}

function validatePasswordInput(value, fieldName = "Пароль") {
  const raw = String(value || "");

  if (!raw.trim()) {
    return `${fieldName}: введите пароль.`;
  }

  if (raw.length < PASSWORD_MIN_LENGTH) {
    return `${fieldName}: нужно как минимум ${PASSWORD_MIN_LENGTH} символов.`;
  }

  if (!PASSWORD_ALLOWED_CHARS_REGEX.test(raw)) {
    return `${fieldName}: используйте латиницу, цифры и символы ! @ # $ % ^ & * ( ) - _ + = . , ?`;
  }

  return "";
}

function parseRoute() {
  const rawHash = window.location.hash.replace(/^#/, "") || defaultAuthenticatedRoute();
  const cleanHash = rawHash.startsWith("/") ? rawHash : `/${rawHash}`;
  const productMatch = cleanHash.match(/^\/product\/([^/]+)$/);
  const workspaceOrderMatch = cleanHash.match(/^\/workspace\/order\/([^/]+)$/);

  if (workspaceOrderMatch) {
    return { name: "workspace-order", medicineId: null, orderId: workspaceOrderMatch[1] };
  }

  if (productMatch) {
    return { name: "product", medicineId: productMatch[1], orderId: null };
  }

  switch (cleanHash) {
    case "/login":
      return { name: "login", medicineId: null, orderId: null };
    case "/register":
      return { name: "register", medicineId: null, orderId: null };
    case "/profile":
      return { name: "profile", medicineId: null, orderId: null };
    case "/basket":
      return { name: "basket", medicineId: null, orderId: null };
    case "/workspace":
      return { name: "workspace", medicineId: null, orderId: null };
    case "/catalog":
    default:
      return { name: "catalog", medicineId: null, orderId: null };
  }
}

function setRoute(path) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (window.location.hash === `#${normalized}`) {
    handleRouteChange();
    return;
  }

  window.location.hash = normalized;
}

async function handleRouteChange() {
  syncIdentityFromToken();
  state.route = parseRoute();
  document.title = getPageTitle(state.route.name);
  render();

  if (!canAccessRoute(state.route.name)) {
    const targetRoute = state.token ? defaultAuthenticatedRoute() : "/catalog";
    showNotice(
      state.token
        ? "Этот экран недоступен для вашей роли."
        : "Этот экран доступен только после авторизации.",
      "warning"
    );
    setRoute(targetRoute);
    return;
  }

  try {
    if (state.route.name === "catalog") {
      await fetchCatalog();
      return;
    }

    if (state.route.name === "product" && state.route.medicineId) {
      await fetchProduct(state.route.medicineId);
      return;
    }

    if (state.route.name === "profile") {
      await fetchProfile();
      return;
    }

    if (state.route.name === "basket") {
      await fetchBasket();
      return;
    }

    if (state.route.name === "workspace") {
      await fetchWorkspace();
      return;
    }

    if (state.route.name === "workspace-order") {
      await fetchWorkspace();
      return;
    }

    render();
  } catch (error) {
    handleError(error);
  }
}

function canAccessRoute(routeName) {
  if (routeName === "login" || routeName === "register" || routeName === "catalog" || routeName === "product") return true;
  if (!state.token) return false;

  const role = getRole();
  if (routeName === "profile" || routeName === "basket") return role === ROLE.CLIENT;
  if (routeName === "workspace") return role === ROLE.ADMIN || role === ROLE.SUPER_ADMIN;
  if (routeName === "workspace-order") return role === ROLE.ADMIN;

  return false;
}

function defaultAuthenticatedRoute() {
  const role = getRole();
  if (!state.token) return "/catalog";
  return role === ROLE.CLIENT ? "/catalog" : "/workspace";
}

function getPageTitle(routeName) {
  switch (routeName) {
    case "login":
      return "Вход | Yalla Farm Apteka";
    case "register":
      return "Регистрация | Yalla Farm Apteka";
    case "profile":
      return "Профиль | Yalla Farm Apteka";
    case "basket":
      return "Корзина | Yalla Farm Apteka";
    case "product":
      return "Карточка товара | Yalla Farm Apteka";
    case "workspace":
      return "Кабинет | Yalla Farm Apteka";
    case "workspace-order":
      return "Детали заказа | Yalla Farm Apteka";
    case "catalog":
    default:
      return "Каталог | Yalla Farm Apteka";
  }
}

async function handleSubmit(event) {
  const form = event.target.closest("form[data-form]");
  if (!form) return;

  event.preventDefault();
  const formData = new FormData(form);
  const formType = form.dataset.form;
  const role = getRole();

  if (role === ROLE.SUPER_ADMIN && (
    formType === "admin-update"
    || formType === "client-update"
    || formType === "client-delete"
    || formType === "pharmacy-create"
  )) {
    showNotice("Этот тип изменений недоступен в интерфейсе SuperAdmin.", "warning");
    return;
  }

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

    if (formType === "admin-medicine-search") {
      state.adminMedicineSearch = String(formData.get("query") || "").trim();
      await fetchWorkspace({ silent: true });
      return;
    }

    if (formType === "admin-order-filter") {
      state.adminOrderStatusFilter = String(formData.get("status") || "").trim();
      await fetchWorkspace();
      return;
    }

    if (formType === "superadmin-order-filter") {
      state.superAdminOrderStatusFilter = String(formData.get("status") || "").trim();
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

    if (formType === "basket-quantity") {
      const positionId = String(formData.get("positionId") || "").trim();
      const quantity = Math.max(1, Number(formData.get("quantity") || "1"));
      await updateBasketQuantity(positionId, quantity);
      return;
    }

    if (formType === "client-checkout") {
      await checkoutBasket(formData);
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

    if (formType === "admin-offer-upsert") {
      await upsertAdminOffer(formData);
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

    if (formType === "pharmacy-delete") {
      await deletePharmacy(formData);
      return;
    }

    if (formType === "client-update") {
      await updateClientAsSuperAdmin(formData);
      return;
    }

    if (formType === "client-delete") {
      await deleteClientAsSuperAdmin(formData);
      return;
    }

    if (formType === "order-reject") {
      await rejectOrderPositions(formData);
    }
  } catch (error) {
    handleError(error);
  }
}

function handleInput(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;

  if (target.dataset.liveSearch === "catalog") {
    state.pendingSearch = target.value.trim();
    window.clearTimeout(catalogLiveSearchTimer);
    catalogLiveSearchTimer = window.setTimeout(async () => {
      if (state.route.name !== "catalog") return;
      try {
        await fetchCatalog({ silent: true });
      } catch (error) {
        handleError(error);
      }
    }, LIVE_SEARCH_DEBOUNCE_MS);
    return;
  }

  if (target.dataset.liveSearch === "admin-medicine") {
    state.adminMedicineSearch = target.value.trim();
    window.clearTimeout(adminMedicineLiveSearchTimer);
    adminMedicineLiveSearchTimer = window.setTimeout(async () => {
      if (state.route.name !== "workspace" || getRole() !== ROLE.ADMIN) return;
      try {
        await fetchWorkspace({ silent: true });
      } catch (error) {
        handleError(error);
      }
    }, LIVE_SEARCH_DEBOUNCE_MS);
    return;
  }

  if (target.dataset.liveSearch === "superadmin-medicine") {
    state.superAdminSearch.medicine = target.value.trim();
    window.clearTimeout(superAdminMedicineLiveSearchTimer);
    superAdminMedicineLiveSearchTimer = window.setTimeout(async () => {
      if (state.route.name !== "workspace" || getRole() !== ROLE.SUPER_ADMIN) return;
      try {
        await fetchWorkspace({ silent: true });
      } catch (error) {
        handleError(error);
      }
    }, LIVE_SEARCH_DEBOUNCE_MS);
  }
}

async function handleClick(event) {
  const actionTarget = event.target.closest("[data-action]");
  if (!actionTarget) return;

  const action = actionTarget.dataset.action;

  try {
    if (action === "logout") {
      clearSession();
      setRoute("/login");
      return;
    }

    if (action === "go-catalog") {
      setRoute("/catalog");
      return;
    }

    if (action === "require-auth") {
      showNotice("Чтобы добавить товар в корзину, войдите или зарегистрируйтесь.", "warning");
      setRoute("/login");
      return;
    }

    if (action === "go-workspace") {
      if (state.route.name === "workspace-order" && getRole() === ROLE.ADMIN) {
        state.adminInterface = ADMIN_INTERFACE.ORDERS;
      }
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

    if (action === "client-order-toggle") {
      const orderId = String(actionTarget.dataset.orderId || "").trim();
      if (!orderId) return;

      if (state.expandedClientOrders.has(orderId)) {
        state.expandedClientOrders.delete(orderId);
        render();
        return;
      }

      state.expandedClientOrders.add(orderId);
      render();
      await ensureClientOrderDetails(orderId);
      return;
    }

    if (action === "admin-interface") {
      const nextInterface = String(actionTarget.dataset.interface || "").trim();
      if (Object.values(ADMIN_INTERFACE).includes(nextInterface)) {
        state.adminInterface = nextInterface;
        render();
      }
      return;
    }

    if (action === "admin-order-open") {
      const orderId = String(actionTarget.dataset.orderId || "").trim();
      if (!orderId) return;

      state.adminInterface = ADMIN_INTERFACE.ORDERS;
      setRoute(`/workspace/order/${orderId}`);
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

    if (action === "superadmin-interface") {
      const nextInterface = String(actionTarget.dataset.interface || "").trim();
      if (Object.values(SUPERADMIN_INTERFACE).includes(nextInterface)) {
        state.superAdminInterface = nextInterface;
        render();
      }
      return;
    }

    if (action === "superadmin-operations-interface") {
      const nextInterface = String(actionTarget.dataset.interface || "").trim();
      if (Object.values(SUPERADMIN_OPERATIONS_INTERFACE).includes(nextInterface)) {
        state.superAdminOperationsInterface = nextInterface;
        render();
      }
      return;
    }

    if (action === "superadmin-medicine-select") {
      const medicineId = String(actionTarget.dataset.medicineId || "").trim();
      if (!medicineId) return;

      state.superAdminSelectedMedicineId = medicineId;
      render();
      await ensureSuperAdminMedicineDetails(medicineId);
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

    if (action === "checkout-use-pharmacy") {
      const pharmacyId = String(actionTarget.dataset.pharmacyId || "").trim();
      if (!pharmacyId) return;

      state.checkoutDraft.pharmacyId = pharmacyId;
      showNotice("Аптека выбрана для оформления.", "success");
      render();
      return;
    }

    if (action === "client-order-cancel") {
      await cancelClientOrder(actionTarget.dataset.orderId);
      return;
    }

    if (action === "order-start") {
      const confirmed = window.confirm("Перевести заказ в статус UnderReview (сборка начинается)?");
      if (!confirmed) return;
      await performAdminOrderAction("/api/orders/assembly/start", actionTarget.dataset.orderId, "Сборка заказа запущена.");
      return;
    }

    if (action === "order-ready") {
      const confirmed = window.confirm("Перевести заказ в статус Ready (готов)?");
      if (!confirmed) return;
      await performAdminOrderAction("/api/orders/ready", actionTarget.dataset.orderId, "Заказ отмечен как готовый.");
      return;
    }

    if (action === "order-on-the-way") {
      const confirmed = window.confirm("Перевести заказ в статус OnTheWay (едет)?");
      if (!confirmed) return;
      await performAdminOrderAction("/api/orders/on-the-way", actionTarget.dataset.orderId, "Заказ отмечен как отправленный.");
      return;
    }

    if (action === "order-delivered") {
      const confirmed = window.confirm("Перевести выбранный заказ в статус Delivered?");
      if (!confirmed) return;
      await performSuperAdminOrderDelivered(actionTarget.dataset.orderId);
      return;
    }

    if (action === "refund-initiate") {
      await initiateRefund(actionTarget.dataset.refundRequestId);
      return;
    }

    if (action === "notice-close") {
      state.notice = null;
      render();
    }
  } catch (error) {
    handleError(error);
  }
}

function clearSession() {
  window.clearTimeout(catalogLiveSearchTimer);
  window.clearTimeout(adminMedicineLiveSearchTimer);
  window.clearTimeout(superAdminMedicineLiveSearchTimer);
  catalogFetchRequestId = 0;
  superAdminMedicineDetailsRequestId = 0;
  state.token = "";
  state.currentUser = null;
  state.identity = null;
  state.profile = null;
  state.clientOrderHistory = [];
  state.clientOrderDetailsCache = new Map();
  state.clientOrderDetailsLoading = new Set();
  state.expandedClientOrders = new Set();
  state.pharmacies = [];
  state.basket = null;
  state.workspace.admin = null;
  state.workspace.superAdmin = null;
  state.expandedAdminOrders = new Set();
  state.adminMedicineSearch = "";
  state.adminOrderStatusFilter = "";
  state.superAdminOrderStatusFilter = "";
  state.superAdminSearch.pharmacyAdmin = "";
  state.superAdminSearch.medicine = "";
  state.superAdminSearch.client = "";
  state.adminInterface = ADMIN_INTERFACE.PHARMACY;
  state.superAdminInterface = SUPERADMIN_INTERFACE.PHARMACY_ADMIN;
  state.superAdminOperationsInterface = SUPERADMIN_OPERATIONS_INTERFACE.ORDERS;
  state.superAdminSelectedMedicineId = "";
  state.superAdminMedicineDetailsLoading = false;
  state.checkoutDraft.pharmacyId = "";
  state.checkoutDraft.deliveryAddress = "";
  persistSession();
  showNotice("Сессия очищена.", "success");
  render();
}

async function login(formData) {
  const phoneNumber = normalizePhoneInputValue(formData.get("phoneNumber"));
  const password = String(formData.get("password") || "");
  const phoneError = validatePhoneNumberInput(phoneNumber, "Телефон для входа");
  if (phoneError) {
    showNotice(phoneError, "warning");
    return;
  }

  const passwordError = validatePasswordInput(password, "Пароль для входа");
  if (passwordError) {
    showNotice(passwordError, "warning");
    return;
  }

  const response = await withLoading("Входим в аккаунт...", () => apiFetch("/api/auth/login", {
    method: "POST",
    body: {
      phoneNumber,
      password
    },
    auth: false
  }));

  state.currentUser = response;
  state.token = response.accessToken || "";
  syncIdentityFromToken(response);
  persistSession();
  showNotice("Вход выполнен.", "success");
  setRoute(defaultAuthenticatedRoute());
}

async function register(formData) {
  const phoneNumber = normalizePhoneInputValue(formData.get("phoneNumber"));
  const password = String(formData.get("password") || "");
  const phoneError = validatePhoneNumberInput(phoneNumber, "Телефон");
  if (phoneError) {
    showNotice(phoneError, "warning");
    return;
  }

  const passwordError = validatePasswordInput(password, "Пароль");
  if (passwordError) {
    showNotice(passwordError, "warning");
    return;
  }

  await withLoading("Создаем аккаунт...", () => apiFetch("/api/clients/register", {
    method: "POST",
    body: {
      name: String(formData.get("name") || "").trim(),
      phoneNumber,
      password
    },
    auth: false
  }));

  showNotice("Аккаунт создан. Теперь можно войти.", "success");
  setRoute("/login");
}

async function updateClientProfile(formData) {
  const phoneNumber = normalizePhoneInputValue(formData.get("phoneNumber"));
  const phoneError = validatePhoneNumberInput(phoneNumber, "Телефон");
  if (phoneError) {
    showNotice(phoneError, "warning");
    return;
  }

  const payload = {
    name: String(formData.get("name") || "").trim(),
    phoneNumber
  };

  await withLoading("Сохраняем профиль...", () => apiFetch("/api/clients/me", {
    method: "PUT",
    body: payload
  }));

  if (state.currentUser) {
    state.currentUser = {
      ...state.currentUser,
      name: payload.name,
      phoneNumber: payload.phoneNumber
    };
    syncIdentityFromToken(state.currentUser);
    persistSession();
  }

  showNotice("Профиль обновлен.", "success");
  await fetchProfile();
}

async function updateAdminProfile(formData) {
  const phoneNumber = normalizePhoneInputValue(formData.get("phoneNumber"));
  const phoneError = validatePhoneNumberInput(phoneNumber, "Телефон");
  if (phoneError) {
    showNotice(phoneError, "warning");
    return;
  }

  const payload = {
    name: String(formData.get("name") || "").trim(),
    phoneNumber
  };

  await withLoading("Сохраняем профиль администратора...", () => apiFetch("/api/admins/me", {
    method: "PUT",
    body: payload
  }));

  if (state.identity) {
    state.identity = {
      ...state.identity,
      name: payload.name,
      phoneNumber: payload.phoneNumber
    };
  }

  if (state.currentUser) {
    state.currentUser = {
      ...state.currentUser,
      name: payload.name,
      phoneNumber: payload.phoneNumber
    };
  }

  persistSession();
  showNotice("Профиль администратора обновлен.", "success");
  await fetchWorkspace();
}

async function changePassword(formData) {
  const currentPassword = String(formData.get("currentPassword") || "");
  const newPassword = String(formData.get("newPassword") || "");
  if (!currentPassword.trim()) {
    showNotice("Текущий пароль обязателен.", "warning");
    return;
  }

  const newPasswordError = validatePasswordInput(newPassword, "Новый пароль");
  if (newPasswordError) {
    showNotice(newPasswordError, "warning");
    return;
  }

  await withLoading("Обновляем пароль...", () => apiFetch("/api/auth/change-password", {
    method: "POST",
    body: {
      currentPassword,
      newPassword
    }
  }));

  showNotice("Пароль изменен.", "success");
  render();
}

async function addToBasket(formData) {
  if (!state.token) {
    showNotice("Чтобы добавить товар в корзину, войдите или зарегистрируйтесь.", "warning");
    setRoute("/login");
    return;
  }

  if (getRole() !== ROLE.CLIENT) {
    showNotice("Корзина доступна только клиенту.", "warning");
    return;
  }

  await withLoading("Добавляем товар в корзину...", () => apiFetch("/api/basket/items", {
    method: "POST",
    body: {
      medicineId: String(formData.get("medicineId") || "").trim(),
      quantity: Math.max(1, Number(formData.get("quantity") || "1"))
    }
  }));

  showNotice("Товар добавлен в корзину.", "success");
  await fetchBasket({ silent: true });
}

async function removeFromBasket(positionId) {
  if (!positionId) return;

  await withLoading("Удаляем товар из корзины...", () => apiFetch("/api/basket/items", {
    method: "DELETE",
    body: { positionId }
  }));

  showNotice("Товар удален из корзины.", "success");
  await fetchBasket();
}

async function clearBasket() {
  await withLoading("Очищаем корзину...", () => apiFetch("/api/basket", {
    method: "DELETE",
    body: {}
  }));

  showNotice("Корзина очищена.", "success");
  await fetchBasket();
}

async function updateBasketQuantity(positionId, quantity) {
  await withLoading("Обновляем количество...", () => apiFetch("/api/basket/items/quantity", {
    method: "PATCH",
    body: {
      positionId,
      quantity
    }
  }));

  showNotice("Количество обновлено.", "success");
  await fetchBasket();
}

async function checkoutBasket(formData) {
  if (getRole() !== ROLE.CLIENT) {
    showNotice("Оформление заказа доступно только клиенту.", "warning");
    return;
  }

  const pharmacyId = String(formData.get("pharmacyId") || "").trim();
  const deliveryAddress = String(formData.get("deliveryAddress") || "").trim();

  if (!pharmacyId) {
    showNotice("Выберите аптеку для оформления заказа.", "warning");
    return;
  }

  if (!deliveryAddress) {
    showNotice("Укажите адрес доставки.", "warning");
    return;
  }

  state.checkoutDraft.pharmacyId = pharmacyId;
  state.checkoutDraft.deliveryAddress = deliveryAddress;

  const idempotencyKey = createCheckoutIdempotencyKey();
  const checkoutPayload = {
    pharmacyId,
    deliveryAddress,
    idempotencyKey,
    ignoredPositionIds: []
  };

  const preview = await withLoading("Проверяем заказ перед оформлением...", () => apiFetch("/api/clients/checkout/preview", {
    method: "POST",
    body: checkoutPayload
  }));

  if (!preview.canCheckout) {
    showNotice(formatCheckoutPreviewMessage(preview), "warning");
    await fetchBasket({ silent: true });
    return;
  }

  const checkoutResponse = await withLoading("Оформляем заказ...", () => apiFetch("/api/clients/checkout", {
    method: "POST",
    body: checkoutPayload
  }));

  state.checkoutDraft.pharmacyId = "";
  state.checkoutDraft.deliveryAddress = "";

  const shortOrderId = String(checkoutResponse.orderId || "").slice(0, 8);
  showNotice(
    `Заказ ${shortOrderId} оформлен. Сумма: ${formatMoney(checkoutResponse.cost)}.`,
    "success"
  );

  await Promise.all([
    fetchBasket({ silent: true }),
    fetchProfile({ silent: true })
  ]);

  setRoute("/profile");
}

function createCheckoutIdempotencyKey() {
  if (window.crypto?.randomUUID) {
    return `checkout-${window.crypto.randomUUID()}`;
  }

  return `checkout-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatCheckoutPreviewMessage(preview) {
  if (!preview || Number(preview.totalPositions || 0) === 0) {
    return "Корзина пуста. Добавьте товары перед оформлением.";
  }

  const rejected = Array.isArray(preview.positions)
    ? preview.positions.find(item => item.isRejected && item.reason !== "IgnoredByClient")
    : null;

  if (!rejected) {
    return "Оформление сейчас недоступно. Проверьте корзину и наличие.";
  }

  return `Оформление недоступно: ${formatCheckoutRejectReason(rejected.reason)}.`;
}

function formatCheckoutRejectReason(reason) {
  const labels = {
    MedicineInactive: "один из товаров неактивен",
    OfferNotFound: "в выбранной аптеке нет предложения по одному из товаров",
    InsufficientStock: "не хватает количества по одному из товаров",
    IgnoredByClient: "часть позиций исключена клиентом"
  };

  return labels[reason] || "есть ограничение по текущему составу корзины";
}

async function cancelClientOrder(orderId) {
  const normalizedOrderId = String(orderId || "").trim();
  if (!normalizedOrderId) return;

  const confirmed = window.confirm("Отменить этот заказ? Для него будет создан запрос на возврат.");
  if (!confirmed) return;

  const response = await withLoading("Отменяем заказ...", () => apiFetch("/api/orders/cancel", {
    method: "POST",
    body: {
      orderId: normalizedOrderId
    }
  }));

  const refundStubId = String(response?.refundRequest?.refundRequestId || "").slice(0, 8);
  showNotice(
    refundStubId
      ? `Заказ отменен. Создан запрос на возврат ${refundStubId}.`
      : "Заказ отменен.",
    "success"
  );

  await Promise.all([
    fetchProfile({ silent: true }),
    fetchBasket({ silent: true })
  ]);
}

async function updatePharmacy(formData) {
  const role = getRole();
  const identity = getIdentity();
  const currentPharmacy = state.workspace.admin?.pharmacy || state.workspace.superAdmin?.pharmacies?.find(item => item.id === String(formData.get("pharmacyId") || ""));

  const payload = {
    pharmacyId: role === ROLE.ADMIN
      ? identity?.pharmacyId || ""
      : String(formData.get("pharmacyId") || "").trim(),
    title: String(formData.get("title") || "").trim(),
    address: String(formData.get("address") || "").trim(),
    adminId: role === ROLE.ADMIN
      ? identity?.userId || ""
      : String(formData.get("adminId") || "").trim(),
    isActive: formData.get("isActive") !== null
  };

  if (role === ROLE.ADMIN && currentPharmacy && payload.title === "") {
    payload.title = currentPharmacy.title || "";
    payload.address = currentPharmacy.address || "";
  }

  await withLoading("Сохраняем аптеку...", () => apiFetch("/api/pharmacies", {
    method: "PUT",
    body: payload
  }));

  showNotice("Данные аптеки обновлены.", "success");
  await fetchWorkspace();
}

async function upsertAdminOffer(formData) {
  const medicineId = String(formData.get("medicineId") || "").trim();
  const stockQuantity = Number(formData.get("stockQuantity"));
  const price = Number(formData.get("price"));

  await withLoading("Сохраняем offer...", () => apiFetch("/api/offers", {
    method: "POST",
    body: {
      medicineId,
      stockQuantity: Number.isFinite(stockQuantity) ? stockQuantity : 0,
      price: Number.isFinite(price) ? price : 0
    }
  }));

  showNotice("Offer сохранен для вашей аптеки.", "success");
  await fetchWorkspace();
}

async function createMedicine(formData) {
  await withLoading("Создаем товар...", () => apiFetch("/api/medicines", {
    method: "POST",
    body: {
      title: String(formData.get("title") || "").trim(),
      articul: String(formData.get("articul") || "").trim(),
      atributes: parseAttributesInput(formData.get("attributes"))
    }
  }));

  showNotice("Товар создан.", "success");
  await fetchWorkspaceOrCatalog();
}

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
  const phoneNumber = normalizePhoneInputValue(formData.get("phoneNumber"));
  const password = String(formData.get("password") || "");
  const phoneError = validatePhoneNumberInput(phoneNumber, "Телефон администратора");
  if (phoneError) {
    showNotice(phoneError, "warning");
    return;
  }

  const passwordError = validatePasswordInput(password, "Пароль администратора");
  if (passwordError) {
    showNotice(passwordError, "warning");
    return;
  }

  await withLoading("Создаем администратора...", () => apiFetch("/api/admins/register", {
    method: "POST",
    body: {
      name: String(formData.get("name") || "").trim(),
      phoneNumber,
      password,
      pharmacyId: String(formData.get("pharmacyId") || "").trim()
    }
  }));

  showNotice("Администратор создан.", "success");
  await fetchWorkspace();
}

async function createAdminWithPharmacy(formData) {
  const adminPhoneNumber = normalizePhoneInputValue(formData.get("adminPhoneNumber"));
  const adminPassword = String(formData.get("adminPassword") || "");
  const phoneError = validatePhoneNumberInput(adminPhoneNumber, "Телефон администратора");
  if (phoneError) {
    showNotice(phoneError, "warning");
    return;
  }

  const passwordError = validatePasswordInput(adminPassword, "Пароль администратора");
  if (passwordError) {
    showNotice(passwordError, "warning");
    return;
  }

  await withLoading("Создаем администратора и аптеку...", () => apiFetch("/api/admins/register-with-pharmacy", {
    method: "POST",
    body: {
      adminName: String(formData.get("adminName") || "").trim(),
      adminPhoneNumber,
      adminPassword,
      pharmacyTitle: String(formData.get("pharmacyTitle") || "").trim(),
      pharmacyAddress: String(formData.get("pharmacyAddress") || "").trim()
    }
  }));

  showNotice("Администратор и аптека созданы.", "success");
  await fetchWorkspace();
}

async function updateAdmin(formData) {
  const adminId = String(formData.get("adminId") || "").trim();
  const phoneNumber = normalizePhoneInputValue(formData.get("phoneNumber"));
  const phoneError = validatePhoneNumberInput(phoneNumber, "Телефон администратора");
  if (phoneError) {
    showNotice(phoneError, "warning");
    return;
  }

  await withLoading("Обновляем администратора...", () => apiFetch(`/api/admins/${adminId}`, {
    method: "PUT",
    body: {
      name: String(formData.get("name") || "").trim(),
      phoneNumber
    }
  }));

  showNotice("Администратор обновлен.", "success");
  await fetchWorkspace();
}

async function deleteAdmin(formData) {
  await withLoading("Удаляем администратора...", () => apiFetch("/api/admins", {
    method: "DELETE",
    body: {
      pharmacyWorkerId: String(formData.get("pharmacyWorkerId") || "").trim()
    }
  }));

  showNotice("Администратор удален.", "success");
  await fetchWorkspace();
}

async function createPharmacy(formData) {
  await withLoading("Создаем аптеку...", () => apiFetch("/api/pharmacies", {
    method: "POST",
    body: {
      title: String(formData.get("title") || "").trim(),
      address: String(formData.get("address") || "").trim(),
      adminId: String(formData.get("adminId") || "").trim()
    }
  }));

  showNotice("Аптека создана.", "success");
  await fetchWorkspace();
}

async function deletePharmacy(formData) {
  await withLoading("Удаляем аптеку...", () => apiFetch("/api/pharmacies", {
    method: "DELETE",
    body: {
      pharmacyId: String(formData.get("pharmacyId") || "").trim()
    }
  }));

  showNotice("Аптека удалена.", "success");
  await fetchWorkspace();
}

async function updateClientAsSuperAdmin(formData) {
  const phoneNumber = normalizePhoneInputValue(formData.get("phoneNumber"));
  const phoneError = validatePhoneNumberInput(phoneNumber, "Телефон клиента");
  if (phoneError) {
    showNotice(phoneError, "warning");
    return;
  }

  await withLoading("Обновляем клиента...", () => apiFetch("/api/clients", {
    method: "PUT",
    body: {
      clientId: String(formData.get("clientId") || "").trim(),
      name: String(formData.get("name") || "").trim(),
      phoneNumber
    }
  }));

  showNotice("Данные клиента обновлены.", "success");
  await fetchWorkspace();
}

async function deleteClientAsSuperAdmin(formData) {
  const clientId = String(formData.get("clientId") || "").trim();
  const confirmed = window.confirm("Удалить клиента? Это действие нельзя отменить.");
  if (!confirmed) return;

  await withLoading("Удаляем клиента...", () => apiFetch("/api/clients", {
    method: "DELETE",
    body: {
      clientId
    }
  }));

  showNotice("Клиент удален.", "success");
  await fetchWorkspace();
}

async function performAdminOrderAction(endpoint, orderId, successMessage) {
  await withLoading("Обновляем заказ...", () => apiFetch(endpoint, {
    method: "POST",
    body: {
      orderId
    }
  }));

  showNotice(successMessage, "success");
  await fetchWorkspace();
}

async function performSuperAdminOrderDelivered(orderId) {
  await withLoading("Отмечаем заказ доставленным...", () => apiFetch("/api/orders/delivered", {
    method: "POST",
    body: {
      orderId
    }
  }));

  showNotice("Заказ отмечен как доставленный.", "success");
  await fetchWorkspace();
}

async function rejectOrderPositions(formData) {
  const selectedIds = formData
    .getAll("positionIds")
    .map(item => String(item || "").trim())
    .filter(Boolean);
  const rawIds = String(formData.get("positionIds") || "");
  const fallbackIds = rawIds
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
  const positionIds = selectedIds.length ? selectedIds : fallbackIds;
  if (!positionIds.length) {
    showNotice("Выберите хотя бы одну позицию для отклонения.", "warning");
    return;
  }

  await withLoading("Отклоняем позиции...", () => apiFetch("/api/orders/positions/reject", {
    method: "POST",
    body: {
      orderId: String(formData.get("orderId") || "").trim(),
      positionIds
    }
  }));

  showNotice("Позиции заказа отклонены.", "success");
  await fetchWorkspace();
}

async function initiateRefund(refundRequestId) {
  await withLoading("Запускаем возврат...", () => apiFetch("/api/refund-requests/initiate", {
    method: "POST",
    body: {
      refundRequestId
    }
  }));

  showNotice("Возврат инициирован.", "success");
  await fetchWorkspace();
}

async function refreshCurrentRoute() {
  if (state.route.name === "catalog") {
    await fetchCatalog();
    return;
  }

  if (state.route.name === "product" && state.route.medicineId) {
    await fetchProduct(state.route.medicineId);
    return;
  }

  if (state.route.name === "profile") {
    await fetchProfile();
    return;
  }

  if (state.route.name === "basket") {
    await fetchBasket();
    return;
  }

  if (state.route.name === "workspace") {
    await fetchWorkspace();
    return;
  }

  if (state.route.name === "workspace-order") {
    await fetchWorkspace();
    return;
  }

  render();
}

async function fetchWorkspaceOrCatalog() {
  if (state.route.name === "workspace") {
    await fetchWorkspace();
    return;
  }

  await fetchCatalog();
}

async function fetchCatalog(options = {}) {
  const requestId = ++catalogFetchRequestId;
  const query = state.pendingSearch.trim();
  const response = await withLoading(options.silent ? "" : "Загружаем каталог...", async () => {
    if (query) {
      return apiFetch("/api/medicines/search", {
        method: "POST",
        body: {
          query,
          limit: 24
        }
      });
    }

    return apiFetch("/api/medicines?page=1&pageSize=24");
  }, {
    silent: Boolean(options.silent)
  });

  if (requestId !== catalogFetchRequestId) return;
  if (state.route.name !== "catalog") return;

  const medicines = response.medicines || [];
  medicines.forEach(rememberMedicine);
  state.catalogItems = medicines;
  state.catalogMeta = {
    mode: query ? "search" : "catalog",
    totalCount: Number(response.totalCount ?? medicines.length),
    page: Number(response.page ?? 1),
    pageSize: Number(response.pageSize ?? medicines.length ?? 24),
    query
  };

  render();
}

async function fetchProduct(medicineId) {
  const response = await withLoading("Открываем карточку товара...", () => apiFetch(`/api/medicines/${medicineId}`));
  state.selectedProduct = response.medicine || null;
  rememberMedicine(state.selectedProduct);
  render();
}

async function fetchProfile(options = {}) {
  const [profileResponse, historyResponse, pharmaciesResponse] = await withLoading(options.silent ? "" : "Загружаем профиль...", () => Promise.all([
    apiFetch("/api/clients/me"),
    apiFetch("/api/orders/client-history"),
    apiFetch("/api/pharmacies")
  ]), {
    silent: Boolean(options.silent)
  });

  state.profile = profileResponse.client || null;
  state.clientOrderHistory = historyResponse.orders || [];
  state.pharmacies = pharmaciesResponse.pharmacies || [];
  const knownOrderIds = new Set(state.clientOrderHistory.map(order => String(order.orderId)));
  state.clientOrderDetailsCache = new Map(
    [...state.clientOrderDetailsCache.entries()].filter(([orderId]) => knownOrderIds.has(orderId))
  );
  state.clientOrderDetailsLoading = new Set(
    [...state.clientOrderDetailsLoading].filter(orderId => knownOrderIds.has(orderId))
  );
  state.expandedClientOrders = new Set(
    [...state.expandedClientOrders].filter(orderId => knownOrderIds.has(orderId))
  );

  await hydrateMedicineDetails((state.profile?.basketPositions || []).map(item => item.medicineId));
  render();
}

async function ensureClientOrderDetails(orderId) {
  const normalizedOrderId = String(orderId || "").trim();
  if (!normalizedOrderId) return;
  if (state.clientOrderDetailsCache.has(normalizedOrderId)) return;
  if (state.clientOrderDetailsLoading.has(normalizedOrderId)) return;

  state.clientOrderDetailsLoading.add(normalizedOrderId);
  render();

  try {
    const response = await apiFetch(`/api/orders/${normalizedOrderId}`);
    state.clientOrderDetailsCache.set(normalizedOrderId, response);
    const medicineIds = (response?.positions || []).map(item => item.medicineId);
    await hydrateMedicineDetails(medicineIds);
  } finally {
    state.clientOrderDetailsLoading.delete(normalizedOrderId);
    render();
  }
}

async function fetchBasket(options = {}) {
  const response = await withLoading(options.silent ? "" : "Загружаем корзину...", () => apiFetch("/api/basket"), {
    silent: Boolean(options.silent)
  });

  state.basket = response;
  await hydrateMedicineDetails((state.basket?.basketPositions || []).map(item => item.medicineId));
  render();
}

async function fetchWorkspace(options = {}) {
  const role = getRole();
  if (role === ROLE.ADMIN) {
    await fetchAdminWorkspace(options);
    return;
  }

  if (role === ROLE.SUPER_ADMIN) {
    await fetchSuperAdminWorkspace(options);
    return;
  }

  render();
}

async function fetchAdminWorkspace(options = {}) {
  const identity = getIdentity();
  const orderQuery = new URLSearchParams({
    page: "1",
    pageSize: "120"
  });
  const medicineQuery = state.adminMedicineSearch.trim();
  const medicinesFetch = medicineQuery
    ? apiFetch("/api/medicines/search", {
      method: "POST",
      body: {
        query: medicineQuery,
        limit: 80
      }
    })
    : apiFetch("/api/medicines?page=1&pageSize=80");

  const [pharmaciesResponse, ordersResponse, medicinesResponse] = await withLoading(options.silent ? "" : "Загружаем кабинет администратора...", () => Promise.all([
    apiFetch("/api/pharmacies"),
    apiFetch(`/api/orders/admin/history?${orderQuery.toString()}`),
    medicinesFetch
  ]), {
    silent: Boolean(options.silent)
  });

  const orders = ordersResponse.orders || [];
  orders.forEach(order => {
    (order.positions || []).forEach(position => rememberMedicine(position.medicine));
  });

  const medicines = medicinesResponse.medicines || [];
  medicines.forEach(rememberMedicine);
  const knownOrderIds = new Set(orders.map(order => String(order.orderId)));
  state.expandedAdminOrders = new Set(
    [...state.expandedAdminOrders].filter(orderId => knownOrderIds.has(orderId))
  );

  state.workspace.admin = {
    pharmacyId: identity?.pharmacyId || "",
    pharmacy: (pharmaciesResponse.pharmacies || []).find(item => item.id === identity?.pharmacyId) || null,
    pharmacies: pharmaciesResponse.pharmacies || [],
    medicineList: medicines,
    orders,
    totalOrders: ordersResponse.totalCount || orders.length,
    workerId: ordersResponse.workerId || identity?.userId || ""
  };

  render();
}

async function fetchSuperAdminWorkspace(options = {}) {
  const pharmacyAdminQuery = state.superAdminSearch.pharmacyAdmin.trim();
  const medicineQuery = state.superAdminSearch.medicine.trim();
  const clientQuery = state.superAdminSearch.client.trim();

  const adminsParams = new URLSearchParams({ page: "1", pageSize: "50" });
  const pharmaciesParams = new URLSearchParams({ page: "1", pageSize: "50" });
  const ordersParams = new URLSearchParams({ page: "1", pageSize: "20" });
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

  if (state.superAdminOrderStatusFilter) {
    ordersParams.set("status", state.superAdminOrderStatusFilter);
  }

  const [adminsResponse, pharmaciesResponse, ordersResponse, refundsResponse, catalogResponse, clientsResponse] = await withLoading(
    options.silent ? "" : "Загружаем кабинет супер-админа...",
    () => Promise.all([
      apiFetch(`/api/admins?${adminsParams.toString()}`),
      apiFetch(`/api/pharmacies/all?${pharmaciesParams.toString()}`),
      apiFetch(`/api/orders/all?${ordersParams.toString()}`),
      apiFetch("/api/refund-requests?page=1&pageSize=20"),
      apiFetch(`/api/medicines/all?${medicinesParams.toString()}`),
      apiFetch(`/api/clients?${clientsParams.toString()}`)
    ]),
    {
      silent: Boolean(options.silent)
    }
  );

  const medicines = catalogResponse.medicines || [];
  medicines.forEach(rememberMedicine);
  const knownMedicineIds = new Set(medicines.map(item => String(item.id || "")));
  if (!knownMedicineIds.has(state.superAdminSelectedMedicineId)) {
    state.superAdminSelectedMedicineId = medicines.length
      ? String(medicines[0].id || "")
      : "";
  }

  const orders = ordersResponse.orders || [];
  orders.forEach(order => {
    (order.positions || []).forEach(position => rememberMedicine(position.medicine));
  });

  state.workspace.superAdmin = {
    admins: adminsResponse.admins || [],
    pharmacies: pharmaciesResponse.pharmacies || [],
    orders,
    totalOrders: Number(ordersResponse.totalCount ?? orders.length),
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

  if (state.superAdminSelectedMedicineId) {
    await ensureSuperAdminMedicineDetails(state.superAdminSelectedMedicineId);
    return;
  }

  state.superAdminMedicineDetailsLoading = false;
  render();
}

async function ensureSuperAdminMedicineDetails(medicineId) {
  const normalizedMedicineId = String(medicineId || "").trim();
  if (!normalizedMedicineId) return;

  const cached = state.medicineCache.get(normalizedMedicineId);
  const hasDetails = Boolean(cached)
    && Object.prototype.hasOwnProperty.call(cached, "atributes")
    && Object.prototype.hasOwnProperty.call(cached, "offers");
  if (hasDetails) {
    if (state.superAdminMedicineDetailsLoading) {
      state.superAdminMedicineDetailsLoading = false;
      render();
    }

    return;
  }

  const requestId = ++superAdminMedicineDetailsRequestId;
  state.superAdminMedicineDetailsLoading = true;
  render();

  try {
    const response = await apiFetch(`/api/medicines/${normalizedMedicineId}`);
    rememberMedicine(response.medicine);
  } catch {
    if (!state.medicineCache.has(normalizedMedicineId)) {
      state.medicineCache.set(normalizedMedicineId, {
        id: normalizedMedicineId,
        title: "Товар недоступен",
        articul: normalizedMedicineId.slice(0, 8),
        images: [],
        atributes: [],
        offers: []
      });
    }
  } finally {
    if (requestId === superAdminMedicineDetailsRequestId) {
      state.superAdminMedicineDetailsLoading = false;
      render();
    }
  }
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
    }
  }));
}

function rememberMedicine(medicine) {
  if (!medicine?.id) return;
  const cached = state.medicineCache.get(medicine.id) || {};
  state.medicineCache.set(medicine.id, {
    ...cached,
    ...medicine
  });
}

async function apiFetch(path, options = {}) {
  const method = options.method || "GET";
  const headers = new Headers(options.headers || {});
  const hasBody = options.body !== undefined;

  if (!(options.body instanceof FormData) && hasBody) {
    headers.set("Content-Type", "application/json");
  }

  if (options.auth !== false && state.token) {
    headers.set("Authorization", `Bearer ${state.token}`);
  }

  const response = await fetch(`${state.baseUrl}${path}`, {
    method,
    headers,
    body: hasBody ? (options.body instanceof FormData ? options.body : JSON.stringify(options.body)) : undefined
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const error = new Error(extractErrorMessage(payload) || `${response.status} ${response.statusText}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

function extractErrorMessage(payload) {
  if (!payload) return "";
  if (typeof payload === "string") return payload;
  if (typeof payload.message === "string" && payload.message) return payload.message;
  if (typeof payload.title === "string" && payload.title) return payload.title;
  if (payload.errors && typeof payload.errors === "object") {
    const firstKey = Object.keys(payload.errors)[0];
    if (firstKey && Array.isArray(payload.errors[firstKey]) && payload.errors[firstKey][0]) {
      return payload.errors[firstKey][0];
    }
  }
  return "";
}

async function withLoading(label, action, options = {}) {
  if (!options.silent) {
    state.loading = true;
    state.loadingLabel = label || "Подождите...";
    render();
  }

  try {
    return await action();
  } finally {
    if (!options.silent) {
      state.loading = false;
      state.loadingLabel = "";
      render();
    }
  }
}

function handleError(error) {
  const status = Number(error?.status || 0);
  if (status === 401) {
    clearSession();
    showNotice("Сессия истекла. Выполните вход заново.", "warning");
    setRoute("/login");
    return;
  }

  showNotice(error?.message || "Произошла ошибка.", "danger");
  render();
}

function showNotice(message, tone = "success") {
  state.notice = {
    message,
    tone
  };
  render();
}

function syncIdentityFromToken(fallback = state.currentUser) {
  if (!state.token) {
    state.identity = null;
    return;
  }

  const claims = parseJwtClaims(state.token);
  state.identity = {
    userId: claims.userId || fallback?.userId || "",
    name: claims.name || fallback?.name || "Авторизован",
    phoneNumber: claims.phoneNumber || fallback?.phoneNumber || "",
    role: normalizeRole(claims.role ?? fallback?.role),
    pharmacyId: claims.pharmacyId || ""
  };
}

function parseJwtClaims(token) {
  try {
    const payload = JSON.parse(decodeBase64Url(token.split(".")[1] || ""));
    return {
      userId: payload.sub || payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"] || "",
      name: payload.name || payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"] || "",
      phoneNumber: payload.phone_number || payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/mobilephone"] || "",
      role: payload.role || payload["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] || "",
      pharmacyId: payload.pharmacy_id || ""
    };
  } catch {
    return {
      userId: "",
      name: "",
      phoneNumber: "",
      role: "",
      pharmacyId: ""
    };
  }
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  return atob(padded);
}

function normalizeRole(value) {
  if (value === ROLE.CLIENT || value === 0 || value === "0") return ROLE.CLIENT;
  if (value === ROLE.ADMIN || value === 1 || value === "1") return ROLE.ADMIN;
  if (value === ROLE.SUPER_ADMIN || value === 2 || value === "2") return ROLE.SUPER_ADMIN;
  return ROLE.CLIENT;
}

function getIdentity() {
  if (!state.identity && state.token) {
    syncIdentityFromToken();
  }
  return state.identity;
}

function getRole() {
  return getIdentity()?.role || ROLE.CLIENT;
}

function parseAttributesInput(value) {
  return String(value || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => {
      const [name, option] = item.split(":").map(part => part.trim());
      return {
        name: name || "attribute",
        option: option || name || ""
      };
    });
}

function render() {
  const role = getRole();
  const roleThemeClass = getRoleThemeClass(role);
  const interfaceLabel = getInterfaceLabel(role);

  app.innerHTML = `
    <div class="page-shell ${escapeHtml(roleThemeClass)}">
      <div class="ambient ambient-a"></div>
      <div class="ambient ambient-b"></div>

      <header class="site-header">
        <a class="brand" href="#${state.token ? defaultAuthenticatedRoute() : "/catalog"}">
          <span class="brand-mark">YF</span>
          <span class="brand-copy">
            <strong>Yalla Farm Apteka</strong>
            <span>Онлайн-каталог, корзина и роли Admin/SuperAdmin</span>
          </span>
          <span class="interface-chip">${escapeHtml(interfaceLabel)}</span>
        </a>

        <nav class="main-nav">
          ${state.token ? renderAuthenticatedNav(role) : `
            ${renderNavLink("/catalog", "Каталог", state.route.name === "catalog" || state.route.name === "product")}
            ${renderNavLink("/login", "Войти", state.route.name === "login")}
            ${renderNavLink("/register", "Регистрация", state.route.name === "register")}
          `}
          ${state.token ? `<button class="nav-link ghost" type="button" data-action="logout">Выйти</button>` : ""}
        </nav>
      </header>

      ${renderNotice()}

      <main class="view-area">
        ${renderCurrentView()}
      </main>

      ${state.loading ? `
        <div class="loading-scrim" aria-live="polite">
          <div class="loading-card">
            <div class="spinner"></div>
            <p>${escapeHtml(state.loadingLabel || "Подождите...")}</p>
          </div>
        </div>
      ` : ""}
    </div>
  `;
}

function renderAuthenticatedNav(role) {
  if (role === ROLE.CLIENT) {
    return `
      ${renderNavLink("/catalog", "Каталог", state.route.name === "catalog" || state.route.name === "product")}
      ${renderNavLink("/profile", "Профиль", state.route.name === "profile")}
      ${renderNavLink("/basket", `Корзина${basketBadge()}`, state.route.name === "basket")}
    `;
  }

  return `
    ${renderNavLink("/workspace", "Кабинет", state.route.name === "workspace" || state.route.name === "workspace-order")}
    ${renderNavLink("/catalog", "Каталог", state.route.name === "catalog" || state.route.name === "product")}
  `;
}

function renderCurrentView() {
  switch (state.route.name) {
    case "login":
      return renderLoginView();
    case "register":
      return renderRegisterView();
    case "profile":
      return renderProfileView();
    case "basket":
      return renderBasketView();
    case "product":
      return renderProductView();
    case "workspace":
      return renderWorkspaceView();
    case "workspace-order":
      return renderAdminOrderDetailView();
    case "catalog":
    default:
      return renderCatalogView();
  }
}

function renderLoginView() {
  return `
    <section class="view-area" style="align-items: center; justify-content: center; min-height: 80vh;">
      <article class="panel auth-layout" style="max-width: 900px; padding: 0; overflow: hidden;">
        <div style="padding: 3rem; display: flex; flex-direction: column; justify-content: center; background-color: var(--primary-soft);">
           <p class="eyebrow">Вход в систему</p>
           <h2 style="font-size: 2.5rem; line-height: 1.1; margin-bottom: 1.5rem;">Добро пожаловать в Yalla Farm</h2>
           <p class="muted">Войдите, чтобы получить доступ к каталогу лекарств, вашей корзине и истории заказов.</p>
        </div>
        <div style="padding: 3rem;">
          <form class="stack-form" data-form="login">
            <label>
              Номер телефона
              ${renderPhoneField({ name: "phoneNumber", autocomplete: "username", placeholder: "900000001" })}
            </label>
            <label style="margin-top: 1rem;">
              Пароль
              <input
                name="password"
                type="password"
                autocomplete="current-password"
                minlength="${PASSWORD_MIN_LENGTH}"
                pattern="[A-Za-z0-9!@#$%^&*()\\-_=.,?]+"
                placeholder="минимум 8 символов"
                required>
            </label>
            <button class="btn btn-primary" type="submit" style="width: 100%; margin-top: 1.5rem;">Войти</button>
          </form>
          <p class="muted" style="margin-top: 1.5rem; text-align: center;">
            Нет аккаунта? <a href="#/register" style="color: var(--primary); font-weight: 600;">Зарегистрироваться</a>
          </p>
        </div>
      </article>
    </section>
  `;
}

function renderRegisterView() {
  return `
    <section class="view-area" style="align-items: center; justify-content: center; min-height: 80vh;">
      <article class="panel auth-layout" style="max-width: 900px; padding: 0; overflow: hidden;">
        <div style="padding: 3rem; display: flex; flex-direction: column; justify-content: center; background-color: var(--primary-soft);">
           <p class="eyebrow">Регистрация</p>
           <h2 style="font-size: 2.5rem; line-height: 1.1; margin-bottom: 1.5rem;">Создайте аккаунт для покупок</h2>
           <p class="muted">Присоединяйтесь к нашей сети аптек и заказывайте лекарства онлайн с доставкой или самовывозом.</p>
        </div>
        <div style="padding: 3rem;">
          <form class="stack-form" data-form="register">
            <label>
              Ваше имя
              <input name="name" type="text" placeholder="Иван Иванов" required>
            </label>
            <label style="margin-top: 1rem;">
              Номер телефона
              ${renderPhoneField({ name: "phoneNumber", autocomplete: "tel", placeholder: "900000001" })}
            </label>
            <label style="margin-top: 1rem;">
              Пароль
              <input
                name="password"
                type="password"
                autocomplete="new-password"
                minlength="${PASSWORD_MIN_LENGTH}"
                pattern="[A-Za-z0-9!@#$%^&*()\\-_=.,?]+"
                placeholder="минимум 8 символов"
                required>
            </label>
            <button class="btn btn-primary" type="submit" style="width: 100%; margin-top: 1.5rem;">Создать аккаунт</button>
          </form>
          <p class="muted" style="margin-top: 1.5rem; text-align: center;">
            Уже есть аккаунт? <a href="#/login" style="color: var(--primary); font-weight: 600;">Войти</a>
          </p>
        </div>
      </article>
    </section>
  `;
}

function renderCatalogView() {
  const items = state.catalogItems || [];
  const role = getRole();
  const isGuest = !state.token;
  const isClient = !isGuest && role === ROLE.CLIENT;
  const emptyMessage = state.catalogMeta.query
    ? "По вашему запросу товаров нет."
    : "Товаров нет.";
  const totalItemsLabel = String(state.catalogMeta.totalCount || items.length);

  const sidePanel = isGuest
    ? `
      <aside class="catalog-side">
        <article class="panel catalog-side-card">
          <p class="eyebrow">Гостевой режим</p>
          <h3>Каталог открыт без авторизации</h3>
          <p class="muted">Смотрите лекарства и карточки товаров. Чтобы собрать заказ, войдите в аккаунт.</p>
          <div class="hero-actions">
            <a class="btn btn-primary" href="#/login">Войти</a>
            <a class="btn btn-secondary" href="#/register">Регистрация</a>
          </div>
        </article>

        <article class="panel catalog-side-card">
          <h3>Как начать покупку</h3>
          <ol class="catalog-side-steps">
            <li>Выберите товар в сетке</li>
            <li>Откройте полную карточку</li>
            <li>Войдите и добавьте в корзину</li>
          </ol>
        </article>
      </aside>
    `
    : isClient
      ? `
        <aside class="catalog-side">
          <article class="panel catalog-side-card">
            <h3>Мой аккаунт</h3>
            <div class="catalog-side-identity">
              <strong>${escapeHtml(getIdentity()?.name || "Клиент")}</strong>
              <p class="muted">${escapeHtml(formatPhoneNumber(getIdentity()?.phoneNumber || "") || "Телефон не указан")}</p>
            </div>
            <a class="btn btn-secondary btn-small" href="#/profile">Открыть профиль</a>
          </article>

          <article class="panel catalog-side-card">
            <h3>Корзина</h3>
            <div class="catalog-basket-count">
              ${escapeHtml(String(state.basket?.basketItemsCount || 0))}
              <span>позиций</span>
            </div>
            <a class="btn btn-primary btn-small" href="#/basket">Перейти к оформлению</a>
          </article>
        </aside>
      `
      : `
        <aside class="catalog-side">
          <article class="panel catalog-side-card">
            <h3>Режим ${escapeHtml(formatRoleLabel(role))}</h3>
            <p class="muted">Каталог доступен для просмотра. Управление сущностями выполняется в кабинете.</p>
            <button class="btn btn-secondary" type="button" data-action="go-workspace">Открыть кабинет</button>
          </article>
        </aside>
      `;

  return `
    <section class="catalog-view">
      <div class="panel intro-panel">
        <div class="catalog-hero-head">
          <p class="eyebrow">${isGuest ? "Открытый каталог" : "Онлайн-аптека"}</p>
          <h1>Найдите нужное лекарство быстро</h1>
          <p class="muted">
            Сетка товаров с быстрым просмотром. Нажмите на изображение, чтобы открыть полную карточку лекарства.
          </p>
        </div>

        <form class="search-form catalog-search-form" data-form="catalog-search">
          <input
            name="query"
            type="search"
            data-live-search="catalog"
            value="${escapeHtml(state.pendingSearch)}"
            placeholder="Название лекарства или артикул (например: Парацетамол)">
          <button class="btn btn-primary" type="submit">Найти</button>
        </form>

        ${isGuest ? `
          <div class="catalog-hero-auth">
            <a class="btn btn-secondary btn-small" href="#/login">Войти</a>
            <a class="btn btn-secondary btn-small" href="#/register">Регистрация</a>
          </div>
        ` : ""}
      </div>

      <div class="catalog-content-grid">
        <div class="catalog-main">
          <div class="catalog-grid-head">
            <h2>${state.catalogMeta.query ? "Результаты поиска" : "Витрина товаров"}</h2>
            <span class="muted">${escapeHtml(totalItemsLabel)} товаров найдено</span>
          </div>

          <div class="product-grid">
            ${items.length
              ? items.map(item => renderProductCard(item, role, {
                superAdminManage: role === ROLE.SUPER_ADMIN
              })).join("")
              : `
                <div class="panel empty-panel">
                  <h3>${emptyMessage}</h3>
                  <p class="muted">Попробуйте другой запрос или вернитесь к общей витрине.</p>
                </div>
              `}
          </div>
        </div>

        ${sidePanel}
      </div>
    </section>
  `;
}

function renderProductView() {
  const product = state.selectedProduct || state.medicineCache.get(state.route.medicineId);
  if (!product) {
    return `
      <div class="panel empty-panel" style="margin: 2rem auto; max-width: 600px;">
        <h2>Карточка товара не найдена</h2>
        <button class="btn btn-secondary" type="button" data-action="go-catalog" style="margin-top: 1rem;">Вернуться в каталог</button>
      </div>
    `;
  }

  const role = getRole();
  const isGuest = !state.token;
  const isCustomerMode = isGuest || role === ROLE.CLIENT;
  const imageSource = getMedicineImageSource(product.images);
  const attributes = Array.isArray(product.atributes) ? product.atributes : [];
  const offers = Array.isArray(product.offers) ? product.offers : [];
  const backAction = role === ROLE.ADMIN || role === ROLE.SUPER_ADMIN ? "go-workspace" : "go-catalog";
  const backLabel = role === ROLE.ADMIN || role === ROLE.SUPER_ADMIN
    ? "Назад в кабинет"
    : "Назад в каталог";

  return `
    <section class="product-view">
      <div class="product-nav-row">
        <button class="btn btn-secondary btn-small" type="button" data-action="${backAction}">
          ← ${backLabel}
        </button>
      </div>

      <div class="product-detail-grid">
        <article class="panel product-gallery-card">
          <div class="product-media product-media-detail">
            ${imageSource
              ? `<img src="${escapeHtml(imageSource)}" alt="${escapeHtml(product.title || "Товар")}">`
              : `<div class="image-fallback large">${escapeHtml(getInitials(product.title))}</div>`}
          </div>
          <div class="product-gallery-meta">
            <p class="muted">Изображений: ${escapeHtml(String(product.images?.length || 0))}</p>
          </div>
        </article>

        <article class="panel product-summary-card">
          <p class="eyebrow">Карточка товара</p>
          <h1 class="product-title-main">${escapeHtml(product.title || "Без названия")}</h1>

          <div class="product-summary-meta">
            <span class="status-badge ${product.isActive === false ? "danger" : "success"}">
              ${product.isActive === false ? "Скрыт из каталога" : "Доступен для заказа"}
            </span>
            <span class="muted">Артикул: ${escapeHtml(product.articul || "—")}</span>
          </div>

          <div class="attribute-cloud">
            ${attributes.length
              ? attributes.map(attribute => `
                <span class="interface-chip">${escapeHtml(attribute.name)}: ${escapeHtml(attribute.option)}</span>
              `).join("")
              : `<p class="muted">Характеристики не указаны</p>`}
          </div>

          <div class="product-offers-block">
            <h3>Предложения аптек</h3>
            <div class="product-offers-list">
              ${offers.length
                ? offers.map(offer => renderMedicineOfferItem(offer, role)).join("")
                : `<p class="muted">Для этого товара пока нет активных предложений аптек.</p>`}
            </div>
          </div>

          ${isCustomerMode ? `
            <div class="panel product-buy-panel">
              <h4>Заказать этот товар</h4>
              <p class="muted">Выберите количество и добавьте позицию в корзину.</p>
              <form class="product-buy-form" data-form="add-to-basket">
                <input type="hidden" name="medicineId" value="${escapeHtml(product.id)}">
                <input name="quantity" type="number" min="1" value="1">
                <button class="btn btn-primary" type="submit">
                  ${isGuest ? "Войти и добавить в корзину" : "Добавить в корзину"}
                </button>
              </form>

              ${isGuest ? `
                <div class="guest-auth-inline">
                  <a class="btn btn-secondary btn-small" href="#/login">Войти</a>
                  <a class="btn btn-secondary btn-small" href="#/register">Регистрация</a>
                </div>
              ` : ""}
            </div>
          ` : `
            <div class="panel product-admin-tip">
              <strong>Режим ${escapeHtml(role)}</strong>
              <p class="muted">Управление этим товаром доступно в вашем кабинете.</p>
              <button class="btn btn-secondary btn-small" type="button" data-action="go-workspace">Открыть кабинет</button>
            </div>
          `}
        </article>
      </div>
    </section>
  `;
}

function renderProfileView() {
  if (getRole() !== ROLE.CLIENT) return renderAuthRequired("Профиль клиента доступен только клиенту.");
  const profile = state.profile;
  if (!profile) {
    return `
      <div class="panel empty-panel" style="margin: 2rem auto; max-width: 600px;">
        <h2>Профиль пока не загружен</h2>
        <button class="btn btn-primary" type="button" data-action="refresh-route" style="margin-top: 1rem;">Обновить</button>
      </div>
    `;
  }

  const identity = getIdentity();
  const basketPreview = profile.basketPositions || [];
  const orders = state.clientOrderHistory || [];

  return `
    <section class="view-area">
      <div class="panel intro-panel" style="background-color: var(--primary-soft); display: flex; justify-content: space-between; align-items: center;">
        <div>
          <p class="eyebrow">Мой профиль</p>
          <h1>Здравствуйте, ${escapeHtml(identity?.name || "Клиент")}</h1>
          <p class="muted">Ваши данные, история заказов и управление аккаунтом.</p>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 1.5rem; font-weight: 700; color: var(--primary);">${escapeHtml(String(orders.length))}</div>
          <p class="muted">Заказов совершено</p>
        </div>
      </div>

      <div class="basket-grid">
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
          <article class="panel">
            <h3>Личные данные</h3>
            <form class="stack-form" data-form="profile-update" style="margin-top: 1.5rem;">
              <label>
                Ваше имя
                <input name="name" type="text" value="${escapeHtml(profile.name || "")}" required>
              </label>
              <label style="margin-top: 1rem;">
                Номер телефона
                ${renderPhoneField({ name: "phoneNumber", value: profile.phoneNumber || "" })}
              </label>
              <button class="btn btn-primary" type="submit" style="margin-top: 1.5rem;">Сохранить изменения</button>
            </form>
          </article>

          <article class="panel">
            <h3>Безопасность</h3>
            <form class="stack-form" data-form="password-change" style="margin-top: 1.5rem;">
              <label>
                Текущий пароль
                <input
                  name="currentPassword"
                  type="password"
                  minlength="${PASSWORD_MIN_LENGTH}"
                  pattern="[A-Za-z0-9!@#$%^&*()\\-_=.,?]+"
                  required>
              </label>
              <label style="margin-top: 1rem;">
                Новый пароль
                <input
                  name="newPassword"
                  type="password"
                  minlength="${PASSWORD_MIN_LENGTH}"
                  pattern="[A-Za-z0-9!@#$%^&*()\\-_=.,?]+"
                  required>
              </label>
              <button class="btn btn-secondary btn-small" type="submit" style="margin-top: 1.5rem;">Обновить пароль</button>
            </form>
          </article>
        </div>

        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
          <article class="panel profile-order-history">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
              <h3>История заказов</h3>
              <button class="btn btn-secondary btn-small" type="button" data-action="refresh-route">Обновить</button>
            </div>
            <div class="order-history-list">
              ${orders.length
                ? orders.map(order => renderClientOrderCard(order)).join("")
                : `<div style="text-align: center; padding: 2rem;"><p class="muted">У вас пока нет заказов.</p></div>`}
            </div>
          </article>

          <article class="panel">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
              <h3>Текущая корзина</h3>
              <a class="btn btn-secondary btn-small" href="#/basket">Открыть</a>
            </div>
            ${basketPreview.length
              ? `<div class="basket-list" style="gap: 0.5rem;">${basketPreview.map(renderCompactBasketItem).join("")}</div>`
              : `<p class="muted">В корзине пока пусто.</p>`}
          </article>
        </div>
      </div>
    </section>
  `;
}

function renderBasketView() {
  if (getRole() !== ROLE.CLIENT) return renderAuthRequired("Корзина доступна только клиенту.");
  const basket = state.basket;
  if (!basket) {
    return `
      <div class="panel empty-panel" style="margin: 2rem auto; max-width: 600px;">
        <h2>Корзина пока не загружена</h2>
        <button class="btn btn-primary" type="button" data-action="refresh-route" style="margin-top: 1rem;">Обновить</button>
      </div>
    `;
  }

  const positions = basket.basketPositions || [];
  const options = basket.pharmacyOptions || [];

  return `
    <section class="view-area">
      <div class="panel intro-panel" style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <p class="eyebrow">Корзина</p>
          <h1>Оформление заказа</h1>
          <p class="muted">Проверьте состав заказа и выберите подходящую аптеку.</p>
        </div>
        <div style="display: flex; gap: 1rem; align-items: center;">
          <span class="status-badge success">Позиций: ${escapeHtml(String(basket.basketItemsCount || positions.length))}</span>
          <button class="btn btn-secondary btn-small" type="button" data-action="basket-clear">Очистить</button>
        </div>
      </div>

      <div class="basket-grid">
        <div class="basket-list basket-card-grid">
          ${positions.length
            ? positions.map(renderBasketItem).join("")
            : `
              <div class="panel empty-panel" style="padding: 4rem 2rem;">
                <h3>Корзина пуста</h3>
                <p class="muted">Перейдите в каталог и добавьте нужные товары.</p>
                <button class="btn btn-primary" type="button" data-action="go-catalog" style="margin-top: 1.5rem;">В каталог</button>
              </div>
            `}
        </div>

        <aside style="display: flex; flex-direction: column; gap: 1.5rem;">
          <div class="panel">
            <h3>Доступные аптеки</h3>
            <p class="muted" style="margin-bottom: 1.5rem;">Сравните цены и выберите удобный пункт выдачи.</p>
            <div class="pharmacy-option-list">
              ${options.length
                ? options.map(renderPharmacyOption).join("")
                : `<p class="muted">Данные по аптекам появятся, когда в корзине будут товары.</p>`}
            </div>
          </div>
          
          ${renderCheckoutPanel(positions, options)}
        </aside>
      </div>
    </section>
  `;
}

function renderWorkspaceView() {
  const role = getRole();
  if (role === ROLE.ADMIN) {
    return renderAdminWorkspaceView();
  }

  if (role === ROLE.SUPER_ADMIN) {
    return renderSuperAdminWorkspaceView();
  }

  return renderAuthRequired("Кабинет доступен только для Admin и SuperAdmin.");
}

function renderAdminWorkspaceView() {
  const workspace = state.workspace.admin;
  const identity = getIdentity();

  if (!workspace) {
    return `
      <div class="panel empty-panel" style="margin: 2rem auto; max-width: 600px;">
        <h2>Кабинет администратора пока не загружен</h2>
        <button class="btn btn-primary" type="button" data-action="refresh-route" style="margin-top: 1rem;">Обновить</button>
      </div>
    `;
  }

  const groupedOrders = groupOrdersByStatus(workspace.orders || []);
  const statusOrder = ["UnderReview", "Preparing", "Ready", "OnTheWay"];
  const currentInterface = getCurrentAdminInterface();

  return `
    <section class="view-area theme-admin">
      <div class="panel intro-panel admin-hero-panel">
        <p class="eyebrow">Admin Dashboard</p>
        <h1>Кабинет администратора: ${escapeHtml(workspace.pharmacy?.title || "Аптека")}</h1>

        <div class="workspace-stat-grid">
          <div class="panel admin-stat-card">
            <strong>${escapeHtml(String(workspace.orders.length))}</strong>
            <p class="muted">Заказов в ленте</p>
          </div>
          <div class="panel admin-stat-card">
            <strong>${workspace.pharmacy?.isActive !== false ? "Активна" : "Отключена"}</strong>
            <p class="muted">Статус аптеки</p>
          </div>
          <div class="panel admin-stat-card">
            <strong>${escapeHtml(identity?.name || "Admin")}</strong>
            <p class="muted">Администратор</p>
          </div>
        </div>
      </div>

      <div class="main-nav admin-interface-tabs" style="justify-content: flex-start; margin-bottom: 0;">
        <button
          class="nav-link ${currentInterface === ADMIN_INTERFACE.PHARMACY ? "active" : ""}"
          type="button"
          data-action="admin-interface"
          data-interface="${ADMIN_INTERFACE.PHARMACY}">
          Pharmacy
        </button>
        <button
          class="nav-link ${currentInterface === ADMIN_INTERFACE.OFFER ? "active" : ""}"
          type="button"
          data-action="admin-interface"
          data-interface="${ADMIN_INTERFACE.OFFER}">
          Medicine (Offer)
        </button>
        <button
          class="nav-link ${currentInterface === ADMIN_INTERFACE.ORDERS ? "active" : ""}"
          type="button"
          data-action="admin-interface"
          data-interface="${ADMIN_INTERFACE.ORDERS}">
          Заказы
        </button>
      </div>

      ${currentInterface === ADMIN_INTERFACE.PHARMACY ? `
        <div class="admin-section-grid">
          <article class="panel admin-section-panel">
            <div class="section-headline">
              <h3>Профиль администратора</h3>
              <span class="muted">Ваши контактные данные</span>
            </div>
            <form class="stack-form" data-form="admin-profile-update">
              <label>
                Имя
                <input name="name" type="text" value="${escapeHtml(identity?.name || "")}" required>
              </label>
              <label>
                Телефон
                ${renderPhoneField({ name: "phoneNumber", value: identity?.phoneNumber || "" })}
              </label>
              <button class="btn btn-primary" type="submit">Сохранить профиль</button>
            </form>
          </article>

          <article class="panel admin-section-panel">
            <div class="section-headline">
              <h3>Управление Pharmacy</h3>
              <span class="muted">Название, адрес и активность аптеки</span>
            </div>
            <form class="stack-form" data-form="pharmacy-update">
              <input type="hidden" name="pharmacyId" value="${escapeHtml(workspace.pharmacyId || "")}">
              <input type="hidden" name="adminId" value="${escapeHtml(identity?.userId || "")}">
              <label>
                Название
                <input name="title" type="text" value="${escapeHtml(workspace.pharmacy?.title || "")}" required>
              </label>
              <label>
                Адрес
                <input name="address" type="text" value="${escapeHtml(workspace.pharmacy?.address || "")}" required>
              </label>
              <label class="checkbox-row">
                <input name="isActive" type="checkbox" ${workspace.pharmacy?.isActive !== false ? "checked" : ""}>
                <span>Аптека активна и видна клиентам</span>
              </label>
              <button class="btn btn-primary" type="submit">Обновить аптеку</button>
            </form>
          </article>
        </div>
      ` : ""}

      ${currentInterface === ADMIN_INTERFACE.OFFER ? `
        <article class="panel admin-section-panel admin-catalog-panel">
          <div class="section-headline">
            <h3>Medicine каталог для Offer вашей аптеки</h3>
            <span class="muted">${escapeHtml(String(workspace.medicineList.length))} товаров</span>
          </div>

          <form class="search-form" data-form="admin-medicine-search">
            <input
              name="query"
              type="search"
              data-live-search="admin-medicine"
              value="${escapeHtml(state.adminMedicineSearch)}"
              placeholder="Поиск лекарства по названию или артикулу">
            <button class="btn btn-secondary" type="submit">Найти</button>
          </form>

          <div class="admin-catalog-grid">
            ${workspace.medicineList.length
              ? workspace.medicineList.map(item => renderAdminCatalogCard(item)).join("")
              : `
                <div class="panel empty-panel">
                  <h3>Товары не найдены</h3>
                  <p class="muted">Измените поисковый запрос.</p>
                </div>
              `}
          </div>
        </article>
      ` : ""}

      ${currentInterface === ADMIN_INTERFACE.ORDERS ? `
        <article class="panel admin-orders-panel admin-section-panel">
          <div class="section-headline">
            <h3>Полки заказов по статусам</h3>
            <span class="muted">Отображаются только UnderReview, Preparing, Prepared, OnTheWay</span>
          </div>

          <div class="admin-status-board admin-status-board-strong">
            ${statusOrder.map(status => renderAdminOrderStatusColumn(status, groupedOrders[status] || [])).join("")}
          </div>
        </article>
      ` : ""}
    </section>
  `;
}

function getCurrentAdminInterface() {
  if (!Object.values(ADMIN_INTERFACE).includes(state.adminInterface)) {
    state.adminInterface = ADMIN_INTERFACE.PHARMACY;
  }

  return state.adminInterface;
}
function renderSuperAdminWorkspaceView() {
  const workspace = state.workspace.superAdmin;

  if (!workspace) {
    return `
      <div class="panel empty-panel" style="margin: 2rem auto; max-width: 600px;">
        <h2>Кабинет супер-админа пока не загружен</h2>
        <button class="btn btn-primary" type="button" data-action="refresh-route" style="margin-top: 1rem;">Обновить</button>
      </div>
    `;
  }

  const stats = workspace.stats || {};
  const currentInterface = getCurrentSuperAdminInterface();
  const currentOperationsInterface = getCurrentSuperAdminOperationsInterface();

  return `
    <section class="view-area theme-superadmin">
      <div class="panel intro-panel" style="background-color: #fff7ed;">
        <p class="eyebrow">SuperAdmin Control</p>
        <h1>Глобальное управление системой</h1>
        
        <div class="workspace-stat-grid" style="margin-top: 1.5rem;">
          <div class="panel" style="padding: 1rem;">
            <strong style="font-size: 1.5rem; color: #f97316;">${escapeHtml(String(stats.adminsTotal ?? workspace.admins.length))}</strong>
            <p class="muted">Администраторы</p>
          </div>
          <div class="panel" style="padding: 1rem;">
            <strong style="font-size: 1.5rem; color: #f97316;">${escapeHtml(String(stats.pharmaciesTotal ?? workspace.pharmacies.length))}</strong>
            <p class="muted">Аптеки</p>
          </div>
          <div class="panel" style="padding: 1rem;">
            <strong style="font-size: 1.5rem; color: #f97316;">${escapeHtml(String(stats.medicinesTotal ?? workspace.medicineList.length))}</strong>
            <p class="muted">Товары</p>
          </div>
          <div class="panel" style="padding: 1rem;">
            <strong style="font-size: 1.5rem; color: #f97316;">${escapeHtml(String(stats.clientsTotal ?? workspace.clients.length))}</strong>
            <p class="muted">Клиенты</p>
          </div>
        </div>
      </div>

      <div class="main-nav" style="justify-content: flex-start; margin-bottom: 0;">
        <button
          class="nav-link ${currentInterface === SUPERADMIN_INTERFACE.PHARMACY_ADMIN ? "active" : ""}"
          type="button"
          data-action="superadmin-interface"
          data-interface="${SUPERADMIN_INTERFACE.PHARMACY_ADMIN}">
          Аптеки и Админы
        </button>
        <button
          class="nav-link ${currentInterface === SUPERADMIN_INTERFACE.MEDICINE ? "active" : ""}"
          type="button"
          data-action="superadmin-interface"
          data-interface="${SUPERADMIN_INTERFACE.MEDICINE}">
          Каталог товаров
        </button>
        <button
          class="nav-link ${currentInterface === SUPERADMIN_INTERFACE.CLIENT ? "active" : ""}"
          type="button"
          data-action="superadmin-interface"
          data-interface="${SUPERADMIN_INTERFACE.CLIENT}">
          Клиенты
        </button>
      </div>

      <section style="display: flex; flex-direction: column; gap: 1.5rem;">
        ${currentInterface === SUPERADMIN_INTERFACE.PHARMACY_ADMIN
          ? renderSuperAdminPharmacyAdminManager(workspace)
          : ""}
        ${currentInterface === SUPERADMIN_INTERFACE.MEDICINE
          ? renderMedicineManager("superadmin", workspace.medicineList)
          : ""}
        ${currentInterface === SUPERADMIN_INTERFACE.CLIENT
          ? renderSuperAdminClientManager(workspace)
          : ""}

        <article class="panel superadmin-section-panel">
          <div class="main-nav superadmin-ops-tabs" style="justify-content: flex-start; margin-bottom: 0.5rem;">
            <button
              class="nav-link ${currentOperationsInterface === SUPERADMIN_OPERATIONS_INTERFACE.ORDERS ? "active" : ""}"
              type="button"
              data-action="superadmin-operations-interface"
              data-interface="${SUPERADMIN_OPERATIONS_INTERFACE.ORDERS}">
              Заказы системы
            </button>
            <button
              class="nav-link ${currentOperationsInterface === SUPERADMIN_OPERATIONS_INTERFACE.REFUNDS ? "active" : ""}"
              type="button"
              data-action="superadmin-operations-interface"
              data-interface="${SUPERADMIN_OPERATIONS_INTERFACE.REFUNDS}">
              Возвраты
            </button>
          </div>

          ${currentOperationsInterface === SUPERADMIN_OPERATIONS_INTERFACE.ORDERS ? `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 1rem;">
              <h3>Все заказы системы</h3>
              <form class="search-form" data-form="superadmin-order-filter">
                <select name="status" style="min-width: 200px;">
                  <option value="">Все статусы</option>
                  ${renderStatusOptions(state.superAdminOrderStatusFilter)}
                </select>
                <button class="btn btn-secondary btn-small" type="submit">Фильтр</button>
              </form>
            </div>
            <div class="workspace-order-list superadmin-order-list-grid">
              ${workspace.orders.length
                ? workspace.orders.map(order => renderSuperAdminOrderCard(order)).join("")
                : `<div class="panel empty-panel" style="grid-column: 1/-1; padding: 3rem;"><p class="muted">Заказов пока нет.</p></div>`}
            </div>
          ` : ""}

          ${currentOperationsInterface === SUPERADMIN_OPERATIONS_INTERFACE.REFUNDS ? `
            <div class="section-headline" style="margin-bottom: 1rem;">
              <h3>Запросы на возврат</h3>
              <span class="status-badge warning">${escapeHtml(String(workspace.refunds.length))} ожидают</span>
            </div>
            <div class="superadmin-refund-list">
              ${workspace.refunds.length
                ? workspace.refunds.map(refund => renderRefundCard(refund)).join("")
                : `<p class="muted">Активных запросов на возврат нет.</p>`}
            </div>
          ` : ""}
        </article>
      </section>
    </section>
  `;
}

function getCurrentSuperAdminInterface() {
  if (!Object.values(SUPERADMIN_INTERFACE).includes(state.superAdminInterface)) {
    state.superAdminInterface = SUPERADMIN_INTERFACE.PHARMACY_ADMIN;
  }

  return state.superAdminInterface;
}

function getCurrentSuperAdminOperationsInterface() {
  if (!Object.values(SUPERADMIN_OPERATIONS_INTERFACE).includes(state.superAdminOperationsInterface)) {
    state.superAdminOperationsInterface = SUPERADMIN_OPERATIONS_INTERFACE.ORDERS;
  }

  return state.superAdminOperationsInterface;
}

function renderSuperAdminPharmacyAdminManager(workspace) {
  return `
    <article class="panel workspace-panel workspace-panel-wide superadmin-manager-panel">
      <div class="section-headline">
        <h3>Управление Pharmacy + Admin</h3>
        <span class="muted">Разделены списки, создание и операции обновления/удаления</span>
      </div>
      <form class="workspace-inline-filter superadmin-inline-search" data-form="superadmin-pharmacy-admin-search">
        <label>
          Поиск по аптеке или администратору
          <input
            name="query"
            type="search"
            value="${escapeHtml(state.superAdminSearch.pharmacyAdmin)}"
            placeholder="Название Pharmacy или имя Admin">
        </label>
        <button class="btn btn-secondary" type="submit">Найти</button>
      </form>

      <div class="superadmin-boundary-grid">
        <section class="superadmin-block">
          <div class="superadmin-block-head">
            <h4>Администраторы</h4>
            <span class="status-badge warning">${escapeHtml(String(workspace.admins.length))}</span>
          </div>
          <div class="workspace-list">
            ${workspace.admins.length
              ? workspace.admins.map(admin => `
                <div class="workspace-list-item">
                  <strong>${escapeHtml(admin.name)}</strong>
                  <span>${escapeHtml(formatPhoneNumber(admin.phoneNumber))}</span>
                  <span>${escapeHtml(admin.pharmacyTitle || "Без аптеки")}</span>
                  <span class="mono-text">${escapeHtml(admin.adminId)}</span>
                </div>
              `).join("")
              : `<p class="muted">По текущему фильтру администраторы не найдены.</p>`}
          </div>
        </section>

        <section class="superadmin-block">
          <div class="superadmin-block-head">
            <h4>Аптеки</h4>
            <span class="status-badge warning">${escapeHtml(String(workspace.pharmacies.length))}</span>
          </div>
          <div class="workspace-list">
            ${workspace.pharmacies.length
              ? workspace.pharmacies.map(pharmacy => `
                <div class="workspace-list-item">
                  <strong>${escapeHtml(pharmacy.title)}</strong>
                  <span>${escapeHtml(pharmacy.address)}</span>
                  <span>${pharmacy.isActive === false ? "Неактивна" : "Активна"}</span>
                  <span class="mono-text">${escapeHtml(pharmacy.id)}</span>
                  <span class="mono-text">${escapeHtml(pharmacy.adminId)}</span>
                </div>
              `).join("")
              : `<p class="muted">По текущему фильтру аптеки не найдены.</p>`}
          </div>
        </section>
      </div>

      <div class="superadmin-boundary-grid">
        <section class="superadmin-block">
          <div class="superadmin-block-head">
            <h4>Создание сущностей</h4>
            <span class="muted">Создание Admin+Pharmacy и создание Admin в существующую Pharmacy</span>
          </div>
          <div class="workspace-form-grid superadmin-form-grid">
            <form class="stack-form" data-form="admin-pharmacy-create">
              <label>
                Имя администратора
                <input name="adminName" type="text" placeholder="Admin" required>
              </label>
              <label>
                Телефон администратора
                ${renderPhoneField({ name: "adminPhoneNumber", placeholder: "900100009" })}
              </label>
              <label>
                Пароль администратора
                <input
                  name="adminPassword"
                  type="password"
                  minlength="${PASSWORD_MIN_LENGTH}"
                  pattern="[A-Za-z0-9!@#$%^&*()\\-_=.,?]+"
                  title="Минимум 8 символов. Латиница, цифры и ! @ # $ % ^ & * ( ) - _ + = . , ?"
                  placeholder="Pass123!"
                  required>
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
                <input
                  name="password"
                  type="password"
                  minlength="${PASSWORD_MIN_LENGTH}"
                  pattern="[A-Za-z0-9!@#$%^&*()\\-_=.,?]+"
                  title="Минимум 8 символов. Латиница, цифры и ! @ # $ % ^ & * ( ) - _ + = . , ?"
                  placeholder="Pass123!"
                  required>
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
          </div>
        </section>

        <section class="superadmin-block">
          <div class="superadmin-block-head">
            <h4>Изменение и удаление</h4>
            <span class="muted">Удаление Admin и управление Pharmacy</span>
          </div>
          <div class="workspace-form-grid superadmin-form-grid">
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
        </section>
      </div>
    </article>
  `;
}

function renderSuperAdminClientManager(workspace) {
  return `
    <article class="panel workspace-panel workspace-panel-wide superadmin-manager-panel">
      <div class="section-headline">
        <h3>Просмотр Client</h3>
        <span class="muted">SuperAdmin может только просматривать клиентов</span>
      </div>
      <form class="workspace-inline-filter superadmin-inline-search" data-form="superadmin-client-search">
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

      <div class="superadmin-boundary-grid">
        <section class="superadmin-block" style="grid-column: 1 / -1;">
          <div class="superadmin-block-head">
            <h4>Клиентский каталог</h4>
            <span class="status-badge warning">${escapeHtml(String(workspace.clients.length))}</span>
          </div>
          <div class="workspace-list">
            ${workspace.clients.length
              ? workspace.clients.map(client => renderClientCard(client)).join("")
              : `<p class="muted">По текущему фильтру клиенты не найдены.</p>`}
          </div>
        </section>
      </div>
    </article>
  `;
}

function renderMedicineManager(scope, medicines) {
  if (scope !== "superadmin") {
    return `
      <article class="panel workspace-panel workspace-panel-wide">
        <div class="section-headline">
          <h3>Управление Medicine</h3>
          <span class="muted">Создание, обновление и деактивация товаров</span>
        </div>
        <div class="workspace-form-grid">
          <form class="stack-form" data-form="medicine-create">
            <label>
              Название
              <input name="title" type="text" placeholder="Paracetamol" required>
            </label>
            <label>
              Артикул
              <input name="articul" type="text" placeholder="ART-1001" required>
            </label>
            <label>
              Атрибуты
              <input name="attributes" type="text" placeholder="dosage:500mg, pack:20 pcs">
            </label>
            <button class="btn btn-primary" type="submit">Создать товар</button>
          </form>
        </div>
      </article>
    `;
  }

  const medicineList = Array.isArray(medicines) ? medicines : [];
  const selectedMedicineId = medicineList.some(item => String(item.id) === state.superAdminSelectedMedicineId)
    ? state.superAdminSelectedMedicineId
    : (medicineList[0] ? String(medicineList[0].id) : "");
  const selectedFromList = medicineList.find(item => String(item.id) === selectedMedicineId) || null;
  const selectedFromCache = selectedMedicineId ? state.medicineCache.get(selectedMedicineId) : null;
  const selectedMedicine = selectedFromList
    ? {
      ...selectedFromList,
      ...(selectedFromCache || {})
    }
    : null;
  const selectedAttributes = Array.isArray(selectedMedicine?.atributes) ? selectedMedicine.atributes : [];
  const selectedOffers = Array.isArray(selectedMedicine?.offers) ? selectedMedicine.offers : [];
  const selectedImage = getMedicineImageSource(selectedMedicine?.images);
  const detailsDisabled = selectedMedicine ? "" : "disabled";

  return `
    <article class="panel workspace-panel workspace-panel-wide superadmin-manager-panel">
      <div class="section-headline">
        <h3>Управление Medicine</h3>
        <span class="muted">Каталог + карточка товара: просмотр, редактирование, управление изображениями и статусом</span>
      </div>

      <div class="superadmin-medicine-layout">
        <div class="superadmin-stack">
          <section class="superadmin-block">
            <div class="superadmin-block-head">
              <h4>Создать новый Medicine</h4>
              <span class="muted">Добавление товара в глобальный каталог</span>
            </div>
            <form class="stack-form" data-form="medicine-create">
              <label>
                Название
                <input name="title" type="text" placeholder="Paracetamol" required>
              </label>
              <label>
                Артикул
                <input name="articul" type="text" placeholder="ART-1001" required>
              </label>
              <label>
                Атрибуты
                <input name="attributes" type="text" placeholder="dosage:500mg, pack:20 pcs">
              </label>
              <button class="btn btn-primary" type="submit">Создать товар</button>
            </form>
          </section>

          <section class="superadmin-block">
            <div class="superadmin-block-head">
              <h4>Каталог Medicine</h4>
              <span class="status-badge warning">${escapeHtml(String(medicineList.length))}</span>
            </div>
            <form class="workspace-inline-filter superadmin-inline-search" data-form="superadmin-medicine-search">
              <label>
                Поиск по названию товара
                <input
                  name="query"
                  type="search"
                  data-live-search="superadmin-medicine"
                  value="${escapeHtml(state.superAdminSearch.medicine)}"
                  placeholder="Например: Paracetamol">
              </label>
              <button class="btn btn-secondary" type="submit">Найти</button>
            </form>

            ${medicineList.length
              ? `
                <div class="superadmin-medicine-grid">
                  ${medicineList.map(item => {
                    const cardImage = getMedicineImageSource(item.images);
                    const isSelected = String(item.id) === selectedMedicineId;
                    return `
                      <button
                        class="superadmin-medicine-card ${isSelected ? "active" : ""}"
                        type="button"
                        data-action="superadmin-medicine-select"
                        data-medicine-id="${escapeHtml(item.id)}">
                        <span class="superadmin-medicine-card-media">
                          ${cardImage
                            ? `<img src="${escapeHtml(cardImage)}" alt="${escapeHtml(item.title || "Товар")}">`
                            : `<span class="image-fallback">${escapeHtml(getInitials(item.title || "Товар"))}</span>`}
                        </span>
                        <span class="superadmin-medicine-card-body">
                          <span class="product-articul">${escapeHtml(item.articul || "Без артикула")}</span>
                          <strong>${escapeHtml(item.title || "Без названия")}</strong>
                          <span class="status-badge ${item.isActive === false ? "danger" : "success"}">
                            ${item.isActive === false ? "Скрыт" : "В каталоге"}
                          </span>
                        </span>
                      </button>
                    `;
                  }).join("")}
                </div>
              `
              : `<p class="muted">Список товаров пока пуст.</p>`}
          </section>
        </div>

        <section class="superadmin-block superadmin-medicine-details">
          <div class="superadmin-block-head">
            <h4>Карточка Medicine</h4>
            <span class="muted">Просмотр полной информации и изменение данных</span>
          </div>

          ${selectedMedicine ? `
            <div class="superadmin-medicine-preview">
              <div class="superadmin-medicine-preview-media">
                ${selectedImage
                  ? `<img src="${escapeHtml(selectedImage)}" alt="${escapeHtml(selectedMedicine.title || "Товар")}">`
                  : `<div class="image-fallback large">${escapeHtml(getInitials(selectedMedicine.title || "Товар"))}</div>`}
              </div>
              <div class="superadmin-medicine-preview-body">
                <span class="product-articul">${escapeHtml(selectedMedicine.articul || "Без артикула")}</span>
                <h3>${escapeHtml(selectedMedicine.title || "Без названия")}</h3>
                <span class="status-badge ${selectedMedicine.isActive === false ? "danger" : "success"}">
                  ${selectedMedicine.isActive === false ? "Неактивен" : "Активен"}
                </span>
                <span class="mono-text">${escapeHtml(selectedMedicine.id || "")}</span>
              </div>
            </div>

            ${state.superAdminMedicineDetailsLoading
              ? `<p class="muted">Загружаем подробную информацию о Medicine...</p>`
              : ""}

            <div class="superadmin-details-subsection">
              <h5>Атрибуты</h5>
              <div class="attribute-cloud">
                ${selectedAttributes.length
                  ? selectedAttributes.map(attribute => `
                    <span class="interface-chip">${escapeHtml(attribute.name)}: ${escapeHtml(attribute.option)}</span>
                  `).join("")
                  : `<span class="muted">Атрибуты не заданы.</span>`}
              </div>
            </div>

            <div class="superadmin-details-subsection">
              <h5>Предложения аптек</h5>
              <div class="product-offers-list">
                ${selectedOffers.length
                  ? selectedOffers.map(offer => renderMedicineOfferItem(offer, ROLE.SUPER_ADMIN)).join("")
                  : `<p class="muted">По этому товару пока нет offers.</p>`}
              </div>
            </div>
          ` : `
            <p class="muted">Выберите карточку лекарства в каталоге, чтобы открыть полную информацию и редактирование.</p>
          `}

          <div class="superadmin-details-subsection">
            <h5>Изменить данные товара</h5>
            <form class="stack-form" data-form="medicine-update">
              <input type="hidden" name="medicineId" value="${escapeHtml(selectedMedicineId)}">
              <label>
                Название
                <input name="title" type="text" value="${escapeHtml(selectedMedicine?.title || "")}" placeholder="Paracetamol Forte" required ${detailsDisabled}>
              </label>
              <label>
                Артикул
                <input name="articul" type="text" value="${escapeHtml(selectedMedicine?.articul || "")}" placeholder="ART-1002" required ${detailsDisabled}>
              </label>
              <button class="btn btn-secondary" type="submit" ${detailsDisabled}>Обновить товар</button>
            </form>
          </div>

          <div class="superadmin-details-subsection">
            <h5>Загрузка изображения</h5>
            <form class="stack-form" data-form="medicine-image-upload">
              <input type="hidden" name="medicineId" value="${escapeHtml(selectedMedicineId)}">
              <label>
                Основная картинка
                <select name="isMain" required ${detailsDisabled}>
                  <option value="true">Да</option>
                  <option value="false" selected>Нет</option>
                </select>
              </label>
              <label>
                Миниатюра
                <select name="isMinimal" required ${detailsDisabled}>
                  <option value="true">Да</option>
                  <option value="false" selected>Нет</option>
                </select>
              </label>
              <label>
                Файл изображения
                <input name="image" type="file" accept="image/*" required ${detailsDisabled}>
              </label>
              <button class="btn btn-primary" type="submit" ${detailsDisabled}>Загрузить картинку</button>
            </form>
          </div>

          <div class="superadmin-danger-row">
            <form class="stack-form compact-form" data-form="medicine-delete">
              <input type="hidden" name="medicineId" value="${escapeHtml(selectedMedicineId)}">
              <button class="btn btn-secondary" type="submit" ${detailsDisabled}>Деактивировать товар</button>
            </form>
            <form class="stack-form compact-form" data-form="medicine-hard-delete">
              <input type="hidden" name="medicineId" value="${escapeHtml(selectedMedicineId)}">
              <button class="btn btn-secondary" type="submit" ${detailsDisabled}>Удалить полностью</button>
            </form>
          </div>
        </section>
      </div>
    </article>
  `;
}

function renderAdminCatalogCard(item) {
  const imageSource = getMedicineImageSource(item.images);

  return `
    <article class="admin-catalog-card">
      <button
        class="product-media product-media-btn"
        type="button"
        data-action="product-open"
        data-medicine-id="${escapeHtml(item.id)}"
        aria-label="Открыть карточку ${escapeHtml(item.title || "товара")}">
        ${imageSource
          ? `<img src="${escapeHtml(imageSource)}" alt="${escapeHtml(item.title || "Товар")}">`
          : `<div class="image-fallback">${escapeHtml(getInitials(item.title || "Товар"))}</div>`}
      </button>

      <div class="admin-catalog-card-body">
        <span class="product-articul">${escapeHtml(item.articul || "Без артикула")}</span>
        <h4>${escapeHtml(item.title || "Без названия")}</h4>
      </div>

      <form class="admin-offer-inline-form" data-form="admin-offer-upsert">
        <input type="hidden" name="medicineId" value="${escapeHtml(item.id)}">
        <label>
          Остаток
          <input name="stockQuantity" type="number" min="0" value="0" required>
        </label>
        <label>
          Цена
          <input name="price" type="number" min="0" step="0.01" value="0" required>
        </label>
        <button class="btn btn-primary btn-small" type="submit">Сохранить offer</button>
      </form>
    </article>
  `;
}

function groupOrdersByStatus(orders) {
  const buckets = {};
  (orders || []).forEach(order => {
    const status = formatStatusLabel(order.status);
    if (!buckets[status]) {
      buckets[status] = [];
    }

    buckets[status].push(order);
  });

  return buckets;
}

function renderAdminOrderStatusColumn(status, orders) {
  const statusLabel = formatAdminOrderStatusLabel(status);

  return `
    <section class="admin-status-column">
      <div class="admin-status-head">
        <h4>${escapeHtml(statusLabel)}</h4>
        <span class="status-badge warning">${escapeHtml(String(orders.length))}</span>
      </div>
      <div class="admin-status-orders">
        ${orders.length
          ? orders.map(order => renderAdminOrderCard(order)).join("")
          : `<p class="muted">В этом статусе пока нет заказов.</p>`}
      </div>
    </section>
  `;
}

function renderAdminOrderCard(order) {
  const statusLabel = formatAdminOrderStatusLabel(order.status);

  return `
    <article class="workspace-order-card admin-order-card">
      <div class="workspace-order-head admin-order-head">
        <div>
          <strong>Заказ ${escapeHtml(String(order.orderId).slice(0, 8))}</strong>
          <p class="muted">${escapeHtml(order.deliveryAddress || "Без адреса")}</p>
        </div>
        <div class="admin-order-head-actions">
          <span class="status-badge success">${escapeHtml(statusLabel)}</span>
          <button
            class="btn btn-secondary btn-small"
            type="button"
            data-action="admin-order-open"
            data-order-id="${escapeHtml(order.orderId)}">
            Подробнее
          </button>
        </div>
      </div>

      <div class="workspace-order-meta">
        <span>Сумма: ${escapeHtml(formatMoney(order.cost))}</span>
        <span>Дата: ${escapeHtml(formatDate(order.orderPlacedAt))}</span>
        <span>Позиций: ${escapeHtml(String((order.positions || []).length))}</span>
      </div>
    </article>
  `;
}

function renderAdminOrderDetailView() {
  if (getRole() !== ROLE.ADMIN) {
    return renderAuthRequired("Детали заказа доступны только администратору аптеки.");
  }

  const workspace = state.workspace.admin;
  const orderId = String(state.route.orderId || "").trim();
  if (!workspace) {
    return `
      <div class="panel empty-panel" style="margin: 2rem auto; max-width: 700px;">
        <h2>Загружаем детали заказа</h2>
        <p class="muted">Данные кабинета администратора пока не готовы.</p>
      </div>
    `;
  }

  const order = (workspace.orders || []).find(item => String(item.orderId) === orderId);
  if (!order) {
    return `
      <article class="panel empty-panel">
        <h2>Заказ не найден</h2>
        <p class="muted">Вернитесь к полкам заказов и выберите доступный заказ.</p>
        <button class="btn btn-secondary" type="button" data-action="go-workspace">Назад к заказам</button>
      </article>
    `;
  }

  const status = formatStatusLabel(order.status);
  const statusLabel = formatAdminOrderStatusLabel(order.status);
  const canStartAssembly = status === "UnderReview";
  const canMarkReady = status === "Preparing";
  const canMarkOnTheWay = status === "Ready";
  const canRejectPositions = status === "Preparing";
  const nextActionMarkup = canStartAssembly
    ? `<button class="btn btn-secondary" type="button" data-action="order-start" data-order-id="${escapeHtml(order.orderId)}">В статус Preparing</button>`
    : canMarkReady
      ? `<button class="btn btn-secondary" type="button" data-action="order-ready" data-order-id="${escapeHtml(order.orderId)}">В статус Ready</button>`
      : canMarkOnTheWay
        ? `<button class="btn btn-secondary" type="button" data-action="order-on-the-way" data-order-id="${escapeHtml(order.orderId)}">В статус OnTheWay</button>`
        : `<span class="muted">Следующий статус недоступен.</span>`;

  return `
    <section class="view-area admin-order-detail-view">
      <article class="panel admin-order-detail-hero">
        <div class="admin-order-detail-head">
          <div>
            <p class="eyebrow">Order details</p>
            <h2>Заказ ${escapeHtml(String(order.orderId).slice(0, 8))}</h2>
            <p class="muted">${escapeHtml(order.deliveryAddress || "Без адреса доставки")}</p>
          </div>
          <div class="admin-order-detail-head-actions">
            <span class="status-badge success">${escapeHtml(statusLabel)}</span>
            <button class="btn btn-secondary btn-small" type="button" data-action="go-workspace">К полкам заказов</button>
          </div>
        </div>

        <div class="admin-order-detail-meta">
          <span>Сумма: ${escapeHtml(formatMoney(order.cost))}</span>
          <span>Дата: ${escapeHtml(formatDate(order.orderPlacedAt))}</span>
          <span>ClientId: ${escapeHtml(String(order.clientId || "").slice(0, 8) || "—")}</span>
          <span>PharmacyId: ${escapeHtml(String(order.pharmacyId || "").slice(0, 8) || "—")}</span>
          <span>Возврат: ${escapeHtml(formatMoney(order.returnCost))}</span>
        </div>
      </article>

      <article class="panel admin-order-detail-panel">
        <div class="section-headline">
          <h3>Позиции заказа</h3>
          <span class="muted">Нажимайте на позицию для перехода в карточку лекарства</span>
        </div>

        <div class="workspace-position-list admin-position-list admin-position-list-detail">
          ${(order.positions || []).map(position => `
            <button
              class="workspace-position-item admin-position-item"
              type="button"
              data-action="product-open"
              data-medicine-id="${escapeHtml(position.medicineId || position.medicine?.id || "")}">
              <span>${escapeHtml(position.medicine?.title || "Товар")}</span>
              <span>x${escapeHtml(String(position.quantity))}</span>
              <span>${escapeHtml(formatMoney(position.price))}</span>
              <span class="mono-text">${escapeHtml(String(position.positionId).slice(0, 8))}</span>
              ${position.isRejected ? `<span class="status-badge warning">Отклонена</span>` : ""}
            </button>
          `).join("")}
        </div>

        <div class="workspace-action-row admin-order-next-action">
          ${nextActionMarkup}
        </div>

        ${canRejectPositions ? `
          <form class="stack-form admin-reject-form admin-reject-form-large" data-form="order-reject">
            <input type="hidden" name="orderId" value="${escapeHtml(order.orderId)}">
            <div class="admin-reject-options">
              ${(order.positions || []).map(position => `
                <label class="admin-reject-option">
                  <input
                    name="positionIds"
                    type="checkbox"
                    value="${escapeHtml(position.positionId)}"
                    ${position.isRejected ? "disabled" : ""}>
                  <span>
                    ${escapeHtml(position.medicine?.title || "Товар")}
                    · x${escapeHtml(String(position.quantity))}
                    · ${escapeHtml(formatMoney(position.price))}
                    ${position.isRejected ? " · уже отклонена" : ""}
                  </span>
                </label>
              `).join("")}
            </div>
            <button class="btn btn-secondary" type="submit">Отклонить выбранные позиции</button>
          </form>
        ` : ""}
      </article>
    </section>
  `;
}

function renderSuperAdminOrderCard(order) {
  const status = formatStatusLabel(order.status);
  const canMarkDelivered = status === "OnTheWay";

  return `
    <div class="workspace-order-card superadmin-order-card">
      <div class="workspace-order-head">
        <div>
          <strong>Заказ ${escapeHtml(String(order.orderId).slice(0, 8))}</strong>
          <p class="muted">${escapeHtml(order.deliveryAddress || "Без адреса")}</p>
        </div>
        <span class="status-badge success">${escapeHtml(formatStatusLabel(order.status))}</span>
      </div>
      <div class="workspace-order-meta">
        <span>Сумма: ${escapeHtml(formatMoney(order.cost))}</span>
        <span>PharmacyId: ${escapeHtml(String(order.pharmacyId).slice(0, 8))}</span>
        <span>Дата: ${escapeHtml(formatDate(order.orderPlacedAt))}</span>
      </div>
      <div class="workspace-position-list">
        ${(order.positions || []).map(position => `
          <div class="workspace-position-item">
            <span>${escapeHtml(position.medicine?.title || "Товар")}</span>
            <span>x${escapeHtml(String(position.quantity))}</span>
            <span>${escapeHtml(formatMoney(position.price))}</span>
          </div>
        `).join("")}
      </div>
      <div class="workspace-action-row">
        ${canMarkDelivered
          ? `<button class="btn btn-primary" type="button" data-action="order-delivered" data-order-id="${escapeHtml(order.orderId)}">Отметить доставленным</button>`
          : `<span class="muted">Delivered доступен только для заказов в статусе OnTheWay.</span>`}
      </div>
    </div>
  `;
}

function renderRefundCard(refund) {
  return `
    <div class="workspace-list-item refund-item superadmin-refund-card">
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

function renderMedicineOfferItem(offer, role) {
  const pharmacyTitle = offer.pharmacyTitle || "Аптека";
  const pharmacyId = offer.pharmacyId || "";
  const pharmacyState = offer.pharmacyIsActive === false ? "Аптека неактивна" : "Аптека активна";
  const availability = offer.isAvailable ? "Доступно к заказу" : "Нет достаточного остатка";

  return `
    <div class="medicine-offer-item">
      <div class="medicine-offer-head">
        <strong>${escapeHtml(pharmacyTitle)}</strong>
        <span>${escapeHtml(formatMoney(offer.price))}</span>
      </div>
      <div class="medicine-offer-meta">
        <span>Остаток: ${escapeHtml(String(offer.stockQuantity ?? 0))}</span>
        <span>${escapeHtml(availability)}</span>
        ${role === ROLE.SUPER_ADMIN ? `<span>${escapeHtml(pharmacyState)}</span>` : ""}
        ${role === ROLE.SUPER_ADMIN ? `<span class="mono-text">${escapeHtml(pharmacyId)}</span>` : ""}
      </div>
    </div>
  `;
}

function renderProductCard(item, role, options = {}) {
  const showSuperAdminManage = role === ROLE.SUPER_ADMIN && options.superAdminManage === true;
  const isGuest = !state.token;
  const canShop = isGuest || role === ROLE.CLIENT;
  const imageSource = getMedicineImageSource(item.images);

  return `
    <article class="product-card">
      <button
        class="product-media product-media-btn"
        type="button"
        data-action="product-open"
        data-medicine-id="${escapeHtml(item.id)}"
        aria-label="Открыть карточку ${escapeHtml(item.title || "товара")}">
        ${imageSource
          ? `<img src="${escapeHtml(imageSource)}" alt="${escapeHtml(item.title || "Товар")}">`
          : `<div class="image-fallback">${escapeHtml(getInitials(item.title))}</div>`}
      </button>
      <div class="product-body">
        <div class="product-meta-row">
          <span class="product-articul">${escapeHtml(item.articul || "Без артикула")}</span>
          <span class="status-badge ${item.isActive === false ? "danger" : "success"}">
            ${item.isActive === false ? "Скрыт" : "В каталоге"}
          </span>
        </div>
        <h3 class="product-title">${escapeHtml(item.title || "Без названия")}</h3>
        <p class="product-mini-note">Нажмите на фото, чтобы открыть полную информацию о препарате.</p>
      </div>
      <div class="product-actions">
        <button class="btn btn-secondary btn-small" type="button" data-action="product-open" data-medicine-id="${escapeHtml(item.id)}">Подробнее</button>
        ${canShop ? (
          isGuest
            ? `<button class="btn btn-primary btn-small" type="button" data-action="require-auth">В корзину</button>`
            : `
          <form data-form="add-to-basket" class="product-card-add-form">
            <input type="hidden" name="medicineId" value="${escapeHtml(item.id)}">
            <input type="hidden" name="quantity" value="1">
            <button class="btn btn-primary btn-small" type="submit">В корзину</button>
          </form>
        `
        ) : showSuperAdminManage ? `
          <button class="btn btn-secondary btn-small" type="button" data-action="medicine-card-deactivate" data-medicine-id="${escapeHtml(item.id)}">Скрыть</button>
        ` : `
          <button class="btn btn-secondary btn-small" type="button" data-action="go-workspace">Кабинет</button>
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
    <div class="basket-item basket-item-extended">
      <a class="basket-item-media" href="#/product/${escapeHtml(item.medicineId)}">
        ${imageSource
          ? `<img src="${escapeHtml(imageSource)}" alt="${escapeHtml(medicine.title || "Товар")}">`
          : `<div class="image-fallback" style="font-size: 1.5rem;">${escapeHtml(getInitials(medicine.title || "Товар"))}</div>`}
      </a>
      <div class="basket-item-main">
        <a href="#/product/${escapeHtml(item.medicineId)}" style="font-weight: 700; font-size: 1rem; color: var(--text-main);">${escapeHtml(medicine.title || "Товар")}</a>
        <p class="muted" style="margin-bottom: 0.5rem;">${escapeHtml(medicine.articul || item.medicineId)}</p>
        <form class="basket-qty-form" data-form="basket-quantity">
          <input type="hidden" name="positionId" value="${escapeHtml(item.positionId)}">
          <label>
            Количество
            <input name="quantity" type="number" min="1" value="${escapeHtml(String(Math.max(1, quantity)))}">
          </label>
          <button class="btn btn-secondary btn-small" type="submit">Применить</button>
        </form>
      </div>
      <div class="basket-item-actions">
        <button class="btn btn-secondary btn-small" type="button" data-action="basket-step" data-position-id="${escapeHtml(item.positionId)}" data-quantity="${escapeHtml(String(quantity))}" data-delta="-1">−1</button>
        <button class="btn btn-secondary btn-small" type="button" data-action="basket-step" data-position-id="${escapeHtml(item.positionId)}" data-quantity="${escapeHtml(String(quantity))}" data-delta="1">+1</button>
        <button class="btn btn-secondary btn-small" type="button" data-action="basket-remove" data-position-id="${escapeHtml(item.positionId)}" style="color: var(--danger); border-color: rgba(239, 68, 68, 0.2);">Удалить</button>
      </div>
    </div>
  `;
}

function renderPharmacyOption(option) {
  const items = option.items || [];
  const isSelected = state.checkoutDraft.pharmacyId === option.pharmacyId;
  
  return `
    <div class="pharmacy-card ${option.isAvailable ? "available" : "limited"}" style="background-color: ${isSelected ? "var(--primary-soft)" : "white"}; border-color: ${isSelected ? "var(--primary)" : ""};">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <strong style="font-size: 1.1rem; display: block;">${escapeHtml(option.pharmacyTitle || "Аптека")}</strong>
          <p class="muted" style="margin-top: 0.25rem;">${escapeHtml(option.foundMedicinesRatio || "0/0")} найдено</p>
        </div>
        <span class="status-badge ${option.isAvailable ? "success" : "warning"}">
          ${option.isAvailable ? "В наличии" : "Частично"}
        </span>
      </div>
      
      <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed var(--border); display: flex; justify-content: space-between; align-items: center;">
        <span style="font-weight: 700; font-size: 1.125rem; color: var(--primary);">${escapeHtml(formatMoney(option.totalCost))}</span>
        <button class="btn ${isSelected ? "btn-primary" : "btn-secondary"} btn-small" type="button" 
          data-action="checkout-use-pharmacy" 
          data-pharmacy-id="${escapeHtml(option.pharmacyId)}">
          ${isSelected ? "Выбрано" : "Выбрать"}
        </button>
      </div>
    </div>
  `;
}

function renderCheckoutPanel(positions, options) {
  if (!(positions || []).length) {
    return `
      <div class="panel empty-panel" style="padding: 2rem;">
        <h3>Оформление заказа</h3>
        <p class="muted">Добавьте товары в корзину, чтобы перейти к оформлению.</p>
      </div>
    `;
  }

  const availableOptions = (options || []).filter(option => option.isAvailable);
  if (!availableOptions.length) {
    return `
      <div class="panel" style="border-color: var(--danger); background-color: #fef2f2;">
        <h3>Оформление заказа</h3>
        <p class="muted">Нет аптек, где все позиции доступны в нужном количестве. Измените корзину или выберите другие товары.</p>
      </div>
    `;
  }

  const selectedPharmacyId = availableOptions.some(item => item.pharmacyId === state.checkoutDraft.pharmacyId)
    ? state.checkoutDraft.pharmacyId
    : availableOptions[0].pharmacyId;

  const selectedOption = availableOptions.find(item => item.pharmacyId === selectedPharmacyId) || availableOptions[0];

  return `
    <div class="panel" style="background-color: var(--primary-soft); border-color: var(--primary);">
      <div class="section-headline" style="margin-bottom: 1.5rem;">
        <h3>Завершение заказа</h3>
        <span class="status-badge success">Доступно аптек: ${escapeHtml(String(availableOptions.length))}</span>
      </div>
      <form class="stack-form" data-form="client-checkout">
        <label>
          Выбранная аптека
          <select name="pharmacyId" required>
            ${availableOptions.map(option => `
              <option value="${escapeHtml(option.pharmacyId)}" ${option.pharmacyId === selectedPharmacyId ? "selected" : ""}>
                ${escapeHtml(option.pharmacyTitle || "Аптека")} · ${escapeHtml(formatMoney(option.totalCost))}
              </option>
            `).join("")}
          </select>
        </label>
        <label style="margin-top: 1rem;">
          Адрес доставки
          <input
            name="deliveryAddress"
            type="text"
            value="${escapeHtml(state.checkoutDraft.deliveryAddress)}"
            placeholder="Например: Dushanbe, Rudaki 10, kv. 5"
            required>
        </label>
        <div class="checkout-summary-row" style="margin-top: 1.5rem; background-color: white;">
          <span>К оплате:</span>
          <strong style="font-size: 1.5rem; color: var(--primary);">${escapeHtml(formatMoney(selectedOption.totalCost))}</strong>
        </div>
        <button class="btn btn-primary" type="submit" style="width: 100%; margin-top: 1.5rem; padding: 1rem;">
          Оформить заказ
        </button>
      </form>
    </div>
  `;
}

function findPharmacyById(pharmacyId) {
  const normalizedPharmacyId = String(pharmacyId || "");
  return (state.pharmacies || []).find(item => String(item.id) === normalizedPharmacyId) || null;
}

function renderClientOrderCard(order) {
  const orderId = String(order.orderId || "");
  const isExpanded = state.expandedClientOrders.has(orderId);
  const isLoading = state.clientOrderDetailsLoading.has(orderId);
  const details = state.clientOrderDetailsCache.get(orderId);
  const pharmacy = findPharmacyById(order.pharmacyId);
  const pharmacyTitle = pharmacy?.title || `Аптека ${String(order.pharmacyId || "").slice(0, 8)}`;
  const canCancel = canClientCancelOrder(order.status);

  const detailsMarkup = isLoading
    ? `<p class="muted">Загружаем детали заказа...</p>`
    : details
      ? `
        <div class="client-order-details-grid">
          <div class="workspace-order-meta">
            <span>Аптека: ${escapeHtml(pharmacyTitle)}</span>
            <span>Адрес аптеки: ${escapeHtml(pharmacy?.address || "—")}</span>
            <span>Доставка: ${escapeHtml(details.deliveryAddress || order.deliveryAddress || "—")}</span>
            <span>К оплате: ${escapeHtml(formatMoney(details.cost || order.cost))}</span>
          </div>

          <div class="client-order-position-list">
            ${(details.positions || []).length
              ? (details.positions || []).map(position => `
                <button
                  class="client-order-position-btn"
                  type="button"
                  data-action="product-open"
                  data-medicine-id="${escapeHtml(position.medicineId)}">
                  <span>${escapeHtml(position.medicineTitle || "Товар")}</span>
                  <span>x${escapeHtml(String(position.quantity))}</span>
                  <span>${escapeHtml(formatMoney(position.price))}</span>
                  ${position.isRejected ? `<span class="status-badge warning">Отклонено</span>` : ""}
                </button>
              `).join("")
              : `<p class="muted">Позиции заказа не найдены.</p>`}
          </div>
        </div>
      `
      : `<p class="muted">Нажмите "Подробнее", чтобы загрузить состав и информацию о заказе.</p>`;

  return `
    <article class="order-card customer-order-card order-history-card">
      <div class="order-history-head">
        <div>
          <strong>Заказ ${escapeHtml(String(order.orderId).slice(0, 8))}</strong>
          <p class="muted">${escapeHtml(pharmacyTitle)}</p>
        </div>
        <span class="status-badge success">${escapeHtml(formatStatusLabel(order.status))}</span>
      </div>

      <div class="order-history-meta">
        <span>Сумма: ${escapeHtml(formatMoney(order.cost))}</span>
        <span>Дата: ${escapeHtml(formatDate(order.orderPlacedAt))}</span>
        <span>PharmacyId: ${escapeHtml(String(order.pharmacyId).slice(0, 8))}</span>
      </div>

      <div class="order-history-actions">
        <button
          class="btn btn-secondary btn-small"
          type="button"
          data-action="client-order-toggle"
          data-order-id="${escapeHtml(order.orderId)}">
          ${isExpanded ? "Скрыть детали" : "Подробнее"}
        </button>
        ${canCancel
          ? `<button
              class="btn btn-secondary btn-small"
              type="button"
              data-action="client-order-cancel"
              data-order-id="${escapeHtml(order.orderId)}">
              Отменить заказ
            </button>`
          : ""}
      </div>

      ${isExpanded ? `
        <div class="order-history-details">
          ${detailsMarkup}
        </div>
      ` : ""}
    </article>
  `;
}

function renderAuthRequired(message) {
  return `
    <article class="panel empty-panel">
      <h2>${escapeHtml(message)}</h2>
      <p class="muted">Откройте отдельное окно входа или регистрации.</p>
      <div class="hero-actions">
        <a class="btn btn-primary" href="#/login">Войти</a>
        <a class="btn btn-secondary" href="#/register">Регистрация</a>
      </div>
    </article>
  `;
}

function renderNavLink(path, label, isActive) {
  return `<a class="nav-link ${isActive ? "active" : ""}" href="#${path}">${label}</a>`;
}

function renderUserBadge() {
  if (!state.token) {
    return `<span class="status-badge warning">Гость</span>`;
  }

  const identity = getIdentity();
  return `<span class="status-badge success">${escapeHtml(identity?.name || "Авторизован")} · ${escapeHtml(formatRoleLabel(identity?.role || ""))}</span>`;
}

function renderNotice() {
  if (!state.notice) return "";
  return `
    <section class="notice notice-${escapeHtml(state.notice.tone)}">
      <span>${escapeHtml(state.notice.message)}</span>
      <button type="button" data-action="notice-close" aria-label="Закрыть уведомление">×</button>
    </section>
  `;
}

function renderHeroActions(role) {
  if (!state.token) {
    return `
      <a class="btn btn-primary" href="#/login">Войти</a>
      <a class="btn btn-secondary" href="#/register">Регистрация</a>
    `;
  }

  if (role === ROLE.CLIENT) {
    return `
      <button class="btn btn-primary" type="button" data-action="refresh-route">Обновить экран</button>
      <a class="btn btn-secondary" href="#/basket">Открыть корзину</a>
    `;
  }

  return `
    <button class="btn btn-primary" type="button" data-action="refresh-route">Обновить кабинет</button>
    <a class="btn btn-secondary" href="#/workspace">Открыть кабинет</a>
  `;
}

function getRoleEyebrow(role) {
  if (!state.token) return "Онлайн-аптека";
  return role === ROLE.CLIENT ? "Клиент" : role === ROLE.ADMIN ? "Admin" : "SuperAdmin";
}

function getRoleThemeClass(role) {
  if (!state.token) return "theme-guest";
  if (role === ROLE.ADMIN) return "theme-admin";
  if (role === ROLE.SUPER_ADMIN) return "theme-superadmin";
  return "theme-client";
}

function getInterfaceLabel(role) {
  if (!state.token) return "Гостевой";
  if (role === ROLE.ADMIN) return "Admin интерфейс";
  if (role === ROLE.SUPER_ADMIN) return "SuperAdmin интерфейс";
  return "Client интерфейс";
}

function renderStatusOptions(selectedStatus) {
  const statuses = [
    "New",
    "UnderReview",
    "Preparing",
    "Ready",
    "OnTheWay",
    "Delivered",
    "Cancelled",
    "Returned"
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
    Ready: "Ready",
    OnTheWay: "OnTheWay",
    Delivered: "Delivered",
    Cancelled: "Cancelled",
    Returned: "Returned"
  };

  return labels[value] || String(value ?? "—");
}

function formatAdminOrderStatusLabel(value) {
  const normalized = formatStatusLabel(value);
  return normalized === "Ready" ? "Prepared" : normalized;
}

function canClientCancelOrder(status) {
  const normalized = formatStatusLabel(status);
  return normalized !== "Delivered"
    && normalized !== "Returned"
    && normalized !== "Cancelled";
}

function formatRefundStatusLabel(value) {
  const labels = {
    0: "Created",
    1: "InitiatedBySuperAdmin",
    2: "Processed",
    Created: "Created",
    InitiatedBySuperAdmin: "InitiatedBySuperAdmin",
    Processed: "Processed"
  };

  return labels[value] || String(value ?? "—");
}

function basketBadge() {
  if (getRole() !== ROLE.CLIENT) return "";
  const count = Number(state.basket?.basketItemsCount || 0);
  return count > 0 ? ` <span class="nav-badge">${escapeHtml(String(count))}</span>` : "";
}

function getTopStripTitle() {
  const role = getRole();
  if (!state.token) return "Онлайн-аптека";

  if (state.route.name === "workspace" || state.route.name === "workspace-order") {
    return role === ROLE.ADMIN ? "Admin кабинет" : "SuperAdmin кабинет";
  }

  if (state.route.name === "catalog") return "Витрина товаров";
  if (state.route.name === "product") return "Карточка товара";
  if (state.route.name === "workspace-order") return "Детали заказа";
  if (state.route.name === "basket") return "Корзина";
  if (state.route.name === "profile") return "Профиль клиента";
  if (state.route.name === "register") return "Регистрация";
  return "Вход";
}

function getTopStripText() {
  const role = getRole();
  if (!state.token) return "Войдите, чтобы открыть клиентский, admin или superadmin интерфейс.";

  if (state.route.name === "workspace" && role === ROLE.SUPER_ADMIN) {
    return "Управляйте аптеками, администраторами, клиентами и товарами из одного кабинета.";
  }

  if (state.route.name === "workspace" && role === ROLE.ADMIN) {
    return "Работайте с аптекой, заказами и внутренними операциями.";
  }

  if (state.route.name === "workspace-order" && role === ROLE.ADMIN) {
    return "Полный экран деталей заказа: клиент, позиции, стоимость, отклонение позиций и смена статуса.";
  }

  if (state.route.name === "catalog") return "Ищите товары и открывайте детальную карточку.";
  if (state.route.name === "product") return "Детали, изображения и статус выбранного товара.";
  if (state.route.name === "basket") return "Позиции корзины и варианты аптек для оформления.";
  if (state.route.name === "profile") return "Личные данные, история заказов и настройки.";
  if (state.route.name === "register") return "Создание клиентского аккаунта.";
  return "Выполните вход и продолжайте работу.";
}

function getHeroTitle() {
  switch (state.route.name) {
    case "login":
      return "Отдельное окно входа";
    case "register":
      return "Отдельное окно регистрации";
    case "profile":
      return "Профиль клиента";
    case "basket":
      return "Корзина клиента";
    case "product":
      return "Полная карточка товара";
    case "workspace":
      return getRole() === ROLE.ADMIN
        ? "Кабинет администратора аптеки"
        : "Кабинет супер-админа";
    case "workspace-order":
      return "Расширенная карточка заказа";
    case "catalog":
    default:
      return "Каталог товаров в аптечном стиле";
  }
}

function getHeroText() {
  const role = getRole();
  switch (state.route.name) {
    case "login":
      return "Вход единый, а после него интерфейс переключается под роль пользователя.";
    case "register":
      return "Регистрация открывает только клиентский поток: каталог, корзину и профиль.";
    case "profile":
      return "Здесь собрана информация о клиенте, его корзина и заказы.";
    case "basket":
      return "Здесь собраны все товары, управление количеством и предложения аптек.";
    case "product":
      return "Карточка раскрывает товар отдельным экраном, а не коротким блоком в каталоге.";
    case "workspace":
      return role === ROLE.ADMIN
        ? "В этом кабинете доступны профиль администратора, аптека, сотрудники, товары и заказы."
        : "В этом кабинете доступны админы, аптеки, все заказы, возвраты и управление товарами.";
    case "workspace-order":
      return "Это отдельный экран с детальной карточкой заказа и действиями по статусу.";
    case "catalog":
    default:
      return role === ROLE.CLIENT
        ? "Каталог сделан как витрина: карточки товара, отдельный экран и корзина."
        : "Каталог доступен и для ролей управления, а операционные действия вынесены в отдельный кабинет.";
  }
}

function getMedicineImageSource(images) {
  const firstImage = Array.isArray(images)
    ? images.find(image => image?.isMain) || images[0]
    : null;

  if (!firstImage?.key) return "";

  const key = String(firstImage.key).trim();
  if (/^(https?:|data:|blob:)/i.test(key)) return key;
  if (key.startsWith("/")) return `${state.baseUrl}${key}`;
  if (firstImage.id) return `${state.baseUrl}/api/medicines/images/${firstImage.id}/content`;
  return "";
}

function getInitials(value) {
  const source = String(value || "Т").trim();
  if (!source) return "Т";
  return source.slice(0, 2).toUpperCase();
}

function formatMoney(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
