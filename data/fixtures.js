/**
 * Prototype fixture module — source of truth for the static workspace demo.
 * Loaded as a classic script before app.js. Exposes one global:
 *     window.HydraxFixtures = { venues, orders, positions, riskAlerts }
 *
 * @typedef {Object} VenueLoad
 * @property {number} queueDepth
 * @property {"strong"|"fair"|"weak"} fillQuality
 * @property {string} posture
 *
 * @typedef {Object} VenueFallback
 * @property {string} target
 * @property {"armed"|"degraded"|"unavailable"} readiness
 *
 * @typedef {Object} Venue
 * @property {string} id
 * @property {string} name
 * @property {"live"|"warm"} state
 * @property {string} uptime
 * @property {"primary"|"secondary"} role
 * @property {VenueLoad} load
 * @property {VenueFallback} fallback
 * @property {string} rationale
 *
 * @typedef {Object} RiskAlert
 * @property {string} id
 * @property {string} type
 * @property {string} trigger
 * @property {"high"|"moderate"|"low"} severity
 * @property {"pending"|"accepted"|"deferred"} status
 * @property {string} venue
 * @property {string} timestamp
 * @property {string} rationale
 * @property {string} recommendation
 * @property {string} impact
 *
 * @typedef {Object} PositionHolding
 * @property {string} name
 * @property {string} weight
 * @property {string} venue
 *
 * @typedef {Object} PositionVenueShare
 * @property {string} name
 * @property {string} share
 *
 * @typedef {Object} Position
 * @property {string} id
 * @property {string} name
 * @property {string} pnl
 * @property {string} exposure
 * @property {"active"|"watch"|"staged"} status
 * @property {number} instruments
 * @property {PositionHolding[]} topHoldings
 * @property {PositionVenueShare[]} venueAllocation
 * @property {string} rationale
 * @property {string} riskNote
 *
 * @typedef {Object} OrderVenueMix
 * @property {string} name
 * @property {string} share
 *
 * @typedef {Object} Order
 * @property {string} id
 * @property {string} venue
 * @property {string} mode
 * @property {string} exposure
 * @property {"live"|"review"|"queued"} status
 * @property {"Buy"|"Sell"} side
 * @property {string} instrument
 * @property {string} fillQuality
 * @property {string} slippage
 * @property {string} rationale
 * @property {OrderVenueMix[]} venueMix
 * @property {string} fallback
 */

/** @type {Venue[]} */
const venues = [
  {
    id: "sg-nexus",
    name: "Singapore Nexus",
    state: "live",
    uptime: "99.2%",
    role: "primary",
    load: { queueDepth: 1842, fillQuality: "strong", posture: "Balanced sweep" },
    fallback: { target: "Tokyo Arc", readiness: "armed" },
    rationale: "Deepest Asia-session book today, lowest adverse selection pressure across the primary cluster.",
  },
  {
    id: "tk-arc",
    name: "Tokyo Arc",
    state: "live",
    uptime: "98.7%",
    role: "primary",
    load: { queueDepth: 1264, fillQuality: "fair", posture: "Latency shield" },
    fallback: { target: "Singapore Nexus", readiness: "armed" },
    rationale: "Holds JGB and Nikkei flow under tight latency envelope; paired with Singapore for symmetric failover.",
  },
  {
    id: "db-harbor",
    name: "Dubai Harbor",
    state: "live",
    uptime: "97.9%",
    role: "primary",
    load: { queueDepth: 978, fillQuality: "strong", posture: "Inventory protect" },
    fallback: { target: "Frankfurt Loop", readiness: "armed" },
    rationale: "GCC liquidity seam between Asia close and London open; clears inventory skew without spread widening.",
  },
  {
    id: "fr-loop",
    name: "Frankfurt Loop",
    state: "warm",
    uptime: "Warm",
    role: "secondary",
    load: { queueDepth: 412, fillQuality: "weak", posture: "Fallback mesh" },
    fallback: { target: "London Arc", readiness: "degraded" },
    rationale: "Recovering from the 10:42 latency spike; routes held off the book until round-trip normalizes.",
  },
  {
    id: "ln-arc",
    name: "London Arc",
    state: "live",
    uptime: "98.1%",
    role: "primary",
    load: { queueDepth: 1537, fillQuality: "fair", posture: "Balanced sweep" },
    fallback: { target: "Frankfurt Loop", readiness: "armed" },
    rationale: "European macro book anchor; carries the Frankfurt overflow while Frankfurt stabilizes.",
  },
  {
    id: "ny-relay",
    name: "New York Relay",
    state: "live",
    uptime: "99.4%",
    role: "primary",
    load: { queueDepth: 2104, fillQuality: "strong", posture: "Balanced sweep" },
    fallback: { target: "Zurich Chain", readiness: "armed" },
    rationale: "US session primary; strongest fill quality in the network during overlap with London close.",
  },
  {
    id: "sy-rim",
    name: "Sydney Rim",
    state: "warm",
    uptime: "Warm",
    role: "secondary",
    load: { queueDepth: 286, fillQuality: "fair", posture: "Passive ladder" },
    fallback: { target: "Singapore Nexus", readiness: "armed" },
    rationale: "Pre-open standby for APAC; warms the book before Tokyo takes primary weight.",
  },
  {
    id: "zu-chain",
    name: "Zurich Chain",
    state: "live",
    uptime: "98.8%",
    role: "secondary",
    load: { queueDepth: 624, fillQuality: "fair", posture: "Inventory protect" },
    fallback: { target: "Frankfurt Loop", readiness: "armed" },
    rationale: "Central European counterweight; absorbs Frankfurt degraded flow without routing through London.",
  },
  {
    id: "se-vertex",
    name: "Seoul Vertex",
    state: "live",
    uptime: "97.3%",
    role: "secondary",
    load: { queueDepth: 498, fillQuality: "fair", posture: "Latency shield" },
    fallback: { target: "Tokyo Arc", readiness: "unavailable" },
    rationale: "KRX-linked flow only; Tokyo fallback currently unavailable during the Nikkei session halt window.",
  },
];

/** @type {RiskAlert[]} */
const riskAlerts = [
  {
    id: "RA-001",
    type: "Threshold widening",
    trigger: "London open spread exceeded 2.1 bps",
    severity: "high",
    status: "pending",
    venue: "London Arc",
    timestamp: "08:32",
    rationale: "Operator widened the fill slippage ceiling from 1.8 bps to 2.4 bps during London open volatility. HydraX held the route but flagged for sign-off before re-arming passive mode.",
    recommendation: "Accept the widened threshold for the current session and auto-revert at London close.",
    impact: "Allows continued routing through London Arc without manual holds during peak liquidity.",
  },
  {
    id: "RA-002",
    type: "Passive window reopen",
    trigger: "Spread normalization on Singapore Nexus",
    severity: "moderate",
    status: "pending",
    venue: "Singapore Nexus",
    timestamp: "08:18",
    rationale: "HydraX detected spread normalization after Asia session volatility. Passive routing window can reopen, but operator confirmation is required per guardrail policy.",
    recommendation: "Reopen passive window with a 15-minute review horizon.",
    impact: "Restores full routing flexibility on Singapore Nexus for the remainder of the Asia session.",
  },
  {
    id: "RA-003",
    type: "Inventory skew",
    trigger: "Asia book skew crossed -0.6% threshold",
    severity: "low",
    status: "pending",
    venue: "Tokyo Arc",
    timestamp: "07:54",
    rationale: "Inventory skew in the Asia macro book crossed the -0.6% soft threshold. Currently narrowing, no hard limit breached.",
    recommendation: "Acknowledge and monitor. No action required unless skew widens past -1.2%.",
    impact: "Informational. Current trajectory is self-correcting.",
  },
  {
    id: "RA-004",
    type: "Adverse selection",
    trigger: "Fill quality dropped below 95% on Frankfurt",
    severity: "high",
    status: "pending",
    venue: "Frankfurt Loop",
    timestamp: "07:41",
    rationale: "Frankfurt Loop reported adverse selection pressure after the latency spike. Fill quality dropped to 93.2%. HydraX moved the venue to warm standby and rerouted to London Arc.",
    recommendation: "Defer re-enabling Frankfurt routing until round-trip stabilizes below 18ms for five minutes.",
    impact: "Prevents degraded fills during Frankfurt recovery. London Arc absorbs overflow.",
  },
];

/** @type {Position[]} */
const positions = [
  {
    id: "BK-ASIA",
    name: "Asia macro book",
    pnl: "+1.8%",
    exposure: "$18.4M",
    status: "active",
    instruments: 12,
    topHoldings: [
      { name: "SGX iShares MSCI", weight: "22%", venue: "Singapore Nexus" },
      { name: "Nikkei 225 basket", weight: "18%", venue: "Tokyo Arc" },
      { name: "GCC energy sleeve", weight: "14%", venue: "Dubai Harbor" },
    ],
    venueAllocation: [
      { name: "Singapore Nexus", share: "41%" },
      { name: "Tokyo Arc", share: "32%" },
      { name: "Dubai Harbor", share: "19%" },
      { name: "Seoul Vertex", share: "8%" },
    ],
    rationale: "Overweight Asia-Pacific flow during pre-London session. Inventory skew narrowing after the BoJ tape print; queue density improving on Singapore and Tokyo.",
    riskNote: "Soft threshold at -0.6% inventory skew crossed but self-correcting. No hard limit breached.",
  },
  {
    id: "BK-EUR",
    name: "Europe dispersion",
    pnl: "-0.4%",
    exposure: "$11.2M",
    status: "watch",
    instruments: 8,
    topHoldings: [
      { name: "DAX futures sleeve", weight: "28%", venue: "Frankfurt Loop" },
      { name: "Euro Stoxx vol surface", weight: "24%", venue: "London Arc" },
      { name: "CHF rates overlay", weight: "16%", venue: "Zurich Chain" },
    ],
    venueAllocation: [
      { name: "London Arc", share: "44%" },
      { name: "Frankfurt Loop", share: "30%" },
      { name: "Zurich Chain", share: "26%" },
    ],
    rationale: "Book tilted defensive after Frankfurt latency spike. London Arc absorbing overflow while Frankfurt recovers. Dispersion trades hedging against implied vol mean-reversion.",
    riskNote: "Frankfurt Loop in warm standby — DAX sleeve queued until round-trip normalizes below 18ms.",
  },
  {
    id: "BK-HEDGE",
    name: "Cross-venue hedge",
    pnl: "+0.9%",
    exposure: "$6.8M",
    status: "active",
    instruments: 5,
    topHoldings: [
      { name: "SGD rates curve", weight: "34%", venue: "Singapore Nexus" },
      { name: "JGB short sleeve", weight: "28%", venue: "Tokyo Arc" },
      { name: "FX delta neutral", weight: "22%", venue: "New York Relay" },
    ],
    venueAllocation: [
      { name: "Singapore Nexus", share: "38%" },
      { name: "Tokyo Arc", share: "30%" },
      { name: "New York Relay", share: "32%" },
    ],
    rationale: "Offsetting directional exposure across the Asia and US books. Rate curve positions sized to maintain delta neutrality during the session overlap.",
    riskNote: "Within tolerance band. Auto-rebalance armed if net delta drifts beyond 0.3%.",
  },
  {
    id: "BK-US",
    name: "US session book",
    pnl: "+2.1%",
    exposure: "$22.6M",
    status: "active",
    instruments: 9,
    topHoldings: [
      { name: "S&P 500 basket", weight: "30%", venue: "New York Relay" },
      { name: "Treasury curve", weight: "25%", venue: "New York Relay" },
      { name: "VIX sleeve", weight: "15%", venue: "New York Relay" },
    ],
    venueAllocation: [
      { name: "New York Relay", share: "72%" },
      { name: "Zurich Chain", share: "18%" },
      { name: "London Arc", share: "10%" },
    ],
    rationale: "Primary US session exposure. Strongest fill quality in the network during the London-New York overlap window. Treasury curve weighted for yield curve steepening.",
    riskNote: "Clean. No threshold breach. Passive mode fully armed.",
  },
  {
    id: "BK-APAC",
    name: "APAC pre-open staging",
    pnl: "Flat",
    exposure: "$3.2M",
    status: "staged",
    instruments: 3,
    topHoldings: [
      { name: "ASX 200 sleeve", weight: "45%", venue: "Sydney Rim" },
      { name: "KRX flow basket", weight: "35%", venue: "Seoul Vertex" },
      { name: "NZD overlay", weight: "20%", venue: "Sydney Rim" },
    ],
    venueAllocation: [
      { name: "Sydney Rim", share: "55%" },
      { name: "Seoul Vertex", share: "45%" },
    ],
    rationale: "Pre-open staging for the next APAC session. Orders held in passive ladder until Sydney and Seoul venues warm into primary weight.",
    riskNote: "No live exposure. Staged orders will activate when venue load thresholds are met.",
  },
];

/** @type {Order[]} */
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

if (typeof window !== "undefined") {
  window.HydraxFixtures = { venues, orders, positions, riskAlerts };
}
