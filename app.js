const venues = [
  { name: "Singapore Nexus", state: "live", uptime: "99.2%" },
  { name: "Tokyo Arc", state: "live", uptime: "98.7%" },
  { name: "Dubai Harbor", state: "live", uptime: "97.9%" },
  { name: "Frankfurt Loop", state: "warm", uptime: "Warm" },
  { name: "London Arc", state: "live", uptime: "98.1%" },
  { name: "New York Relay", state: "live", uptime: "99.4%" },
  { name: "Sydney Rim", state: "warm", uptime: "Warm" },
  { name: "Zurich Chain", state: "live", uptime: "98.8%" },
  { name: "Seoul Vertex", state: "live", uptime: "97.3%" },
];

const STORAGE_KEY = "hydrax.workspace.v1";

const modes = [
  {
    venue: "Singapore Nexus",
    mode: "Balanced Sweep",
    drift: "0.14%",
  },
  {
    venue: "Tokyo Arc",
    mode: "Latency Shield",
    drift: "0.09%",
  },
  {
    venue: "Dubai Harbor",
    mode: "Inventory Protect",
    drift: "0.18%",
  },
];

const events = [
  "Liquidity bias shifted toward Tokyo Arc after queue density improved.",
  "Fallback threshold widened while Frankfurt Loop stabilized.",
  "HydraX reduced exposure drift during an adverse selection burst.",
  "Passive routing window reopened after spread normalized.",
  "Inventory pressure cooled across the primary venue cluster.",
];

const orders = [
  {
    id: "HX-2041",
    venue: "Singapore Nexus",
    mode: "Balanced Sweep",
    exposure: "$4.2M",
    status: "live",
    side: "Buy",
    instrument: "SGX iShares MSCI",
    fillQuality: "99.1%",
    slippage: "+0.06%",
    rationale: "Queue depth tightened on Singapore Nexus, HydraX shifted weight from Tokyo to absorb the improved fill curve.",
    venueMix: [
      { name: "Singapore Nexus", share: "68%" },
      { name: "Tokyo Arc", share: "24%" },
      { name: "Dubai Harbor", share: "8%" },
    ],
    fallback: "Tokyo Arc armed as warm reroute if Singapore latency drifts above 18ms.",
  },
  {
    id: "HX-2038",
    venue: "Tokyo Arc",
    mode: "Latency Shield",
    exposure: "$2.1M",
    status: "review",
    side: "Sell",
    instrument: "Nikkei 225 basket",
    fillQuality: "96.4%",
    slippage: "+0.14%",
    rationale: "Adverse selection pressure rose during the Tokyo open; HydraX flagged the route for operator review before expanding the child-order window.",
    venueMix: [
      { name: "Tokyo Arc", share: "74%" },
      { name: "Singapore Nexus", share: "26%" },
    ],
    fallback: "Passive ladder rollback ready if spread widens beyond 1.4 bps.",
  },
  {
    id: "HX-2035",
    venue: "Dubai Harbor",
    mode: "Inventory Protect",
    exposure: "$3.4M",
    status: "live",
    side: "Buy",
    instrument: "GCC energy sleeve",
    fillQuality: "98.7%",
    slippage: "+0.08%",
    rationale: "Inventory skew in the Asia book narrowed; HydraX re-enabled aggressive take on Dubai Harbor to rebuild depth.",
    venueMix: [
      { name: "Dubai Harbor", share: "82%" },
      { name: "Frankfurt Loop", share: "18%" },
    ],
    fallback: "Frankfurt Loop holds warm standby with tightened size caps.",
  },
  {
    id: "HX-2031",
    venue: "Frankfurt Loop",
    mode: "Fallback Mesh",
    exposure: "$1.2M",
    status: "queued",
    side: "Sell",
    instrument: "DAX futures sleeve",
    fillQuality: "Pending",
    slippage: "—",
    rationale: "Route parked until Frankfurt Loop recovers from the 10:42 latency spike. HydraX is holding exposure off the book rather than forcing a degraded fill.",
    venueMix: [
      { name: "Frankfurt Loop", share: "60% target" },
      { name: "Singapore Nexus", share: "40% hedge" },
    ],
    fallback: "Auto-release once Frankfurt round-trip drops under 22ms for two minutes.",
  },
  {
    id: "HX-2028",
    venue: "Singapore Nexus",
    mode: "Balanced Sweep",
    exposure: "$5.0M",
    status: "review",
    side: "Buy",
    instrument: "SGD rates curve",
    fillQuality: "97.2%",
    slippage: "+0.12%",
    rationale: "Operator widened the threshold during London open, HydraX logged the override and is awaiting sign-off before re-arming passive mode.",
    venueMix: [
      { name: "Singapore Nexus", share: "58%" },
      { name: "Dubai Harbor", share: "30%" },
      { name: "Tokyo Arc", share: "12%" },
    ],
    fallback: "Auto-revert to Balanced Sweep once passive window reopens post-review.",
  },
  {
    id: "HX-2026",
    venue: "Tokyo Arc",
    mode: "Passive Ladder",
    exposure: "$900K",
    status: "queued",
    side: "Sell",
    instrument: "JGB short sleeve",
    fillQuality: "Pending",
    slippage: "—",
    rationale: "Child orders staged but held — HydraX is waiting for queue density to normalize after the BoJ tape print.",
    venueMix: [
      { name: "Tokyo Arc", share: "100%" },
    ],
    fallback: "Escalate to Latency Shield if queue density recovers before spread normalizes.",
  },
];

const panelTitles = {
  orders: "Execution orders",
  positions: "Position overview",
  venues: "Venue health",
  risk: "Risk posture",
  settings: "Workspace settings",
};

const persisted = readPersistedState();

let modeIndex = 0;
let eventIndex = 0;
let activePanel = persisted.activePanel || "orders";
let activeFilter = persisted.activeFilter || "all";
let activeState = "loading";
let selectedOrderId = persisted.selectedOrderId || null;

function readPersistedState() {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_err) {
    return {};
  }
}

function persistState() {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      activePanel,
      activeFilter,
      selectedOrderId,
    }));
  } catch (_err) {
    // ignore — persistence is best-effort
  }
}

const primaryVenue = document.getElementById("primaryVenue");
const routingMode = document.getElementById("routingMode");
const driftValue = document.getElementById("driftValue");
const cycleModeButton = document.getElementById("cycleMode");
const eventFeed = document.getElementById("eventFeed");
const ordersTableBody = document.getElementById("ordersTableBody");
const orderDetail = document.getElementById("orderDetail");
const panelTitle = document.getElementById("panelTitle");
const stateBanner = document.getElementById("stateBanner");
const cycleStateButton = document.getElementById("cycleState");
const navButtons = Array.from(document.querySelectorAll(".workspace-nav-item"));
const filterButtons = Array.from(document.querySelectorAll(".filter-chip"));
const panelBodies = Array.from(document.querySelectorAll("[data-panel-body]"));
const stateCards = Array.from(document.querySelectorAll("#panel-orders [data-state]"));
const summaryFillValue = document.getElementById("summaryFillValue");
const summaryFillCaption = document.getElementById("summaryFillCaption");
const summaryRiskValue = document.getElementById("summaryRiskValue");
const summaryRiskCaption = document.getElementById("summaryRiskCaption");
const summaryFallbackValue = document.getElementById("summaryFallbackValue");
const summaryFallbackCaption = document.getElementById("summaryFallbackCaption");
const ordersActivePill = document.getElementById("ordersActivePill");
const workspaceLivePill = document.getElementById("workspaceLivePill");
const venueList = document.getElementById("venueList");
const venueHealthList = document.getElementById("venueHealthList");
const heroVenueCount = document.getElementById("heroVenueCount");
const navCountEls = {
  orders: document.querySelector('[data-nav-count="orders"]'),
  venues: document.querySelector('[data-nav-count="venues"]'),
};
const dashboardButtons = [
  document.getElementById("openDashboardTop"),
  document.getElementById("openDashboardHero"),
].filter(Boolean);

function updateMode() {
  const current = modes[modeIndex];
  if (!current) return;
  primaryVenue.textContent = current.venue;
  routingMode.textContent = current.mode;
  driftValue.textContent = current.drift;
}

function pushEvent() {
  if (!eventFeed) return;
  const entry = document.createElement("li");
  const time = document.createElement("span");
  const message = document.createElement("p");

  time.className = "event-time";
  time.textContent = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  message.textContent = events[eventIndex];
  entry.append(time, message);
  eventFeed.prepend(entry);

  while (eventFeed.children.length > 4) {
    eventFeed.removeChild(eventFeed.lastElementChild);
  }

  eventIndex = (eventIndex + 1) % events.length;
}

function filteredOrders() {
  return activeFilter === "all"
    ? orders
    : orders.filter((order) => order.status === activeFilter);
}

function renderOrders() {
  if (!ordersTableBody) return;

  const filtered = filteredOrders();

  ordersTableBody.innerHTML = filtered.map((order) => `
    <tr
      data-order-id="${order.id}"
      class="order-row${order.id === selectedOrderId ? " is-selected" : ""}"
      tabindex="0"
      role="button"
      aria-pressed="${order.id === selectedOrderId ? "true" : "false"}"
      aria-label="Open ${order.id} route detail"
    >
      <td>${order.id}</td>
      <td>${order.venue}</td>
      <td>${order.mode}</td>
      <td>${order.exposure}</td>
      <td><span class="status-badge ${order.status}">${order.status}</span></td>
    </tr>
  `).join("");

  updateSummary(filtered);
  updateOrdersPill();

  if (activeState === "ready" && filtered.length === 0) {
    setOrderState("empty");
    selectedOrderId = null;
    persistState();
    renderOrderDetail();
    return;
  }

  if (selectedOrderId && !filtered.some((o) => o.id === selectedOrderId)) {
    selectedOrderId = null;
    persistState();
  }

  renderOrderDetail();
}

function renderOrderDetail() {
  if (!orderDetail) return;

  const selected = orders.find((o) => o.id === selectedOrderId);

  if (!selected) {
    orderDetail.innerHTML = `
      <div class="detail-placeholder">
        <p class="panel-label">Route detail</p>
        <strong>Select an order to inspect its route.</strong>
        <p>Every HydraX decision carries venue mix, operator rationale, and a fallback plan. Open a row to see the trail.</p>
      </div>
    `;
    return;
  }

  const statusLabel = selected.status.charAt(0).toUpperCase() + selected.status.slice(1);

  const venueRows = selected.venueMix
    .map((entry) => `<li><span>${entry.name}</span><strong>${entry.share}</strong></li>`)
    .join("");

  orderDetail.innerHTML = `
    <article class="detail-card">
      <header class="detail-head">
        <div>
          <p class="panel-label">${selected.id}</p>
          <strong>${selected.instrument}</strong>
        </div>
        <span class="status-badge ${selected.status}">${statusLabel}</span>
      </header>

      <dl class="detail-meta">
        <div><dt>Side</dt><dd>${selected.side}</dd></div>
        <div><dt>Venue</dt><dd>${selected.venue}</dd></div>
        <div><dt>Mode</dt><dd>${selected.mode}</dd></div>
        <div><dt>Exposure</dt><dd>${selected.exposure}</dd></div>
        <div><dt>Fill quality</dt><dd>${selected.fillQuality}</dd></div>
        <div><dt>Slippage</dt><dd>${selected.slippage}</dd></div>
      </dl>

      <section class="detail-section">
        <p class="panel-label">Operator rationale</p>
        <p class="narrative-copy">${selected.rationale}</p>
      </section>

      <section class="detail-section">
        <p class="panel-label">Venue mix</p>
        <ul class="detail-venue-list">${venueRows}</ul>
      </section>

      <section class="detail-section">
        <p class="panel-label">Fallback sequence</p>
        <p class="narrative-copy">${selected.fallback}</p>
      </section>
    </article>
  `;
}

function selectOrder(orderId) {
  const exists = orders.some((o) => o.id === orderId);
  if (!exists) return;

  selectedOrderId = selectedOrderId === orderId ? null : orderId;

  ordersTableBody?.querySelectorAll("tr.order-row").forEach((row) => {
    const isSelected = row.getAttribute("data-order-id") === selectedOrderId;
    row.classList.toggle("is-selected", isSelected);
    row.setAttribute("aria-pressed", isSelected ? "true" : "false");
  });

  persistState();
  renderOrderDetail();
}

function updateSummary(filtered) {
  if (!summaryFillValue) return;

  const source = filtered && filtered.length ? filtered : orders;
  const liveCount = source.filter((o) => o.status === "live").length;
  const reviewCount = source.filter((o) => o.status === "review").length;
  const queuedCount = source.filter((o) => o.status === "queued").length;

  const fillSamples = source
    .map((o) => parseFloat(o.fillQuality))
    .filter((n) => Number.isFinite(n));
  const avgFill = fillSamples.length
    ? (fillSamples.reduce((a, b) => a + b, 0) / fillSamples.length).toFixed(1) + "%"
    : "Pending";
  summaryFillValue.textContent = avgFill;
  summaryFillCaption.textContent = fillSamples.length
    ? `Average across ${fillSamples.length} filled route${fillSamples.length === 1 ? "" : "s"} in the current lane`
    : "No filled routes in the current lane yet";

  let riskLabel = "Contained";
  let riskCopy = "Inventory skew cooling across Asia and Europe books";
  if (reviewCount >= 2) {
    riskLabel = "Elevated";
    riskCopy = `${reviewCount} routes waiting on operator review`;
  } else if (reviewCount === 1) {
    riskLabel = "Watch";
    riskCopy = "One route flagged for review — monitor threshold widening";
  }
  summaryRiskValue.textContent = riskLabel;
  summaryRiskCaption.textContent = riskCopy;

  let fallbackLabel = "Ready";
  let fallbackCopy = "Frankfurt reroute profile armed with graceful degradation";
  if (queuedCount > 0) {
    fallbackLabel = `${queuedCount} armed`;
    fallbackCopy = `${queuedCount} queued route${queuedCount === 1 ? "" : "s"} holding until venue health recovers`;
  } else if (liveCount === source.length && source.length > 0) {
    fallbackLabel = "Idle";
    fallbackCopy = "All routes live — no fallback position currently staged";
  }
  summaryFallbackValue.textContent = fallbackLabel;
  summaryFallbackCaption.textContent = fallbackCopy;
}

function renderVenues() {
  if (heroVenueCount) {
    heroVenueCount.textContent = String(venues.length);
  }

  const stateLabel = {
    live: "Live",
    warm: "Warm",
    cold: "Cold",
  };

  if (venueList) {
    const featured = venues.slice(0, 3);
    venueList.innerHTML = featured
      .map((v) => `<li><span>${v.name}</span><span class="venue-state venue-state-${v.state}">${stateLabel[v.state] || v.state}</span></li>`)
      .join("");
  }

  if (venueHealthList) {
    venueHealthList.innerHTML = venues
      .map((v) => `<li><span>${v.name}</span><strong class="${v.state}">${v.uptime}</strong></li>`)
      .join("");
  }
}

function updateNavCounts() {
  const liveOrders = orders.filter((o) => o.status === "live").length;
  const liveVenues = venues.filter((v) => v.state === "live").length;

  if (navCountEls.orders) {
    navCountEls.orders.textContent = `${liveOrders} live`;
  }
  if (navCountEls.venues) {
    navCountEls.venues.textContent = `${liveVenues} connected`;
  }
}

function updateOrdersPill() {
  if (!ordersActivePill) return;
  const filtered = filteredOrders();
  const label = activeFilter === "all" ? "total" : activeFilter;
  ordersActivePill.textContent = `${filtered.length} ${label} order${filtered.length === 1 ? "" : "s"}`;
}

function updateWorkspaceLivePill() {
  if (!workspaceLivePill) return;
  const liveOrders = orders.filter((o) => o.status === "live").length;
  workspaceLivePill.textContent = `${liveOrders} live route${liveOrders === 1 ? "" : "s"}`;
}

function setOrderState(nextState) {
  activeState = nextState;

  stateCards.forEach((card) => {
    card.classList.toggle("is-visible", card.dataset.state === nextState);
  });

  if (nextState === "loading") {
    stateBanner.querySelector(".panel-label").textContent = "Loading state";
    stateBanner.querySelector("strong").textContent = "HydraX is reconciling venue health and order confidence.";
    stateBanner.querySelector("p").textContent = "Skeleton rows hold the workspace shape until fresh route telemetry lands.";
  } else if (nextState === "ready") {
    stateBanner.querySelector(".panel-label").textContent = "Ready state";
    stateBanner.querySelector("strong").textContent = "Execution workspace is live with route detail and review flags.";
    stateBanner.querySelector("p").textContent = "Operators can scan active, queued, and review lanes without leaving the dashboard.";
  } else {
    stateBanner.querySelector(".panel-label").textContent = "Empty state";
    stateBanner.querySelector("strong").textContent = "Current filter combination produced an empty lane.";
    stateBanner.querySelector("p").textContent = "The surface preserves structure while showing why no orders are visible.";
  }

  if (nextState === "ready") {
    renderOrders();
  }
}

function setActivePanel(panel) {
  activePanel = panel;
  panelTitle.textContent = panelTitles[panel] || "Workspace";

  navButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.panel === panel);
  });

  panelBodies.forEach((panelBody) => {
    panelBody.classList.toggle("is-visible", panelBody.id === `panel-${panel}`);
  });

  persistState();
}

function setActiveFilter(filter) {
  activeFilter = filter;
  filterButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.filter === filter);
  });

  persistState();

  if (activeState === "loading") {
    updateOrdersPill();
    return;
  }

  const filtered = filteredOrders();
  if (filtered.length === 0) {
    setOrderState("empty");
  } else {
    setOrderState("ready");
  }
}

cycleModeButton?.addEventListener("click", () => {
  modeIndex = (modeIndex + 1) % modes.length;
  updateMode();
  pushEvent();
});

cycleStateButton?.addEventListener("click", () => {
  const next = activeState === "loading" ? "ready" : activeState === "ready" ? "empty" : "loading";
  setOrderState(next);
});

navButtons.forEach((button) => {
  button.addEventListener("click", () => setActivePanel(button.dataset.panel));
});

filterButtons.forEach((button) => {
  button.addEventListener("click", () => setActiveFilter(button.dataset.filter));
});

ordersTableBody?.addEventListener("click", (event) => {
  const row = event.target.closest("tr.order-row");
  if (!row) return;
  const id = row.getAttribute("data-order-id");
  if (id) selectOrder(id);
});

ordersTableBody?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const row = event.target.closest("tr.order-row");
  if (!row) return;
  event.preventDefault();
  const id = row.getAttribute("data-order-id");
  if (id) selectOrder(id);
});

dashboardButtons.forEach((button) => {
  button.addEventListener("click", () => {
    document.getElementById("workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

filterButtons.forEach((button) => {
  button.classList.toggle("is-active", button.dataset.filter === activeFilter);
});

renderVenues();
updateNavCounts();
updateWorkspaceLivePill();
updateMode();
setActivePanel(activePanel);
setOrderState("loading");
renderOrders();
renderOrderDetail();

setTimeout(() => {
  setOrderState("ready");
}, 1200);

setInterval(pushEvent, 9000);