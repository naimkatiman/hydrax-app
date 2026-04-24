/** @type {{ id:string, name:string, state:"live"|"warm", uptime:string, role:"primary"|"secondary", load:{ queueDepth:number, fillQuality:"strong"|"fair"|"weak", posture:string }, fallback:{ target:string, readiness:"armed"|"degraded"|"unavailable" }, rationale:string }[]} */
const venues = [
  {
    id: "sg-nexus", name: "Singapore Nexus", state: "live", uptime: "99.2%", role: "primary",
    load: { queueDepth: 1842, fillQuality: "strong", posture: "Balanced sweep" },
    fallback: { target: "Tokyo Arc", readiness: "armed" },
    rationale: "Deepest Asia-session book today, lowest adverse selection pressure across the primary cluster.",
  },
  {
    id: "tk-arc", name: "Tokyo Arc", state: "live", uptime: "98.7%", role: "primary",
    load: { queueDepth: 1264, fillQuality: "fair", posture: "Latency shield" },
    fallback: { target: "Singapore Nexus", readiness: "armed" },
    rationale: "Holds JGB and Nikkei flow under tight latency envelope; paired with Singapore for symmetric failover.",
  },
  {
    id: "db-harbor", name: "Dubai Harbor", state: "live", uptime: "97.9%", role: "primary",
    load: { queueDepth: 978, fillQuality: "strong", posture: "Inventory protect" },
    fallback: { target: "Frankfurt Loop", readiness: "armed" },
    rationale: "GCC liquidity seam between Asia close and London open; clears inventory skew without spread widening.",
  },
  {
    id: "fr-loop", name: "Frankfurt Loop", state: "warm", uptime: "Warm", role: "secondary",
    load: { queueDepth: 412, fillQuality: "weak", posture: "Fallback mesh" },
    fallback: { target: "London Arc", readiness: "degraded" },
    rationale: "Recovering from the 10:42 latency spike; routes held off the book until round-trip normalizes.",
  },
  {
    id: "ln-arc", name: "London Arc", state: "live", uptime: "98.1%", role: "primary",
    load: { queueDepth: 1537, fillQuality: "fair", posture: "Balanced sweep" },
    fallback: { target: "Frankfurt Loop", readiness: "armed" },
    rationale: "European macro book anchor; carries the Frankfurt overflow while Frankfurt stabilizes.",
  },
  {
    id: "ny-relay", name: "New York Relay", state: "live", uptime: "99.4%", role: "primary",
    load: { queueDepth: 2104, fillQuality: "strong", posture: "Balanced sweep" },
    fallback: { target: "Zurich Chain", readiness: "armed" },
    rationale: "US session primary; strongest fill quality in the network during overlap with London close.",
  },
  {
    id: "sy-rim", name: "Sydney Rim", state: "warm", uptime: "Warm", role: "secondary",
    load: { queueDepth: 286, fillQuality: "fair", posture: "Passive ladder" },
    fallback: { target: "Singapore Nexus", readiness: "armed" },
    rationale: "Pre-open standby for APAC; warms the book before Tokyo takes primary weight.",
  },
  {
    id: "zu-chain", name: "Zurich Chain", state: "live", uptime: "98.8%", role: "secondary",
    load: { queueDepth: 624, fillQuality: "fair", posture: "Inventory protect" },
    fallback: { target: "Frankfurt Loop", readiness: "armed" },
    rationale: "Central European counterweight; absorbs Frankfurt degraded flow without routing through London.",
  },
  {
    id: "se-vertex", name: "Seoul Vertex", state: "live", uptime: "97.3%", role: "secondary",
    load: { queueDepth: 498, fillQuality: "fair", posture: "Latency shield" },
    fallback: { target: "Tokyo Arc", readiness: "unavailable" },
    rationale: "KRX-linked flow only; Tokyo fallback currently unavailable during the Nikkei session halt window.",
  },
];

/** @type {{ id:string, type:string, trigger:string, severity:"high"|"moderate"|"low", status:"pending"|"accepted"|"deferred", venue:string, timestamp:string, rationale:string, recommendation:string, impact:string }[]} */
const riskAlerts = [
  {
    id: "RA-001", type: "Threshold widening", trigger: "London open spread exceeded 2.1 bps",
    severity: "high", status: "pending", venue: "London Arc", timestamp: "08:32",
    rationale: "Operator widened the fill slippage ceiling from 1.8 bps to 2.4 bps during London open volatility. HydraX held the route but flagged for sign-off before re-arming passive mode.",
    recommendation: "Accept the widened threshold for the current session and auto-revert at London close.",
    impact: "Allows continued routing through London Arc without manual holds during peak liquidity.",
  },
  {
    id: "RA-002", type: "Passive window reopen", trigger: "Spread normalization on Singapore Nexus",
    severity: "moderate", status: "pending", venue: "Singapore Nexus", timestamp: "08:18",
    rationale: "HydraX detected spread normalization after Asia session volatility. Passive routing window can reopen, but operator confirmation is required per guardrail policy.",
    recommendation: "Reopen passive window with a 15-minute review horizon.",
    impact: "Restores full routing flexibility on Singapore Nexus for the remainder of the Asia session.",
  },
  {
    id: "RA-003", type: "Inventory skew", trigger: "Asia book skew crossed -0.6% threshold",
    severity: "low", status: "pending", venue: "Tokyo Arc", timestamp: "07:54",
    rationale: "Inventory skew in the Asia macro book crossed the -0.6% soft threshold. Currently narrowing, no hard limit breached.",
    recommendation: "Acknowledge and monitor. No action required unless skew widens past -1.2%.",
    impact: "Informational. Current trajectory is self-correcting.",
  },
  {
    id: "RA-004", type: "Adverse selection", trigger: "Fill quality dropped below 95% on Frankfurt",
    severity: "high", status: "pending", venue: "Frankfurt Loop", timestamp: "07:41",
    rationale: "Frankfurt Loop reported adverse selection pressure after the latency spike. Fill quality dropped to 93.2%. HydraX moved the venue to warm standby and rerouted to London Arc.",
    recommendation: "Defer re-enabling Frankfurt routing until round-trip stabilizes below 18ms for five minutes.",
    impact: "Prevents degraded fills during Frankfurt recovery. London Arc absorbs overflow.",
  },
];

/** @type {{ id:string, name:string, pnl:string, exposure:string, status:"active"|"watch"|"staged", instruments:number, topHoldings:{ name:string, weight:string, venue:string }[], venueAllocation:{ name:string, share:string }[], rationale:string, riskNote:string }[]} */
const positions = [
  {
    id: "BK-ASIA", name: "Asia macro book", pnl: "+1.8%", exposure: "$18.4M", status: "active", instruments: 12,
    topHoldings: [
      { name: "SGX iShares MSCI", weight: "22%", venue: "Singapore Nexus" },
      { name: "Nikkei 225 basket", weight: "18%", venue: "Tokyo Arc" },
      { name: "GCC energy sleeve", weight: "14%", venue: "Dubai Harbor" },
    ],
    venueAllocation: [
      { name: "Singapore Nexus", share: "41%" }, { name: "Tokyo Arc", share: "32%" },
      { name: "Dubai Harbor", share: "19%" }, { name: "Seoul Vertex", share: "8%" },
    ],
    rationale: "Overweight Asia-Pacific flow during pre-London session. Inventory skew narrowing after the BoJ tape print; queue density improving on Singapore and Tokyo.",
    riskNote: "Soft threshold at -0.6% inventory skew crossed but self-correcting. No hard limit breached.",
  },
  {
    id: "BK-EUR", name: "Europe dispersion", pnl: "-0.4%", exposure: "$11.2M", status: "watch", instruments: 8,
    topHoldings: [
      { name: "DAX futures sleeve", weight: "28%", venue: "Frankfurt Loop" },
      { name: "Euro Stoxx vol surface", weight: "24%", venue: "London Arc" },
      { name: "CHF rates overlay", weight: "16%", venue: "Zurich Chain" },
    ],
    venueAllocation: [
      { name: "London Arc", share: "44%" }, { name: "Frankfurt Loop", share: "30%" }, { name: "Zurich Chain", share: "26%" },
    ],
    rationale: "Book tilted defensive after Frankfurt latency spike. London Arc absorbing overflow while Frankfurt recovers. Dispersion trades hedging against implied vol mean-reversion.",
    riskNote: "Frankfurt Loop in warm standby — DAX sleeve queued until round-trip normalizes below 18ms.",
  },
  {
    id: "BK-HEDGE", name: "Cross-venue hedge", pnl: "+0.9%", exposure: "$6.8M", status: "active", instruments: 5,
    topHoldings: [
      { name: "SGD rates curve", weight: "34%", venue: "Singapore Nexus" },
      { name: "JGB short sleeve", weight: "28%", venue: "Tokyo Arc" },
      { name: "FX delta neutral", weight: "22%", venue: "New York Relay" },
    ],
    venueAllocation: [
      { name: "Singapore Nexus", share: "38%" }, { name: "Tokyo Arc", share: "30%" }, { name: "New York Relay", share: "32%" },
    ],
    rationale: "Offsetting directional exposure across the Asia and US books. Rate curve positions sized to maintain delta neutrality during the session overlap.",
    riskNote: "Within tolerance band. Auto-rebalance armed if net delta drifts beyond 0.3%.",
  },
  {
    id: "BK-US", name: "US session book", pnl: "+2.1%", exposure: "$22.6M", status: "active", instruments: 9,
    topHoldings: [
      { name: "S&P 500 basket", weight: "30%", venue: "New York Relay" },
      { name: "Treasury curve", weight: "25%", venue: "New York Relay" },
      { name: "VIX sleeve", weight: "15%", venue: "New York Relay" },
    ],
    venueAllocation: [
      { name: "New York Relay", share: "72%" }, { name: "Zurich Chain", share: "18%" }, { name: "London Arc", share: "10%" },
    ],
    rationale: "Primary US session exposure. Strongest fill quality in the network during the London-New York overlap window. Treasury curve weighted for yield curve steepening.",
    riskNote: "Clean. No threshold breach. Passive mode fully armed.",
  },
  {
    id: "BK-APAC", name: "APAC pre-open staging", pnl: "Flat", exposure: "$3.2M", status: "staged", instruments: 3,
    topHoldings: [
      { name: "ASX 200 sleeve", weight: "45%", venue: "Sydney Rim" },
      { name: "KRX flow basket", weight: "35%", venue: "Seoul Vertex" },
      { name: "NZD overlay", weight: "20%", venue: "Sydney Rim" },
    ],
    venueAllocation: [
      { name: "Sydney Rim", share: "55%" }, { name: "Seoul Vertex", share: "45%" },
    ],
    rationale: "Pre-open staging for the next APAC session. Orders held in passive ladder until Sydney and Seoul venues warm into primary weight.",
    riskNote: "No live exposure. Staged orders will activate when venue load thresholds are met.",
  },
];

/** @type {{ id:string, venue:string, mode:string, exposure:string, status:"live"|"review"|"queued", side:"Buy"|"Sell", instrument:string, fillQuality:string, slippage:string, rationale:string, venueMix:{ name:string, share:string }[], fallback:string }[]} */
const orders = [
  {
    id: "HX-2041", venue: "Singapore Nexus", mode: "Balanced Sweep", exposure: "$4.2M",
    status: "live", side: "Buy", instrument: "SGX iShares MSCI", fillQuality: "99.1%", slippage: "+0.06%",
    rationale: "Queue depth tightened on Singapore Nexus, HydraX shifted weight from Tokyo to absorb the improved fill curve.",
    venueMix: [{ name: "Singapore Nexus", share: "68%" }, { name: "Tokyo Arc", share: "24%" }, { name: "Dubai Harbor", share: "8%" }],
    fallback: "Tokyo Arc armed as warm reroute if Singapore latency drifts above 18ms.",
  },
  {
    id: "HX-2038", venue: "Tokyo Arc", mode: "Latency Shield", exposure: "$2.1M",
    status: "review", side: "Sell", instrument: "Nikkei 225 basket", fillQuality: "96.4%", slippage: "+0.14%",
    rationale: "Adverse selection pressure rose during the Tokyo open; HydraX flagged the route for operator review before expanding the child-order window.",
    venueMix: [{ name: "Tokyo Arc", share: "74%" }, { name: "Singapore Nexus", share: "26%" }],
    fallback: "Passive ladder rollback ready if spread widens beyond 1.4 bps.",
  },
  {
    id: "HX-2035", venue: "Dubai Harbor", mode: "Inventory Protect", exposure: "$3.4M",
    status: "live", side: "Buy", instrument: "GCC energy sleeve", fillQuality: "98.7%", slippage: "+0.08%",
    rationale: "Inventory skew in the Asia book narrowed; HydraX re-enabled aggressive take on Dubai Harbor to rebuild depth.",
    venueMix: [{ name: "Dubai Harbor", share: "82%" }, { name: "Frankfurt Loop", share: "18%" }],
    fallback: "Frankfurt Loop holds warm standby with tightened size caps.",
  },
  {
    id: "HX-2031", venue: "Frankfurt Loop", mode: "Fallback Mesh", exposure: "$1.2M",
    status: "queued", side: "Sell", instrument: "DAX futures sleeve", fillQuality: "Pending", slippage: "\u2014",
    rationale: "Route parked until Frankfurt Loop recovers from the 10:42 latency spike. HydraX is holding exposure off the book rather than forcing a degraded fill.",
    venueMix: [{ name: "Frankfurt Loop", share: "60% target" }, { name: "Singapore Nexus", share: "40% hedge" }],
    fallback: "Auto-release once Frankfurt round-trip drops under 22ms for two minutes.",
  },
  {
    id: "HX-2028", venue: "Singapore Nexus", mode: "Balanced Sweep", exposure: "$5.0M",
    status: "review", side: "Buy", instrument: "SGD rates curve", fillQuality: "97.2%", slippage: "+0.12%",
    rationale: "Operator widened the threshold during London open, HydraX logged the override and is awaiting sign-off before re-arming passive mode.",
    venueMix: [{ name: "Singapore Nexus", share: "58%" }, { name: "Dubai Harbor", share: "30%" }, { name: "Tokyo Arc", share: "12%" }],
    fallback: "Auto-revert to Balanced Sweep once passive window reopens post-review.",
  },
  {
    id: "HX-2026", venue: "Tokyo Arc", mode: "Passive Ladder", exposure: "$900K",
    status: "queued", side: "Sell", instrument: "JGB short sleeve", fillQuality: "Pending", slippage: "\u2014",
    rationale: "Child orders staged but held — HydraX is waiting for queue density to normalize after the BoJ tape print.",
    venueMix: [{ name: "Tokyo Arc", share: "100%" }],
    fallback: "Escalate to Latency Shield if queue density recovers before spread normalizes.",
  },
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

const panelTitles = {
  orders: "Execution orders",
  positions: "Position overview",
  venues: "Venue health",
  risk: "Risk posture",
  settings: "Workspace settings",
  activity: "Activity log",
};

const panelFilters = {
  orders: [
    { key: "all", label: "All" },
    { key: "live", label: "Live" },
    { key: "review", label: "Needs review" },
    { key: "queued", label: "Queued" },
  ],
  venues: [
    { key: "all", label: "All" },
    { key: "live", label: "Live" },
    { key: "warm", label: "Warm" },
  ],
  positions: [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "watch", label: "Watch" },
    { key: "staged", label: "Staged" },
  ],
  risk: [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "accepted", label: "Accepted" },
    { key: "deferred", label: "Deferred" },
  ],
  settings: [],
  activity: [],
};

const persisted = readPersistedState();

let modeIndex = 0;
let eventIndex = 0;
let activePanel = persisted.activePanel || "orders";
let activeFilter = persisted.activeFilter || "all";
let activeState = "loading";
let selectedOrderId = persisted.selectedOrderId || null;
let selectedVenueId = persisted.selectedVenueId || null;
let selectedRiskId = persisted.selectedRiskId || null;
let selectedPositionId = persisted.selectedPositionId || null;

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
      selectedVenueId,
      selectedRiskId,
      selectedPositionId,
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
const breadcrumbTrail = document.getElementById("breadcrumbTrail");
const stateBanner = document.getElementById("stateBanner");
const cycleStateButton = document.getElementById("cycleState");
const navButtons = Array.from(document.querySelectorAll(".workspace-nav-item"));
const filterGroup = document.getElementById("filterGroup");
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
const venuesTableBody = document.getElementById("venuesTableBody");
const venueDetail = document.getElementById("venueDetail");
const venuesActivePill = document.getElementById("venuesActivePill");
const heroVenueCount = document.getElementById("heroVenueCount");
const summaryFillLabel = document.getElementById("summaryFillLabel");
const summaryRiskLabel = document.getElementById("summaryRiskLabel");
const summaryFallbackLabel = document.getElementById("summaryFallbackLabel");
const riskTableBody = document.getElementById("riskTableBody");
const riskDetail = document.getElementById("riskDetail");
const riskActivePill = document.getElementById("riskActivePill");
const positionsTableBody = document.getElementById("positionsTableBody");
const positionDetail = document.getElementById("positionDetail");
const positionsActivePill = document.getElementById("positionsActivePill");
const navCountEls = {
  orders: document.querySelector('[data-nav-count="orders"]'),
  venues: document.querySelector('[data-nav-count="venues"]'),
  risk: document.querySelector('[data-nav-count="risk"]'),
  positions: document.querySelector('[data-nav-count="positions"]'),
};
const settingModeBias = document.getElementById("settingModeBias");
const settingAlertCadence = document.getElementById("settingAlertCadence");
const settingFallbackPolicy = document.getElementById("settingFallbackPolicy");
const settingDensity = document.getElementById("settingDensity");
const settingsSavedPill = document.getElementById("settingsSavedPill");
const readoutModeBias = document.getElementById("readoutModeBias");
const readoutAlertCadence = document.getElementById("readoutAlertCadence");
const readoutFallbackPolicy = document.getElementById("readoutFallbackPolicy");
const readoutDensity = document.getElementById("readoutDensity");
const workspaceShell = document.querySelector(".workspace-shell");
const workspaceSearch = document.getElementById("workspaceSearch");

const toastContainer = document.getElementById("toastContainer");
const activityTableBody = document.getElementById("activityTableBody");
const activityCountPill = document.getElementById("activityCountPill");
const activityEmpty = document.getElementById("activityEmpty");
const navCountActivity = document.querySelector('[data-nav-count="activity"]');

const venuesFilterEmpty = document.getElementById("venuesFilterEmpty");
const positionsFilterEmpty = document.getElementById("positionsFilterEmpty");
const riskFilterEmpty = document.getElementById("riskFilterEmpty");

const ACTIVITY_STORAGE_KEY = "hydrax.activity.v1";

const activityLog = loadPersistedActivity();

function loadPersistedActivity() {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(ACTIVITY_STORAGE_KEY) : null;
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_err) {
    return [];
  }
}

function persistActivity() {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(activityLog));
  } catch (_err) {
    // best-effort
  }
}

function logActivity(action, detail) {
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  activityLog.unshift({ time, action, detail });
  if (activityLog.length > 50) activityLog.length = 50;
  persistActivity();
  renderActivityLog();
}

function clearActivityLog() {
  activityLog.length = 0;
  persistActivity();
  renderActivityLog();
  updateLaneSummary(filteredOrders());
}

function renderActivityLog() {
  if (activityTableBody) {
    activityTableBody.innerHTML = activityLog.map((entry) => `
      <tr class="activity-row">
        <td>${entry.time}</td>
        <td><span class="activity-action">${entry.action}</span></td>
        <td><span class="activity-detail">${entry.detail}</span></td>
      </tr>
    `).join("");
  }

  if (activityCountPill) {
    activityCountPill.textContent = `${activityLog.length} entr${activityLog.length === 1 ? "y" : "ies"}`;
  }
  if (navCountActivity) {
    navCountActivity.textContent = `${activityLog.length} entr${activityLog.length === 1 ? "y" : "ies"}`;
  }
  if (activityEmpty) {
    activityEmpty.classList.toggle("is-hidden", activityLog.length > 0);
  }
}

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

function filteredVenues() {
  return activeFilter === "all"
    ? venues
    : venues.filter((v) => v.state === activeFilter);
}

function filteredPositions() {
  return activeFilter === "all"
    ? positions
    : positions.filter((p) => p.status === activeFilter);
}

function filteredRisk() {
  return activeFilter === "all"
    ? riskAlerts
    : riskAlerts.filter((a) => a.status === activeFilter);
}

function selectedItemForPanel(panel) {
  if (panel === "orders" && selectedOrderId) {
    return orders.find((o) => o.id === selectedOrderId)?.id || null;
  }
  if (panel === "venues" && selectedVenueId) {
    return venues.find((v) => v.id === selectedVenueId)?.name || null;
  }
  if (panel === "risk" && selectedRiskId) {
    return riskAlerts.find((a) => a.id === selectedRiskId)?.id || null;
  }
  if (panel === "positions" && selectedPositionId) {
    return positions.find((p) => p.id === selectedPositionId)?.name || null;
  }
  return null;
}

function renderBreadcrumb() {
  if (!breadcrumbTrail) return;
  const panelName = panelTitles[activePanel] || "Workspace";
  const itemLabel = selectedItemForPanel(activePanel);

  let html =
    '<span class="crumb-root">Dashboard view</span>' +
    '<span class="crumb-sep" aria-hidden="true">›</span>' +
    '<span class="crumb-panel">' + panelName + '</span>';

  if (itemLabel) {
    html +=
      '<span class="crumb-sep" aria-hidden="true">›</span>' +
      '<span class="crumb-item">' + itemLabel + '</span>';
  }

  breadcrumbTrail.innerHTML = html;
}

function renderFilterChips(panel) {
  if (!filterGroup) return;
  var filters = panelFilters[panel] || [];
  if (filters.length === 0) {
    filterGroup.classList.add("is-hidden");
    filterGroup.innerHTML = "";
    return;
  }
  filterGroup.classList.remove("is-hidden");
  filterGroup.innerHTML = filters.map(function (f) {
    return '<button class="filter-chip' + (f.key === activeFilter ? " is-active" : "") + '" type="button" data-filter="' + f.key + '">' + f.label + '</button>';
  }).join("");
  filterGroup.querySelectorAll(".filter-chip").forEach(function (btn) {
    btn.addEventListener("click", function () {
      setActiveFilter(btn.dataset.filter);
    });
  });
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

  updateLaneSummary(filtered);
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

/**
 * Shared drill-down detail card renderer.
 * @param {{ label:string, title:string, badge:string, badgeClass:string, meta:{ dt:string, dd:string }[], sections:{ label:string, html:string }[], actions?:string }} opts
 * @returns {string}
 */
function renderDetailCard(opts) {
  const closeIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
  const metaRows = opts.meta.map(function (m) { return '<div><dt>' + m.dt + '</dt><dd>' + m.dd + '</dd></div>'; }).join('');
  const sectionRows = opts.sections.map(function (s) { return '<section class="detail-section"><p class="panel-label">' + s.label + '</p>' + s.html + '</section>'; }).join('');
  return '<article class="detail-card">' +
    '<header class="detail-head">' +
      '<div><p class="panel-label">' + opts.label + '</p><strong>' + opts.title + '</strong></div>' +
      '<span class="' + opts.badgeClass + '">' + opts.badge + '</span>' +
      '<button class="detail-close" type="button" aria-label="Close detail">' + closeIcon + '</button>' +
    '</header>' +
    '<dl class="detail-meta">' + metaRows + '</dl>' +
    sectionRows +
    (opts.actions || '') +
  '</article>';
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
    .map((entry) => `<li><span><span class="venue-link" data-venue-link="${entry.name}" role="button" tabindex="0" aria-label="Open ${entry.name} in venues panel">${entry.name}</span></span><strong>${entry.share}</strong></li>`)
    .join("");

  orderDetail.innerHTML = renderDetailCard({
    label: selected.id,
    title: selected.instrument,
    badge: statusLabel,
    badgeClass: 'status-badge ' + selected.status,
    meta: [
      { dt: 'Side', dd: selected.side },
      { dt: 'Venue', dd: '<span class="venue-link" data-venue-link="' + selected.venue + '" role="button" tabindex="0" aria-label="Open ' + selected.venue + ' in venues panel">' + selected.venue + '</span>' },
      { dt: 'Mode', dd: selected.mode },
      { dt: 'Exposure', dd: selected.exposure },
      { dt: 'Fill quality', dd: selected.fillQuality },
      { dt: 'Slippage', dd: selected.slippage },
    ],
    sections: [
      { label: 'Operator rationale', html: '<p class="narrative-copy">' + selected.rationale + '</p>' },
      { label: 'Venue mix', html: '<ul class="detail-venue-list">' + venueRows + '</ul>' },
      { label: 'Fallback sequence', html: '<p class="narrative-copy">' + selected.fallback + '</p>' },
    ],
  });
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
  if (selectedOrderId) logActivity("Select order", selectedOrderId);
  renderBreadcrumb();
}

function updateLaneSummary(filtered) {
  if (activePanel === "venues") {
    updateVenuesSummary();
  } else if (activePanel === "risk") {
    updateRiskSummary();
  } else if (activePanel === "positions") {
    updatePositionsSummary();
  } else if (activePanel === "activity") {
    updateActivitySummary();
  } else {
    updateOrdersSummary(filtered);
  }
}

function updateActivitySummary() {
  if (!summaryFillValue) return;

  if (summaryFillLabel) summaryFillLabel.textContent = "Log entries";
  if (summaryRiskLabel) summaryRiskLabel.textContent = "Last action";
  if (summaryFallbackLabel) summaryFallbackLabel.textContent = "Session";

  summaryFillValue.textContent = `${activityLog.length}`;
  summaryFillCaption.textContent = `${activityLog.length} action${activityLog.length === 1 ? "" : "s"} recorded this session`;

  if (activityLog.length > 0) {
    summaryRiskValue.textContent = activityLog[0].action;
    summaryRiskCaption.textContent = activityLog[0].detail;
  } else {
    summaryRiskValue.textContent = "None";
    summaryRiskCaption.textContent = "No actions recorded yet";
  }

  summaryFallbackValue.textContent = "Persistent";
  summaryFallbackCaption.textContent = "Activity persists across sessions via local storage";
}

function updateOrdersSummary(filtered) {
  if (!summaryFillValue) return;

  if (summaryFillLabel) summaryFillLabel.textContent = "Fill quality";
  if (summaryRiskLabel) summaryRiskLabel.textContent = "Risk pressure";
  if (summaryFallbackLabel) summaryFallbackLabel.textContent = "Fallback posture";

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

function updateVenuesSummary() {
  if (!summaryFillValue) return;

  if (summaryFillLabel) summaryFillLabel.textContent = "Venue load";
  if (summaryRiskLabel) summaryRiskLabel.textContent = "Failover readiness";
  if (summaryFallbackLabel) summaryFallbackLabel.textContent = "Connected cluster";

  const strongCount = venues.filter((v) => v.load.fillQuality === "strong").length;
  const fairCount = venues.filter((v) => v.load.fillQuality === "fair").length;
  const weakCount = venues.filter((v) => v.load.fillQuality === "weak").length;

  let loadLabel;
  if (weakCount > 0) loadLabel = `${weakCount} weak`;
  else if (fairCount >= strongCount) loadLabel = `${fairCount} fair`;
  else loadLabel = `${strongCount} strong`;
  summaryFillValue.textContent = loadLabel;
  summaryFillCaption.textContent = `${strongCount} strong / ${fairCount} fair / ${weakCount} weak across ${venues.length} venue${venues.length === 1 ? "" : "s"}`;

  const armed = venues.filter((v) => v.fallback.readiness === "armed").length;
  const degraded = venues.filter((v) => v.fallback.readiness === "degraded").length;
  const unavailable = venues.filter((v) => v.fallback.readiness === "unavailable").length;

  let readinessLabel = `${armed} armed`;
  let readinessCopy = `${armed} venue${armed === 1 ? "" : "s"} with failover armed`;
  if (unavailable > 0) {
    readinessLabel = `${unavailable} gap${unavailable === 1 ? "" : "s"}`;
    readinessCopy = `${unavailable} venue${unavailable === 1 ? "" : "s"} without an available fallback — operator attention required`;
  } else if (degraded > 0) {
    readinessLabel = `${degraded} degraded`;
    readinessCopy = `${degraded} fallback${degraded === 1 ? "" : "s"} degraded — monitor before peak window`;
  }
  summaryRiskValue.textContent = readinessLabel;
  summaryRiskCaption.textContent = readinessCopy;

  const liveCount = venues.filter((v) => v.state === "live").length;
  const warmCount = venues.filter((v) => v.state === "warm").length;
  summaryFallbackValue.textContent = `${liveCount} of ${venues.length}`;
  summaryFallbackCaption.textContent = warmCount > 0
    ? `${liveCount} live, ${warmCount} warm standby across the connected cluster`
    : `${liveCount} venue${liveCount === 1 ? "" : "s"} live across the connected cluster`;
}

const stateLabel = {
  live: "Live",
  warm: "Warm",
  cold: "Cold",
};

const loadLabel = {
  strong: "Strong",
  fair: "Fair",
  weak: "Weak",
};

const readinessLabel = {
  armed: "Armed",
  degraded: "Degraded",
  unavailable: "Unavailable",
};

function routedOrdersFor(venueName) {
  return orders.filter((o) => o.venue === venueName);
}

function renderVenues() {
  if (heroVenueCount) {
    heroVenueCount.textContent = String(venues.length);
  }

  if (venueList) {
    const featured = venues.slice(0, 3);
    venueList.innerHTML = featured
      .map((v) => `<li><span>${v.name}</span><span class="venue-state venue-state-${v.state}">${stateLabel[v.state] || v.state}</span></li>`)
      .join("");
  }

  renderVenueLane();
  renderVenueDetail();
  updateVenuesPill();
}

function renderVenueLane() {
  if (!venuesTableBody) return;

  var filtered = filteredVenues();
  var isEmpty = filtered.length === 0;

  if (venuesFilterEmpty) venuesFilterEmpty.classList.toggle("is-visible", isEmpty);
  var venueLane = venuesTableBody.closest(".venue-lane");
  if (venueLane) venueLane.classList.toggle("is-hidden", isEmpty);
  var venueRail = venuesTableBody.closest(".venues-workbench")?.querySelector(".detail-rail");
  if (venueRail) venueRail.classList.toggle("is-hidden", isEmpty);

  if (selectedVenueId && !filtered.some((v) => v.id === selectedVenueId)) {
    selectedVenueId = null;
    persistState();
  }

  venuesTableBody.innerHTML = filtered.map((venue) => {
    const routed = routedOrdersFor(venue.name);
    const roleLabel = venue.role.charAt(0).toUpperCase() + venue.role.slice(1);
    const stateText = stateLabel[venue.state] || venue.state;
    const readinessText = readinessLabel[venue.fallback.readiness] || venue.fallback.readiness;
    const loadText = loadLabel[venue.load.fillQuality] || venue.load.fillQuality;
    return `
      <tr
        data-venue-id="${venue.id}"
        class="venue-row${venue.id === selectedVenueId ? " is-selected" : ""}"
        tabindex="0"
        role="button"
        aria-pressed="${venue.id === selectedVenueId ? "true" : "false"}"
        aria-label="Open ${venue.name} venue detail"
      >
        <td>
          <strong>${venue.name}</strong>
          <span class="venue-role venue-role-${venue.role}">${roleLabel}</span>
        </td>
        <td><span class="venue-state venue-state-${venue.state}">${stateText}</span></td>
        <td>
          <span class="load-pill load-${venue.load.fillQuality}">${loadText}</span>
          <span class="load-posture">${venue.load.posture}</span>
        </td>
        <td class="numeric">${venue.load.queueDepth.toLocaleString()}</td>
        <td>${routed.length}</td>
        <td><span class="readiness-pill readiness-${venue.fallback.readiness}">${readinessText}</span></td>
      </tr>
    `;
  }).join("");
}

function renderVenueDetail() {
  if (!venueDetail) return;

  const selected = venues.find((v) => v.id === selectedVenueId);

  if (!selected) {
    venueDetail.innerHTML = `
      <div class="detail-placeholder">
        <p class="panel-label">Venue detail</p>
        <strong>Select a venue to inspect load, routed orders, and failover readiness.</strong>
        <p>Each venue carries an operator rationale, a failover target, and a readiness state. Open a row to see the trail.</p>
      </div>
    `;
    return;
  }

  const stateText = stateLabel[selected.state] || selected.state;
  const roleText = selected.role.charAt(0).toUpperCase() + selected.role.slice(1);
  const loadText = loadLabel[selected.load.fillQuality] || selected.load.fillQuality;
  const readinessText = readinessLabel[selected.fallback.readiness] || selected.fallback.readiness;
  const routed = routedOrdersFor(selected.name);

  const routedMarkup = routed.length
    ? `<ul class="detail-venue-list">${routed.map((order) => `
        <li>
          <span>
            <strong class="routed-order-id" data-routed-order-id="${order.id}" role="button" tabindex="0" aria-label="Open ${order.id} in orders lane">${order.id}</strong>
            <span class="routed-order-meta">${order.instrument} · ${order.mode}</span>
          </span>
          <span class="status-badge ${order.status}">${order.status}</span>
        </li>
      `).join("")}</ul>`
    : `<p class="narrative-copy">No orders currently routed through ${selected.name}.</p>`;

  venueDetail.innerHTML = renderDetailCard({
    label: selected.name,
    title: selected.load.posture,
    badge: stateText,
    badgeClass: 'venue-state venue-state-' + selected.state,
    meta: [
      { dt: 'Role', dd: roleText },
      { dt: 'Uptime', dd: selected.uptime },
      { dt: 'Queue depth', dd: selected.load.queueDepth.toLocaleString() },
      { dt: 'Fill quality', dd: loadText },
      { dt: 'Posture', dd: selected.load.posture },
      { dt: 'Routed orders', dd: String(routed.length) },
    ],
    sections: [
      { label: 'Operator rationale', html: '<p class="narrative-copy">' + selected.rationale + '</p>' },
      { label: 'Routed orders', html: routedMarkup },
      { label: 'Failover readiness', html: '<div class="detail-fallback"><span>Target</span><strong>' + selected.fallback.target + '</strong><span>Readiness</span><strong class="readiness-pill readiness-' + selected.fallback.readiness + '">' + readinessText + '</strong></div>' },
    ],
  });
}

function selectVenue(venueId) {
  const exists = venues.some((v) => v.id === venueId);
  if (!exists) return;

  const prev = selectedVenueId;
  selectedVenueId = selectedVenueId === venueId ? null : venueId;

  venuesTableBody?.querySelectorAll("tr.venue-row").forEach((row) => {
    const isSelected = row.getAttribute("data-venue-id") === selectedVenueId;
    row.classList.toggle("is-selected", isSelected);
    row.setAttribute("aria-pressed", isSelected ? "true" : "false");
  });

  persistState();
  renderVenueDetail();
  if (selectedVenueId) {
    const v = venues.find((v) => v.id === selectedVenueId);
    if (v) logActivity("Select venue", v.name);
  }
  renderBreadcrumb();
}

function showToast(message) {
  if (!toastContainer) return;
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = '<span class="toast-accent" aria-hidden="true"></span>';
  const text = document.createElement("span");
  text.textContent = message;
  el.appendChild(text);
  toastContainer.appendChild(el);
  setTimeout(() => {
    el.classList.add("toast-out");
    el.addEventListener("animationend", () => el.remove(), { once: true });
  }, 3000);
  while (toastContainer.children.length > 4) {
    toastContainer.removeChild(toastContainer.firstElementChild);
  }
}

function jumpToOrder(orderId) {
  const exists = orders.some((o) => o.id === orderId);
  if (!exists) return;

  if (activeFilter !== "all" && !filteredOrders().some((o) => o.id === orderId)) {
    setActiveFilter("all");
  }

  selectedOrderId = orderId;
  persistState();
  setActivePanel("orders", true);
  renderOrders();
  logActivity("Jump to order", orderId);
  showToast("Jumped to order " + orderId);
}

function jumpToVenue(venueName) {
  const venue = venues.find((v) => v.name === venueName);
  if (!venue) return;

  selectedVenueId = venue.id;
  persistState();
  setActivePanel("venues", true);
  renderVenueLane();
  renderVenueDetail();
  logActivity("Jump to venue", venue.name);
  showToast("Jumped to " + venue.name);
}

function updateVenuesPill() {
  if (!venuesActivePill) return;
  const liveCount = venues.filter((v) => v.state === "live").length;
  venuesActivePill.textContent = `${liveCount} live · ${venues.length} total`;
}

const severityLabel = {
  high: "High",
  moderate: "Moderate",
  low: "Low",
};

const riskStatusLabel = {
  pending: "Pending",
  accepted: "Accepted",
  deferred: "Deferred",
};

function pendingRiskCount() {
  return riskAlerts.filter((a) => a.status === "pending").length;
}

function renderRiskAlerts() {
  if (!riskTableBody) return;

  var filtered = filteredRisk();
  var isEmpty = filtered.length === 0;

  if (riskFilterEmpty) riskFilterEmpty.classList.toggle("is-visible", isEmpty);
  var riskLane = riskTableBody.closest(".risk-lane");
  if (riskLane) riskLane.classList.toggle("is-hidden", isEmpty);
  var riskRail = riskTableBody.closest(".risk-workbench")?.querySelector(".detail-rail");
  if (riskRail) riskRail.classList.toggle("is-hidden", isEmpty);

  if (selectedRiskId && !filtered.some((a) => a.id === selectedRiskId)) {
    selectedRiskId = null;
    persistState();
  }

  riskTableBody.innerHTML = filtered.map((alert) => {
    const sevText = severityLabel[alert.severity] || alert.severity;
    const statusText = riskStatusLabel[alert.status] || alert.status;
    return `
      <tr
        data-risk-id="${alert.id}"
        class="risk-row${alert.id === selectedRiskId ? " is-selected" : ""}"
        tabindex="0"
        role="button"
        aria-pressed="${alert.id === selectedRiskId ? "true" : "false"}"
        aria-label="Open ${alert.id} risk detail"
      >
        <td>
          <strong>${alert.type}</strong>
          <span class="risk-trigger">${alert.trigger}</span>
        </td>
        <td><span class="severity-badge severity-${alert.severity}">${sevText}</span></td>
        <td>${alert.venue}</td>
        <td><span class="risk-time">${alert.timestamp}</span></td>
        <td><span class="risk-status-badge risk-status-${alert.status}">${statusText}</span></td>
      </tr>
    `;
  }).join("");

  updateRiskPill();
  updateRiskNavCount();
  renderRiskDetail();
}

function renderRiskDetail() {
  if (!riskDetail) return;

  const selected = riskAlerts.find((a) => a.id === selectedRiskId);

  if (!selected) {
    riskDetail.innerHTML = `
      <div class="detail-placeholder">
        <p class="panel-label">Review detail</p>
        <strong>Select an alert to review its context and take action.</strong>
        <p>Each risk alert carries a trigger, operator rationale, and a recommended action. Accept or defer from this rail.</p>
      </div>
    `;
    return;
  }

  const sevText = severityLabel[selected.severity] || selected.severity;
  const statusText = riskStatusLabel[selected.status] || selected.status;

  const actionsMarkup = selected.status === "pending"
    ? `<div class="risk-actions">
        <button class="button button-accept" type="button" data-risk-action="accept" data-risk-target="${selected.id}">Accept</button>
        <button class="button button-defer" type="button" data-risk-action="defer" data-risk-target="${selected.id}">Defer</button>
      </div>`
    : `<div class="risk-resolved">
        <span class="risk-status-badge risk-status-${selected.status}">${statusText}</span>
      </div>`;

  riskDetail.innerHTML = renderDetailCard({
    label: selected.id,
    title: selected.type,
    badge: sevText,
    badgeClass: 'severity-badge severity-' + selected.severity,
    meta: [
      { dt: 'Severity', dd: sevText },
      { dt: 'Venue', dd: selected.venue },
      { dt: 'Triggered', dd: selected.timestamp },
    ],
    sections: [
      { label: 'Trigger', html: '<p class="narrative-copy">' + selected.trigger + '</p>' },
      { label: 'Rationale', html: '<p class="narrative-copy">' + selected.rationale + '</p>' },
      { label: 'Recommendation', html: '<p class="narrative-copy">' + selected.recommendation + '</p>' },
      { label: 'Impact', html: '<p class="narrative-copy">' + selected.impact + '</p>' },
    ],
    actions: actionsMarkup,
  });
}

function selectRisk(riskId) {
  const exists = riskAlerts.some((a) => a.id === riskId);
  if (!exists) return;

  selectedRiskId = selectedRiskId === riskId ? null : riskId;

  riskTableBody?.querySelectorAll("tr.risk-row").forEach((row) => {
    const isSelected = row.getAttribute("data-risk-id") === selectedRiskId;
    row.classList.toggle("is-selected", isSelected);
    row.setAttribute("aria-pressed", isSelected ? "true" : "false");
  });

  persistState();
  renderRiskDetail();
  if (selectedRiskId) logActivity("Select risk", selectedRiskId);
  renderBreadcrumb();
}

function resolveRisk(riskId, resolution) {
  const alert = riskAlerts.find((a) => a.id === riskId);
  if (!alert || alert.status !== "pending") return;

  alert.status = resolution;
  logActivity("Risk " + resolution, alert.id + " — " + alert.type);
  renderRiskAlerts();
  updateLaneSummary(filteredOrders());
  renderBreadcrumb();
}

function updateRiskPill() {
  if (!riskActivePill) return;
  const pending = pendingRiskCount();
  riskActivePill.textContent = `${pending} pending`;
}

function updateRiskNavCount() {
  if (!navCountEls.risk) return;
  const pending = pendingRiskCount();
  navCountEls.risk.textContent = `${pending} alert${pending === 1 ? "" : "s"}`;
}

function updateRiskSummary() {
  if (!summaryFillValue) return;

  if (summaryFillLabel) summaryFillLabel.textContent = "Review queue";
  if (summaryRiskLabel) summaryRiskLabel.textContent = "Severity profile";
  if (summaryFallbackLabel) summaryFallbackLabel.textContent = "Resolution rate";

  const pending = riskAlerts.filter((a) => a.status === "pending").length;
  const accepted = riskAlerts.filter((a) => a.status === "accepted").length;
  const deferred = riskAlerts.filter((a) => a.status === "deferred").length;
  const total = riskAlerts.length;

  summaryFillValue.textContent = `${pending} pending`;
  summaryFillCaption.textContent = `${total} total alert${total === 1 ? "" : "s"} in the review queue`;

  const highCount = riskAlerts.filter((a) => a.severity === "high").length;
  const modCount = riskAlerts.filter((a) => a.severity === "moderate").length;
  const lowCount = riskAlerts.filter((a) => a.severity === "low").length;

  let sevLabel;
  if (highCount > 0) sevLabel = `${highCount} high`;
  else if (modCount > 0) sevLabel = `${modCount} moderate`;
  else sevLabel = `${lowCount} low`;
  summaryRiskValue.textContent = sevLabel;
  summaryRiskCaption.textContent = `${highCount} high / ${modCount} moderate / ${lowCount} low across ${total} alert${total === 1 ? "" : "s"}`;

  const resolved = accepted + deferred;
  if (total === 0) {
    summaryFallbackValue.textContent = "Clear";
    summaryFallbackCaption.textContent = "No alerts in the review queue";
  } else if (resolved === total) {
    summaryFallbackValue.textContent = "All resolved";
    summaryFallbackCaption.textContent = `${accepted} accepted, ${deferred} deferred`;
  } else {
    summaryFallbackValue.textContent = `${resolved} of ${total}`;
    summaryFallbackCaption.textContent = `${pending} pending review${accepted > 0 ? `, ${accepted} accepted` : ""}${deferred > 0 ? `, ${deferred} deferred` : ""}`;
  }
}

const positionStatusLabel = {
  active: "Active",
  watch: "Watch",
  staged: "Staged",
};

function renderPositions() {
  if (!positionsTableBody) return;

  var filtered = filteredPositions();
  var isEmpty = filtered.length === 0;

  if (positionsFilterEmpty) positionsFilterEmpty.classList.toggle("is-visible", isEmpty);
  var posLane = positionsTableBody.closest(".position-lane");
  if (posLane) posLane.classList.toggle("is-hidden", isEmpty);
  var posRail = positionsTableBody.closest(".positions-workbench")?.querySelector(".detail-rail");
  if (posRail) posRail.classList.toggle("is-hidden", isEmpty);

  if (selectedPositionId && !filtered.some((p) => p.id === selectedPositionId)) {
    selectedPositionId = null;
    persistState();
  }

  positionsTableBody.innerHTML = filtered.map((pos) => {
    const statusText = positionStatusLabel[pos.status] || pos.status;
    return `
      <tr
        data-position-id="${pos.id}"
        class="position-row${pos.id === selectedPositionId ? " is-selected" : ""}"
        tabindex="0"
        role="button"
        aria-pressed="${pos.id === selectedPositionId ? "true" : "false"}"
        aria-label="Open ${pos.name} position detail"
      >
        <td>
          <strong>${pos.name}</strong>
          <span class="position-id">${pos.id}</span>
        </td>
        <td>${pos.exposure}</td>
        <td><span class="pnl-value ${parseFloat(pos.pnl) > 0 ? "pnl-positive" : parseFloat(pos.pnl) < 0 ? "pnl-negative" : "pnl-flat"}">${pos.pnl}</span></td>
        <td class="numeric">${pos.instruments}</td>
        <td><span class="position-status-badge position-status-${pos.status}">${statusText}</span></td>
      </tr>
    `;
  }).join("");

  updatePositionsPill();
  updatePositionsNavCount();
  renderPositionDetail();
}

function renderPositionDetail() {
  if (!positionDetail) return;

  const selected = positions.find((p) => p.id === selectedPositionId);

  if (!selected) {
    positionDetail.innerHTML = `
      <div class="detail-placeholder">
        <p class="panel-label">Book detail</p>
        <strong>Select a book to inspect its holdings and venue allocation.</strong>
        <p>Each position book carries top holdings, venue distribution, operator rationale, and a risk note.</p>
      </div>
    `;
    return;
  }

  const statusText = positionStatusLabel[selected.status] || selected.status;

  const holdingsMarkup = selected.topHoldings
    .map((h) => `<li><span><strong>${h.name}</strong><span class="holding-venue venue-link" data-venue-link="${h.venue}" role="button" tabindex="0" aria-label="Open ${h.venue} in venues panel">${h.venue}</span></span><strong>${h.weight}</strong></li>`)
    .join("");

  const allocationMarkup = selected.venueAllocation
    .map((v) => `<li><span><span class="venue-link" data-venue-link="${v.name}" role="button" tabindex="0" aria-label="Open ${v.name} in venues panel">${v.name}</span></span><strong>${v.share}</strong></li>`)
    .join("");

  const pnlClass = parseFloat(selected.pnl) > 0 ? "pnl-positive" : parseFloat(selected.pnl) < 0 ? "pnl-negative" : "pnl-flat";

  positionDetail.innerHTML = renderDetailCard({
    label: selected.id,
    title: selected.name,
    badge: statusText,
    badgeClass: 'position-status-badge position-status-' + selected.status,
    meta: [
      { dt: 'Exposure', dd: selected.exposure },
      { dt: 'P&L', dd: '<span class="pnl-value ' + pnlClass + '">' + selected.pnl + '</span>' },
      { dt: 'Instruments', dd: String(selected.instruments) },
    ],
    sections: [
      { label: 'Top holdings', html: '<ul class="detail-venue-list">' + holdingsMarkup + '</ul>' },
      { label: 'Venue allocation', html: '<ul class="detail-venue-list">' + allocationMarkup + '</ul>' },
      { label: 'Operator rationale', html: '<p class="narrative-copy">' + selected.rationale + '</p>' },
      { label: 'Risk note', html: '<p class="narrative-copy">' + selected.riskNote + '</p>' },
    ],
  });
}

function selectPosition(positionId) {
  const exists = positions.some((p) => p.id === positionId);
  if (!exists) return;

  selectedPositionId = selectedPositionId === positionId ? null : positionId;

  positionsTableBody?.querySelectorAll("tr.position-row").forEach((row) => {
    const isSelected = row.getAttribute("data-position-id") === selectedPositionId;
    row.classList.toggle("is-selected", isSelected);
    row.setAttribute("aria-pressed", isSelected ? "true" : "false");
  });

  persistState();
  renderPositionDetail();
  if (selectedPositionId) {
    const p = positions.find((p) => p.id === selectedPositionId);
    if (p) logActivity("Select position", p.name);
  }
  renderBreadcrumb();
}

function updatePositionsPill() {
  if (!positionsActivePill) return;
  const activeCount = positions.filter((p) => p.status === "active").length;
  positionsActivePill.textContent = `${activeCount} active · ${positions.length} books`;
}

function updatePositionsNavCount() {
  if (!navCountEls.positions) return;
  const activeCount = positions.filter((p) => p.status === "active").length;
  navCountEls.positions.textContent = `${activeCount} active`;
}

function updatePositionsSummary() {
  if (!summaryFillValue) return;

  if (summaryFillLabel) summaryFillLabel.textContent = "Net exposure";
  if (summaryRiskLabel) summaryRiskLabel.textContent = "Book status";
  if (summaryFallbackLabel) summaryFallbackLabel.textContent = "Instrument count";

  const totalExposure = positions.reduce((sum, p) => {
    const val = parseFloat(p.exposure.replace(/[$,M]/g, ""));
    return sum + (Number.isFinite(val) ? val : 0);
  }, 0);
  summaryFillValue.textContent = `$${totalExposure.toFixed(1)}M`;
  summaryFillCaption.textContent = `Across ${positions.length} book${positions.length === 1 ? "" : "s"}`;

  const activeCount = positions.filter((p) => p.status === "active").length;
  const watchCount = positions.filter((p) => p.status === "watch").length;
  const stagedCount = positions.filter((p) => p.status === "staged").length;

  let statusLabel;
  if (watchCount > 0) statusLabel = `${watchCount} watch`;
  else statusLabel = `${activeCount} active`;
  summaryRiskValue.textContent = statusLabel;
  summaryRiskCaption.textContent = `${activeCount} active / ${watchCount} watch / ${stagedCount} staged`;

  const totalInstruments = positions.reduce((sum, p) => sum + p.instruments, 0);
  summaryFallbackValue.textContent = `${totalInstruments}`;
  summaryFallbackCaption.textContent = `${totalInstruments} instrument${totalInstruments === 1 ? "" : "s"} across ${positions.length} book${positions.length === 1 ? "" : "s"}`;
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

function applySearch() {
  const query = workspaceSearch ? workspaceSearch.value.trim().toLowerCase() : "";
  const panelEl = document.getElementById(`panel-${activePanel}`);
  if (!panelEl) return;
  const rows = panelEl.querySelectorAll("tbody tr");
  rows.forEach((row) => {
    if (!query) {
      row.classList.remove("search-hidden");
      return;
    }
    const text = row.textContent.toLowerCase();
    row.classList.toggle("search-hidden", !text.includes(query));
  });
}

function clearSearch() {
  if (workspaceSearch) {
    workspaceSearch.value = "";
  }
}

function setActivePanel(panel, skipLog) {
  activePanel = panel;
  clearSearch();
  activeFilter = "all";
  renderFilterChips(panel);
  panelTitle.textContent = panelTitles[panel] || "Workspace";

  navButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.panel === panel);
  });

  panelBodies.forEach((panelBody) => {
    panelBody.classList.toggle("is-visible", panelBody.id === `panel-${panel}`);
  });

  persistState();
  updateLaneSummary(filteredOrders());
  if (!skipLog) logActivity("Panel switch", panelTitles[panel] || panel);
  renderBreadcrumb();
}

function setActiveFilter(filter) {
  activeFilter = filter;

  if (filterGroup) {
    filterGroup.querySelectorAll(".filter-chip").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.dataset.filter === filter);
    });
  }

  persistState();
  logActivity("Filter change", panelTitles[activePanel] + " filtered to: " + filter);

  if (activePanel === "orders") {
    if (activeState === "loading") {
      updateOrdersPill();
      return;
    }
    var filtered = filteredOrders();
    if (filtered.length === 0) {
      setOrderState("empty");
    } else {
      setOrderState("ready");
    }
  } else if (activePanel === "venues") {
    renderVenueLane();
    renderVenueDetail();
    updateVenuesPill();
  } else if (activePanel === "positions") {
    renderPositions();
  } else if (activePanel === "risk") {
    renderRiskAlerts();
  }

  updateLaneSummary(filteredOrders());
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
  button.addEventListener("click", () => {
    setActivePanel(button.dataset.panel);
    closeSidebar();
  });
});

// Filter chip listeners are now attached dynamically in renderFilterChips

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

venuesTableBody?.addEventListener("click", (event) => {
  const row = event.target.closest("tr.venue-row");
  if (!row) return;
  const id = row.getAttribute("data-venue-id");
  if (id) selectVenue(id);
});

venuesTableBody?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const row = event.target.closest("tr.venue-row");
  if (!row) return;
  event.preventDefault();
  const id = row.getAttribute("data-venue-id");
  if (id) selectVenue(id);
});

venueDetail?.addEventListener("click", (event) => {
  if (event.target.closest(".detail-close")) { selectVenue(selectedVenueId); return; }
  const target = event.target.closest("[data-routed-order-id]");
  if (!target) return;
  const id = target.getAttribute("data-routed-order-id");
  if (id) jumpToOrder(id);
});

venueDetail?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const target = event.target.closest("[data-routed-order-id]");
  if (!target) return;
  event.preventDefault();
  const id = target.getAttribute("data-routed-order-id");
  if (id) jumpToOrder(id);
});

riskTableBody?.addEventListener("click", (event) => {
  const row = event.target.closest("tr.risk-row");
  if (!row) return;
  const id = row.getAttribute("data-risk-id");
  if (id) selectRisk(id);
});

riskTableBody?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const row = event.target.closest("tr.risk-row");
  if (!row) return;
  event.preventDefault();
  const id = row.getAttribute("data-risk-id");
  if (id) selectRisk(id);
});

positionsTableBody?.addEventListener("click", (event) => {
  const row = event.target.closest("tr.position-row");
  if (!row) return;
  const id = row.getAttribute("data-position-id");
  if (id) selectPosition(id);
});

positionsTableBody?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const row = event.target.closest("tr.position-row");
  if (!row) return;
  event.preventDefault();
  const id = row.getAttribute("data-position-id");
  if (id) selectPosition(id);
});

riskDetail?.addEventListener("click", (event) => {
  if (event.target.closest(".detail-close")) { selectRisk(selectedRiskId); return; }
  const actionBtn = event.target.closest("[data-risk-action]");
  if (!actionBtn) return;
  const action = actionBtn.getAttribute("data-risk-action");
  const targetId = actionBtn.getAttribute("data-risk-target");
  if (action && targetId) resolveRisk(targetId, action === "accept" ? "accepted" : "deferred");
});

function handleVenueLinkClick(event) {
  const link = event.target.closest("[data-venue-link]");
  if (!link) return;
  const venueName = link.getAttribute("data-venue-link");
  if (venueName) jumpToVenue(venueName);
}

function handleVenueLinkKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") return;
  const link = event.target.closest("[data-venue-link]");
  if (!link) return;
  event.preventDefault();
  const venueName = link.getAttribute("data-venue-link");
  if (venueName) jumpToVenue(venueName);
}

orderDetail?.addEventListener("click", (event) => {
  if (event.target.closest(".detail-close")) { selectOrder(selectedOrderId); return; }
  handleVenueLinkClick(event);
});
orderDetail?.addEventListener("keydown", handleVenueLinkKeydown);
positionDetail?.addEventListener("click", (event) => {
  if (event.target.closest(".detail-close")) { selectPosition(selectedPositionId); return; }
  handleVenueLinkClick(event);
});
positionDetail?.addEventListener("keydown", handleVenueLinkKeydown);

dashboardButtons.forEach((button) => {
  button.addEventListener("click", () => {
    document.getElementById("workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

const fallbackPolicyLabels = {
  graceful: "Graceful degrade",
  aggressive: "Aggressive reroute",
  hold: "Hold and wait",
};

const densityLabels = {
  comfortable: "Comfortable",
  compact: "Compact",
};

let eventFeedInterval = null;

function loadSettings() {
  if (persisted.modeBias && settingModeBias) settingModeBias.value = persisted.modeBias;
  if (persisted.alertCadence && settingAlertCadence) settingAlertCadence.value = persisted.alertCadence;
  if (persisted.fallbackPolicy && settingFallbackPolicy) settingFallbackPolicy.value = persisted.fallbackPolicy;
  if (persisted.density && settingDensity) settingDensity.value = persisted.density;

  applySettings();
}

function applySettings() {
  const modeBias = settingModeBias ? settingModeBias.value : "Balanced Sweep";
  const cadence = settingAlertCadence ? parseInt(settingAlertCadence.value, 10) : 9000;
  const fallbackPolicy = settingFallbackPolicy ? settingFallbackPolicy.value : "graceful";
  const density = settingDensity ? settingDensity.value : "comfortable";

  if (readoutModeBias) readoutModeBias.textContent = modeBias;
  if (readoutAlertCadence) {
    const seconds = cadence / 1000;
    readoutAlertCadence.textContent = `Every ${seconds} second${seconds === 1 ? "" : "s"}`;
  }
  if (readoutFallbackPolicy) readoutFallbackPolicy.textContent = fallbackPolicyLabels[fallbackPolicy] || fallbackPolicy;
  if (readoutDensity) readoutDensity.textContent = densityLabels[density] || density;

  const defaultMode = modes.find((m) => m.mode === modeBias);
  if (defaultMode) {
    modeIndex = modes.indexOf(defaultMode);
    updateMode();
  }

  if (eventFeedInterval) clearInterval(eventFeedInterval);
  eventFeedInterval = setInterval(pushEvent, cadence);

  if (workspaceShell) {
    workspaceShell.classList.toggle("density-compact", density === "compact");
  }
}

function flashSavedPill() {
  if (!settingsSavedPill) return;
  settingsSavedPill.classList.add("flash");
  setTimeout(() => settingsSavedPill.classList.remove("flash"), 1200);
}

function onSettingChange() {
  const modeBias = settingModeBias ? settingModeBias.value : "Balanced Sweep";
  const cadence = settingAlertCadence ? settingAlertCadence.value : "9000";
  const fallbackPolicy = settingFallbackPolicy ? settingFallbackPolicy.value : "graceful";
  const density = settingDensity ? settingDensity.value : "comfortable";

  try {
    if (typeof localStorage !== "undefined") {
      const current = readPersistedState();
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...current,
        modeBias,
        alertCadence: cadence,
        fallbackPolicy,
        density,
      }));
    }
  } catch (_err) {
    // best-effort
  }

  applySettings();
  flashSavedPill();
  logActivity("Settings changed", "Preferences updated");
}

const clearActivityLogBtn = document.getElementById("clearActivityLog");
clearActivityLogBtn?.addEventListener("click", clearActivityLog);

const sidebarToggle = document.getElementById("sidebarToggle");
const sidebarBackdrop = document.getElementById("sidebarBackdrop");
const workspaceSidebar = document.querySelector(".workspace-sidebar");

function openSidebar() {
  if (!workspaceSidebar || !sidebarToggle) return;
  workspaceSidebar.classList.add("sidebar-open");
  sidebarToggle.setAttribute("aria-expanded", "true");
  if (sidebarBackdrop) sidebarBackdrop.classList.add("is-visible");
  logActivity("Sidebar opened", "Responsive sidebar toggled open");
}

function closeSidebar() {
  if (!workspaceSidebar || !sidebarToggle) return;
  workspaceSidebar.classList.remove("sidebar-open");
  sidebarToggle.setAttribute("aria-expanded", "false");
  if (sidebarBackdrop) sidebarBackdrop.classList.remove("is-visible");
}

function toggleSidebar() {
  const isOpen = workspaceSidebar?.classList.contains("sidebar-open");
  if (isOpen) {
    closeSidebar();
  } else {
    openSidebar();
  }
}

sidebarToggle?.addEventListener("click", toggleSidebar);
sidebarBackdrop?.addEventListener("click", closeSidebar);

const topbarToggle = document.getElementById("topbarToggle");
const topbar = document.querySelector(".topbar");

function toggleTopbar() {
  if (!topbar || !topbarToggle) return;
  const isOpen = topbar.classList.toggle("topbar-open");
  topbarToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
}

function closeTopbar() {
  if (!topbar || !topbarToggle) return;
  topbar.classList.remove("topbar-open");
  topbarToggle.setAttribute("aria-expanded", "false");
}

topbarToggle?.addEventListener("click", toggleTopbar);

topbar?.querySelectorAll(".topnav a").forEach((link) => {
  link.addEventListener("click", closeTopbar);
});

const searchToggle = document.getElementById("searchToggle");

searchToggle?.addEventListener("click", () => {
  if (!workspaceSearch) return;
  const expanded = workspaceSearch.classList.toggle("search-expanded");
  searchToggle.classList.toggle("is-active", expanded);
  if (expanded) {
    workspaceSearch.focus();
  } else {
    workspaceSearch.value = "";
    applySearch();
  }
});

workspaceSearch?.addEventListener("input", applySearch);

if (settingModeBias) settingModeBias.addEventListener("change", onSettingChange);
if (settingAlertCadence) settingAlertCadence.addEventListener("change", onSettingChange);
if (settingFallbackPolicy) settingFallbackPolicy.addEventListener("change", onSettingChange);
if (settingDensity) settingDensity.addEventListener("change", onSettingChange);

// Initial filter chips rendered via renderFilterChips in setActivePanel

renderVenues();
renderRiskAlerts();
renderPositions();
renderActivityLog();
updateNavCounts();
updateWorkspaceLivePill();
updateMode();
setActivePanel(activePanel, true);
setOrderState("loading");
renderOrders();
renderOrderDetail();

loadSettings();

const sortState = {
  orders: { key: null, dir: "asc" },
  positions: { key: null, dir: "asc" },
  venues: { key: null, dir: "asc" },
  risk: { key: null, dir: "asc" },
};

const severityRank = { high: 3, moderate: 2, low: 1 };

function parseNumeric(val) {
  if (typeof val === "number") return val;
  var str = String(val).replace(/[$,MK%]/g, "");
  var num = parseFloat(str);
  return Number.isFinite(num) ? num : 0;
}

function getSortValue(item, key, panel) {
  if (panel === "orders") {
    if (key === "exposure") return parseNumeric(item.exposure);
    return item[key] || "";
  }
  if (panel === "venues") {
    if (key === "queueDepth") return item.load.queueDepth;
    if (key === "fillQuality") return item.load.fillQuality;
    if (key === "routed") return routedOrdersFor(item.name).length;
    if (key === "readiness") return item.fallback.readiness;
    if (key === "name") return item.name;
    if (key === "state") return item.state;
    return "";
  }
  if (panel === "positions") {
    if (key === "exposure") return parseNumeric(item.exposure);
    if (key === "pnl") return parseNumeric(item.pnl);
    if (key === "instruments") return item.instruments;
    if (key === "name") return item.name;
    return item[key] || "";
  }
  if (panel === "risk") {
    if (key === "severity") return severityRank[item.severity] || 0;
    return item[key] || "";
  }
  return "";
}

function sortData(arr, panel, key, dir) {
  arr.sort(function (a, b) {
    var va = getSortValue(a, key, panel);
    var vb = getSortValue(b, key, panel);
    if (typeof va === "string") va = va.toLowerCase();
    if (typeof vb === "string") vb = vb.toLowerCase();
    var cmp = va < vb ? -1 : va > vb ? 1 : 0;
    return dir === "desc" ? -cmp : cmp;
  });
}

function handleSort(panel, key) {
  var state = sortState[panel];
  if (state.key === key) {
    state.dir = state.dir === "asc" ? "desc" : "asc";
  } else {
    state.key = key;
    state.dir = "asc";
  }

  if (panel === "orders") {
    sortData(orders, panel, key, state.dir);
    renderOrders();
  } else if (panel === "venues") {
    sortData(venues, panel, key, state.dir);
    renderVenueLane();
    renderVenueDetail();
    updateVenuesPill();
  } else if (panel === "positions") {
    sortData(positions, panel, key, state.dir);
    renderPositions();
  } else if (panel === "risk") {
    sortData(riskAlerts, panel, key, state.dir);
    renderRiskAlerts();
  }

  updateSortIndicators(panel);
  logActivity("Sort", panelTitles[panel] + " by " + key + " " + state.dir);
}

function updateSortIndicators(panel) {
  var panelEl = document.getElementById("panel-" + panel);
  if (!panelEl) return;
  var state = sortState[panel];
  panelEl.querySelectorAll("th.sortable").forEach(function (th) {
    th.classList.remove("sort-asc", "sort-desc");
    if (th.dataset.sortKey === state.key) {
      th.classList.add(state.dir === "asc" ? "sort-asc" : "sort-desc");
    }
  });
}

panelBodies.forEach(function (panel) {
  panel.addEventListener("click", function (event) {
    var th = event.target.closest("th.sortable");
    if (!th) return;
    var key = th.dataset.sortKey;
    var panelId = panel.id.replace("panel-", "");
    if (key && sortState[panelId]) handleSort(panelId, key);
  });
});

const keyPanelMap = { "1": "orders", "2": "positions", "3": "venues", "4": "risk", "5": "settings", "6": "activity" };

document.addEventListener("keydown", (event) => {
  const tag = document.activeElement?.tagName;
  if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
  const panel = keyPanelMap[event.key];
  if (!panel) return;
  event.preventDefault();
  setActivePanel(panel);
  if (activeState === "loading" && panel === "orders") {
    // don't force state change on orders during initial load
  }
});

setTimeout(() => {
  setOrderState("ready");
}, 1200);