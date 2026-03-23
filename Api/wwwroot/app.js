const STORAGE_KEY = "yalla.apteka.session";
const GUEST_BASKET_STORAGE_KEY = "yalla.guest.basket.v1";
const GUEST_CHECKOUT_INTENT_KEY = "yalla.guest.checkout.intent.v1";
const GUEST_POSITION_PREFIX = "guest:";
const DEFAULT_BASE_URL = window.location.origin?.startsWith("http")
  ? window.location.origin
  : "https://localhost:5001";
const TJ_PREFIX = "+992";
const MAX_MEDICINE_IMAGE_SIZE_BYTES = 50 * 1024 * 1024;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_ALLOWED_CHARS_REGEX = /^[A-Za-z0-9!@#$%^&*()\-_=.,?]+$/;
const LIVE_SEARCH_DEBOUNCE_MS = 260;
const MAIN_NAV_REGION = "main-nav";
const BASKET_OVERVIEW_REGION = "basket-overview";
const BASKET_POSITIONS_REGION = "basket-positions";
const BASKET_PHARMACY_REGION = "basket-pharmacy-selection";
const BASKET_CHECKOUT_REGION = "basket-checkout-panel";
const CATALOG_BASKET_SUMMARY_REGION = "catalog-basket-summary";
const ADMIN_INTERFACE_REGION = "admin-interface-content";
const SUPERADMIN_MAIN_INTERFACE_REGION = "superadmin-main-interface";
const REGISTER_VERIFY_RESEND_REGION = "register-verify-resend";
const PROFILE_ACCOUNT_REGION = "profile-account-actions";
const PAYMENT_AWAIT_STATUS_REGION = "payment-await-status";
const PROFILE_PENDING_PAYMENT_REGION = "profile-pending-payment";

const ROLE = {
  CLIENT: "Client",
  ADMIN: "Admin",
  SUPER_ADMIN: "SuperAdmin"
};

const PAYMENT_INTENT_STATE = {
  CREATED: 0,
  AWAITING_ADMIN_CONFIRMATION: 1,
  CONFIRMED: 2,
  REJECTED: 3,
  NEEDS_RESOLUTION: 4
};

const SUPERADMIN_INTERFACE = {
  PHARMACY_ADMIN: "pharmacy-admin",
  MEDICINE: "medicine",
  CLIENT: "client",
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
let workspaceLiveSearchTimer = 0;
let adminMedicineLiveSearchTimer = 0;
let superAdminMedicineLiveSearchTimer = 0;
let catalogFetchRequestId = 0;
let adminMedicineSearchRequestId = 0;
let superAdminMedicineDetailsRequestId = 0;
let superAdminMedicineSearchRequestId = 0;
let adminWorkspaceRequestId = 0;
let superAdminWorkspaceRequestId = 0;
let superAdminPharmacyAdminSearchRequestId = 0;
let superAdminClientSearchRequestId = 0;
let superAdminOrdersSearchRequestId = 0;
let registerVerifyCountdownTimer = 0;
let paymentAwaitCountdownTimer = 0;
let paymentAwaitPollTimer = 0;
let paymentAwaitPollInProgress = false;
let paymentAwaitEntryRedirectHandled = false;
const addToBasketInFlightMedicineIds = new Set();

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
  superAdminSelectedMedicineId: "",
  superAdminMedicineDetailsLoading: false,
  checkoutDraft: {
    pharmacyId: "",
    deliveryAddress: "",
    isPickup: false
  },
  checkoutInlineNotice: null,
  registrationVerification: null,
  paymentAwait: null,
  expandedBasketPharmacyDetails: new Set(),
  guestBasket: {
    items: [],
    pharmacyId: "",
    deliveryAddress: "",
    isPickup: false,
    updatedAt: ""
  },
  pendingGuestCheckoutAfterLogin: false,
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
  app.addEventListener("change", handleChange);
}

function restoreSession() {
  try {
    state.guestBasket = loadGuestBasket();
    state.pendingGuestCheckoutAfterLogin = hasGuestCheckoutIntent();
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      state.checkoutDraft.pharmacyId = state.guestBasket.pharmacyId || "";
      state.checkoutDraft.deliveryAddress = state.guestBasket.deliveryAddress || "";
      state.checkoutDraft.isPickup = Boolean(state.guestBasket.isPickup);
      return;
    }

    const parsed = JSON.parse(raw);
    state.baseUrl = normalizeBaseUrl(parsed.baseUrl || DEFAULT_BASE_URL);
    state.token = parsed.token || "";
    state.currentUser = parsed.currentUser || null;
    state.registrationVerification = normalizeRegistrationVerificationState(parsed.registrationVerification);
    state.paymentAwait = normalizePaymentAwaitState(parsed.paymentAwait);
    syncIdentityFromToken();

    if (!state.token) {
      state.checkoutDraft.pharmacyId = state.guestBasket.pharmacyId || "";
      state.checkoutDraft.deliveryAddress = state.guestBasket.deliveryAddress || "";
      state.checkoutDraft.isPickup = Boolean(state.guestBasket.isPickup);
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    state.guestBasket = createEmptyGuestBasket();
    state.pendingGuestCheckoutAfterLogin = false;
    state.registrationVerification = null;
    state.paymentAwait = null;
  }
}

function persistSession() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    baseUrl: state.baseUrl,
    token: state.token,
    currentUser: state.currentUser,
    registrationVerification: state.registrationVerification,
    paymentAwait: state.paymentAwait
  }));
}

function normalizeRegistrationVerificationState(rawValue) {
  if (!rawValue || typeof rawValue !== "object") return null;

  const registrationId = String(rawValue.registrationId || "").trim();
  if (!registrationId) return null;

  return {
    registrationId,
    phoneNumber: String(rawValue.phoneNumber || "").trim(),
    expiresAtUtc: String(rawValue.expiresAtUtc || ""),
    resendAvailableAtUtc: String(rawValue.resendAvailableAtUtc || ""),
    codeLength: Math.max(4, Math.min(8, Number(rawValue.codeLength || 6)))
  };
}

function normalizePaymentAwaitState(rawValue) {
  if (!rawValue || typeof rawValue !== "object") return null;

  const paymentIntentId = String(rawValue.paymentIntentId || "").trim();
  const reservedOrderId = String(rawValue.reservedOrderId || rawValue.orderId || "").trim();
  if (!paymentIntentId && !reservedOrderId) return null;

  return {
    paymentIntentId,
    reservedOrderId,
    orderId: reservedOrderId,
    paymentUrl: String(rawValue.paymentUrl || "").trim(),
    paymentExpiresAtUtc: String(rawValue.paymentExpiresAtUtc || "").trim(),
    createdAtUtc: String(rawValue.createdAtUtc || new Date().toISOString()),
    amount: Number(rawValue.amount || 0),
    currency: String(rawValue.currency || "TJS").trim() || "TJS"
  };
}

function createEmptyGuestBasket() {
  return {
    items: [],
    pharmacyId: "",
    deliveryAddress: "",
    isPickup: false,
    updatedAt: new Date().toISOString()
  };
}

function normalizeGuestBasket(rawValue) {
  const source = rawValue && typeof rawValue === "object" ? rawValue : {};
  const pickupRaw = source.isPickup;
  const rawItems = Array.isArray(source.items) ? source.items : [];
  const grouped = new Map();

  for (const item of rawItems) {
    const medicineId = String(item?.medicineId || "").trim();
    if (!medicineId) continue;

    const parsedQuantity = Number(item?.quantity ?? 0);
    if (!Number.isFinite(parsedQuantity)) continue;
    const quantity = Math.max(0, Math.floor(parsedQuantity));
    if (quantity <= 0) continue;

    const currentQuantity = grouped.get(medicineId) || 0;
    grouped.set(medicineId, Math.min(999, currentQuantity + quantity));

    if (grouped.size >= 100) {
      break;
    }
  }

  return {
    items: [...grouped.entries()].map(([medicineId, quantity]) => ({
      medicineId,
      quantity
    })),
    pharmacyId: String(source.pharmacyId || "").trim(),
    deliveryAddress: String(source.deliveryAddress || ""),
    isPickup: pickupRaw === true || pickupRaw === "true" || pickupRaw === 1 || pickupRaw === "1",
    updatedAt: typeof source.updatedAt === "string" && source.updatedAt
      ? source.updatedAt
      : new Date().toISOString()
  };
}

function loadGuestBasket() {
  try {
    const raw = localStorage.getItem(GUEST_BASKET_STORAGE_KEY);
    if (!raw) {
      const empty = createEmptyGuestBasket();
      state.guestBasket = empty;
      return empty;
    }

    const parsed = JSON.parse(raw);
    const normalized = normalizeGuestBasket(parsed);
    state.guestBasket = normalized;
    return normalized;
  } catch {
    localStorage.removeItem(GUEST_BASKET_STORAGE_KEY);
    const empty = createEmptyGuestBasket();
    state.guestBasket = empty;
    return empty;
  }
}

function saveGuestBasket(rawValue) {
  const normalized = normalizeGuestBasket(rawValue);
  normalized.updatedAt = new Date().toISOString();
  state.guestBasket = normalized;
  localStorage.setItem(GUEST_BASKET_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

function clearGuestBasket() {
  localStorage.removeItem(GUEST_BASKET_STORAGE_KEY);
  state.guestBasket = createEmptyGuestBasket();
}

function hasGuestCheckoutIntent() {
  return sessionStorage.getItem(GUEST_CHECKOUT_INTENT_KEY) === "1";
}

function setGuestCheckoutIntent(value) {
  if (value) {
    sessionStorage.setItem(GUEST_CHECKOUT_INTENT_KEY, "1");
    state.pendingGuestCheckoutAfterLogin = true;
    return;
  }

  sessionStorage.removeItem(GUEST_CHECKOUT_INTENT_KEY);
  state.pendingGuestCheckoutAfterLogin = false;
}

function consumeGuestCheckoutIntent() {
  const hasIntent = hasGuestCheckoutIntent();
  setGuestCheckoutIntent(false);
  return hasIntent;
}

function createGuestPositionId(medicineId) {
  return `${GUEST_POSITION_PREFIX}${String(medicineId || "").trim()}`;
}

function resolveGuestMedicineIdFromPosition(positionId) {
  const value = String(positionId || "").trim();
  if (!value) return "";
  if (value.startsWith(GUEST_POSITION_PREFIX)) {
    return value.slice(GUEST_POSITION_PREFIX.length);
  }

  return value;
}

function upsertGuestBasketItem(medicineId, quantity) {
  const normalizedMedicineId = String(medicineId || "").trim();
  const normalizedQuantity = Math.max(0, Math.floor(Number(quantity || 0)));
  if (!normalizedMedicineId) return loadGuestBasket();

  const basket = loadGuestBasket();
  const existingItems = Array.isArray(basket.items) ? basket.items : [];
  const nextItems = existingItems
    .filter(item => String(item.medicineId) !== normalizedMedicineId);

  if (normalizedQuantity > 0) {
    nextItems.push({
      medicineId: normalizedMedicineId,
      quantity: normalizedQuantity
    });
  }

  return saveGuestBasket({
    ...basket,
    items: nextItems
  });
}

function addGuestBasketQuantity(medicineId, quantityToAdd) {
  const normalizedMedicineId = String(medicineId || "").trim();
  const increment = Math.max(1, Math.floor(Number(quantityToAdd || 1)));
  if (!normalizedMedicineId) return loadGuestBasket();

  const basket = loadGuestBasket();
  const existing = (basket.items || []).find(item => String(item.medicineId) === normalizedMedicineId);
  const nextQuantity = Math.min(999, Number(existing?.quantity || 0) + increment);
  return upsertGuestBasketItem(normalizedMedicineId, nextQuantity);
}

function updateGuestCheckoutDraftStorage(
  pharmacyId = state.checkoutDraft.pharmacyId,
  deliveryAddress = state.checkoutDraft.deliveryAddress,
  isPickup = state.checkoutDraft.isPickup
) {
  const basket = loadGuestBasket();
  return saveGuestBasket({
    ...basket,
    pharmacyId: String(pharmacyId || "").trim(),
    deliveryAddress: String(deliveryAddress || ""),
    isPickup: Boolean(isPickup)
  });
}

function getGuestBasketItemCount() {
  const basket = state.guestBasket?.items ? state.guestBasket : loadGuestBasket();
  return Number(basket.items?.length || 0);
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

function validateSmsCodeInput(value, length = 6) {
  const normalized = String(value || "").replace(/\D+/g, "");
  if (!normalized) {
    return `Код: введите ${length} цифр.`;
  }

  return new RegExp(`^\\d{${length}}$`).test(normalized)
    ? ""
    : `Код: нужно ввести ровно ${length} цифр.`;
}

function getRegistrationResendSecondsLeft() {
  const raw = state.registrationVerification?.resendAvailableAtUtc;
  if (!raw) return 0;

  const resendAt = Date.parse(raw);
  if (!Number.isFinite(resendAt)) return 0;

  return Math.max(0, Math.ceil((resendAt - Date.now()) / 1000));
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
    case "/register/verify":
      return { name: "register-verify", medicineId: null, orderId: null };
    case "/payment-await":
      return { name: "payment-await", medicineId: null, orderId: null };
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
  syncRegisterVerifyCountdownTimer();
  syncPaymentAwaitPolling();

  if (state.route.name === "register-verify" && !state.registrationVerification) {
    showNotice("Сначала запросите код подтверждения номера телефона.", "warning");
    setRoute("/register");
    return;
  }

  if (state.route.name === "payment-await" && !state.paymentAwait) {
    showNotice("Сессия ожидания оплаты не найдена.", "warning");
    setRoute("/basket");
    return;
  }

  if (!state.paymentAwait) {
    paymentAwaitEntryRedirectHandled = false;
  } else if (
    !paymentAwaitEntryRedirectHandled
    && state.token
    && getRole() === ROLE.CLIENT
    && state.route.name !== "profile"
    && state.route.name !== "payment-await")
  {
    paymentAwaitEntryRedirectHandled = true;
    showNotice("Возврат после оплаты: открылся профиль с текущим заказом, ожидающим подтверждения SuperAdmin.", "success");
    setRoute("/profile");
    return;
  }

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

function syncRegisterVerifyCountdownTimer() {
  const shouldRun = state.route.name === "register-verify" && Boolean(state.registrationVerification);
  if (shouldRun && registerVerifyCountdownTimer === 0) {
    registerVerifyCountdownTimer = window.setInterval(() => {
      if (state.route.name === "register-verify" && state.registrationVerification) {
        replaceRegionOrFallback(REGISTER_VERIFY_RESEND_REGION, renderRegisterVerifyResendRegion());
      }
    }, 1000);
    return;
  }

  if (!shouldRun && registerVerifyCountdownTimer !== 0) {
    window.clearInterval(registerVerifyCountdownTimer);
    registerVerifyCountdownTimer = 0;
  }
}

function getPaymentAwaitSecondsLeft() {
  return 0;
}

function formatSecondsToMinuteClock(totalSeconds) {
  const safeValue = Math.max(0, Math.floor(Number(totalSeconds || 0)));
  const minutes = String(Math.floor(safeValue / 60)).padStart(2, "0");
  const seconds = String(safeValue % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function getPaymentAwaitStatusCountdownText(totalSeconds) {
  return "Ожидаем ручное подтверждение оплаты SuperAdmin.";
}

function getPaymentAwaitProfileCountdownText(totalSeconds) {
  return "Оплата отправлена, ожидаем подтверждение SuperAdmin.";
}

function updatePaymentAwaitCountdownDisplays() {
  const secondsLeft = getPaymentAwaitSecondsLeft();
  const statusText = getPaymentAwaitStatusCountdownText(secondsLeft);
  const profileText = getPaymentAwaitProfileCountdownText(secondsLeft);

  app.querySelectorAll("[data-payment-await-status-countdown]").forEach(node => {
    node.textContent = statusText;
  });
  app.querySelectorAll("[data-payment-await-profile-countdown]").forEach(node => {
    node.textContent = profileText;
  });

  const pendingOrderId = String(state.paymentAwait?.orderId || "").trim();
  if (!pendingOrderId) return;

  const orderTimerText = "Ожидание подтверждения";
  app.querySelectorAll("[data-payment-await-order-timer]").forEach(node => {
    const timerOrderId = String(node.getAttribute("data-payment-await-order-timer") || "").trim();
    if (timerOrderId !== pendingOrderId) return;
    node.textContent = orderTimerText;
  });
}

function refreshPaymentAwaitStatusRegions() {
  if (state.route.name === "payment-await") {
    replaceRegionIfExists(PAYMENT_AWAIT_STATUS_REGION, renderPaymentAwaitStatusRegion());
    updatePaymentAwaitCountdownDisplays();
    return;
  }

  if (state.route.name === "profile") {
    replaceRegionIfExists(PROFILE_PENDING_PAYMENT_REGION, renderProfilePendingPaymentRegion());
    updatePaymentAwaitCountdownDisplays();
  }
}

function syncPaymentAwaitPolling() {
  const shouldRun = (state.route.name === "payment-await" || state.route.name === "profile")
    && Boolean(state.paymentAwait?.paymentIntentId || state.paymentAwait?.orderId)
    && Boolean(state.token)
    && getRole() === ROLE.CLIENT;

  if (shouldRun) {
    if (paymentAwaitCountdownTimer === 0) {
      paymentAwaitCountdownTimer = window.setInterval(() => {
        updatePaymentAwaitCountdownDisplays();
      }, 1000);
    }

    if (paymentAwaitPollTimer === 0) {
      paymentAwaitPollTimer = window.setInterval(() => {
        void pollPaymentAwaitStatus();
      }, 5000);
    }

    updatePaymentAwaitCountdownDisplays();
    void pollPaymentAwaitStatus();
    return;
  }

  if (paymentAwaitCountdownTimer !== 0) {
    window.clearInterval(paymentAwaitCountdownTimer);
    paymentAwaitCountdownTimer = 0;
  }

  if (paymentAwaitPollTimer !== 0) {
    window.clearInterval(paymentAwaitPollTimer);
    paymentAwaitPollTimer = 0;
  }

  paymentAwaitPollInProgress = false;
}

async function pollPaymentAwaitStatus() {
  if (paymentAwaitPollInProgress) return;
  if (state.route.name !== "payment-await" && state.route.name !== "profile") return;
  if (!state.paymentAwait?.paymentIntentId && !state.paymentAwait?.orderId) return;
  if (!state.token || getRole() !== ROLE.CLIENT) return;

  paymentAwaitPollInProgress = true;
  try {
    const pendingState = state.paymentAwait;

    if (pendingState?.paymentIntentId) {
      const paymentIntentResponse = await apiFetch(`/api/clients/payment-intents/${pendingState.paymentIntentId}`);
      const paymentIntent = paymentIntentResponse?.paymentIntent || null;
      const paymentIntentState = Number(paymentIntent?.state ?? NaN);

      if (paymentIntentState === PAYMENT_INTENT_STATE.CONFIRMED && paymentIntentResponse?.orderId) {
        await finalizePaymentAwaitSuccess({ orderId: paymentIntentResponse.orderId });
        return;
      }

      if (paymentIntentState === PAYMENT_INTENT_STATE.REJECTED) {
        await finalizePaymentAwaitFailure("Оплата отклонена SuperAdmin.");
        return;
      }

      if (paymentIntentState === PAYMENT_INTENT_STATE.NEEDS_RESOLUTION) {
        await finalizePaymentAwaitFailure("Оплату нельзя автоматически завершить: нужна ручная проверка SuperAdmin.");
        return;
      }
    } else {
      const historyResponse = await apiFetch("/api/orders/client-history");
      const orders = Array.isArray(historyResponse?.orders) ? historyResponse.orders : [];
      const currentOrder = orders.find(order => String(order?.orderId || "").trim() === pendingState.orderId);

      if (currentOrder) {
        const paymentState = formatPaymentStateLabel(currentOrder.paymentState);
        const orderStatus = formatStatusLabel(currentOrder.status);
        const isSuccessfulPostPaymentStatus = orderStatus === "UnderReview"
          || orderStatus === "Preparing"
          || orderStatus === "Ready"
          || orderStatus === "OnTheWay"
          || orderStatus === "Delivered"
          || orderStatus === "Returned";

        if (paymentState === "Confirmed" || isSuccessfulPostPaymentStatus) {
          await finalizePaymentAwaitSuccess(currentOrder);
          return;
        }

        if (paymentState === "Expired" || orderStatus === "Cancelled") {
          await finalizePaymentAwaitFailure("Оплата не подтверждена.");
          return;
        }
      }
    }

    refreshPaymentAwaitStatusRegions();
  } catch (error) {
    if (Number(error?.status || 0) === 401) {
      handleError(error);
      return;
    }
  } finally {
    paymentAwaitPollInProgress = false;
  }
}

async function finalizePaymentAwaitSuccess(order) {
  const orderId = String(order?.orderId || state.paymentAwait?.orderId || "").trim();
  const shortOrderId = orderId.slice(0, 8);

  state.paymentAwait = null;
  paymentAwaitEntryRedirectHandled = false;
  persistSession();
  syncPaymentAwaitPolling();

  await Promise.all([
    fetchBasket({ silent: true }),
    fetchProfile({ silent: true })
  ]);

  showNotice(
    shortOrderId
      ? `Оплата подтверждена. Заказ ${shortOrderId} успешно оформлен.`
      : "Оплата подтверждена. Заказ успешно оформлен.",
    "success"
  );

  setRoute("/profile");
}

async function finalizePaymentAwaitFailure(reason = "Оплата не подтверждена.") {
  const orderId = String(state.paymentAwait?.orderId || "").trim();
  const shortOrderId = orderId.slice(0, 8);

  state.paymentAwait = null;
  paymentAwaitEntryRedirectHandled = false;
  persistSession();
  syncPaymentAwaitPolling();

  await Promise.all([
    fetchBasket({ silent: true }),
    fetchProfile({ silent: true })
  ]);

  showNotice(
    shortOrderId
      ? `Не получилось оформить заказ ${shortOrderId}: ${reason}`
      : `Не получилось оформить заказ: ${reason}`,
    "warning"
  );

  setRoute("/basket");
}

function canAccessRoute(routeName) {
  if (routeName === "login" || routeName === "register" || routeName === "register-verify" || routeName === "catalog" || routeName === "product") return true;
  if (routeName === "basket" && !state.token) return true;
  if (!state.token) return false;

  const role = getRole();
  if (routeName === "payment-await") return role === ROLE.CLIENT;
  if (routeName === "profile") return role === ROLE.CLIENT;
  if (routeName === "basket") return role === ROLE.CLIENT;
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
    case "register-verify":
      return "Подтверждение телефона | Yalla Farm Apteka";
    case "payment-await":
      return "Ожидание оплаты | Yalla Farm Apteka";
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

    if (formType === "register-verify") {
      await verifyRegistration(formData);
      return;
    }

    if (formType === "register-resend") {
      await resendRegistrationCode();
      return;
    }

    if (formType === "catalog-search") {
      state.pendingSearch = String(formData.get("query") || "").trim();
      await fetchCatalog({
        silent: true,
        partial: true
      });
      return;
    }

    if (formType === "admin-medicine-search") {
      state.adminMedicineSearch = String(formData.get("query") || "").trim();
      await fetchAdminMedicineCatalog({
        silent: true,
        partial: true
      });
      return;
    }

    if (formType === "admin-order-filter") {
      state.adminOrderStatusFilter = String(formData.get("status") || "").trim();
      await fetchAdminOrders({
        silent: true,
        partial: true
      });
      return;
    }

    if (formType === "superadmin-order-filter") {
      state.superAdminOrderStatusFilter = String(formData.get("status") || "").trim();
      await fetchSuperAdminOrders({
        silent: true,
        partial: true
      });
      return;
    }

    if (formType === "superadmin-pharmacy-admin-search") {
      state.superAdminSearch.pharmacyAdmin = String(formData.get("query") || "").trim();
      await fetchSuperAdminPharmacyAdmin({
        silent: true,
        partial: true
      });
      return;
    }

    if (formType === "superadmin-medicine-search") {
      state.superAdminSearch.medicine = String(formData.get("query") || "").trim();
      await fetchSuperAdminMedicineCatalog({
        silent: true,
        partial: true
      });
      return;
    }

    if (formType === "superadmin-client-search") {
      state.superAdminSearch.client = String(formData.get("query") || "").trim();
      await fetchSuperAdminClients({
        silent: true,
        partial: true
      });
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

    if (formType === "profile-delete-account") {
      await deleteMyAccount();
      return;
    }

    if (formType === "add-to-basket") {
      await addToBasket(formData, form);
      return;
    }

    if (formType === "basket-quantity") {
      const positionId = String(formData.get("positionId") || "").trim();
      const quantity = Math.max(1, Number(formData.get("quantity") || "1"));
      await updateBasketQuantity(positionId, quantity, {
        showNotice: false,
        silentFetch: true
      });
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
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) {
    return;
  }

  const form = target.closest("form[data-form]");
  if (!(form instanceof HTMLFormElement)) return;

  const formType = String(form.dataset.form || "").trim();

  if (formType === "catalog-search" && target.name === "query") {
    state.pendingSearch = String(target.value || "").trim();
    window.clearTimeout(catalogLiveSearchTimer);
    catalogLiveSearchTimer = window.setTimeout(() => {
      void fetchCatalog({
        silent: true,
        partial: true
      }).catch(handleError);
    }, LIVE_SEARCH_DEBOUNCE_MS);
    return;
  }

  if (formType === "admin-medicine-search" && target.name === "query") {
    state.adminMedicineSearch = String(target.value || "").trim();
    window.clearTimeout(adminMedicineLiveSearchTimer);
    adminMedicineLiveSearchTimer = window.setTimeout(() => {
      void fetchAdminMedicineCatalog({
        silent: true,
        partial: true
      }).catch(handleError);
    }, LIVE_SEARCH_DEBOUNCE_MS);
    return;
  }

  if (formType === "superadmin-medicine-search" && target.name === "query") {
    state.superAdminSearch.medicine = String(target.value || "").trim();
    window.clearTimeout(superAdminMedicineLiveSearchTimer);
    superAdminMedicineLiveSearchTimer = window.setTimeout(() => {
      void fetchSuperAdminMedicineCatalog({
        silent: true,
        partial: true
      }).catch(handleError);
    }, LIVE_SEARCH_DEBOUNCE_MS);
    return;
  }

  if (formType === "superadmin-pharmacy-admin-search" && target.name === "query") {
    state.superAdminSearch.pharmacyAdmin = String(target.value || "").trim();
    window.clearTimeout(workspaceLiveSearchTimer);
    workspaceLiveSearchTimer = window.setTimeout(() => {
      void fetchSuperAdminPharmacyAdmin({
        silent: true,
        partial: true
      }).catch(handleError);
    }, LIVE_SEARCH_DEBOUNCE_MS);
    return;
  }

  if (formType === "superadmin-client-search" && target.name === "query") {
    state.superAdminSearch.client = String(target.value || "").trim();
    window.clearTimeout(workspaceLiveSearchTimer);
    workspaceLiveSearchTimer = window.setTimeout(() => {
      void fetchSuperAdminClients({
        silent: true,
        partial: true
      }).catch(handleError);
    }, LIVE_SEARCH_DEBOUNCE_MS);
    return;
  }

  if (formType === "admin-order-filter" && target.name === "status") {
    state.adminOrderStatusFilter = String(target.value || "").trim();
    window.clearTimeout(workspaceLiveSearchTimer);
    workspaceLiveSearchTimer = window.setTimeout(() => {
      void fetchAdminOrders({
        silent: true,
        partial: true
      }).catch(handleError);
    }, Math.max(80, LIVE_SEARCH_DEBOUNCE_MS / 2));
    return;
  }

  if (formType === "superadmin-order-filter" && target.name === "status") {
    state.superAdminOrderStatusFilter = String(target.value || "").trim();
    window.clearTimeout(workspaceLiveSearchTimer);
    workspaceLiveSearchTimer = window.setTimeout(() => {
      void fetchSuperAdminOrders({
        silent: true,
        partial: true
      }).catch(handleError);
    }, Math.max(80, LIVE_SEARCH_DEBOUNCE_MS / 2));
    return;
  }

  if (formType === "client-checkout" && target.name === "deliveryAddress") {
    state.checkoutDraft.deliveryAddress = String(target.value || "");
    if (state.checkoutInlineNotice) {
      clearCheckoutInlineNotice();
      renderBasketPharmacyCheckoutRegions({ pharmacy: false });
      return;
    }
    if (!state.token) {
      updateGuestCheckoutDraftStorage(
        state.checkoutDraft.pharmacyId,
        state.checkoutDraft.deliveryAddress,
        state.checkoutDraft.isPickup
      );
    }
    return;
  }

  if (formType === "client-checkout" && target.name === "pharmacyId") {
    state.checkoutDraft.pharmacyId = String(target.value || "").trim();
    clearCheckoutInlineNotice();
    if (!state.token) {
      updateGuestCheckoutDraftStorage(
        state.checkoutDraft.pharmacyId,
        state.checkoutDraft.deliveryAddress,
        state.checkoutDraft.isPickup
      );
    }
    renderBasketPharmacyCheckoutRegions();
    return;
  }

  if (formType === "client-checkout" && target.name === "isPickup") {
    const value = String(target.value || "").trim().toLowerCase();
    state.checkoutDraft.isPickup = value === "true" || value === "1" || value === "pickup";
    clearCheckoutInlineNotice();
    if (!state.token) {
      updateGuestCheckoutDraftStorage(
        state.checkoutDraft.pharmacyId,
        state.checkoutDraft.deliveryAddress,
        state.checkoutDraft.isPickup
      );
    }
    renderBasketPharmacyCheckoutRegions({ pharmacy: false });
  }
}

function handleChange(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) {
    return;
  }

  const form = target.closest("form[data-form]");
  if (!(form instanceof HTMLFormElement)) return;

  const formType = String(form.dataset.form || "").trim();
  if (formType !== "basket-quantity" || target.name !== "quantity") {
    return;
  }

  const positionId = String(form.querySelector("[name='positionId']")?.value || "").trim();
  if (!positionId) return;

  const parsed = Number(target.value || "1");
  const normalizedQuantity = Number.isFinite(parsed)
    ? Math.max(1, Math.floor(parsed))
    : 1;

  target.value = String(normalizedQuantity);

  void updateBasketQuantity(positionId, normalizedQuantity, {
    showNotice: false,
    silentFetch: true
  }).catch(handleError);
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
      showNotice("Для оформления и оплаты заказа войдите или зарегистрируйтесь.", "warning");
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
        renderAdminInterfaceRegion();
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
        renderSuperAdminMainInterfaceRegion();
      }
      return;
    }

    if (action === "superadmin-medicine-select") {
      const medicineId = String(actionTarget.dataset.medicineId || "").trim();
      if (!medicineId) return;

      state.superAdminSelectedMedicineId = medicineId;
      renderSuperAdminMedicineManagerRegion();
      await ensureSuperAdminMedicineDetails(medicineId, { partial: true });
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

    if (action === "pharmacy-details-toggle") {
      const pharmacyId = String(actionTarget.dataset.pharmacyId || "").trim();
      if (!pharmacyId) return;

      if (state.expandedBasketPharmacyDetails.has(pharmacyId)) {
        state.expandedBasketPharmacyDetails.delete(pharmacyId);
      } else {
        state.expandedBasketPharmacyDetails.add(pharmacyId);
      }

      renderBasketPharmacyCheckoutRegions({ checkout: false });
      return;
    }

    if (action === "checkout-use-pharmacy") {
      const pharmacyId = String(actionTarget.dataset.pharmacyId || "").trim();
      if (!pharmacyId) return;
      const isAvailable = String(actionTarget.dataset.pharmacyAvailable || "1") === "1";
      if (!isAvailable) {
        return;
      }

      state.checkoutDraft.pharmacyId = pharmacyId;
      clearCheckoutInlineNotice();
      if (!state.token) {
        updateGuestCheckoutDraftStorage(
          state.checkoutDraft.pharmacyId,
          state.checkoutDraft.deliveryAddress,
          state.checkoutDraft.isPickup
        );
      }
      renderBasketPharmacyCheckoutRegions();
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
      const isPickup = String(actionTarget.dataset.orderPickup || "") === "1";
      const confirmed = window.confirm(
        isPickup
          ? "Подтвердить, что заказ выдан клиенту?"
          : "Перевести заказ в статус OnTheWay (едет)?"
      );
      if (!confirmed) return;
      await performAdminOrderAction(
        "/api/orders/on-the-way",
        actionTarget.dataset.orderId,
        isPickup ? "Заказ отмечен как выданный клиенту." : "Заказ отмечен как отправленный."
      );
      return;
    }

    if (action === "order-delete-new-admin") {
      const confirmed = window.confirm("Удалить заказ в статусе New? Заказ будет удален из базы.");
      if (!confirmed) return;
      await deleteNewOrderAsAdmin(actionTarget.dataset.orderId);
      return;
    }

    if (action === "order-superadmin-next") {
      const currentStatus = String(actionTarget.dataset.currentStatus || "").trim();
      const confirmationText = currentStatus === "New"
        ? "Подтвердить заказ и перевести в статус UnderReview?"
        : "Перевести заказ в следующий статус?";
      const confirmed = window.confirm(confirmationText);
      if (!confirmed) return;
      await performSuperAdminOrderNextStatus(actionTarget.dataset.orderId, currentStatus);
      return;
    }

    if (action === "payment-intent-confirm") {
      const confirmed = window.confirm("Подтвердить оплату и создать заказ?");
      if (!confirmed) return;
      await confirmPaymentIntentAsSuperAdmin(actionTarget.dataset.paymentIntentId);
      return;
    }

    if (action === "payment-intent-reject") {
      await rejectPaymentIntentAsSuperAdmin(actionTarget.dataset.paymentIntentId);
      return;
    }

    if (action === "client-delete-by-id") {
      const clientId = String(actionTarget.dataset.clientId || "").trim();
      await deleteClientAsSuperAdminById(clientId);
      return;
    }

    if (action === "order-delivered") {
      const confirmed = window.confirm("Перевести выбранный заказ в статус «Получен клиентом»?");
      if (!confirmed) return;
      await performSuperAdminOrderNextStatus(actionTarget.dataset.orderId, "OnTheWay");
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
  window.clearTimeout(workspaceLiveSearchTimer);
  window.clearTimeout(adminMedicineLiveSearchTimer);
  window.clearTimeout(superAdminMedicineLiveSearchTimer);
  if (registerVerifyCountdownTimer !== 0) {
    window.clearInterval(registerVerifyCountdownTimer);
    registerVerifyCountdownTimer = 0;
  }
  if (paymentAwaitCountdownTimer !== 0) {
    window.clearInterval(paymentAwaitCountdownTimer);
    paymentAwaitCountdownTimer = 0;
  }
  if (paymentAwaitPollTimer !== 0) {
    window.clearInterval(paymentAwaitPollTimer);
    paymentAwaitPollTimer = 0;
  }
  paymentAwaitPollInProgress = false;
  paymentAwaitEntryRedirectHandled = false;
  catalogFetchRequestId = 0;
  adminMedicineSearchRequestId = 0;
  superAdminMedicineSearchRequestId = 0;
  superAdminMedicineDetailsRequestId = 0;
  adminWorkspaceRequestId = 0;
  superAdminWorkspaceRequestId = 0;
  superAdminPharmacyAdminSearchRequestId = 0;
  superAdminClientSearchRequestId = 0;
  superAdminOrdersSearchRequestId = 0;
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
  state.superAdminSelectedMedicineId = "";
  state.superAdminMedicineDetailsLoading = false;
  state.registrationVerification = null;
  state.paymentAwait = null;
  state.expandedBasketPharmacyDetails = new Set();
  const guestBasket = loadGuestBasket();
  state.checkoutDraft.pharmacyId = guestBasket.pharmacyId || "";
  state.checkoutDraft.deliveryAddress = guestBasket.deliveryAddress || "";
  state.checkoutDraft.isPickup = Boolean(guestBasket.isPickup);
  state.guestBasket = guestBasket;
  setGuestCheckoutIntent(false);
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

  const role = getRole();
  const continueCheckoutAfterLogin = consumeGuestCheckoutIntent();
  let mergeResult = {
    mergedCount: 0,
    failedCount: 0
  };

  if (role === ROLE.CLIENT) {
    mergeResult = await mergeGuestBasketIntoClient({
      silent: true
    });
  }

  if (continueCheckoutAfterLogin) {
    if (role !== ROLE.CLIENT) {
      showNotice("Оформление заказа доступно только клиенту.", "warning");
      setRoute(defaultAuthenticatedRoute());
      return;
    }

    if (mergeResult.mergedCount > 0 && mergeResult.failedCount === 0) {
      showNotice("Вход выполнен. Гостевая корзина перенесена, можно оплатить заказ.", "success");
    } else if (mergeResult.failedCount > 0) {
      showNotice("Вход выполнен. Часть гостевых позиций не удалось перенести в корзину.", "warning");
    } else {
      showNotice("Вход выполнен. Продолжайте оформление заказа.", "success");
    }

    setRoute("/basket");
    return;
  }

  if (role === ROLE.CLIENT) {
    if (mergeResult.mergedCount > 0 && mergeResult.failedCount === 0) {
      showNotice("Вход выполнен. Гостевая корзина перенесена в ваш аккаунт.", "success");
    } else if (mergeResult.failedCount > 0) {
      showNotice("Вход выполнен. Часть гостевых позиций не удалось перенести.", "warning");
    } else {
      showNotice("Вход выполнен.", "success");
    }
  } else {
    showNotice("Вход выполнен.", "success");
  }

  setRoute(defaultAuthenticatedRoute());
}

async function register(formData) {
  const phoneNumber = normalizePhoneInputValue(formData.get("phoneNumber"));
  const password = String(formData.get("password") || "");
  const registrationMode = String(formData.get("registrationMode") || "").trim().toLowerCase();
  const skipPhoneVerification = registrationMode === "skip" || formData.get("skipPhoneVerification") !== null;
  const enteredName = String(formData.get("name") || "").trim();
  const name = enteredName || `Клиент ${phoneNumber}`;
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

  if (skipPhoneVerification) {
    await withLoading("Создаем аккаунт...", () => apiFetch("/api/clients/register", {
      method: "POST",
      body: {
        name,
        phoneNumber,
        password,
        skipPhoneVerification: true
      },
      auth: false
    }));

    state.registrationVerification = null;
    persistSession();
    showNotice("Аккаунт создан. Теперь можно войти.", "success");
    setRoute("/login");
    return;
  }

  const response = await withLoading("Отправляем код подтверждения...", () => apiFetch("/api/clients/register/request", {
    method: "POST",
    body: {
      name,
      phoneNumber,
      password
    },
    auth: false
  }));

  state.registrationVerification = {
    registrationId: String(response.registrationId || "").trim(),
    phoneNumber: String(response.phoneNumber || phoneNumber).trim(),
    expiresAtUtc: String(response.expiresAtUtc || ""),
    resendAvailableAtUtc: String(response.resendAvailableAtUtc || ""),
    codeLength: Math.max(4, Math.min(8, Number(response.codeLength || 6)))
  };
  persistSession();

  showNotice("Код подтверждения отправлен. Введите его для завершения регистрации.", "success");
  setRoute("/register/verify");
}

async function verifyRegistration(formData) {
  if (!state.registrationVerification?.registrationId) {
    showNotice("Сессия подтверждения не найдена. Запросите код снова.", "warning");
    setRoute("/register");
    return;
  }

  const expectedLength = Number(state.registrationVerification.codeLength || 6);
  const codeRaw = String(formData.get("code") || "");
  const code = codeRaw.replace(/\D+/g, "");
  const codeError = validateSmsCodeInput(code, expectedLength);
  if (codeError) {
    showNotice(codeError, "warning");
    return;
  }

  await withLoading("Проверяем код...", () => apiFetch("/api/clients/register/verify", {
    method: "POST",
    body: {
      registrationId: state.registrationVerification.registrationId,
      code
    },
    auth: false
  }));

  state.registrationVerification = null;
  syncRegisterVerifyCountdownTimer();
  persistSession();
  showNotice("Регистрация подтверждена. Теперь можно войти.", "success");
  setRoute("/login");
}

async function resendRegistrationCode() {
  const registrationId = String(state.registrationVerification?.registrationId || "").trim();
  if (!registrationId) {
    showNotice("Сессия подтверждения не найдена. Запросите код снова.", "warning");
    setRoute("/register");
    return;
  }

  const secondsLeft = getRegistrationResendSecondsLeft();
  if (secondsLeft > 0) {
    showNotice(`Запросить новый код можно через ${secondsLeft} сек.`, "warning");
    return;
  }

  const response = await withLoading("Запрашиваем новый код...", () => apiFetch("/api/clients/register/resend", {
    method: "POST",
    body: {
      registrationId
    },
    auth: false
  }));

  state.registrationVerification = {
    ...state.registrationVerification,
    expiresAtUtc: String(response.expiresAtUtc || state.registrationVerification.expiresAtUtc || ""),
    resendAvailableAtUtc: String(response.resendAvailableAtUtc || state.registrationVerification.resendAvailableAtUtc || ""),
    codeLength: Math.max(4, Math.min(8, Number(response.codeLength || state.registrationVerification.codeLength || 6)))
  };
  persistSession();

  showNotice("Новый код отправлен.", "success");
  if (state.route.name === "register-verify" && state.registrationVerification) {
    replaceRegionOrFallback(REGISTER_VERIFY_RESEND_REGION, renderRegisterVerifyResendRegion());
    return;
  }

  render();
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

async function deleteMyAccount() {
  const confirmed = window.confirm("Удалить аккаунт? История заказов сохранится, но доступ к профилю будет потерян.");
  if (!confirmed) return;

  await withLoading("Удаляем аккаунт...", () => apiFetch("/api/clients/me", {
    method: "DELETE"
  }));

  clearSession();
  showNotice("Аккаунт удален. История заказов сохранена.", "success");
  setRoute("/register");
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

function animateAddToBasketFeedback(form) {
  if (!(form instanceof HTMLFormElement)) return;
  const submitButton = form.querySelector("button[type='submit']");
  if (!(submitButton instanceof HTMLButtonElement)) return;

  submitButton.classList.remove("basket-add-success");
  void submitButton.offsetWidth;
  submitButton.classList.add("basket-add-success");
  window.setTimeout(() => {
    submitButton.classList.remove("basket-add-success");
  }, 680);
}

async function addToBasket(formData, formElement = null) {
  const medicineId = String(formData.get("medicineId") || "").trim();
  const quantity = Math.max(1, Number(formData.get("quantity") || "1"));
  if (!medicineId) {
    showNotice("Не удалось определить товар для корзины.", "warning");
    return;
  }

  if (addToBasketInFlightMedicineIds.has(medicineId)) return;

  const submitButton = formElement?.querySelector("button[type='submit']");
  const hasSubmitButton = submitButton instanceof HTMLButtonElement;
  addToBasketInFlightMedicineIds.add(medicineId);
  if (hasSubmitButton) {
    submitButton.disabled = true;
  }

  try {
    if (!state.token) {
      addGuestBasketQuantity(medicineId, quantity);
      await hydrateMedicineDetails([medicineId]);
      animateAddToBasketFeedback(formElement);
      await fetchBasket({
        silent: true,
        partial: true
      });
      return;
    }

    if (getRole() !== ROLE.CLIENT) {
      showNotice("Корзина доступна только клиенту.", "warning");
      return;
    }

    await withLoading("Добавляем товар в корзину...", () => apiFetch("/api/basket/items", {
      method: "POST",
      body: {
        medicineId,
        quantity
      }
    }), {
      silent: true
    });

    animateAddToBasketFeedback(formElement);
    await fetchBasket({
      silent: true,
      partial: true
    });
  } finally {
    addToBasketInFlightMedicineIds.delete(medicineId);
    if (hasSubmitButton) {
      submitButton.disabled = false;
    }
  }
}

async function removeFromBasket(positionId) {
  if (!positionId) return;

  if (!state.token) {
    const medicineId = resolveGuestMedicineIdFromPosition(positionId);
    upsertGuestBasketItem(medicineId, 0);
    await fetchBasket({ silent: true, partial: true });
    return;
  }

  await withLoading("Удаляем товар из корзины...", () => apiFetch("/api/basket/items", {
    method: "DELETE",
    body: { positionId }
  }), {
    silent: true
  });

  await fetchBasket({ partial: true });
}

async function clearBasket() {
  if (!state.token) {
    clearGuestBasket();
    state.expandedBasketPharmacyDetails = new Set();
    clearCheckoutInlineNotice();
    state.checkoutDraft.pharmacyId = "";
    state.checkoutDraft.deliveryAddress = "";
    state.checkoutDraft.isPickup = false;
    state.basket = {
      clientId: "",
      basketItemsCount: 0,
      basketPositions: [],
      pharmacyOptions: []
    };
    updateMainNavRegion();
    if (isBasketViewVisible()) {
      renderBasketViewRegions();
      return;
    }

    render();
    return;
  }

  await withLoading("Очищаем корзину...", () => apiFetch("/api/basket", {
    method: "DELETE",
    body: {}
  }), {
    silent: true
  });

  state.expandedBasketPharmacyDetails = new Set();
  clearCheckoutInlineNotice();
  await fetchBasket({ partial: true });
}

async function updateBasketQuantity(positionId, quantity, options = {}) {
  const silentFetch = Boolean(options.silentFetch);

  if (!state.token) {
    const medicineId = resolveGuestMedicineIdFromPosition(positionId);
    const normalizedQuantity = Math.max(1, Math.floor(Number(quantity || 1)));
    upsertGuestBasketItem(medicineId, normalizedQuantity);
    await fetchBasket({ silent: true, partial: true });
    return;
  }

  await withLoading("Обновляем количество...", () => apiFetch("/api/basket/items/quantity", {
    method: "PATCH",
    body: {
      positionId,
      quantity
    }
  }), {
    silent: true
  });

  await fetchBasket({ silent: silentFetch, partial: true });
}

async function checkoutBasket(formData) {
  const isGuest = !state.token;

  const pharmacyId = String(formData.get("pharmacyId") || state.checkoutDraft.pharmacyId || "").trim();
  const isPickupValue = String(formData.get("isPickup") ?? state.checkoutDraft.isPickup).trim().toLowerCase();
  const isPickup = isPickupValue === "true" || isPickupValue === "1" || isPickupValue === "pickup";
  const deliveryAddress = String(formData.get("deliveryAddress") || "").trim();

  if (!pharmacyId) {
    setCheckoutInlineNotice("Выберите аптеку для оформления заказа.", "warning");
    renderBasketPharmacyCheckoutRegions();
    return;
  }

  if (!isPickup && !deliveryAddress) {
    setCheckoutInlineNotice("Укажите адрес доставки.", "warning");
    renderBasketPharmacyCheckoutRegions({ pharmacy: false });
    return;
  }

  state.checkoutDraft.pharmacyId = pharmacyId;
  state.checkoutDraft.deliveryAddress = deliveryAddress;
  state.checkoutDraft.isPickup = isPickup;
  clearCheckoutInlineNotice();

  if (isGuest) {
    updateGuestCheckoutDraftStorage(pharmacyId, deliveryAddress, isPickup);
    setGuestCheckoutIntent(true);
    showNotice("Для оплаты нужно войти. Гостевая корзина и адрес сохранены.", "warning");
    setRoute("/login");
    return;
  }

  if (getRole() !== ROLE.CLIENT) {
    showNotice("Оформление заказа доступно только клиенту.", "warning");
    return;
  }

  const idempotencyKey = createCheckoutIdempotencyKey();
  const checkoutPayload = {
    pharmacyId,
    isPickup,
    deliveryAddress,
    idempotencyKey,
    ignoredPositionIds: []
  };

  const preview = await withLoading("Проверяем заказ перед оформлением...", () => apiFetch("/api/clients/checkout/preview", {
    method: "POST",
    body: checkoutPayload
  }));

  if (!preview.canCheckout) {
    setCheckoutInlineNotice(formatCheckoutPreviewMessage(preview), "warning");
    await fetchBasket({ silent: true, partial: true });
    renderBasketPharmacyCheckoutRegions({ pharmacy: false });
    return;
  }

  const checkoutResponse = await withLoading("Оформляем заказ...", () => apiFetch("/api/clients/checkout", {
    method: "POST",
    body: checkoutPayload
  }));

  state.checkoutDraft.pharmacyId = "";
  state.checkoutDraft.deliveryAddress = "";
  state.checkoutDraft.isPickup = false;
  clearCheckoutInlineNotice();
  clearGuestBasket();
  setGuestCheckoutIntent(false);

  const reservedOrderId = String(checkoutResponse.reservedOrderId || checkoutResponse.orderId || "").trim();
  const paymentIntentId = String(checkoutResponse.paymentIntentId || "").trim();
  const shortOrderId = reservedOrderId.slice(0, 8);
  const paymentUrl = String(checkoutResponse.paymentUrl || "").trim();

  if (paymentUrl) {
    state.paymentAwait = normalizePaymentAwaitState({
      paymentIntentId,
      reservedOrderId,
      paymentUrl,
      paymentExpiresAtUtc: String(checkoutResponse.paymentExpiresAtUtc || ""),
      createdAtUtc: new Date().toISOString(),
      amount: Number(checkoutResponse.cost || checkoutResponse.amount || 0),
      currency: String(checkoutResponse.currency || "TJS")
    });
    paymentAwaitEntryRedirectHandled = false;
    persistSession();

    if (!confirmExternalPaymentRedirect(paymentUrl)) {
      showNotice("Редирект на внешний сайт оплаты отменен. Вы можете перейти к оплате позже из профиля.", "warning");
      await Promise.all([
        fetchBasket({ silent: true }),
        fetchProfile({ silent: true })
      ]);
      setRoute("/profile");
      return;
    }

    showNotice("Переходим на сайт оплаты DushanbeCity...", "success");
    window.location.assign(paymentUrl);
    return;
  }

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

function confirmExternalPaymentRedirect(paymentUrl) {
  const safeUrl = String(paymentUrl || "").trim();
  if (!safeUrl) return false;

  return window.confirm(
    "Вы будете перенаправлены на внешний сайт оплаты DushanbeCity (QR). Продолжить переход?"
  );
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
  const confirmed = window.confirm("Деактивировать аптеку? Она станет неактивной и останется в истории заказов.");
  if (!confirmed) return;

  await withLoading("Деактивируем аптеку...", () => apiFetch("/api/pharmacies", {
    method: "DELETE",
    body: {
      pharmacyId: String(formData.get("pharmacyId") || "").trim()
    }
  }));

  showNotice("Аптека деактивирована.", "success");
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
  await deleteClientAsSuperAdminById(clientId);
}

async function deleteClientAsSuperAdminById(clientId) {
  if (!clientId) {
    showNotice("ClientId не передан.", "warning");
    return;
  }

  const confirmed = window.confirm("Удалить клиента? Это действие нельзя отменить.");
  if (!confirmed) return;

  await withLoading("Удаляем клиента...", () => apiFetch("/api/clients", {
    method: "DELETE",
    body: {
      clientId
    }
  }));

  showNotice("Аккаунт клиента удален. История заказов сохранена.", "success");
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

async function deleteNewOrderAsAdmin(orderId) {
  await withLoading("Удаляем новый заказ...", () => apiFetch("/api/orders/admin/new/delete", {
    method: "POST",
    body: {
      orderId
    }
  }));

  showNotice("Новый заказ удален.", "success");
  await fetchWorkspace();
}

async function performSuperAdminOrderNextStatus(orderId, currentStatus = "") {
  await withLoading("Переводим заказ в следующий статус...", () => apiFetch("/api/orders/superadmin/next-status", {
    method: "POST",
    body: {
      orderId
    }
  }));

  const status = String(currentStatus || "").trim();
  const successMessage = status === "New"
    ? "Заказ подтвержден и переведен в статус UnderReview."
    : "Заказ переведен в следующий статус.";

  showNotice(successMessage, "success");
  await fetchWorkspace();
}

async function confirmPaymentIntentAsSuperAdmin(paymentIntentId) {
  const normalizedId = String(paymentIntentId || "").trim();
  if (!normalizedId) return;

  await withLoading("Подтверждаем оплату и создаем заказ...", () => apiFetch(`/api/superadmin/payment-intents/${normalizedId}/confirm`, {
    method: "POST"
  }));

  showNotice("Оплата подтверждена. Заказ создан или уже был создан.", "success");
  await fetchWorkspace();
}

async function rejectPaymentIntentAsSuperAdmin(paymentIntentId) {
  const normalizedId = String(paymentIntentId || "").trim();
  if (!normalizedId) return;

  const reason = window.prompt("Укажите причину отклонения оплаты:", "Оплата не подтверждена");
  if (reason === null) return;

  const normalizedReason = String(reason || "").trim();
  if (!normalizedReason) {
    showNotice("Причина отклонения обязательна.", "warning");
    return;
  }

  await withLoading("Отклоняем оплату...", () => apiFetch(`/api/superadmin/payment-intents/${normalizedId}/reject`, {
    method: "POST",
    body: { reason: normalizedReason }
  }));

  showNotice("Оплата отклонена.", "success");
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

function isCatalogViewVisible() {
  return state.route.name === "catalog";
}

function replaceRegionIfExists(regionName, markup) {
  const regionNode = app.querySelector(`[data-region='${regionName}']`);
  if (!(regionNode instanceof HTMLElement)) {
    return false;
  }

  regionNode.outerHTML = markup;
  return true;
}

function replaceRegionOrFallback(regionName, markup) {
  if (!replaceRegionIfExists(regionName, markup)) {
    render();
    return false;
  }
  return true;
}

function renderCatalogResultsRegion() {
  if (!isCatalogViewVisible()) {
    render();
    return;
  }

  const role = getRole();
  const items = state.catalogItems || [];
  const emptyMessage = state.catalogMeta.query
    ? "По вашему запросу товаров нет."
    : "Товаров нет.";
  const totalItemsLabel = String(state.catalogMeta.totalCount || items.length);

  replaceRegionOrFallback(
    "catalog-results",
    renderCatalogResultsSection(items, role, emptyMessage, totalItemsLabel)
  );
}

function renderCatalogBasketSummaryRegion() {
  const role = getRole();
  const isGuest = !state.token;
  const isClient = !isGuest && role === ROLE.CLIENT;
  if (!isGuest && !isClient) return "";

  const positionsCount = isGuest
    ? getGuestBasketItemCount()
    : Number(state.basket?.basketItemsCount || 0);

  return `
    <article class="panel catalog-side-card partial-region-enter" data-region="${CATALOG_BASKET_SUMMARY_REGION}">
      <h3>${isGuest ? "Гостевая корзина" : "Корзина"}</h3>
      <div class="catalog-basket-count">
        ${escapeHtml(String(positionsCount))}
        <span>позиций</span>
      </div>
      <a class="btn btn-primary btn-small" href="#/basket">${isGuest ? "Открыть корзину" : "Перейти к оформлению"}</a>
    </article>
  `;
}

function updateCatalogBasketSummaryRegion() {
  if (!isCatalogViewVisible()) return;

  const role = getRole();
  const shouldRenderRegion = !state.token || role === ROLE.CLIENT;
  if (!shouldRenderRegion) return;

  replaceRegionIfExists(CATALOG_BASKET_SUMMARY_REGION, renderCatalogBasketSummaryRegion());
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

  if (options.partial && isCatalogViewVisible()) {
    renderCatalogResultsRegion();
    return;
  }

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

  const pendingOrderId = String(state.paymentAwait?.orderId || "").trim();
  if (pendingOrderId && knownOrderIds.has(pendingOrderId)) {
    state.expandedClientOrders.add(pendingOrderId);
  }

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

function getGuestMedicineOffersByPharmacy(medicineId) {
  const normalizedMedicineId = String(medicineId || "").trim();
  if (!normalizedMedicineId) return new Map();

  const medicine = state.medicineCache.get(normalizedMedicineId);
  const offers = Array.isArray(medicine?.offers) ? medicine.offers : [];
  const byPharmacy = new Map();

  offers.forEach(offer => {
    const pharmacyId = String(offer?.pharmacyId || "").trim();
    if (!pharmacyId) return;
    byPharmacy.set(pharmacyId, offer);
  });

  return byPharmacy;
}

function buildGuestPharmacyOptions(positions) {
  const basketPositions = Array.isArray(positions) ? positions : [];
  if (!basketPositions.length) return [];

  const offersByMedicine = new Map();
  const pharmaciesById = new Map();

  basketPositions.forEach(position => {
    const medicineId = String(position.medicineId || "").trim();
    const offersByPharmacy = getGuestMedicineOffersByPharmacy(medicineId);
    offersByMedicine.set(medicineId, offersByPharmacy);

    offersByPharmacy.forEach((offer, pharmacyId) => {
      if (pharmaciesById.has(pharmacyId)) return;
      pharmaciesById.set(pharmacyId, {
        pharmacyId,
        pharmacyTitle: String(offer?.pharmacyTitle || "Аптека"),
        pharmacyIsActive: offer?.pharmacyIsActive !== false
      });
    });
  });

  const totalMedicinesCount = basketPositions.length;
  const options = [];

  pharmaciesById.forEach(pharmacy => {
    const items = basketPositions.map(position => {
      const medicineId = String(position.medicineId || "").trim();
      const requestedQuantity = Math.max(1, Number(position.quantity || 1));
      const offer = offersByMedicine.get(medicineId)?.get(pharmacy.pharmacyId);
      const foundQuantity = Math.max(0, Number(offer?.stockQuantity || 0));
      const isFound = Boolean(offer) && pharmacy.pharmacyIsActive;
      const hasEnoughQuantity = isFound && foundQuantity >= requestedQuantity;
      const parsedPrice = Number(offer?.price);
      const price = Number.isFinite(parsedPrice) ? parsedPrice : null;

      return {
        medicineId,
        requestedQuantity,
        isFound,
        foundQuantity,
        hasEnoughQuantity,
        price
      };
    });

    const foundMedicinesCount = items.filter(item => item.isFound).length;
    const enoughQuantityMedicinesCount = items.filter(item => item.hasEnoughQuantity).length;
    const totalCost = items
      .filter(item => item.price !== null)
      .reduce((sum, item) => sum + Number(item.price || 0) * item.requestedQuantity, 0);

    options.push({
      pharmacyId: pharmacy.pharmacyId,
      pharmacyTitle: pharmacy.pharmacyTitle,
      pharmacyIsActive: pharmacy.pharmacyIsActive,
      foundMedicinesCount,
      totalMedicinesCount,
      foundMedicinesRatio: `${foundMedicinesCount}/${totalMedicinesCount}`,
      enoughQuantityMedicinesCount,
      isAvailable: pharmacy.pharmacyIsActive
        && enoughQuantityMedicinesCount === totalMedicinesCount
        && totalMedicinesCount > 0,
      totalCost: Number(totalCost.toFixed(2)),
      items
    });
  });

  return options.sort((a, b) => {
    if (a.isAvailable !== b.isAvailable) return a.isAvailable ? -1 : 1;
    return a.totalCost - b.totalCost;
  });
}

function getVisiblePharmacyOptions(options, positions) {
  const sourceOptions = Array.isArray(options) ? options : [];
  const basketPositions = Array.isArray(positions) ? positions : [];
  if (!sourceOptions.length) return [];

  const totalPositions = basketPositions.length;
  const isSingleItemBasket = totalPositions === 1;

  return sourceOptions.filter(option => {
    const foundCountRaw = Number(option?.foundMedicinesCount);
    const foundCount = Number.isFinite(foundCountRaw)
      ? foundCountRaw
      : (Array.isArray(option?.items) ? option.items.filter(item => item?.isFound).length : 0);

    if (foundCount <= 0) {
      return false;
    }

    if (!isSingleItemBasket) {
      return true;
    }

    const enoughCountRaw = Number(option?.enoughQuantityMedicinesCount);
    const enoughCount = Number.isFinite(enoughCountRaw)
      ? enoughCountRaw
      : (Array.isArray(option?.items) ? option.items.filter(item => item?.hasEnoughQuantity).length : 0);

    return enoughCount >= 1;
  });
}

function isPharmacyOptionSelectable(option) {
  const enoughCountRaw = Number(option?.enoughQuantityMedicinesCount);
  const enoughCount = Number.isFinite(enoughCountRaw)
    ? enoughCountRaw
    : (Array.isArray(option?.items) ? option.items.filter(item => item?.hasEnoughQuantity).length : 0);
  return enoughCount >= 1;
}

function isBasketViewVisible() {
  return state.route.name === "basket";
}

function getBasketRenderContext() {
  const basket = state.basket;
  if (!basket) {
    return {
      basket: null,
      positions: [],
      options: [],
      visibleOptions: []
    };
  }

  const positions = Array.isArray(basket?.basketPositions) ? basket.basketPositions : [];
  const options = Array.isArray(basket?.pharmacyOptions) ? basket.pharmacyOptions : [];
  const visibleOptions = getVisiblePharmacyOptions(options, positions);
  const visibleOptionIds = new Set(visibleOptions.map(option => String(option.pharmacyId || "")));
  state.expandedBasketPharmacyDetails = new Set(
    [...state.expandedBasketPharmacyDetails].filter(pharmacyId => visibleOptionIds.has(pharmacyId))
  );

  const selectableOptions = visibleOptions.filter(isPharmacyOptionSelectable);
  const selectedPharmacyId = String(state.checkoutDraft.pharmacyId || "").trim();
  const hasSelectedSelectable = selectableOptions.some(option => String(option.pharmacyId || "") === selectedPharmacyId);
  const fallbackPharmacyId = hasSelectedSelectable
    ? selectedPharmacyId
    : String(selectableOptions[0]?.pharmacyId || "").trim();

  if (fallbackPharmacyId !== selectedPharmacyId) {
    state.checkoutDraft.pharmacyId = fallbackPharmacyId;
    if (!state.token) {
      updateGuestCheckoutDraftStorage(
        state.checkoutDraft.pharmacyId,
        state.checkoutDraft.deliveryAddress,
        state.checkoutDraft.isPickup
      );
    }
  }

  return {
    basket,
    positions,
    options,
    visibleOptions
  };
}

function renderBasketPharmacySelectionRegion(positions, visibleOptions) {
  const availableCount = visibleOptions.filter(option => option.isAvailable).length;
  return `
    <div class="panel basket-pharmacy-panel partial-region-enter" data-region="${BASKET_PHARMACY_REGION}">
      <div class="basket-pharmacy-panel-head">
        <div class="basket-pharmacy-title-wrap">
          <h3>Выбор аптеки</h3>
          <p class="muted">Сравните предложения и выберите аптеку для оформления.</p>
        </div>
        <div class="basket-pharmacy-stats">
          <span class="status-badge success">Всего: ${escapeHtml(String(visibleOptions.length))}</span>
          <span class="status-badge ${availableCount ? "success" : "warning"}">Подходят: ${escapeHtml(String(availableCount))}</span>
        </div>
      </div>
      <p class="muted basket-pharmacy-panel-note">Аптека выбирается только здесь. В нижнем блоке настраивается доставка или самовывоз.</p>
      <div class="pharmacy-option-list basket-pharmacy-option-list">
        ${visibleOptions.length
          ? visibleOptions.map(renderPharmacyOption).join("")
          : (positions || []).length
            ? `<p class="muted">Нет аптек с найденными позициями по вашей корзине.</p>`
            : `<p class="muted">Данные по аптекам появятся, когда в корзине будут товары.</p>`}
      </div>
    </div>
  `;
}

function renderBasketCheckoutPanelRegion(positions, visibleOptions) {
  return `
    <div class="partial-region-enter" data-region="${BASKET_CHECKOUT_REGION}">
      ${renderCheckoutPanel(positions, visibleOptions)}
    </div>
  `;
}

function clearCheckoutInlineNotice() {
  state.checkoutInlineNotice = null;
}

function setCheckoutInlineNotice(message, tone = "warning") {
  state.checkoutInlineNotice = {
    message: String(message || "").trim(),
    tone: tone === "danger" ? "danger" : "warning"
  };
}

function renderBasketOverviewRegion(context, isGuest) {
  const basket = context.basket || {};
  const positions = context.positions || [];
  return `
    <div class="panel intro-panel partial-region-enter" data-region="${BASKET_OVERVIEW_REGION}" style="display: flex; justify-content: space-between; align-items: center;">
      <div>
        <p class="eyebrow">Корзина</p>
        <h1>Оформление заказа</h1>
        <p class="muted">${isGuest
          ? "Гостевой режим: добавляйте товары и адрес, вход потребуется только при оплате."
          : "Проверьте состав заказа и выберите подходящую аптеку."}</p>
      </div>
      <div style="display: flex; gap: 1rem; align-items: center;">
        <span class="status-badge success">Позиций: ${escapeHtml(String(basket.basketItemsCount || positions.length))}</span>
        <button class="btn btn-secondary btn-small" type="button" data-action="basket-clear">Очистить</button>
      </div>
    </div>
  `;
}

function renderBasketPositionsRegion(positions) {
  const list = Array.isArray(positions) ? positions : [];
  return `
    <div class="basket-list basket-card-grid partial-region-enter" data-region="${BASKET_POSITIONS_REGION}">
      ${list.length
        ? list.map(renderBasketItem).join("")
        : `
          <div class="panel empty-panel" style="padding: 4rem 2rem;">
            <h3>Корзина пуста</h3>
            <p class="muted">Перейдите в каталог и добавьте нужные товары.</p>
            <button class="btn btn-primary" type="button" data-action="go-catalog" style="margin-top: 1.5rem;">В каталог</button>
          </div>
        `}
    </div>
  `;
}

function renderBasketViewRegions(options = {}) {
  if (!isBasketViewVisible() || !state.basket) {
    render();
    return;
  }

  const context = getBasketRenderContext();
  const isGuest = !state.token;
  const shouldUpdateOverview = options.overview !== false;
  const shouldUpdatePositions = options.positions !== false;
  const shouldUpdatePharmacy = options.pharmacy !== false;
  const shouldUpdateCheckout = options.checkout !== false;

  if (shouldUpdateOverview) {
    const replaced = replaceRegionOrFallback(
      BASKET_OVERVIEW_REGION,
      renderBasketOverviewRegion(context, isGuest)
    );
    if (!replaced) return;
  }

  if (shouldUpdatePositions) {
    replaceRegionOrFallback(
      BASKET_POSITIONS_REGION,
      renderBasketPositionsRegion(context.positions)
    );
  }

  renderBasketPharmacyCheckoutRegions({
    pharmacy: shouldUpdatePharmacy,
    checkout: shouldUpdateCheckout
  });
}

function renderBasketPharmacyCheckoutRegions(options = {}) {
  if (!isBasketViewVisible() || !state.basket) {
    render();
    return;
  }

  const context = getBasketRenderContext();
  const shouldUpdatePharmacy = options.pharmacy !== false;
  const shouldUpdateCheckout = options.checkout !== false;

  if (shouldUpdatePharmacy) {
    const replaced = replaceRegionOrFallback(
      BASKET_PHARMACY_REGION,
      renderBasketPharmacySelectionRegion(context.positions, context.visibleOptions)
    );
    if (!replaced) return;
  }

  if (shouldUpdateCheckout) {
    replaceRegionOrFallback(
      BASKET_CHECKOUT_REGION,
      renderBasketCheckoutPanelRegion(context.positions, context.visibleOptions)
    );
  }
}

async function buildGuestBasketResponse(guestBasket) {
  const normalizedGuestBasket = normalizeGuestBasket(guestBasket);
  const basketPositions = normalizedGuestBasket.items.map(item => ({
    positionId: createGuestPositionId(item.medicineId),
    medicineId: item.medicineId,
    quantity: item.quantity
  }));

  await hydrateMedicineDetails(basketPositions.map(item => item.medicineId));
  const pharmacyOptions = buildGuestPharmacyOptions(basketPositions);

  return {
    clientId: "",
    basketItemsCount: basketPositions.length,
    basketPositions,
    pharmacyOptions
  };
}

async function mergeGuestBasketIntoClient(options = {}) {
  if (!state.token || getRole() !== ROLE.CLIENT) {
    return {
      mergedCount: 0,
      failedCount: 0
    };
  }

  const guestBasket = loadGuestBasket();
  const guestItems = Array.isArray(guestBasket.items) ? guestBasket.items : [];
  if (!guestItems.length) {
    return {
      mergedCount: 0,
      failedCount: 0
    };
  }

  const failures = [];
  let mergedCount = 0;

  await withLoading(
    options.silent ? "" : "Переносим гостевую корзину...",
    async () => {
      for (const item of guestItems) {
        try {
          await apiFetch("/api/basket/items", {
            method: "POST",
            body: {
              medicineId: item.medicineId,
              quantity: item.quantity
            }
          });

          mergedCount += 1;
        } catch (error) {
          failures.push({
            medicineId: item.medicineId,
            quantity: item.quantity,
            message: error?.message || "Не удалось перенести позицию."
          });
        }
      }
    },
    { silent: Boolean(options.silent) }
  );

  const failedItems = failures.map(item => ({
    medicineId: item.medicineId,
    quantity: item.quantity
  }));

  if (failedItems.length) {
    saveGuestBasket({
      ...guestBasket,
      items: failedItems
    });
  } else {
    clearGuestBasket();
  }

  if (mergedCount > 0) {
    await fetchBasket({
      silent: true
    });
  }

  if (guestBasket.pharmacyId || guestBasket.deliveryAddress || guestBasket.isPickup) {
    state.checkoutDraft.pharmacyId = String(guestBasket.pharmacyId || "").trim();
    state.checkoutDraft.deliveryAddress = String(guestBasket.deliveryAddress || "");
    state.checkoutDraft.isPickup = Boolean(guestBasket.isPickup);
  }

  return {
    mergedCount,
    failedCount: failures.length
  };
}

async function fetchBasket(options = {}) {
  if (!state.token) {
    const guestBasket = loadGuestBasket();
    state.checkoutDraft.pharmacyId = String(guestBasket.pharmacyId || "").trim();
    state.checkoutDraft.deliveryAddress = String(guestBasket.deliveryAddress || "");
    state.checkoutDraft.isPickup = Boolean(guestBasket.isPickup);

    const response = await withLoading(
      options.silent ? "" : "Загружаем гостевую корзину...",
      () => buildGuestBasketResponse(guestBasket),
      { silent: Boolean(options.silent) }
    );

    state.basket = response;
    if (options.partial) {
      updateMainNavRegion();
      updateCatalogBasketSummaryRegion();
      if (isBasketViewVisible()) {
        renderBasketViewRegions();
      }
      return;
    }

    render();
    return;
  }

  const response = await withLoading(options.silent ? "" : "Загружаем корзину...", () => apiFetch("/api/basket"), {
    silent: Boolean(options.silent)
  });

  state.basket = response;
  await hydrateMedicineDetails((state.basket?.basketPositions || []).map(item => item.medicineId));
  if (options.partial) {
    updateMainNavRegion();
    updateCatalogBasketSummaryRegion();
    if (isBasketViewVisible()) {
      renderBasketViewRegions();
    }
    return;
  }

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
  const requestId = ++adminWorkspaceRequestId;
  const identity = getIdentity();
  const orderQuery = new URLSearchParams({
    page: "1",
    pageSize: "120"
  });
  if (state.adminOrderStatusFilter) {
    orderQuery.set("status", state.adminOrderStatusFilter);
  }
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

  if (requestId !== adminWorkspaceRequestId) return;
  if (state.route.name !== "workspace" && state.route.name !== "workspace-order") return;

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

function isAdminMedicineCatalogVisible() {
  return state.route.name === "workspace"
    && getRole() === ROLE.ADMIN
    && state.adminInterface === ADMIN_INTERFACE.OFFER;
}

function renderAdminMedicineCatalogRegion() {
  if (!isAdminMedicineCatalogVisible()) {
    render();
    return;
  }

  const workspace = state.workspace.admin;
  if (!workspace) {
    render();
    return;
  }

  const medicineList = Array.isArray(workspace.medicineList) ? workspace.medicineList : [];
  replaceRegionOrFallback(
    "admin-medicine-results",
    renderAdminMedicineSearchSection(medicineList)
  );
}

async function fetchAdminMedicineCatalog(options = {}) {
  const workspace = state.workspace.admin;
  if (!workspace) {
    await fetchWorkspace(options);
    return;
  }

  const requestId = ++adminMedicineSearchRequestId;
  const query = state.adminMedicineSearch.trim();
  const medicinesResponse = await withLoading(
    options.silent ? "" : "Обновляем каталог лекарств...",
    () => query
      ? apiFetch("/api/medicines/search", {
        method: "POST",
        body: {
          query,
          limit: 80
        }
      })
      : apiFetch("/api/medicines?page=1&pageSize=80"),
    { silent: Boolean(options.silent) }
  );

  if (requestId !== adminMedicineSearchRequestId) return;
  if (state.route.name !== "workspace" || getRole() !== ROLE.ADMIN) return;

  const medicines = medicinesResponse.medicines || [];
  medicines.forEach(rememberMedicine);
  workspace.medicineList = medicines;

  if (options.partial && isAdminMedicineCatalogVisible()) {
    renderAdminMedicineCatalogRegion();
    return;
  }

  render();
}

function isAdminOrdersBoardVisible() {
  return state.route.name === "workspace"
    && getRole() === ROLE.ADMIN
    && state.adminInterface === ADMIN_INTERFACE.ORDERS;
}

function renderAdminOrdersBoardRegion() {
  if (!isAdminOrdersBoardVisible()) {
    render();
    return;
  }

  const workspace = state.workspace.admin;
  if (!workspace) {
    render();
    return;
  }

  replaceRegionOrFallback(
    "admin-orders-board",
    renderAdminOrdersBoardSection(workspace.orders || [])
  );
}

async function fetchAdminOrders(options = {}) {
  const workspace = state.workspace.admin;
  if (!workspace) {
    await fetchWorkspace(options);
    return;
  }

  const requestId = ++adminWorkspaceRequestId;
  const orderQuery = new URLSearchParams({
    page: "1",
    pageSize: "120"
  });

  if (state.adminOrderStatusFilter) {
    orderQuery.set("status", state.adminOrderStatusFilter);
  }

  const ordersResponse = await withLoading(
    options.silent ? "" : "Обновляем список заказов...",
    () => apiFetch(`/api/orders/admin/history?${orderQuery.toString()}`),
    { silent: Boolean(options.silent) }
  );

  if (requestId !== adminWorkspaceRequestId) return;
  if (state.route.name !== "workspace" && state.route.name !== "workspace-order") return;
  if (getRole() !== ROLE.ADMIN) return;

  const orders = ordersResponse.orders || [];
  orders.forEach(order => {
    (order.positions || []).forEach(position => rememberMedicine(position.medicine));
  });

  workspace.orders = orders;
  workspace.totalOrders = Number(ordersResponse.totalCount ?? orders.length);
  workspace.workerId = ordersResponse.workerId || workspace.workerId || getIdentity()?.userId || "";

  const knownOrderIds = new Set(orders.map(order => String(order.orderId)));
  state.expandedAdminOrders = new Set(
    [...state.expandedAdminOrders].filter(orderId => knownOrderIds.has(orderId))
  );

  if (options.partial && isAdminOrdersBoardVisible()) {
    renderAdminOrdersBoardRegion();
    return;
  }

  render();
}

async function fetchSuperAdminWorkspace(options = {}) {
  const requestId = ++superAdminWorkspaceRequestId;
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

  const [adminsResponse, pharmaciesResponse, ordersResponse, paymentIntentsResponse, refundsResponse, catalogResponse, clientsResponse] = await withLoading(
    options.silent ? "" : "Загружаем кабинет супер-админа...",
    () => Promise.all([
      apiFetch(`/api/admins?${adminsParams.toString()}`),
      apiFetch(`/api/pharmacies/all?${pharmaciesParams.toString()}`),
      apiFetch(`/api/orders/all?${ordersParams.toString()}`),
      apiFetch("/api/superadmin/payment-intents?states=AwaitingAdminConfirmation&states=NeedsResolution&page=1&pageSize=50"),
      apiFetch("/api/refund-requests?page=1&pageSize=20"),
      apiFetch(`/api/medicines/all?${medicinesParams.toString()}`),
      apiFetch(`/api/clients?${clientsParams.toString()}`)
    ]),
    {
      silent: Boolean(options.silent)
    }
  );

  if (requestId !== superAdminWorkspaceRequestId) return;
  if (state.route.name !== "workspace" && state.route.name !== "workspace-order") return;

  const medicines = catalogResponse.medicines || [];
  medicines.forEach(rememberMedicine);
  const knownMedicineIds = new Set(medicines.map(item => String(item.id || "")));
  if (!knownMedicineIds.has(state.superAdminSelectedMedicineId)) {
    state.superAdminSelectedMedicineId = medicines.length
      ? String(medicines[0].id || "")
      : "";
  }

  const orders = ordersResponse.orders || [];
  const paymentIntents = paymentIntentsResponse.paymentIntents || [];
  orders.forEach(order => {
    (order.positions || []).forEach(position => rememberMedicine(position.medicine));
  });

  state.workspace.superAdmin = {
    admins: adminsResponse.admins || [],
    pharmacies: pharmaciesResponse.pharmacies || [],
    orders,
    paymentIntents,
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

function isSuperAdminMedicineManagerVisible() {
  return state.route.name === "workspace"
    && getRole() === ROLE.SUPER_ADMIN
    && state.superAdminInterface === SUPERADMIN_INTERFACE.MEDICINE;
}

function renderSuperAdminMedicineManagerRegion() {
  if (!isSuperAdminMedicineManagerVisible()) {
    render();
    return;
  }

  const workspace = state.workspace.superAdmin;
  if (!workspace) {
    render();
    return;
  }

  replaceRegionOrFallback(
    "superadmin-medicine-manager",
    renderMedicineManager("superadmin", workspace.medicineList)
  );
}

async function fetchSuperAdminMedicineCatalog(options = {}) {
  const workspace = state.workspace.superAdmin;
  if (!workspace) {
    await fetchWorkspace(options);
    return;
  }

  const requestId = ++superAdminMedicineSearchRequestId;
  const query = state.superAdminSearch.medicine.trim();
  const medicinesParams = new URLSearchParams({ page: "1", pageSize: "50" });
  if (query) {
    medicinesParams.set("query", query);
  }

  const catalogResponse = await withLoading(
    options.silent ? "" : "Обновляем каталог товаров...",
    () => apiFetch(`/api/medicines/all?${medicinesParams.toString()}`),
    { silent: Boolean(options.silent) }
  );

  if (requestId !== superAdminMedicineSearchRequestId) return;
  if (state.route.name !== "workspace" || getRole() !== ROLE.SUPER_ADMIN) return;

  const medicines = catalogResponse.medicines || [];
  medicines.forEach(rememberMedicine);
  workspace.medicineList = medicines;
  workspace.stats = {
    ...(workspace.stats || {}),
    medicinesTotal: Number(catalogResponse.totalCount ?? medicines.length)
  };

  const knownMedicineIds = new Set(medicines.map(item => String(item.id || "")));
  if (!options.partial && !knownMedicineIds.has(state.superAdminSelectedMedicineId)) {
    state.superAdminSelectedMedicineId = medicines.length
      ? String(medicines[0].id || "")
      : "";
  }

  if (options.partial && isSuperAdminMedicineManagerVisible()) {
    renderSuperAdminMedicineManagerRegion();
  } else {
    render();
  }

  if (options.partial) {
    return;
  }

  if (state.superAdminSelectedMedicineId) {
    await ensureSuperAdminMedicineDetails(state.superAdminSelectedMedicineId, {
      partial: Boolean(options.partial)
    });
    return;
  }

  if (state.superAdminMedicineDetailsLoading) {
    state.superAdminMedicineDetailsLoading = false;
    if (options.partial && isSuperAdminMedicineManagerVisible()) {
      renderSuperAdminMedicineManagerRegion();
    } else {
      render();
    }
  }
}

function isSuperAdminPharmacyAdminManagerVisible() {
  return state.route.name === "workspace"
    && getRole() === ROLE.SUPER_ADMIN
    && state.superAdminInterface === SUPERADMIN_INTERFACE.PHARMACY_ADMIN;
}

function renderSuperAdminPharmacyAdminManagerRegion() {
  if (!isSuperAdminPharmacyAdminManagerVisible()) {
    render();
    return;
  }

  const workspace = state.workspace.superAdmin;
  if (!workspace) {
    render();
    return;
  }

  replaceRegionOrFallback(
    "superadmin-pharmacy-admin-results",
    renderSuperAdminPharmacyAdminSearchResultsRegion(workspace)
  );
}

async function fetchSuperAdminPharmacyAdmin(options = {}) {
  const workspace = state.workspace.superAdmin;
  if (!workspace) {
    await fetchWorkspace(options);
    return;
  }

  const requestId = ++superAdminPharmacyAdminSearchRequestId;
  const query = state.superAdminSearch.pharmacyAdmin.trim();
  const adminsParams = new URLSearchParams({ page: "1", pageSize: "50" });
  const pharmaciesParams = new URLSearchParams({ page: "1", pageSize: "50" });
  if (query) {
    adminsParams.set("query", query);
    pharmaciesParams.set("query", query);
  }

  const [adminsResponse, pharmaciesResponse] = await withLoading(
    options.silent ? "" : "Обновляем список администраторов и аптек...",
    () => Promise.all([
      apiFetch(`/api/admins?${adminsParams.toString()}`),
      apiFetch(`/api/pharmacies/all?${pharmaciesParams.toString()}`)
    ]),
    { silent: Boolean(options.silent) }
  );

  if (requestId !== superAdminPharmacyAdminSearchRequestId) return;
  if (state.route.name !== "workspace" && state.route.name !== "workspace-order") return;
  if (getRole() !== ROLE.SUPER_ADMIN) return;

  workspace.admins = adminsResponse.admins || [];
  workspace.pharmacies = pharmaciesResponse.pharmacies || [];
  workspace.stats = {
    ...(workspace.stats || {}),
    adminsTotal: Number(adminsResponse.totalCount ?? workspace.admins.length),
    pharmaciesTotal: Number(pharmaciesResponse.totalCount ?? workspace.pharmacies.length)
  };

  if (options.partial && isSuperAdminPharmacyAdminManagerVisible()) {
    renderSuperAdminPharmacyAdminManagerRegion();
    return;
  }

  render();
}

function isSuperAdminClientManagerVisible() {
  return state.route.name === "workspace"
    && getRole() === ROLE.SUPER_ADMIN
    && state.superAdminInterface === SUPERADMIN_INTERFACE.CLIENT;
}

function renderSuperAdminClientManagerRegion() {
  if (!isSuperAdminClientManagerVisible()) {
    render();
    return;
  }

  const workspace = state.workspace.superAdmin;
  if (!workspace) {
    render();
    return;
  }

  replaceRegionOrFallback(
    "superadmin-client-results",
    renderSuperAdminClientSearchResultsRegion(workspace)
  );
}

async function fetchSuperAdminClients(options = {}) {
  const workspace = state.workspace.superAdmin;
  if (!workspace) {
    await fetchWorkspace(options);
    return;
  }

  const requestId = ++superAdminClientSearchRequestId;
  const query = state.superAdminSearch.client.trim();
  const clientsParams = new URLSearchParams({ page: "1", pageSize: "50" });
  if (query) {
    clientsParams.set("query", query);
  }

  const clientsResponse = await withLoading(
    options.silent ? "" : "Обновляем список клиентов...",
    () => apiFetch(`/api/clients?${clientsParams.toString()}`),
    { silent: Boolean(options.silent) }
  );

  if (requestId !== superAdminClientSearchRequestId) return;
  if (state.route.name !== "workspace" && state.route.name !== "workspace-order") return;
  if (getRole() !== ROLE.SUPER_ADMIN) return;

  workspace.clients = clientsResponse.clients || [];
  workspace.stats = {
    ...(workspace.stats || {}),
    clientsTotal: Number(clientsResponse.totalCount ?? workspace.clients.length)
  };

  if (options.partial && isSuperAdminClientManagerVisible()) {
    renderSuperAdminClientManagerRegion();
    return;
  }

  render();
}

function isSuperAdminOrdersManagerVisible() {
  return state.route.name === "workspace"
    && getRole() === ROLE.SUPER_ADMIN
    && state.superAdminInterface === SUPERADMIN_INTERFACE.ORDERS;
}

function renderSuperAdminOrdersManagerRegion() {
  if (!isSuperAdminOrdersManagerVisible()) {
    render();
    return;
  }

  const workspace = state.workspace.superAdmin;
  if (!workspace) {
    render();
    return;
  }

  replaceRegionOrFallback(
    "superadmin-orders-results",
    renderSuperAdminOrdersResultsRegion(workspace)
  );
}

async function fetchSuperAdminOrders(options = {}) {
  const workspace = state.workspace.superAdmin;
  if (!workspace) {
    await fetchWorkspace(options);
    return;
  }

  const requestId = ++superAdminOrdersSearchRequestId;
  const ordersParams = new URLSearchParams({ page: "1", pageSize: "20" });
  if (state.superAdminOrderStatusFilter) {
    ordersParams.set("status", state.superAdminOrderStatusFilter);
  }

  const [ordersResponse, paymentIntentsResponse] = await withLoading(
    options.silent ? "" : "Обновляем список заказов...",
    () => Promise.all([
      apiFetch(`/api/orders/all?${ordersParams.toString()}`),
      apiFetch("/api/superadmin/payment-intents?states=AwaitingAdminConfirmation&states=NeedsResolution&page=1&pageSize=50")
    ]),
    { silent: Boolean(options.silent) }
  );

  if (requestId !== superAdminOrdersSearchRequestId) return;
  if (state.route.name !== "workspace" && state.route.name !== "workspace-order") return;
  if (getRole() !== ROLE.SUPER_ADMIN) return;

  const orders = ordersResponse.orders || [];
  const paymentIntents = paymentIntentsResponse.paymentIntents || [];
  orders.forEach(order => {
    (order.positions || []).forEach(position => rememberMedicine(position.medicine));
  });

  workspace.orders = orders;
  workspace.paymentIntents = paymentIntents;
  workspace.totalOrders = Number(ordersResponse.totalCount ?? orders.length);

  if (options.partial && isSuperAdminOrdersManagerVisible()) {
    renderSuperAdminOrdersManagerRegion();
    return;
  }

  render();
}

async function ensureSuperAdminMedicineDetails(medicineId, options = {}) {
  const normalizedMedicineId = String(medicineId || "").trim();
  if (!normalizedMedicineId) return;

  const cached = state.medicineCache.get(normalizedMedicineId);
  const hasDetails = Boolean(cached)
    && Object.prototype.hasOwnProperty.call(cached, "atributes")
    && Object.prototype.hasOwnProperty.call(cached, "offers");
  if (hasDetails) {
    if (state.superAdminMedicineDetailsLoading) {
      state.superAdminMedicineDetailsLoading = false;
      if (options.partial && isSuperAdminMedicineManagerVisible()) {
        renderSuperAdminMedicineManagerRegion();
      } else {
        render();
      }
    }

    return;
  }

  const requestId = ++superAdminMedicineDetailsRequestId;
  state.superAdminMedicineDetailsLoading = true;
  if (options.partial && isSuperAdminMedicineManagerVisible()) {
    renderSuperAdminMedicineManagerRegion();
  } else {
    render();
  }

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
      if (options.partial && isSuperAdminMedicineManagerVisible()) {
        renderSuperAdminMedicineManagerRegion();
      } else {
        render();
      }
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
  if (typeof payload.detail === "string" && payload.detail) return payload.detail;
  if (typeof payload.title === "string" && payload.title) return payload.title;
  if (payload.errors && typeof payload.errors === "object") {
    const firstKey = Object.keys(payload.errors)[0];
    if (firstKey && Array.isArray(payload.errors[firstKey]) && payload.errors[firstKey][0]) {
      return payload.errors[firstKey][0];
    }
  }
  return "";
}

function getApiErrorReason(payload) {
  if (!payload || typeof payload !== "object") return "";
  return String(payload.reason || "").trim();
}

function mapApiErrorToNotice(error) {
  const payload = error?.payload;
  const reason = getApiErrorReason(payload);

  switch (reason) {
    case "invalid_code":
      return { message: "Код подтверждения неверный. Проверьте SMS и попробуйте снова.", tone: "warning" };
    case "expired":
      return { message: "Срок действия кода истек. Запросите новый код.", tone: "warning" };
    case "attempts_exceeded":
      return { message: "Лимит попыток исчерпан. Запросите новый код.", tone: "warning" };
    case "cooldown":
      return { message: extractErrorMessage(payload) || "Повторный запрос кода пока недоступен.", tone: "warning" };
    case "resend_limit_exceeded":
      return { message: "Лимит повторной отправки исчерпан. Начните регистрацию заново.", tone: "warning" };
    case "session_not_found":
      return { message: "Сессия подтверждения не найдена. Запросите код заново.", tone: "warning" };
    case "already_completed":
      return { message: "Сессия подтверждения уже завершена. Начните регистрацию заново.", tone: "warning" };
    case "phone_verification_required":
      return { message: "Для регистрации нужно подтвердить телефон по SMS.", tone: "warning" };
    case "bypass_disabled":
      return { message: "Регистрация без SMS-подтверждения отключена.", tone: "warning" };
    case "rate_limit_exceeded":
      return { message: "Слишком много запросов. Подождите и попробуйте снова.", tone: "warning" };
    default:
      return { message: error?.message || "Произошла ошибка.", tone: "danger" };
  }
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

  const notice = mapApiErrorToNotice(error);
  showNotice(notice.message, notice.tone);
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

function captureActiveInputSnapshot() {
  const active = document.activeElement;
  if (!(active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement)) {
    return null;
  }

  if (!app.contains(active)) {
    return null;
  }

  const form = active.closest("form[data-form]");
  if (!(form instanceof HTMLFormElement)) {
    return null;
  }

  const formType = String(form.dataset.form || "").trim();
  const fieldName = String(active.name || "").trim();
  if (!formType || !fieldName) {
    return null;
  }

  const isTextLike = active instanceof HTMLTextAreaElement
    || (active instanceof HTMLInputElement && ["text", "search", "tel", "url", "email", "password"].includes(active.type));

  return {
    formType,
    fieldName,
    selectionStart: isTextLike ? Number(active.selectionStart ?? -1) : -1,
    selectionEnd: isTextLike ? Number(active.selectionEnd ?? -1) : -1
  };
}

function escapeSelectorValue(value) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(String(value || ""));
  }

  return String(value || "").replace(/["\\]/g, "\\$&");
}

function restoreActiveInputSnapshot(snapshot) {
  if (!snapshot) return;

  const formSelector = `form[data-form="${escapeSelectorValue(snapshot.formType)}"]`;
  const fieldSelector = `[name="${escapeSelectorValue(snapshot.fieldName)}"]`;
  const target = app.querySelector(`${formSelector} ${fieldSelector}`);
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) {
    return;
  }

  target.focus({ preventScroll: true });

  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
    return;
  }

  if (snapshot.selectionStart < 0 || snapshot.selectionEnd < 0 || typeof target.setSelectionRange !== "function") {
    return;
  }

  const length = String(target.value || "").length;
  const start = Math.max(0, Math.min(snapshot.selectionStart, length));
  const end = Math.max(start, Math.min(snapshot.selectionEnd, length));
  target.setSelectionRange(start, end);
}

function render() {
  const activeInputSnapshot = captureActiveInputSnapshot();
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

        ${renderMainNavRegion()}
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

  updatePaymentAwaitCountdownDisplays();
  restoreActiveInputSnapshot(activeInputSnapshot);
}

function renderMainNavRegion() {
  const role = getRole();
  return `
    <nav class="main-nav" data-region="${MAIN_NAV_REGION}">
      ${state.token ? renderAuthenticatedNav(role) : `
        ${renderNavLink("/catalog", "Каталог", state.route.name === "catalog" || state.route.name === "product")}
        ${renderNavLink("/basket", `Корзина${basketBadge()}`, state.route.name === "basket")}
        ${renderNavLink("/login", "Войти", state.route.name === "login")}
        ${renderNavLink("/register", "Регистрация", state.route.name === "register" || state.route.name === "register-verify")}
      `}
      ${state.token ? `<button class="nav-link ghost" type="button" data-action="logout">Выйти</button>` : ""}
    </nav>
  `;
}

function updateMainNavRegion() {
  replaceRegionOrFallback(MAIN_NAV_REGION, renderMainNavRegion());
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
    case "register-verify":
      return renderRegisterVerifyView();
    case "payment-await":
      return renderPaymentAwaitView();
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
           <p class="muted">Введите номер телефона и пароль, затем выберите регистрацию с подтверждением по SMS или без подтверждения.</p>
        </div>
        <div style="padding: 3rem;">
          <form class="stack-form" data-form="register">
            <label>
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
            <p class="muted" style="margin-top: 0.75rem;">Имя можно заполнить позже в профиле.</p>
            <fieldset style="margin-top: 1rem; border: 1px solid var(--line); border-radius: 12px; padding: 0.9rem 1rem;">
              <legend style="padding: 0 0.35rem; font-weight: 600; color: var(--ink);">Режим регистрации</legend>
              <label style="display: flex; align-items: flex-start; gap: 0.65rem;">
                <input name="registrationMode" type="radio" value="sms" checked>
                <span>
                  С SMS-подтверждением
                  <small class="muted" style="display: block;">После отправки формы откроется экран ввода кода из SMS.</small>
                </span>
              </label>
              <label style="display: flex; align-items: flex-start; gap: 0.65rem; margin-top: 0.75rem;">
                <input name="registrationMode" type="radio" value="skip">
                <span>
                  Без SMS-подтверждения
                  <small class="muted" style="display: block;">Если bypass отключен на сервере, форма вернет понятную ошибку.</small>
                </span>
              </label>
            </fieldset>
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

function renderRegisterVerifyView() {
  const verification = state.registrationVerification || {};
  const codeLength = Math.max(4, Math.min(8, Number(verification.codeLength || 6)));
  const phoneLabel = formatPhoneNumber(verification.phoneNumber || "");
  const expiresAtLabel = verification.expiresAtUtc
    ? new Date(verification.expiresAtUtc).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    : "";

  return `
    <section class="view-area" style="align-items: center; justify-content: center; min-height: 80vh;">
      <article class="panel auth-layout" style="max-width: 900px; padding: 0; overflow: hidden;">
        <div style="padding: 3rem; display: flex; flex-direction: column; justify-content: center; background-color: var(--primary-soft);">
           <p class="eyebrow">Подтверждение номера</p>
           <h2 style="font-size: 2.5rem; line-height: 1.1; margin-bottom: 1.5rem;">Введите код из SMS</h2>
           <p class="muted">Мы отправили код на номер <strong>${escapeHtml(phoneLabel || "—")}</strong>.</p>
           ${expiresAtLabel ? `<p class="muted" style="margin-top: 0.5rem;">Код действует до ${escapeHtml(expiresAtLabel)}.</p>` : ""}
        </div>
        <div style="padding: 3rem;">
	          <form class="stack-form" data-form="register-verify">
            <label>
              Код подтверждения
              <input
                name="code"
                type="text"
                inputmode="numeric"
                pattern="[0-9]{${codeLength}}"
                minlength="${codeLength}"
                maxlength="${codeLength}"
                placeholder="${"0".repeat(codeLength)}"
                autocomplete="one-time-code"
                required>
            </label>
	            <button class="btn btn-primary" type="submit" style="width: 100%; margin-top: 1.5rem;">Подтвердить номер</button>
	          </form>

	          ${renderRegisterVerifyResendRegion()}

          <p class="muted" style="margin-top: 1.5rem; text-align: center;">
            Ошиблись номером? <a href="#/register" style="color: var(--primary); font-weight: 600;">Вернуться к регистрации</a>
          </p>
        </div>
      </article>
    </section>
	  `;
}

function renderRegisterVerifyResendRegion() {
  const secondsLeft = getRegistrationResendSecondsLeft();
  return `
    <form class="stack-form partial-region-enter" data-region="${REGISTER_VERIFY_RESEND_REGION}" data-form="register-resend" style="margin-top: 1rem;">
      <button class="btn btn-secondary" type="submit" style="width: 100%;" ${secondsLeft > 0 ? "disabled" : ""}>
        ${secondsLeft > 0 ? `Запросить код повторно через ${secondsLeft} сек.` : "Запросить код повторно"}
      </button>
    </form>
  `;
}

function renderPaymentAwaitView() {
  const pending = state.paymentAwait;
  if (!pending) {
    return `
      <section class="view-area" style="align-items: center; justify-content: center; min-height: 70vh;">
        <article class="panel" style="max-width: 760px; width: 100%;">
          <h2 style="margin-top: 0;">Ожидание оплаты</h2>
          <p class="muted">Сессия ожидания оплаты не найдена.</p>
          <div class="hero-actions" style="margin-top: 1rem;">
            <a class="btn btn-primary" href="#/basket">Вернуться в корзину</a>
          </div>
        </article>
      </section>
    `;
  }

  const shortOrderId = String(pending.orderId || "").slice(0, 8);
  const paymentUrl = String(pending.paymentUrl || "").trim();
  const safePaymentUrl = escapeHtml(paymentUrl);

  return `
    <section class="view-area" style="align-items: center; justify-content: center; min-height: 75vh;">
      <article class="panel auth-layout" style="max-width: 1100px; padding: 0; overflow: hidden;">
        <div style="padding: 2.2rem; background-color: var(--primary-soft); display: flex; flex-direction: column; justify-content: center;">
          <p class="eyebrow">Оплата заказа</p>
          <h2 style="font-size: 2rem; line-height: 1.15; margin-bottom: 1rem;">Ожидаем подтверждение оплаты</h2>
          <p class="muted">
            Платеж по заказу <strong>#${escapeHtml(shortOrderId || "—")}</strong> отправлен. После подтверждения SuperAdmin заказ будет создан автоматически.
          </p>
          <div data-region="${PAYMENT_AWAIT_STATUS_REGION}" style="margin-top: 1rem;">
            ${renderPaymentAwaitStatusRegion()}
          </div>
          <div class="hero-actions" style="margin-top: 1rem;">
            ${paymentUrl
              ? `<a class="btn btn-primary" href="${safePaymentUrl}" target="_blank" rel="noopener noreferrer">Открыть QR-страницу оплаты</a>`
              : ""}
            <a class="btn btn-secondary" href="#/profile">Мои заказы</a>
          </div>
        </div>
        <div style="padding: 1.25rem; background: #fff;">
          ${paymentUrl
            ? `
              <iframe
                title="QR payment page"
                src="${safePaymentUrl}"
                style="width: 100%; min-height: 560px; border: 1px solid var(--line); border-radius: 14px; background: #fff;"
                loading="lazy"
                referrerpolicy="no-referrer">
              </iframe>
            `
            : `<p class="muted">Платежная ссылка недоступна. Обновите корзину и создайте заказ снова.</p>`}
        </div>
      </article>
    </section>
  `;
}

function renderPaymentAwaitStatusRegion() {
  const pending = state.paymentAwait;
  if (!pending) {
    return `<p class="muted">Сессия ожидания оплаты завершена.</p>`;
  }

  const secondsLeft = getPaymentAwaitSecondsLeft();

  return `
    <div class="panel" style="padding: 1rem; margin: 0;">
      <p style="margin: 0; font-weight: 600;" data-payment-await-status-countdown="true">
        ${escapeHtml(getPaymentAwaitStatusCountdownText(secondsLeft))}
      </p>
      <p class="muted" style="margin-top: 0.45rem;">
        Если оплата подтверждена SuperAdmin, вы будете автоматически перенаправлены в профиль с сообщением об успешном оформлении заказа.
      </p>
    </div>
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
          <p class="muted">Смотрите лекарства, добавляйте их в корзину и указывайте адрес. Вход потребуется только перед оплатой.</p>
          <div class="hero-actions">
            <a class="btn btn-primary" href="#/login">Войти</a>
            <a class="btn btn-secondary" href="#/register">Регистрация</a>
          </div>
        </article>

        ${renderCatalogBasketSummaryRegion()}

        <article class="panel catalog-side-card">
          <h3>Как начать покупку</h3>
          <ol class="catalog-side-steps">
            <li>Выберите товар в сетке</li>
            <li>Откройте полную карточку</li>
            <li>Добавьте в корзину и войдите только на шаге оплаты</li>
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

          ${renderCatalogBasketSummaryRegion()}
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
        ${renderCatalogResultsSection(items, role, emptyMessage, totalItemsLabel)}

        ${sidePanel}
      </div>
    </section>
  `;
}

function renderCatalogResultsSection(items, role, emptyMessage, totalItemsLabel) {
  return `
    <div class="catalog-main" data-region="catalog-results">
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
                  Добавить в корзину
                </button>
              </form>

              ${isGuest ? `
                <p class="muted" style="margin-top: 0.75rem;">Авторизация потребуется только при нажатии кнопки оплаты в корзине.</p>
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
  const pendingPaymentOrderId = String(state.paymentAwait?.orderId || "").trim();
  const sortedOrders = pendingPaymentOrderId
    ? [...orders].sort((left, right) => {
      const leftIsPending = String(left?.orderId || "").trim() === pendingPaymentOrderId;
      const rightIsPending = String(right?.orderId || "").trim() === pendingPaymentOrderId;
      if (leftIsPending === rightIsPending) return 0;
      return leftIsPending ? -1 : 1;
    })
    : orders;

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

	          ${renderProfileAccountActionsRegion()}
	        </div>

        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
          <div class="partial-region-enter" data-region="${PROFILE_PENDING_PAYMENT_REGION}">
            ${renderProfilePendingPaymentRegion()}
          </div>

          <article class="panel profile-order-history">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
              <h3>История заказов</h3>
              <button class="btn btn-secondary btn-small" type="button" data-action="refresh-route">Обновить</button>
            </div>
            <div class="order-history-list">
              ${sortedOrders.length
                ? sortedOrders.map(order => renderClientOrderCard(order, { highlightPaymentOrderId: pendingPaymentOrderId })).join("")
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

function renderProfileAccountActionsRegion() {
  return `
    <article class="panel partial-region-enter" data-region="${PROFILE_ACCOUNT_REGION}">
      <h3>Удаление аккаунта</h3>
      <p class="muted" style="margin-top: 0.75rem;">
        Аккаунт будет удален, но заказы сохранятся в истории с номером телефона без привязки к профилю.
      </p>
      <form class="stack-form" data-form="profile-delete-account" style="margin-top: 1rem;">
        <button
          class="btn btn-secondary btn-small"
          type="submit"
          style="color: var(--danger); border-color: rgba(239, 68, 68, 0.35);">
          Удалить аккаунт
        </button>
      </form>
    </article>
  `;
}

function renderBasketView() {
  const isGuest = !state.token;
  if (!isGuest && getRole() !== ROLE.CLIENT) return renderAuthRequired("Корзина доступна только клиенту.");
  const context = getBasketRenderContext();
  const basket = context.basket;
  if (!basket) {
    return `
      <div class="panel empty-panel" style="margin: 2rem auto; max-width: 600px;">
        <h2>Корзина пока не загружена</h2>
        <button class="btn btn-primary" type="button" data-action="refresh-route" style="margin-top: 1rem;">Обновить</button>
      </div>
    `;
  }

  const positions = context.positions;
  const visibleOptions = context.visibleOptions;

  return `
    <section class="view-area">
      ${renderBasketOverviewRegion(context, isGuest)}

      <div class="basket-grid">
        ${renderBasketPositionsRegion(positions)}

        <aside class="basket-sidebar">
          ${renderBasketPharmacySelectionRegion(positions, visibleOptions)}
          ${renderBasketCheckoutPanelRegion(positions, visibleOptions)}
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

  const currentInterface = getCurrentAdminInterface();

  return `
    <section class="view-area theme-admin admin-layout">
      <div class="panel intro-panel admin-hero-panel admin-control-shell">
        <div class="admin-control-head">
          <div class="admin-control-copy">
            <p class="eyebrow">Admin Dashboard</p>
            <h1>Кабинет аптеки: ${escapeHtml(workspace.pharmacy?.title || "Аптека")}</h1>
            <p class="muted">Управляйте профилем аптеки, предложениями товаров и потоком заказов в одном интерфейсе.</p>
          </div>
        </div>

        <div class="workspace-stat-grid admin-stat-grid">
          <div class="admin-stat-card">
            <span class="muted">Заказы в ленте</span>
            <strong>${escapeHtml(String(workspace.orders.length))}</strong>
          </div>
          <div class="admin-stat-card">
            <span class="muted">Статус аптеки</span>
            <strong>${workspace.pharmacy?.isActive !== false ? "Активна" : "Отключена"}</strong>
          </div>
          <div class="admin-stat-card">
            <span class="muted">Администратор</span>
            <strong>${escapeHtml(identity?.name || "Admin")}</strong>
          </div>
        </div>
      </div>

      ${renderAdminWorkspaceInterfaceContent(workspace, identity, currentInterface)}
    </section>
  `;
}

function isAdminWorkspaceVisible() {
  return state.route.name === "workspace" && getRole() === ROLE.ADMIN;
}

function renderAdminWorkspaceInterfaceContent(workspace, identity, currentInterface = getCurrentAdminInterface()) {
  return `
    <div class="workspace-interface-region partial-region-enter admin-main-region" data-region="${ADMIN_INTERFACE_REGION}">
      <div class="main-nav admin-interface-tabs admin-interface-nav">
        <button
          class="nav-link ${currentInterface === ADMIN_INTERFACE.PHARMACY ? "active" : ""}"
          type="button"
          data-action="admin-interface"
          data-interface="${ADMIN_INTERFACE.PHARMACY}">
          Аптека
        </button>
        <button
          class="nav-link ${currentInterface === ADMIN_INTERFACE.OFFER ? "active" : ""}"
          type="button"
          data-action="admin-interface"
          data-interface="${ADMIN_INTERFACE.OFFER}">
          Предложения
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
          <article class="panel admin-section-panel admin-profile-panel">
            <div class="admin-section-head">
              <div class="admin-section-copy">
                <h3>Профиль администратора</h3>
                <p class="muted">Ваши контактные данные и данные для входа.</p>
              </div>
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

          <article class="panel admin-section-panel admin-pharmacy-panel">
            <div class="admin-section-head">
              <div class="admin-section-copy">
                <h3>Управление аптекой</h3>
                <p class="muted">Название, адрес и статус видимости для клиентов.</p>
              </div>
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
          <div class="admin-section-head">
            <div class="admin-section-copy">
              <h3>Управление предложениями</h3>
              <p class="muted">Найдите лекарство и задайте цену/остаток для вашей аптеки.</p>
            </div>
          </div>

          <form class="search-form admin-search-form" data-form="admin-medicine-search">
            <input
              name="query"
              type="search"
              value="${escapeHtml(state.adminMedicineSearch)}"
              placeholder="Поиск лекарства по названию или артикулу">
            <button class="btn btn-secondary" type="submit">Найти</button>
          </form>

          ${renderAdminMedicineSearchSection(workspace.medicineList)}
        </article>
      ` : ""}

      ${currentInterface === ADMIN_INTERFACE.ORDERS ? `
        <article class="panel admin-orders-panel admin-section-panel">
          <div class="admin-section-head">
            <div class="admin-section-copy">
              <h3>Управление заказами</h3>
              <p class="muted">Фильтр и доска заказов по текущим рабочим статусам.</p>
            </div>
            <form class="search-form admin-orders-filter" data-form="admin-order-filter">
              <select name="status">
                <option value="">Все статусы</option>
                ${renderStatusOptions(state.adminOrderStatusFilter)}
              </select>
              <button class="btn btn-secondary btn-small" type="submit">Применить</button>
            </form>
          </div>
          ${renderAdminOrdersBoardSection(workspace.orders || [])}
        </article>
      ` : ""}
    </div>
  `;
}

function renderAdminInterfaceRegion() {
  if (!isAdminWorkspaceVisible()) {
    render();
    return;
  }

  const workspace = state.workspace.admin;
  const identity = getIdentity();
  if (!workspace) {
    render();
    return;
  }

  replaceRegionOrFallback(
    ADMIN_INTERFACE_REGION,
    renderAdminWorkspaceInterfaceContent(workspace, identity, getCurrentAdminInterface())
  );
}

function getCurrentAdminInterface() {
  if (!Object.values(ADMIN_INTERFACE).includes(state.adminInterface)) {
    state.adminInterface = ADMIN_INTERFACE.PHARMACY;
  }

  return state.adminInterface;
}

function renderAdminMedicineCardsRegion(medicineList) {
  return `
    <div class="partial-region-enter" data-region="admin-medicine-cards">
      <div class="admin-catalog-grid">
        ${medicineList.length
          ? medicineList.map(item => renderAdminCatalogCard(item)).join("")
          : `
            <div class="panel empty-panel">
              <h3>Товары не найдены</h3>
              <p class="muted">Измените поисковый запрос.</p>
            </div>
          `}
      </div>
    </div>
  `;
}

function renderAdminMedicineSearchSection(medicineList) {
  const list = Array.isArray(medicineList) ? medicineList : [];
  return `
    <div class="partial-region-enter" data-region="admin-medicine-results">
      <div class="section-headline">
        <h3>Каталог Medicine для вашей аптеки</h3>
        <span class="muted">${escapeHtml(String(list.length))} товаров</span>
      </div>
      ${renderAdminMedicineCardsRegion(list)}
    </div>
  `;
}

function renderAdminOrdersBoardSection(orders) {
  const orderList = Array.isArray(orders) ? orders : [];
  const groupedOrders = groupOrdersByStatus(orderList);
  const statusOrder = ["UnderReview", "Preparing", "Ready", "OnTheWay"];

  return `
    <div class="partial-region-enter" data-region="admin-orders-board">
      <div class="section-headline">
        <h3>Доска заказов по статусам</h3>
        <span class="muted">Отображаются только UnderReview, Preparing, Prepared, OnTheWay</span>
      </div>

      <div class="admin-status-board admin-status-board-strong">
        ${statusOrder.map(status => renderAdminOrderStatusColumn(status, groupedOrders[status] || [])).join("")}
      </div>
    </div>
  `;
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

  return `
    <section class="view-area theme-superadmin superadmin-layout">
      <div class="panel intro-panel superadmin-control-shell">
        <div class="superadmin-control-head">
          <div class="superadmin-control-copy">
            <p class="eyebrow">SuperAdmin Control</p>
            <h1>Глобальное управление системой</h1>
            <p class="muted">Чётко разделённые интерфейсы: управление аптеками и администраторами, каталогом, клиентами, заказами и возвратами.</p>
          </div>
        </div>

        <div class="workspace-stat-grid superadmin-stat-grid">
          <div class="superadmin-stat-card">
            <span class="muted">Администраторы</span>
            <strong>${escapeHtml(String(stats.adminsTotal ?? workspace.admins.length))}</strong>
          </div>
          <div class="superadmin-stat-card">
            <span class="muted">Аптеки</span>
            <strong>${escapeHtml(String(stats.pharmaciesTotal ?? workspace.pharmacies.length))}</strong>
          </div>
          <div class="superadmin-stat-card">
            <span class="muted">Товары</span>
            <strong>${escapeHtml(String(stats.medicinesTotal ?? workspace.medicineList.length))}</strong>
          </div>
          <div class="superadmin-stat-card">
            <span class="muted">Клиенты</span>
            <strong>${escapeHtml(String(stats.clientsTotal ?? workspace.clients.length))}</strong>
          </div>
        </div>
      </div>

      ${renderSuperAdminMainInterfaceContent(workspace, currentInterface)}
    </section>
  `;
}

function isSuperAdminWorkspaceVisible() {
  return state.route.name === "workspace" && getRole() === ROLE.SUPER_ADMIN;
}

function renderSuperAdminMainInterfaceContent(workspace, currentInterface = getCurrentSuperAdminInterface()) {
  return `
    <section class="workspace-interface-region partial-region-enter superadmin-main-region" data-region="${SUPERADMIN_MAIN_INTERFACE_REGION}">
      <div class="main-nav superadmin-interface-nav">
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
        <button
          class="nav-link ${currentInterface === SUPERADMIN_INTERFACE.ORDERS ? "active" : ""}"
          type="button"
          data-action="superadmin-interface"
          data-interface="${SUPERADMIN_INTERFACE.ORDERS}">
          Заказы
        </button>
        <button
          class="nav-link ${currentInterface === SUPERADMIN_INTERFACE.REFUNDS ? "active" : ""}"
          type="button"
          data-action="superadmin-interface"
          data-interface="${SUPERADMIN_INTERFACE.REFUNDS}">
          Возвраты
        </button>
      </div>

      ${currentInterface === SUPERADMIN_INTERFACE.PHARMACY_ADMIN
        ? renderSuperAdminPharmacyAdminManager(workspace)
        : ""}
      ${currentInterface === SUPERADMIN_INTERFACE.MEDICINE
        ? renderMedicineManager("superadmin", workspace.medicineList)
        : ""}
      ${currentInterface === SUPERADMIN_INTERFACE.CLIENT
        ? renderSuperAdminClientManager(workspace)
        : ""}
      ${currentInterface === SUPERADMIN_INTERFACE.ORDERS
        ? renderSuperAdminOrdersInterfacePanel(workspace)
        : ""}
      ${currentInterface === SUPERADMIN_INTERFACE.REFUNDS
        ? renderSuperAdminRefundsInterfacePanel(workspace)
        : ""}
    </section>
  `;
}

function renderSuperAdminOrdersInterfacePanel(workspace) {
  return `
    <article class="panel superadmin-section-panel superadmin-orders-shell">
      <div class="superadmin-section-head">
        <div class="superadmin-section-copy">
          <h3>Управление заказами</h3>
          <p class="muted">Отдельный интерфейс для контроля статусов и просмотра всех заказов системы.</p>
        </div>
        <form class="search-form superadmin-orders-filter" data-form="superadmin-order-filter">
          <select name="status">
            <option value="">Все статусы</option>
            ${renderStatusOptions(state.superAdminOrderStatusFilter)}
          </select>
          <button class="btn btn-secondary btn-small" type="submit">Применить</button>
        </form>
      </div>
      ${renderSuperAdminOrdersResultsRegion(workspace)}
    </article>
  `;
}

function renderSuperAdminRefundsInterfacePanel(workspace) {
  return `
    <article class="panel superadmin-section-panel superadmin-refunds-shell">
      <div class="superadmin-section-head">
        <div class="superadmin-section-copy">
          <h3>Запросы на возврат</h3>
          <p class="muted">Список заявок на возврат и быстрое инициирование операции.</p>
        </div>
        <span class="status-badge warning">${escapeHtml(String(workspace.refunds.length))} ожидают</span>
      </div>
      <div class="superadmin-refund-list">
        ${workspace.refunds.length
          ? workspace.refunds.map(refund => renderRefundCard(refund)).join("")
          : `<p class="muted">Активных запросов на возврат нет.</p>`}
      </div>
    </article>
  `;
}

function renderSuperAdminMainInterfaceRegion() {
  if (!isSuperAdminWorkspaceVisible()) {
    render();
    return;
  }

  const workspace = state.workspace.superAdmin;
  if (!workspace) {
    render();
    return;
  }

  replaceRegionOrFallback(
    SUPERADMIN_MAIN_INTERFACE_REGION,
    renderSuperAdminMainInterfaceContent(workspace, getCurrentSuperAdminInterface())
  );
}

function getCurrentSuperAdminInterface() {
  if (!Object.values(SUPERADMIN_INTERFACE).includes(state.superAdminInterface)) {
    state.superAdminInterface = SUPERADMIN_INTERFACE.PHARMACY_ADMIN;
  }

  return state.superAdminInterface;
}

function renderSuperAdminOrdersResultsRegion(workspace) {
  const orders = Array.isArray(workspace?.orders) ? workspace.orders : [];
  const paymentIntents = Array.isArray(workspace?.paymentIntents) ? workspace.paymentIntents : [];
  return `
    <div class="partial-region-enter" data-region="superadmin-orders-results">
      <div class="panel" style="margin-bottom: 1rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:1rem;">
          <h4 style="margin:0;">Платежи к подтверждению</h4>
          <span class="status-badge warning">${escapeHtml(String(paymentIntents.length))}</span>
        </div>
        <div class="workspace-order-list" style="margin-top:0.8rem;">
          ${paymentIntents.length
            ? paymentIntents.map(item => renderSuperAdminPaymentIntentCard(item)).join("")
            : `<p class="muted">Нет оплат, ожидающих подтверждения.</p>`}
        </div>
      </div>

      <div class="workspace-order-list superadmin-order-list-grid">
        ${orders.length
          ? orders.map(order => renderSuperAdminOrderCard(order)).join("")
          : `<div class="panel empty-panel" style="grid-column: 1/-1; padding: 3rem;"><p class="muted">Заказов пока нет.</p></div>`}
      </div>
    </div>
  `;
}

function renderSuperAdminPharmacyAdminManager(workspace) {
  return `
    <article class="panel workspace-panel workspace-panel-wide superadmin-manager-panel">
      <div class="section-headline">
        <h3>Управление аптеками и администраторами</h3>
        <span class="muted">Структурированный обзор списков, создание и изменения сущностей</span>
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

      ${renderSuperAdminPharmacyAdminSearchResultsRegion(workspace)}
    </article>
  `;
}

function renderSuperAdminPharmacyAdminSearchResultsRegion(workspace) {
  return `
    <div class="partial-region-enter" data-region="superadmin-pharmacy-admin-results">
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
    </div>
  `;
}

function renderSuperAdminClientManager(workspace) {
  return `
    <article class="panel workspace-panel workspace-panel-wide superadmin-manager-panel superadmin-client-shell">
      <div class="superadmin-section-head">
        <div class="superadmin-section-copy">
          <h3>Клиентский реестр</h3>
          <p class="muted">Просмотр клиентов, корзин, последних заказов и удаление клиентских аккаунтов с сохранением истории.</p>
        </div>
      </div>
      <form class="workspace-inline-filter superadmin-inline-search superadmin-search-form" data-form="superadmin-client-search">
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

      ${renderSuperAdminClientSearchResultsRegion(workspace)}
    </article>
  `;
}

function renderSuperAdminClientSearchResultsRegion(workspace) {
  return `
    <div class="superadmin-boundary-grid partial-region-enter" data-region="superadmin-client-results">
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
  `;
}

function renderSuperAdminMedicineCardsRegion(medicineList, selectedMedicineId) {
  return `
    <div data-region="superadmin-medicine-cards">
      ${medicineList.length
        ? `
          <div class="superadmin-medicine-grid">
            ${medicineList.map(item => {
              const cardImage = getMedicineImageSource(item.images);
              const isSelected = String(item.id) === String(selectedMedicineId || "");
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
    </div>
  `;
}

function renderSuperAdminMedicineSearchResultsRegion(medicineList, selectedMedicineId) {
  const list = Array.isArray(medicineList) ? medicineList : [];
  return `
    <div class="partial-region-enter" data-region="superadmin-medicine-search-results">
      <div class="superadmin-block-head">
        <h4>Каталог Medicine</h4>
        <span class="status-badge warning">${escapeHtml(String(list.length))}</span>
      </div>
      ${renderSuperAdminMedicineCardsRegion(list, selectedMedicineId)}
    </div>
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
    <div class="partial-region-enter" data-region="superadmin-medicine-manager">
      <article class="panel workspace-panel workspace-panel-wide superadmin-manager-panel superadmin-medicine-shell">
        <div class="superadmin-section-head">
          <div class="superadmin-section-copy">
            <h3>Управление Medicine</h3>
            <p class="muted">Каталог, карточка товара, атрибуты, предложения аптек и управление изображениями.</p>
          </div>
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
            <form class="workspace-inline-filter superadmin-inline-search superadmin-search-form" data-form="superadmin-medicine-search">
              <label>
                Поиск по названию товара
                <input
                  name="query"
                  type="search"
                  value="${escapeHtml(state.superAdminSearch.medicine)}"
                  placeholder="Например: Paracetamol">
              </label>
              <button class="btn btn-secondary" type="submit">Найти</button>
            </form>

            ${renderSuperAdminMedicineSearchResultsRegion(medicineList, selectedMedicineId)}
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
    </div>
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
  const fulfillmentType = formatFulfillmentTypeLabel(order.isPickup);
  const deliveryLineLabel = order.isPickup ? "Самовывоз" : "Доставка";

  return `
    <article class="workspace-order-card admin-order-card">
      <div class="workspace-order-head admin-order-head">
        <div>
          <strong>Заказ ${escapeHtml(String(order.orderId).slice(0, 8))}</strong>
          <p class="muted">${escapeHtml(`${deliveryLineLabel}: ${order.deliveryAddress || "Без адреса"}`)}</p>
        </div>
        <div class="admin-order-head-actions">
          <span class="status-badge success">${escapeHtml(formatStatusUiLabel(statusLabel))}</span>
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
        <span>Тип: ${escapeHtml(fulfillmentType)}</span>
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
  const canDeleteNew = status === "New";
  const canStartAssembly = status === "UnderReview";
  const canMarkReady = status === "Preparing";
  const canMarkOnTheWay = status === "Ready";
  const canRejectPositions = status === "Preparing";
  const paymentState = formatPaymentStateLabel(order.paymentState);
  const isPendingPayment = paymentState === "PendingManualConfirmation";
  const isPickup = Boolean(order.isPickup);
  const clientPhoneLabel = formatPhoneNumber(order.clientPhoneNumber || "");
  const clientIdShortLabel = String(order.clientId || "").slice(0, 8);
  const clientIdentityLabel = clientPhoneLabel
    ? `${clientPhoneLabel}${clientIdShortLabel ? ` · ${clientIdShortLabel}` : " · удален"}`
    : (clientIdShortLabel || "удален");
  const deliveryLineLabel = isPickup ? "Самовывоз" : "Доставка";
  const nextActionMarkup = canDeleteNew
    ? `<button class="btn btn-secondary" type="button" data-action="order-delete-new-admin" data-order-id="${escapeHtml(order.orderId)}">Удалить заказ New</button>`
    : canStartAssembly
      ? `<button class="btn btn-secondary" type="button" data-action="order-start" data-order-id="${escapeHtml(order.orderId)}">В статус Preparing</button>`
    : canMarkReady
      ? `<button class="btn btn-secondary" type="button" data-action="order-ready" data-order-id="${escapeHtml(order.orderId)}">В статус Ready</button>`
    : canMarkOnTheWay
        ? `<button class="btn btn-secondary" type="button" data-action="order-on-the-way" data-order-id="${escapeHtml(order.orderId)}" data-order-pickup="${isPickup ? "1" : "0"}">${isPickup ? "Выдан клиенту" : "В статус OnTheWay"}</button>`
        : `<span class="muted">Следующий статус недоступен.</span>`;

  return `
    <section class="view-area admin-order-detail-view">
      <article class="panel admin-order-detail-hero">
        <div class="admin-order-detail-head">
          <div>
            <p class="eyebrow">Order details</p>
            <h2>Заказ ${escapeHtml(String(order.orderId).slice(0, 8))}</h2>
            <p class="muted">${escapeHtml(`${deliveryLineLabel}: ${order.deliveryAddress || "Без адреса доставки"}`)}</p>
          </div>
          <div class="admin-order-detail-head-actions">
            <span class="status-badge success">${escapeHtml(formatStatusUiLabel(statusLabel))}</span>
            <button class="btn btn-secondary btn-small" type="button" data-action="go-workspace">К полкам заказов</button>
          </div>
        </div>

        <div class="admin-order-detail-meta">
          <span>Сумма: ${escapeHtml(formatMoney(order.cost))}</span>
          <span>Дата: ${escapeHtml(formatDate(order.orderPlacedAt))}</span>
          <span>Клиент: ${escapeHtml(clientIdentityLabel)}</span>
          <span>PharmacyId: ${escapeHtml(String(order.pharmacyId || "").slice(0, 8) || "—")}</span>
          <span>Тип: ${escapeHtml(formatFulfillmentTypeLabel(order.isPickup))}</span>
          <span>Возврат: ${escapeHtml(formatMoney(order.returnCost))}</span>
          ${isPendingPayment
            ? `<span>Оплата: ожидает подтверждения${order.paymentExpiresAtUtc ? ` до ${escapeHtml(formatDate(order.paymentExpiresAtUtc))}` : ""}</span>`
            : ""}
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

function renderSuperAdminPaymentIntentCard(paymentIntent) {
  const stateCode = Number(paymentIntent?.state ?? NaN);
  const stateLabel = stateCode === PAYMENT_INTENT_STATE.NEEDS_RESOLUTION
    ? "NeedsResolution"
    : "AwaitingAdminConfirmation";
  const badgeTone = stateCode === PAYMENT_INTENT_STATE.NEEDS_RESOLUTION ? "danger" : "warning";
  const reservedOrderId = String(paymentIntent?.reservedOrderId || "").trim();
  const paymentIntentId = String(paymentIntent?.id || "").trim();
  const paymentUrl = String(paymentIntent?.paymentUrl || "").trim();
  const rejectReason = String(paymentIntent?.rejectReason || "").trim();

  return `
    <article class="workspace-order-card">
      <div class="superadmin-order-headline">
        <div class="superadmin-order-title">
          <strong>Intent ${escapeHtml(paymentIntentId.slice(0, 8) || "—")}</strong>
          <span class="mono-text">${escapeHtml(paymentIntentId)}</span>
        </div>
        <div class="superadmin-order-badges">
          <span class="status-badge ${badgeTone}">${escapeHtml(stateLabel)}</span>
        </div>
      </div>
      <div class="superadmin-order-meta-grid">
        <span>ReservedOrderId: ${escapeHtml(reservedOrderId.slice(0, 8) || "—")}</span>
        <span>Клиент: ${escapeHtml(formatPhoneNumber(paymentIntent?.clientPhoneNumber || ""))}</span>
        <span>Сумма: ${escapeHtml(formatMoney(paymentIntent?.amount || 0))} ${escapeHtml(paymentIntent?.currency || "TJS")}</span>
        <span>Provider: ${escapeHtml(paymentIntent?.paymentProvider || "—")}</span>
        <span>Дата: ${escapeHtml(formatDate(paymentIntent?.createdAtUtc || new Date().toISOString()))}</span>
        <span>Позиций: ${escapeHtml(String((paymentIntent?.positions || []).length))}</span>
        ${rejectReason ? `<span>Причина: ${escapeHtml(rejectReason)}</span>` : ""}
      </div>
      <div class="workspace-action-row">
        <button
          class="btn btn-primary"
          type="button"
          data-action="payment-intent-confirm"
          data-payment-intent-id="${escapeHtml(paymentIntentId)}">
          Подтвердить оплату
        </button>
        <button
          class="btn btn-secondary"
          type="button"
          data-action="payment-intent-reject"
          data-payment-intent-id="${escapeHtml(paymentIntentId)}">
          Отклонить
        </button>
        ${paymentUrl
          ? `<a class="btn btn-secondary btn-small" href="${escapeHtml(paymentUrl)}" target="_blank" rel="noopener noreferrer">Открыть ссылку оплаты</a>`
          : ""}
      </div>
    </article>
  `;
}

function renderSuperAdminOrderCard(order) {
  const status = formatStatusLabel(order.status);
  const paymentState = formatPaymentStateLabel(order.paymentState);
  const isPendingPayment = paymentState === "PendingManualConfirmation";
  const isPickup = Boolean(order.isPickup);
  const clientPhoneLabel = formatPhoneNumber(order.clientPhoneNumber || "");
  const clientIdShortLabel = String(order.clientId || "").slice(0, 8);
  const clientIdentityLabel = clientPhoneLabel
    ? `${clientPhoneLabel}${clientIdShortLabel ? ` · ${clientIdShortLabel}` : " · удален"}`
    : (clientIdShortLabel || "удален");
  const deliveryLineLabel = isPickup ? "Самовывоз" : "Доставка";
  const canMoveNext = status === "New" || status === "OnTheWay";
  const nextLabel = status === "New"
    ? "Подтвердить и в UnderReview"
    : "Отметить полученным";
  const unavailableHint = status === "New" || status === "OnTheWay"
    ? ""
    : "Следующий шаг доступен только для статусов New и OnTheWay.";

  return `
    <div class="workspace-order-card superadmin-order-card">
      <div class="superadmin-order-headline">
        <div class="superadmin-order-title">
          <strong>Заказ ${escapeHtml(String(order.orderId).slice(0, 8))}</strong>
          <span class="mono-text">${escapeHtml(String(order.orderId || ""))}</span>
        </div>
        <div class="superadmin-order-badges">
          <span class="status-badge ${isPickup ? "warning" : "success"}">${escapeHtml(deliveryLineLabel)}</span>
          <span class="status-badge success">${escapeHtml(formatStatusUiLabel(order.status))}</span>
        </div>
      </div>

      <div class="superadmin-order-meta-grid">
        <span>Сумма: ${escapeHtml(formatMoney(order.cost))}</span>
        <span>Клиент: ${escapeHtml(clientIdentityLabel)}</span>
        <span>PharmacyId: ${escapeHtml(String(order.pharmacyId).slice(0, 8))}</span>
        <span>${escapeHtml(`${deliveryLineLabel}: ${order.deliveryAddress || "без адреса"}`)}</span>
        <span>Дата: ${escapeHtml(formatDate(order.orderPlacedAt))}</span>
        <span>Позиций: ${escapeHtml(String((order.positions || []).length))}</span>
        ${isPendingPayment
          ? `<span>Оплата: ожидает подтверждения${order.paymentExpiresAtUtc ? ` до ${escapeHtml(formatDate(order.paymentExpiresAtUtc))}` : ""}</span>`
          : ""}
      </div>

      <div class="workspace-position-list superadmin-order-position-list">
        ${(order.positions || []).map(position => `
          <div class="workspace-position-item superadmin-order-position-item">
            <span>${escapeHtml(position.medicine?.title || "Товар")}</span>
            <span>x${escapeHtml(String(position.quantity))}</span>
            <span>${escapeHtml(formatMoney(position.price))}</span>
          </div>
        `).join("")}
      </div>
      <div class="workspace-action-row">
        ${canMoveNext
          ? `<button class="btn btn-primary" type="button" data-action="order-superadmin-next" data-order-id="${escapeHtml(order.orderId)}" data-current-status="${escapeHtml(status)}">${escapeHtml(nextLabel)}</button>`
          : `<span class="muted">${escapeHtml(unavailableHint)}</span>`}
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
    <div class="workspace-list-item superadmin-client-card">
      <strong>${escapeHtml(client.name)}</strong>
      <span>${escapeHtml(formatPhoneNumber(client.phoneNumber))}</span>
      <span>Позиций в корзине: ${escapeHtml(String((client.basketPositions || []).length))}</span>
      <span>Заказов: ${escapeHtml(String((client.orders || []).length))}</span>
      <span class="mono-text">${escapeHtml(client.id)}</span>
      ${(client.orders || []).length ? `
        <div class="workspace-sublist superadmin-client-orders-sublist">
          ${(client.orders || []).slice(0, 4).map(order => `
            <span>
              ${escapeHtml(formatStatusUiLabel(order.status))} · ${escapeHtml(formatMoney(order.cost))} · ${escapeHtml(formatDate(order.orderPlacedAt))}
            </span>
          `).join("")}
        </div>
      ` : ""}
      <button
        class="btn btn-secondary btn-small"
        type="button"
        data-action="client-delete-by-id"
        data-client-id="${escapeHtml(client.id)}"
        style="color: var(--danger); border-color: rgba(239, 68, 68, 0.35);">
        Удалить аккаунт клиента
      </button>
    </div>
  `;
}

function renderProfilePendingPaymentRegion() {
  const pending = state.paymentAwait;
  if (!pending?.orderId) return "";

  const orderId = String(pending.orderId || "").trim();
  const order = (state.clientOrderHistory || []).find(item => String(item?.orderId || "").trim() === orderId) || null;
  const paymentUrl = String(pending.paymentUrl || "").trim();
  const secondsLeft = getPaymentAwaitSecondsLeft();
  const pendingAmount = Number(pending.amount || 0);
  const pendingCurrency = String(pending.currency || "TJS");

  const statusLabel = order
    ? formatStatusUiLabel(order.status)
    : "Ожидает подтверждения оплаты";
  const isPending = order
    ? formatPaymentStateLabel(order.paymentState) === "PendingManualConfirmation" && formatStatusLabel(order.status) === "New"
    : true;

  return `
    <article class="panel" style="border: 1px solid rgba(15, 118, 110, 0.2); background: linear-gradient(120deg, rgba(240, 253, 250, 0.95) 0%, rgba(255, 255, 255, 0.96) 100%);">
      <p class="eyebrow">Ожидает оплаты</p>
      <h3 style="margin-top: 0.4rem;">Заказ ${escapeHtml(orderId.slice(0, 8) || "—")}</h3>
      <div class="order-history-meta" style="margin-top: 0.7rem;">
        ${order
          ? `<span>Сумма: ${escapeHtml(formatMoney(order.cost))}</span>`
          : (pendingAmount > 0 ? `<span>Сумма: ${escapeHtml(formatMoney(pendingAmount))} ${escapeHtml(pendingCurrency)}</span>` : "")}
        <span>Статус: ${escapeHtml(statusLabel)}</span>
        <span data-payment-await-profile-countdown="true">${escapeHtml(getPaymentAwaitProfileCountdownText(secondsLeft))}</span>
      </div>
      <p class="muted" style="margin-top: 0.7rem;">
        ${isPending
          ? "После подтверждения SuperAdmin заказ будет создан и перейдет в стандартный путь обработки."
          : "Статус заказа обновлен. Проверяем, чтобы автоматически завершить сценарий оплаты."}
      </p>
      <div class="hero-actions" style="margin-top: 0.9rem;">
        ${paymentUrl
          ? `<a class="btn btn-primary" href="${escapeHtml(paymentUrl)}" target="_blank" rel="noopener noreferrer">Перейти к оплате</a>`
          : ""}
        <button
          class="btn btn-secondary btn-small"
          type="button"
          data-action="client-order-toggle"
          data-order-id="${escapeHtml(orderId)}">
          Показать детали заказа
        </button>
      </div>
    </article>
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
        ${canShop ? `
          <form data-form="add-to-basket" class="product-card-add-form">
            <input type="hidden" name="medicineId" value="${escapeHtml(item.id)}">
            <input type="hidden" name="quantity" value="1">
            <button class="btn btn-primary btn-small" type="submit">В корзину</button>
          </form>
        ` : showSuperAdminManage ? `
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
          <p class="muted basket-qty-hint">Изменение сохраняется автоматически.</p>
        </form>
      </div>
      <div class="basket-item-actions">
        <button class="btn btn-secondary btn-small" type="button" data-action="basket-remove" data-position-id="${escapeHtml(item.positionId)}" style="color: var(--danger); border-color: rgba(239, 68, 68, 0.2);">Удалить</button>
      </div>
    </div>
  `;
}

function renderPharmacyOption(option, index, allOptions) {
  const items = option.items || [];
  const isSelected = state.checkoutDraft.pharmacyId === option.pharmacyId;
  const isExpanded = state.expandedBasketPharmacyDetails.has(String(option.pharmacyId || ""));
  const foundCount = Number(option.foundMedicinesCount ?? items.filter(item => item.isFound).length);
  const totalCount = Number(option.totalMedicinesCount ?? items.length);
  const enoughCount = Number(option.enoughQuantityMedicinesCount ?? items.filter(item => item.hasEnoughQuantity).length);
  const availabilityLabel = option.isAvailable ? "Можно оформить" : "Частично доступно";
  const pharmacyStateClass = option.isAvailable ? "available" : "limited";
  const selectionClass = isSelected ? "selected" : "";
  const optionList = Array.isArray(allOptions) ? allOptions : [option];
  const costPool = optionList
    .map(item => Number(item?.totalCost))
    .filter(value => Number.isFinite(value));
  const minCost = costPool.length ? Math.min(...costPool) : Number(option.totalCost || 0);
  const currentCost = Number(option.totalCost || 0);
  const isBestPrice = Number.isFinite(currentCost) && Math.abs(currentCost - minCost) < 0.0001;
  const pharmacy = findPharmacyById(option.pharmacyId);
  const pharmacyAddress = String(pharmacy?.address || "").trim();
  const canSelect = isPharmacyOptionSelectable(option);
  const selectionStatusTitle = isSelected
    ? "Аптека выбрана"
    : canSelect
      ? "Нажмите, чтобы выбрать"
      : "Недостаточно для полного заказа";
  const selectionStatusHint = canSelect
    ? "Выбор влияет на нижний блок оформления"
    : "Можно посмотреть цены, но оформить весь заказ нельзя";

  const priceLines = items.map(item => {
    const medicine = state.medicineCache.get(item.medicineId) || {};
    const medicineTitle = medicine.title || item.medicineId || "Товар";
    const requestedQuantity = Math.max(1, Number(item.requestedQuantity || 1));
    const itemPrice = Number(item.price);
    const hasPrice = Number.isFinite(itemPrice);
    const lineClass = item.hasEnoughQuantity ? "ok" : (item.isFound ? "warn" : "miss");
    const linePrice = hasPrice ? formatMoney(itemPrice * requestedQuantity) : "—";
    const lineHint = hasPrice ? `${formatMoney(itemPrice)} x ${requestedQuantity}` : "Цена недоступна";

    return `
      <div class="pharmacy-line-item ${lineClass}">
        <span class="pharmacy-line-copy">
          <strong>${escapeHtml(medicineTitle)}</strong>
          <small>${escapeHtml(lineHint)}</small>
        </span>
        <span class="pharmacy-line-price">${escapeHtml(linePrice)}</span>
      </div>
    `;
  }).join("");

  const detailsRows = items.map(item => {
    const medicine = state.medicineCache.get(item.medicineId) || {};
    const medicineTitle = medicine.title || item.medicineId || "Товар";
    const foundLabel = item.isFound ? "Найдено" : "Не найдено";
    const quantityLabel = item.hasEnoughQuantity ? "Хватает" : "Недостаточно";
    const unitPrice = Number(item.price);
    const hasUnitPrice = Number.isFinite(unitPrice);
    const requestedQuantity = Math.max(1, Number(item.requestedQuantity || 1));
    const priceLabel = hasUnitPrice ? formatMoney(unitPrice) : "—";
    const lineTotalLabel = hasUnitPrice ? formatMoney(unitPrice * requestedQuantity) : "—";
    const summaryClass = item.hasEnoughQuantity ? "success" : (item.isFound ? "warning" : "danger");
    const imageSource = getMedicineImageSource(medicine.images);
    const medicineId = String(item.medicineId || "");

    return `
      <a
        class="pharmacy-detail-product"
        href="#/product/${escapeHtml(medicineId)}"
        data-action="product-open"
        data-medicine-id="${escapeHtml(medicineId)}">
        <div class="pharmacy-detail-thumb">
          ${imageSource
            ? `<img src="${escapeHtml(imageSource)}" alt="${escapeHtml(medicineTitle)}">`
            : `<div class="image-fallback">${escapeHtml(getInitials(medicineTitle))}</div>`}
        </div>
        <div class="pharmacy-detail-body">
          <div class="pharmacy-detail-main">
            <strong>${escapeHtml(medicineTitle)}</strong>
            <span class="muted">x${escapeHtml(String(requestedQuantity))}</span>
          </div>
          <div class="pharmacy-detail-price">
            <span>Цена: <strong>${escapeHtml(priceLabel)}</strong></span>
            <span>Сумма: <strong>${escapeHtml(lineTotalLabel)}</strong></span>
          </div>
          <div class="pharmacy-detail-meta">
            <span class="status-badge ${summaryClass}">${escapeHtml(foundLabel)}</span>
            <span class="status-badge ${item.hasEnoughQuantity ? "success" : "warning"}">${escapeHtml(quantityLabel)}</span>
          </div>
        </div>
      </a>
    `;
  }).join("");

  return `
    <article
      class="pharmacy-card pharmacy-market-card ${pharmacyStateClass} ${selectionClass} ${canSelect ? "" : "disabled"}"
      data-action="checkout-use-pharmacy"
      data-pharmacy-id="${escapeHtml(option.pharmacyId)}"
      data-pharmacy-available="${canSelect ? "1" : "0"}">
      <div class="pharmacy-card-top pharmacy-market-head">
        <div class="pharmacy-market-head-main">
          <strong class="pharmacy-card-title">${escapeHtml(option.pharmacyTitle || "Аптека")}</strong>
          ${pharmacyAddress ? `<p class="pharmacy-card-address">${escapeHtml(pharmacyAddress)}</p>` : ""}
          <div class="pharmacy-market-flags">
            ${isBestPrice ? `<span class="pharmacy-flag best">Лучшая цена</span>` : ""}
            ${isSelected ? `<span class="pharmacy-flag selected">Выбрано</span>` : ""}
          </div>
        </div>
        <div class="pharmacy-market-price">
          <span>Итог заказа</span>
          <strong class="pharmacy-card-total">${escapeHtml(formatMoney(option.totalCost))}</strong>
        </div>
      </div>

      <div class="pharmacy-market-meta">
        <span class="pharmacy-chip ${option.isAvailable ? "success" : "warning"}">${escapeHtml(availabilityLabel)}</span>
        <span class="pharmacy-chip neutral">${escapeHtml(`Найдено ${foundCount}/${totalCount}`)}</span>
        <span class="pharmacy-chip neutral">${escapeHtml(`Хватает ${enoughCount}/${totalCount}`)}</span>
      </div>

      <div class="pharmacy-market-select">
        <span class="pharmacy-select-dot ${isSelected ? "active" : ""}" aria-hidden="true"></span>
        <span class="pharmacy-select-copy">
          <strong class="pharmacy-select-text">${escapeHtml(selectionStatusTitle)}</strong>
          <small>${escapeHtml(selectionStatusHint)}</small>
        </span>
      </div>

      <div class="pharmacy-price-lines">
        ${priceLines}
      </div>

      <div class="pharmacy-card-bottom">
        <button
          class="pharmacy-found-toggle"
          type="button"
          data-action="pharmacy-details-toggle"
          data-pharmacy-id="${escapeHtml(option.pharmacyId)}">
          ${isExpanded ? "Скрыть подробности" : "Показать подробности по заказу"}
        </button>
        <span class="status-badge pharmacy-availability-badge ${option.isAvailable ? "success" : "warning"}">
          ${escapeHtml(availabilityLabel)}
        </span>
      </div>

      ${isExpanded ? `
        <div class="pharmacy-card-details">
          <p class="pharmacy-details-title">Состав заказа в этой аптеке</p>
          <p class="muted" style="margin: 0;">Нажмите на карточку лекарства, чтобы открыть полную информацию о товаре.</p>
          ${detailsRows}
        </div>
      ` : ""}
    </article>
  `;
}

function renderCheckoutPanel(positions, options) {
  const isGuest = !state.token;
  if (!(positions || []).length) {
    return `
      <div class="panel empty-panel" style="padding: 2rem;">
        <h3>Оформление заказа</h3>
        <p class="muted">Добавьте товары в корзину, чтобы перейти к оформлению.</p>
      </div>
    `;
  }

  const visibleOptions = getVisiblePharmacyOptions(options, positions);
  const selectableOptions = visibleOptions.filter(isPharmacyOptionSelectable);
  if (!selectableOptions.length) {
    return `
      <div class="panel" style="border-color: var(--danger); background-color: #fef2f2;">
        <h3>Оформление заказа</h3>
        <p class="muted">Нет аптек, где хотя бы одна позиция доступна в нужном количестве. Измените корзину или выберите другие товары.</p>
      </div>
    `;
  }

  const selectedPharmacyId = String(state.checkoutDraft.pharmacyId || "").trim();
  const selectedOption = selectableOptions.find(item => item.pharmacyId === selectedPharmacyId) || selectableOptions[0];
  const selectedOptionId = String(selectedOption?.pharmacyId || "").trim();
  const selectedPharmacy = findPharmacyById(selectedOptionId);
  const selectedPharmacyAddress = String(selectedPharmacy?.address || "").trim();
  const availableOptionsCount = selectableOptions.filter(option => option.isAvailable).length;

  const isPickupSelected = Boolean(state.checkoutDraft.isPickup);
  const addressHints = [...new Set(
    [
      selectedPharmacy?.address,
      ...(state.pharmacies || []).map(item => item.address)
    ]
      .map(value => String(value || "").trim())
      .filter(Boolean)
  )];

  return `
    <div class="panel checkout-panel-modern">
      <div class="section-headline" style="margin-bottom: 1.5rem;">
        <h3>Настройки заказа</h3>
        <span class="status-badge success">Доступно аптек: ${escapeHtml(String(selectableOptions.length))}</span>
      </div>
      <form class="stack-form" data-form="client-checkout">
        ${selectedOption?.isAvailable
          ? ""
          : `<div class="checkout-inline-notice warning">В этой аптеке доступна только часть заказа. Можно выбрать, но оформить получится только полный состав.</div>`}
        ${state.checkoutInlineNotice?.message
          ? `<div class="checkout-inline-notice ${escapeHtml(state.checkoutInlineNotice.tone)}">${escapeHtml(state.checkoutInlineNotice.message)}</div>`
          : ""}
        <input type="hidden" name="pharmacyId" value="${escapeHtml(selectedOptionId)}">
        <div class="checkout-selected-pharmacy">
          <div class="checkout-selected-pharmacy-head">
            <span class="status-badge success">Выбранная аптека</span>
            <span class="mono-text">${escapeHtml(formatMoney(selectedOption.totalCost))}</span>
          </div>
          <strong>${escapeHtml(selectedOption.pharmacyTitle || "Аптека")}</strong>
          <span class="muted">${escapeHtml(selectedPharmacyAddress || "Адрес аптеки недоступен")}</span>
        </div>
        <fieldset class="checkout-fulfillment-mode">
          <legend>Способ получения</legend>
          <label class="checkout-mode-pill">
            <input type="radio" name="isPickup" value="false" ${isPickupSelected ? "" : "checked"}>
            <span class="checkout-mode-pill-copy">
              <strong>Доставка</strong>
              <small>Курьер привезет по вашему адресу</small>
            </span>
          </label>
          <label class="checkout-mode-pill">
            <input type="radio" name="isPickup" value="true" ${isPickupSelected ? "checked" : ""}>
            <span class="checkout-mode-pill-copy">
              <strong>Самовывоз</strong>
              <small>Получение в выбранной аптеке</small>
            </span>
          </label>
        </fieldset>
        ${isPickupSelected
          ? `
            <div class="checkout-pickup-note">
              <strong>Адрес самовывоза</strong>
              <span>${escapeHtml(selectedPharmacyAddress || "Адрес аптеки будет подставлен автоматически")}</span>
            </div>
          `
          : `
            <label class="checkout-address-field">
              Адрес доставки
              <input
                name="deliveryAddress"
                type="text"
                list="checkout-address-hints"
                value="${escapeHtml(state.checkoutDraft.deliveryAddress)}"
                placeholder="Например: Dushanbe, Rudaki 10, kv. 5"
                required>
            </label>
            <datalist id="checkout-address-hints">
              ${addressHints.map(address => `<option value="${escapeHtml(address)}"></option>`).join("")}
            </datalist>
          `}
        <div class="checkout-summary-row">
          <span>К оплате:</span>
          <strong>${escapeHtml(formatMoney(selectedOption.totalCost))}</strong>
        </div>
        ${availableOptionsCount > 0
          ? `<p class="muted" style="margin-top: 0.5rem;">Аптек с полным составом заказа: ${escapeHtml(String(availableOptionsCount))}</p>`
          : ""}
        ${isGuest ? `
          <p class="muted" style="margin-top: 0.75rem;">Для оплаты вы перейдете на вход. Корзина и адрес не потеряются.</p>
        ` : ""}
        <button class="btn btn-primary checkout-submit-btn" type="submit">
          ${isGuest ? "Войти и перейти к оплате" : "Оформить заказ"}
        </button>
      </form>
    </div>
  `;
}

function findPharmacyById(pharmacyId) {
  const normalizedPharmacyId = String(pharmacyId || "");
  return (state.pharmacies || []).find(item => String(item.id) === normalizedPharmacyId) || null;
}

function renderClientOrderCard(order, options = {}) {
  const orderId = String(order.orderId || "");
  const highlightPaymentOrderId = String(options.highlightPaymentOrderId || "").trim();
  const isPaymentFocusCard = highlightPaymentOrderId.length > 0 && orderId === highlightPaymentOrderId;
  const isExpanded = state.expandedClientOrders.has(orderId);
  const isLoading = state.clientOrderDetailsLoading.has(orderId);
  const details = state.clientOrderDetailsCache.get(orderId);
  const pharmacy = findPharmacyById(order.pharmacyId);
  const pharmacyTitle = pharmacy?.title || `Аптека ${String(order.pharmacyId || "").slice(0, 8)}`;
  const paymentState = formatPaymentStateLabel(order.paymentState);
  const isPendingPayment = paymentState === "PendingManualConfirmation";
  const trackedPaymentUrl = isPaymentFocusCard
    ? String(state.paymentAwait?.paymentUrl || "").trim()
    : "";
  const canCancel = canClientCancelOrder(order.status);

  const detailsMarkup = isLoading
    ? `<p class="muted">Загружаем детали заказа...</p>`
    : details
      ? `
        <div class="client-order-details-grid">
          <div class="workspace-order-meta">
            <span>Аптека: ${escapeHtml(pharmacyTitle)}</span>
            <span>Адрес аптеки: ${escapeHtml(pharmacy?.address || "—")}</span>
            <span>Тип: ${escapeHtml(formatFulfillmentTypeLabel(details.isPickup ?? order.isPickup))}</span>
            <span>${escapeHtml((details.isPickup ?? order.isPickup) ? "Самовывоз" : "Доставка")}: ${escapeHtml(details.deliveryAddress || order.deliveryAddress || "—")}</span>
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
    <article class="order-card customer-order-card order-history-card ${isPaymentFocusCard ? "selected" : ""}">
      <div class="order-history-head">
        <div>
          <strong>Заказ ${escapeHtml(String(order.orderId).slice(0, 8))}</strong>
          <p class="muted">${escapeHtml(pharmacyTitle)}</p>
          ${isPendingPayment
            ? `<p class="muted" style="margin-top: 0.4rem;">Ожидает подтверждения оплаты SuperAdmin.</p>`
            : ""}
        </div>
        <span class="status-badge ${isPendingPayment ? "warning" : "success"}">${escapeHtml(formatStatusUiLabel(order.status))}</span>
      </div>

      <div class="order-history-meta">
        <span>Сумма: ${escapeHtml(formatMoney(order.cost))}</span>
        <span>Дата: ${escapeHtml(formatDate(order.orderPlacedAt))}</span>
        <span>Тип: ${escapeHtml(formatFulfillmentTypeLabel(order.isPickup))}</span>
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
        ${isPaymentFocusCard && isPendingPayment && trackedPaymentUrl
          ? `<a class="btn btn-primary btn-small" href="${escapeHtml(trackedPaymentUrl)}" target="_blank" rel="noopener noreferrer">Перейти к оплате</a>`
          : ""}
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
    .map(status => `<option value="${status}" ${selectedStatus === status ? "selected" : ""}>${escapeHtml(formatStatusUiLabel(status))}</option>`)
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

function formatPaymentStateLabel(value) {
  const labels = {
    0: "Confirmed",
    1: "PendingManualConfirmation",
    2: "Expired",
    Confirmed: "Confirmed",
    PendingManualConfirmation: "PendingManualConfirmation",
    Expired: "Expired"
  };

  return labels[value] || String(value ?? "—");
}

function formatStatusUiLabel(value) {
  const normalized = formatStatusLabel(value);
  return normalized === "Delivered"
    ? "Получен клиентом"
    : normalized;
}

function formatAdminOrderStatusLabel(value) {
  const normalized = formatStatusLabel(value);
  if (normalized === "Ready") return "Prepared";
  return formatStatusUiLabel(normalized);
}

function formatFulfillmentTypeLabel(isPickup) {
  return isPickup ? "Самовывоз" : "Доставка";
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
  if (!state.token) {
    const count = getGuestBasketItemCount();
    return count > 0 ? ` <span class="nav-badge">${escapeHtml(String(count))}</span>` : "";
  }

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
  if (state.route.name === "payment-await") return "Ожидание оплаты";
  if (state.route.name === "profile") return "Профиль клиента";
  if (state.route.name === "register") return "Регистрация";
  if (state.route.name === "register-verify") return "Подтверждение телефона";
  return "Вход";
}

function getTopStripText() {
  const role = getRole();
  if (!state.token) {
    return state.route.name === "basket"
      ? "Гостевая корзина сохраняется в браузере до очистки данных сайта."
      : "Гостевой режим: собирайте корзину без входа, авторизация нужна только перед оплатой.";
  }

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
  if (state.route.name === "payment-await") return "Ожидание подтверждения оплаты заказа и автоматический возврат в приложение.";
  if (state.route.name === "profile") return "Личные данные, история заказов и настройки.";
  if (state.route.name === "register") return "Создание клиентского аккаунта.";
  if (state.route.name === "register-verify") return "Подтвердите номер телефона кодом из SMS.";
  return "Выполните вход и продолжайте работу.";
}

function getHeroTitle() {
  switch (state.route.name) {
    case "login":
      return "Отдельное окно входа";
    case "register":
      return "Отдельное окно регистрации";
    case "register-verify":
      return "Подтверждение номера телефона";
    case "profile":
      return "Профиль клиента";
    case "basket":
      return state.token ? "Корзина клиента" : "Гостевая корзина";
    case "payment-await":
      return "Ожидание подтверждения оплаты";
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
    case "register-verify":
      return "Введите 6-значный код из SMS. Через 60 секунд можно запросить код повторно.";
    case "profile":
      return "Здесь собрана информация о клиенте, его корзина и заказы.";
    case "basket":
      return state.token
        ? "Здесь собраны все товары, управление количеством и предложения аптек."
        : "Добавляйте товары, выбирайте аптеку и адрес. Вход потребуется только на шаге оплаты.";
    case "payment-await":
      return "Откройте QR-страницу оплаты. После подтверждения SuperAdmin вы автоматически вернетесь в приложение.";
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
