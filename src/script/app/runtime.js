// Functions extracted from the legacy script.js app/runtime domain.
export function installRuntime(runtime) {
  const { ANDROID_APP_USER_AGENT_TOKEN, DEFAULT_BIRDREPORT_PROXY_URL, ANDROID_BIRDREPORT_PROXY_URL } = runtime;
  const normalizeProxyBaseUrl = (...args) => runtime.normalizeProxyBaseUrl(...args);

function handleQuickNavClick(event) {
  const targetId = event.currentTarget?.dataset?.target;
  if (!targetId) {
    return;
  }

  const section = document.getElementById(targetId);
  if (!section) {
    return;
  }

  setActiveQuickNav(targetId);
  markJumpTarget(section);
  section.scrollIntoView({ behavior: "smooth", block: "start" });
}

function markJumpTarget(section) {
  document.querySelectorAll(".panel.is-jump-target").forEach((panel) => {
    panel.classList.remove("is-jump-target");
  });
  const token = String(Date.now());
  section.dataset.jumpFocusToken = token;
  section.classList.add("is-jump-target");
  window.setTimeout(() => {
    if (section.dataset.jumpFocusToken === token) {
      section.classList.remove("is-jump-target");
      delete section.dataset.jumpFocusToken;
    }
  }, 520);
}

function setActiveQuickNav(targetId) {
  document.querySelectorAll(".app-quicknav-btn").forEach((button) => {
    const isActive = button.dataset.target === targetId;
    button.classList.toggle("is-active", isActive);
    button.toggleAttribute("aria-current", isActive);
    if (isActive) {
      button.setAttribute("aria-current", "true");
    }
  });
}

function initEmbeddedAndroidQuickNav() {
  if (!isEmbeddedAndroidApp()) {
    return;
  }

  const sections = ["monitorSection", "unlockedSection", "birdPrepSection", "ebirdSection", "birdreportSection"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  if (!sections.length || !("IntersectionObserver" in window)) {
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];

      if (visible?.target?.id) {
        setActiveQuickNav(visible.target.id);
      }
    },
    {
      rootMargin: "-18% 0px -56% 0px",
      threshold: [0.2, 0.35, 0.55]
    }
  );

  sections.forEach((section) => observer.observe(section));
}

function isEmbeddedAndroidApp() {
  return navigator.userAgent.includes(ANDROID_APP_USER_AGENT_TOKEN);
}

function getDefaultBirdreportProxyUrl() {
  if (isEmbeddedAndroidApp()) {
    return ANDROID_BIRDREPORT_PROXY_URL;
  }
  if (window.location.protocol === "file:") {
    return DEFAULT_BIRDREPORT_PROXY_URL;
  }
  return window.location.origin;
}

function applyRuntimeEnvironment() {
  if (isEmbeddedAndroidApp()) {
    document.body.classList.add("embedded-android-app");
  }
}

function lockEmbeddedAndroidViewport() {
  if (!isEmbeddedAndroidApp()) {
    return;
  }

  const applyViewport = () => {
    let viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
      viewport = document.createElement("meta");
      viewport.setAttribute("name", "viewport");
      document.head.append(viewport);
    }

    viewport.setAttribute(
      "content",
      "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
    );

    document.documentElement.style.width = "100%";
    document.documentElement.style.maxWidth = "100%";
    document.body.style.width = "100%";
    document.body.style.maxWidth = "100%";
    document.body.style.overflowX = "hidden";
  };

  applyViewport();
  window.addEventListener("resize", applyViewport, { passive: true });
  window.visualViewport?.addEventListener("resize", applyViewport, { passive: true });
  window.addEventListener("orientationchange", applyViewport, { passive: true });
}

function getBirdreportProxyBaseUrl() {
  return normalizeProxyBaseUrl(getDefaultBirdreportProxyUrl());
}

  Object.assign(runtime, {
    handleQuickNavClick,
    markJumpTarget,
    setActiveQuickNav,
    initEmbeddedAndroidQuickNav,
    isEmbeddedAndroidApp,
    getDefaultBirdreportProxyUrl,
    applyRuntimeEnvironment,
    lockEmbeddedAndroidViewport,
    getBirdreportProxyBaseUrl
  });
}
