(() => {
  "use strict";
  const warn = (id) => console.warn(`HydraxLanding: missing #${id}`);
  const reducedMotionMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointerMQ = window.matchMedia("(pointer: fine)");
  const desktopMQ = window.matchMedia("(min-width: 880px)");

  const nav = document.getElementById("nav");
  const navToggle = document.getElementById("navToggle");
  const navMenu = document.getElementById("navMenu");
  const solutionsTrigger = document.getElementById("solutionsTrigger");
  const solutionsMenu = document.getElementById("solutionsMenu");
  const personaTabs = document.getElementById("personaTabs");
  const personaPanels = document.getElementById("personaPanels");
  const toastRegion = document.getElementById("toastRegion");
  const main = document.getElementById("main");
  for (const [k, v] of Object.entries({ nav, navToggle, navMenu, solutionsTrigger, solutionsMenu, personaTabs, personaPanels, toastRegion })) if (!v) warn(k);

  // Toast — append to #toastRegion, cap stacked at 2, fade out via .is-leaving.
  function showToast(message, opts = {}) {
    if (!toastRegion) return;
    const duration = typeof opts.duration === "number" ? opts.duration : 3000;
    const stacked = toastRegion.querySelectorAll(".toast");
    if (stacked.length >= 2) stacked[0].remove();
    const node = document.createElement("div");
    node.className = `toast toast--${opts.tone || "info"}`;
    node.setAttribute("role", "status");
    node.textContent = message;
    toastRegion.appendChild(node);
    window.setTimeout(() => {
      node.classList.add("is-leaving");
      window.setTimeout(() => node.remove(), 220);
    }, duration);
  }

  // Nav scroll-class via IntersectionObserver against a 1px sentinel at top of <main>.
  if (nav && main) {
    const sentinel = document.createElement("div");
    sentinel.setAttribute("aria-hidden", "true");
    sentinel.style.cssText = "position:absolute;top:0;left:0;width:1px;height:1px;pointer-events:none;";
    if (!main.style.position) main.style.position = "relative";
    main.insertBefore(sentinel, main.firstChild);
    new IntersectionObserver(
      (es) => es.forEach((e) => nav.classList.toggle("is-scrolled", !e.isIntersecting)),
      { threshold: 0 }
    ).observe(sentinel);
  }

  // Mobile menu — focus trap + scroll-lock.
  let lastFocused = null;
  const focusableSel = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])';
  const focusableIn = (c) => Array.from(c.querySelectorAll(focusableSel));
  const isMenuOpen = () => navMenu && navMenu.classList.contains("is-open");
  function openMobileMenu() {
    if (!navMenu || !navToggle) return;
    lastFocused = document.activeElement;
    navMenu.classList.add("is-open");
    navToggle.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
    const items = focusableIn(navMenu);
    if (items[0]) items[0].focus();
  }
  function closeMobileMenu() {
    if (!navMenu || !navToggle) return;
    navMenu.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
    (lastFocused && typeof lastFocused.focus === "function" ? lastFocused : navToggle).focus();
  }
  if (navToggle && navMenu) {
    navToggle.setAttribute("aria-expanded", "false");
    navToggle.addEventListener("click", () => (isMenuOpen() ? closeMobileMenu() : openMobileMenu()));
    navMenu.addEventListener("keydown", (e) => {
      if (!isMenuOpen()) return;
      if (e.key === "Escape") { e.preventDefault(); closeMobileMenu(); return; }
      if (e.key !== "Tab") return;
      const items = focusableIn(navMenu);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    document.addEventListener("click", (e) => {
      if (!isMenuOpen() || navMenu.contains(e.target) || navToggle.contains(e.target)) return;
      closeMobileMenu();
    });
    desktopMQ.addEventListener("change", (e) => { if (e.matches && isMenuOpen()) closeMobileMenu(); });
  }

  // Solutions dropdown — hover (fine pointer) + click + keyboard.
  let solutionsCloseTimer = null;
  const isSolOpen = () => solutionsMenu && solutionsMenu.classList.contains("is-open");
  const setSolutions = (open) => {
    if (!solutionsTrigger || !solutionsMenu) return;
    solutionsMenu.classList.toggle("is-open", open);
    solutionsTrigger.setAttribute("aria-expanded", open ? "true" : "false");
  };
  const clearSolTimer = () => { window.clearTimeout(solutionsCloseTimer); solutionsCloseTimer = null; };
  if (solutionsTrigger && solutionsMenu) {
    solutionsTrigger.setAttribute("aria-expanded", "false");
    solutionsTrigger.setAttribute("aria-haspopup", "true");
    solutionsTrigger.addEventListener("click", (e) => { e.preventDefault(); setSolutions(!isSolOpen()); });
    solutionsTrigger.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSolutions(!isSolOpen()); }
      else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSolutions(true);
        const first = solutionsMenu.querySelector('a, button, [tabindex]:not([tabindex="-1"])');
        if (first) first.focus();
      } else if (e.key === "Escape") setSolutions(false);
    });
    solutionsMenu.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { e.preventDefault(); setSolutions(false); solutionsTrigger.focus(); }
    });
    const enter = () => { if (finePointerMQ.matches) { clearSolTimer(); setSolutions(true); } };
    const leave = () => { if (finePointerMQ.matches) { clearSolTimer(); solutionsCloseTimer = window.setTimeout(() => setSolutions(false), 120); } };
    solutionsTrigger.addEventListener("pointerenter", enter);
    solutionsTrigger.addEventListener("pointerleave", leave);
    solutionsMenu.addEventListener("pointerenter", enter);
    solutionsMenu.addEventListener("pointerleave", leave);
    const closeIfOutside = (e) => {
      if (!isSolOpen() || solutionsMenu.contains(e.target) || solutionsTrigger.contains(e.target)) return;
      setSolutions(false);
    };
    document.addEventListener("click", closeIfOutside);
    document.addEventListener("focusin", closeIfOutside);
  }

  // Persona tabs — roving tabindex + arrow keys + announce switch.
  const getTabs = () => personaTabs ? Array.from(personaTabs.querySelectorAll('[role="tab"]')) : [];
  const getPanels = () => personaPanels ? Array.from(personaPanels.querySelectorAll('[role="tabpanel"]')) : [];
  function switchPersona(persona, opts = {}) {
    if (!personaTabs || !personaPanels) return;
    let activeTab = null;
    getTabs().forEach((tab) => {
      const isActive = tab.dataset.persona === persona;
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
      tab.tabIndex = isActive ? 0 : -1;
      if (isActive) activeTab = tab;
    });
    getPanels().forEach((p) => {
      const isActive = p.dataset.persona === persona;
      p.classList.toggle("is-active", isActive);
      p.setAttribute("aria-hidden", isActive ? "false" : "true");
    });
    if (!activeTab) return;
    if (opts.focus) activeTab.focus();
    if (!opts.silent) showToast(`Switched to ${(activeTab.textContent || persona).trim()} path`, { tone: "info" });
  }
  if (personaTabs && personaPanels) {
    personaTabs.setAttribute("role", "tablist");
    const tabs = getTabs();
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => { if (tab.dataset.persona) switchPersona(tab.dataset.persona); });
      tab.addEventListener("keydown", (e) => {
        const list = getTabs();
        const idx = list.indexOf(tab);
        if (idx === -1) return;
        let next = -1;
        if (e.key === "ArrowRight") next = (idx + 1) % list.length;
        else if (e.key === "ArrowLeft") next = (idx - 1 + list.length) % list.length;
        else if (e.key === "Home") next = 0;
        else if (e.key === "End") next = list.length - 1;
        else if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (tab.dataset.persona) switchPersona(tab.dataset.persona, { focus: true });
          return;
        }
        if (next === -1) return;
        e.preventDefault();
        const t = list[next];
        if (t && t.dataset.persona) switchPersona(t.dataset.persona, { focus: true });
      });
    });
    const initial = tabs.find((t) => t.getAttribute("aria-selected") === "true") || tabs[0];
    if (initial && initial.dataset.persona) switchPersona(initial.dataset.persona, { silent: true });
  }

  // Smooth-scroll for in-page anchors with reduced-motion respect.
  document.addEventListener("click", (e) => {
    const link = e.target.closest && e.target.closest('a[href^="#"]');
    if (!link) return;
    const href = link.getAttribute("href");
    if (!href || href === "#" || href.length < 2) return;
    const target = document.getElementById(href.slice(1));
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: reducedMotionMQ.matches ? "auto" : "smooth", block: "start" });
    const hadTabIndex = target.hasAttribute("tabindex");
    if (!hadTabIndex) target.setAttribute("tabindex", "-1");
    try { target.focus({ preventScroll: true }); } catch (_) { target.focus(); }
    if (!hadTabIndex) target.addEventListener("blur", () => target.removeAttribute("tabindex"), { once: true });
    if (isMenuOpen()) closeMobileMenu();
  });

  window.HydraxLanding = { showToast, switchPersona };
})();
