const KEY = "vocaverse.product.v1";

export function readProductState(storage = globalThis.localStorage) {
  try {
    const value = JSON.parse(storage.getItem(KEY) ?? "{}");
    return value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};
  } catch {
    return {};
  }
}

export function updateProductState(patch, storage = globalThis.localStorage) {
  const current = readProductState(storage);
  const next = { ...current, ...patch };
  try {
    storage.setItem(KEY, JSON.stringify(next));
    return next;
  } catch {
    return current;
  }
}

export function saveLastLesson(id, storage = globalThis.localStorage) {
  if (typeof id === "string" && /^[A-Z]{2}\d{2}/.test(id))
    updateProductState({ lastLesson: id }, storage);
}

export function completeDemoLogin(email) {
  const normalized = String(email ?? "")
    .trim()
    .toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return false;
  updateProductState({
    account: { email: normalized, mode: "local-demo" },
    onboarding: readProductState().onboarding ?? null,
  });
  return true;
}

export function clearDemoAccount() {
  updateProductState({ account: null });
}

export const PRODUCT_KEY = KEY;
