// Functions extracted from the legacy script.js shared/ui domain.
export function installSharedUi(runtime) {
  const { state, elements, EMPTY_STATE_COPY } = runtime;
  const escapeHtml = (...args) => runtime.escapeHtml(...args);

function renderEmptyState(target, variant, options = {}) {
  if (!target) {
    return;
  }

  const copy = {
    ...(EMPTY_STATE_COPY[variant] || {}),
    ...options
  };
  const title = copy.title || "暂无结果";
  const description = copy.description || "完成查询后，结果会显示在这里。";
  const variantClass = String(variant || "default").replace(/[^a-z0-9-]/gi, "") || "default";
  target.innerHTML = `
    <div class="empty-state result-empty result-empty--${variantClass}" role="status">
      <strong class="empty-state-title">${escapeHtml(title)}</strong>
      <span>${escapeHtml(description)}</span>
    </div>
  `;
}

function setMessage(message, isError = false) {
  setStatusMessage(elements.importMessage, message, isError);
}

function setEbirdMessage(message, isError = false) {
  setStatusMessage(elements.ebirdMessage, message, isError);
}

function setEbirdSeasonalMessage(message, isError = false) {
  setStatusMessage(elements.ebirdSeasonalMessage, message, isError);
}

function setBirdreportMessage(message, isError = false) {
  setStatusMessage(elements.birdreportMessage, message, isError);
}

function setBirdPrepMessage(message, isError = false) {
  setStatusMessage(elements.birdPrepMessage, message, isError);
}

function setStatusMessage(target, message, isError = false) {
  if (!target) {
    return;
  }

  target.textContent = message;
  target.classList.toggle("error", Boolean(isError));
}

function setElementLoadingClass(element, isLoading) {
  if (!element) {
    return;
  }
  const loading = Boolean(isLoading);
  element.classList.toggle("is-loading", loading);
  if (loading) {
    element.setAttribute("aria-busy", "true");
  } else {
    element.removeAttribute("aria-busy");
  }
}

function setEbirdLoading(isLoading) {
  elements.syncEbirdBtn.disabled = isLoading;
  elements.clearEbirdKeyBtn.disabled = isLoading;
  elements.syncEbirdBtn.textContent = isLoading ? "查询中..." : "查询 eBird";
  setElementLoadingClass(elements.syncEbirdBtn, isLoading);
  setElementLoadingClass(elements.ebirdMessage, isLoading);
}

function setEbirdSeasonalLoading(isLoading) {
  if (elements.analyzeEbirdSeasonalBtn) {
    elements.analyzeEbirdSeasonalBtn.disabled = isLoading;
    elements.analyzeEbirdSeasonalBtn.textContent = isLoading ? "分析中..." : "分析浙江当季鸟种";
    setElementLoadingClass(elements.analyzeEbirdSeasonalBtn, isLoading);
  }
  if (elements.clearEbirdSeasonalCacheBtn) {
    elements.clearEbirdSeasonalCacheBtn.disabled = isLoading;
  }
  setElementLoadingClass(elements.ebirdSeasonalMessage, isLoading);
}

  Object.assign(runtime, {
    renderEmptyState,
    setMessage,
    setEbirdMessage,
    setEbirdSeasonalMessage,
    setBirdreportMessage,
    setBirdPrepMessage,
    setStatusMessage,
    setElementLoadingClass,
    setEbirdLoading,
    setEbirdSeasonalLoading
  });
}
