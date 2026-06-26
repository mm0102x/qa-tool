function isoWeekKey() {
  const now = new Date();
  const jan4 = new Date(now.getFullYear(), 0, 4);
  const week = Math.ceil(((now - jan4) / 86400000 + jan4.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

const QUEUE_KEY = () => `qa_queue_${isoWeekKey()}`;
const REVIEWED_KEY = () => `qa_reviewed_${isoWeekKey()}`;

// --- Reviewed tracking ---

export function getReviewedIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(REVIEWED_KEY()) || "[]"));
  } catch {
    return new Set();
  }
}

export function markReviewed(ticketId) {
  const ids = getReviewedIds();
  ids.add(ticketId);
  localStorage.setItem(REVIEWED_KEY(), JSON.stringify([...ids]));
}

// --- Queue persistence ---

function loadCachedQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY());
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Invalidate cache if it looks empty or malformed
    if (typeof parsed !== "object" || Array.isArray(parsed)) return null;
    if (Object.keys(parsed).length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveQueue(queue) {
  localStorage.setItem(QUEUE_KEY(), JSON.stringify(queue));
}

// --- Sampling ---

const EXCLUDED_TAGS = [
  "ota_deactivation", "activations", "ota_activation", "deactivations",
  "billing_questions",
  "feature_requests",
  "other__e.g._feedback_",
];

const hasExcludedTag = (t) => t.tags?.some((tag) => EXCLUDED_TAGS.includes(tag));

// Groups tickets by assignee_id, runs sampling per agent, returns:
// { [agentId]: [{ ...ticket, _reason: "Random"|"Low CSAT"|"High CSAT"|"High Replies" }] }
export function buildQueue(tickets) {
  // Group by agent
  const byAgent = {};
  for (const t of tickets) {
    const id = t.assignee_id;
    if (!id) continue;
    if (!byAgent[id]) byAgent[id] = [];
    byAgent[id].push(t);
  }

  const queue = {};

  for (const [agentId, pool] of Object.entries(byAgent)) {
    const selected = [];
    const used = new Set();

    // Filtered pool — excluded tags removed (does NOT apply to CSAT slot)
    const cleanPool = pool.filter((t) => !hasExcludedTag(t));

    // 1. Random — from clean pool only
    if (cleanPool.length > 0) {
      const t = cleanPool[Math.floor(Math.random() * cleanPool.length)];
      selected.push({ ...t, _reason: "Random" });
      used.add(t.id);
    }

    // 2. Notable CSAT — full pool, excluded tags allowed so low CSAT always surfaces
    const badCsat = pool.filter((t) => !used.has(t.id) && t.satisfaction_rating?.score === "bad");
    const goodCsat = pool.filter((t) => !used.has(t.id) && t.satisfaction_rating?.score === "good");
    const csatPick = badCsat[0] || goodCsat[0] || null;
    if (csatPick) {
      const reason = csatPick.satisfaction_rating?.score === "bad" ? "Low CSAT" : "High CSAT";
      selected.push({ ...csatPick, _reason: reason });
      used.add(csatPick.id);
    }

    // 3. Highest reply count — clean pool only
    const byReplies = cleanPool
      .filter((t) => !used.has(t.id))
      .sort((a, b) => (b._replies || 0) - (a._replies || 0));
    if (byReplies.length > 0) {
      selected.push({ ...byReplies[0], _reason: "High Replies" });
    }

    queue[agentId] = selected;
  }

  return queue;
}

// Returns the queue for the current week — cached in localStorage.
// Pass forceRebuild=true to discard cache and resample.
export function getOrBuildQueue(tickets, forceRebuild = false) {
  if (!forceRebuild) {
    const cached = loadCachedQueue();
    if (cached) return cached;
  }
  const queue = buildQueue(tickets);
  saveQueue(queue);
  return queue;
}
