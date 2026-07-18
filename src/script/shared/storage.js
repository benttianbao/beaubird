// Functions extracted from the legacy script.js shared/storage domain.
export function installStorage(runtime) {
function safeLocalStorageGet(key, fallback = "") {
  try {
    const value = localStorage.getItem(key);
    return value == null ? fallback : value;
  } catch (error) {
    console.warn("Failed to read localStorage:", error);
    return fallback;
  }
}

function safeLocalStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn("Failed to write localStorage:", error);
    return false;
  }
}

function safeLocalStorageRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn("Failed to remove localStorage:", error);
  }
}

  Object.assign(runtime, {
    safeLocalStorageGet,
    safeLocalStorageSet,
    safeLocalStorageRemove
  });
}
