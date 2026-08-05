export const DEMO_UNIT_STORAGE_KEY = "digital-handydan-demo-unit";
export const DEMO_UNIT_CHANGE_EVENT = "digital-handydan-demo-unit-change";

export function readDemoUnitPreference() {
  try {
    return window.localStorage.getItem(DEMO_UNIT_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setDemoUnitPreference(enabled: boolean) {
  try {
    if (enabled) window.localStorage.setItem(DEMO_UNIT_STORAGE_KEY, "true");
    else window.localStorage.removeItem(DEMO_UNIT_STORAGE_KEY);
  } catch {
    // Demo mode remains active for the current page through the change event.
  }
  window.dispatchEvent(new CustomEvent(DEMO_UNIT_CHANGE_EVENT, { detail: { enabled } }));
}
