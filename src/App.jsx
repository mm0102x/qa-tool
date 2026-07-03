import { useState, useEffect, useCallback, useRef } from "react";
import TicketQueue from "./components/TicketQueue";
import ReviewPanel from "./components/ReviewPanel";
import { fetchAgents, fetchL1GroupIds, fetchL1AgentIds, fetchL1Tickets } from "./services/zendesk";
import { getOrBuildQueue, getReviewedIds, markReviewed } from "./services/sampling";

const L1_GROUPS = ["smartpms l1", "smartpricing l1"];

const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
const today = new Date().toISOString().slice(0, 10);

export default function App() {
  const [selectedTicket, setSelectedTicket] = useState(null);

  const [agentMap, setAgentMap] = useState({});
  const [l1AgentIds, setL1AgentIds] = useState(null);
  const [l1GroupIds, setL1GroupIds] = useState(null);

  const [startDate, setStartDate] = useState(sevenDaysAgo);
  const [endDate, setEndDate] = useState(today);
  const [agentFilter, setAgentFilter] = useState("");

  const [queue, setQueue] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [reviewedIds, setReviewedIds] = useState(() => getReviewedIds());
  const didBust = useRef(false);

  // Load agents independently from group IDs — failures are isolated
  useEffect(() => {
    fetchAgents()
      .then((agents) => {
        const map = {};
        agents.forEach((a) => { map[a.id] = { name: a.name, email: a.email }; });
        setAgentMap(map);
      })
      .catch((e) => console.warn("fetchAgents failed:", e));
  }, []);

  useEffect(() => {
    Promise.all([
      fetchL1GroupIds(L1_GROUPS),
      fetchL1AgentIds(L1_GROUPS),
    ])
      .then(([gids, aids]) => {
        setL1GroupIds(gids);
        setL1AgentIds(aids);
      })
      .catch((e) => {
        console.warn("fetchL1 failed:", e);
        setL1GroupIds([]);
        setL1AgentIds(new Set());
      });
  }, []);

  const loadQueue = useCallback(async (forceRebuild = false) => {
    setLoading(true);
    setError(null);
    try {
      let gids = l1GroupIds;
      let aids = l1AgentIds;

      // If groups/agents haven't loaded yet (or failed), retry fetching them
      if (!gids?.length || !aids?.size) {
        [gids, aids] = await Promise.all([
          fetchL1GroupIds(L1_GROUPS),
          fetchL1AgentIds(L1_GROUPS),
        ]);
        setL1GroupIds(gids);
        setL1AgentIds(aids);
      }

      if (!gids?.length) throw new Error("No L1 groups found — check Zendesk connection");

      const tickets = await fetchL1Tickets(gids, startDate, endDate);
      const filtered = tickets.filter((t) => t.assignee_id && aids.has(t.assignee_id));
      const q = getOrBuildQueue(filtered, forceRebuild);
      setQueue(q);
    } catch (e) {
      console.error("loadQueue error:", e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [l1GroupIds, l1AgentIds, startDate, endDate]);

  useEffect(() => {
    if (l1GroupIds !== null && l1AgentIds !== null) {
      // Force rebuild once per session to clear any stale localStorage cache
      const forceRebuild = !didBust.current;
      didBust.current = true;
      loadQueue(forceRebuild);
    }
  }, [l1GroupIds, l1AgentIds]);

  const handleReviewed = (ticketId) => {
    markReviewed(ticketId);
    setReviewedIds(getReviewedIds());
    setSelectedTicket(null);
  };

  // All L1 agents, shown in dropdown as soon as group membership is loaded
  const l1Agents = Object.keys(agentMap)
    .map(Number)
    .filter((id) => l1AgentIds?.has(id))
    .map((id) => ({ id, ...agentMap[id] }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <TicketQueue
        queue={queue}
        agentMap={agentMap}
        l1Agents={l1Agents}
        reviewedIds={reviewedIds}
        loading={loading}
        error={error}
        startDate={startDate}
        endDate={endDate}
        agentFilter={agentFilter}
        onStartDate={setStartDate}
        onEndDate={setEndDate}
        onAgentFilter={setAgentFilter}
        onApply={() => loadQueue(true)}
        onSelect={setSelectedTicket}
        selected={selectedTicket}
      />
      <ReviewPanel
        ticket={selectedTicket}
        agentMap={agentMap}
        onReviewed={handleReviewed}
      />
    </>
  );
}
