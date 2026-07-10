function isoWeekKey(dateStr) {
  const d = dateStr ? new Date(dateStr + "T12:00:00") : new Date();
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const week = Math.ceil(((d - jan4) / 86400000 + jan4.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function currentIsoWeekKey() {
  return isoWeekKey(null);
}

const QUEUE_KEY = (startDate, endDate) =>
  `qa_queue_${startDate}_${endDate}`;
const REVIEWED_KEY = () => `qa_reviewed_${currentIsoWeekKey()}`;

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

function loadCachedQueue(startDate, endDate) {
  try {
    // Clear stale queue keys from other date ranges to free up space
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("qa_queue_") && key !== QUEUE_KEY(startDate, endDate)) {
        localStorage.removeItem(key);
      }
    }
    const raw = localStorage.getItem(QUEUE_KEY(startDate, endDate));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || Array.isArray(parsed)) return null;
    if (Object.keys(parsed).length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

const TICKET_FIELDS = [
  "id", "subject", "assignee_id", "requester_id", "status",
  "created_at", "tags", "satisfaction_rating", "via",
  "_reason", "_replies",
];

function slimTicket(t) {
  const slim = {};
  for (const k of TICKET_FIELDS) if (t[k] !== undefined) slim[k] = t[k];
  return slim;
}

function saveQueue(queue, startDate, endDate) {
  const slim = {};
  for (const [agentId, tickets] of Object.entries(queue)) {
    slim[agentId] = tickets.map(slimTicket);
  }
  try {
    localStorage.setItem(QUEUE_KEY(startDate, endDate), JSON.stringify(slim));
  } catch (e) {
    console.warn("localStorage quota exceeded — queue not cached:", e);
  }
}

// --- Sampling ---

const EXCLUDED_TAGS = [
  "ota_deactivation", "activations", "ota_activation", "deactivations",
  "billing_questions",
  "feature_requests",
  "other__e.g._feedback_",
  "closed_by_merge",
  "aircall",
];

const hasExcludedTag = (t) => t.tags?.some((tag) => EXCLUDED_TAGS.includes(tag));

// Groups tickets by assignee_id then by ISO week, samples per week:
//   - ALL bad CSAT (full pool, tags never block)
//   - 1 High CSAT if no bad CSAT that week (full pool)
//   - 1 Random (clean pool, excluded tags removed)
//   - 1 High Replies (clean pool)
// Returns { [agentId]: [{ ...ticket, _reason }] }
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

  for (const [agentId, agentTickets] of Object.entries(byAgent)) {
    const selected = [];
    const usedIds = new Set();

    // Collect ALL bad CSAT across the whole date range first
    const allBadCsat = agentTickets.filter(
      (t) => t.satisfaction_rating?.score === "bad"
    );
    for (const t of allBadCsat) {
      selected.push({ ...t, _reason: "Low CSAT" });
      usedIds.add(t.id);
    }

    // Group remaining tickets by ISO week for per-week sampling
    const byWeek = {};
    for (const t of agentTickets) {
      if (usedIds.has(t.id)) continue;
      const wk = isoWeekKey(t.created_at?.slice(0, 10));
      if (!byWeek[wk]) byWeek[wk] = [];
      byWeek[wk].push(t);
    }

    for (const weekTickets of Object.values(byWeek)) {
      const weekUsed = new Set();
      const cleanPool = weekTickets.filter((t) => !hasExcludedTag(t));

      // 1 High CSAT per week (bad already taken above)
      const goodCsat = weekTickets.find(
        (t) => t.satisfaction_rating?.score === "good" && !weekUsed.has(t.id)
      );
      if (goodCsat) {
        selected.push({ ...goodCsat, _reason: "High CSAT" });
        weekUsed.add(goodCsat.id);
        usedIds.add(goodCsat.id);
      }

      // 1 Random from clean pool
      const randomPool = cleanPool.filter((t) => !weekUsed.has(t.id));
      if (randomPool.length > 0) {
        const pick = randomPool[Math.floor(Math.random() * randomPool.length)];
        selected.push({ ...pick, _reason: "Random" });
        weekUsed.add(pick.id);
        usedIds.add(pick.id);
      }

      // 1 Highest replies from clean pool
      const repliesPool = cleanPool
        .filter((t) => !weekUsed.has(t.id))
        .sort((a, b) => (b._replies || 0) - (a._replies || 0));
      if (repliesPool.length > 0) {
        selected.push({ ...repliesPool[0], _reason: "High Replies" });
        usedIds.add(repliesPool[0].id);
      }
    }

    queue[agentId] = selected;
  }

  return queue;
}

// Returns the queue for the given date range — cached in localStorage.
// Pass forceRebuild=true to discard cache and resample.
export function getOrBuildQueue(tickets, forceRebuild = false, startDate = "", endDate = "") {
  if (!forceRebuild) {
    const cached = loadCachedQueue(startDate, endDate);
    if (cached) return cached;
  }
  const queue = buildQueue(tickets);
  saveQueue(queue, startDate, endDate);
  return queue;
}
