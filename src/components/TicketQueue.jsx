const REASON_STYLES = {
  "Random":      { bg: "#ede9fe", color: "#6d28d9" },
  "Low CSAT":    { bg: "#fee2e2", color: "#b91c1c" },
  "High CSAT":   { bg: "#dcfce7", color: "#15803d" },
  "High Replies":{ bg: "#fef3c7", color: "#92400e" },
};

export default function TicketQueue({
  queue, agentMap, l1Agents, reviewedIds,
  loading, error,
  startDate, endDate, agentFilter,
  onStartDate, onEndDate, onAgentFilter, onApply,
  onSelect, selected,
}) {
  // Build the flat list of agent groups to display
  const agentGroups = Object.entries(queue)
    .map(([agentId, tickets]) => {
      const id = Number(agentId);
      if (agentFilter && id !== Number(agentFilter)) return null;
      const agent = agentMap[id] || { name: `Agent #${id}`, email: "" };
      const pending = tickets.filter((t) => !reviewedIds.has(t.id));
      const doneCount = tickets.length - pending.length;
      return { id, agent, tickets, pending, doneCount };
    })
    .filter(Boolean)
    .sort((a, b) => a.agent.name.localeCompare(b.agent.name));

  const totalPending = agentGroups.reduce((n, g) => n + g.pending.length, 0);

  return (
    <aside style={s.sidebar}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.logo}>
          <span style={s.logoDot} />
          QA Review
        </div>
        <span style={s.badge}>{totalPending} pending</span>
      </div>

      {/* Filters */}
      <div style={s.filters}>
        <div style={s.filterRow}>
          <label style={s.label}>From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => onStartDate(e.target.value)}
            style={s.dateInput}
          />
        </div>
        <div style={s.filterRow}>
          <label style={s.label}>To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onEndDate(e.target.value)}
            style={s.dateInput}
          />
        </div>
        <div style={s.filterRow}>
          <label style={s.label}>Agent</label>
          <select
            value={agentFilter}
            onChange={(e) => onAgentFilter(e.target.value)}
            style={s.select}
          >
            <option value="">All agents</option>
            {l1Agents.map((a) => (
              <option key={a.id} value={String(a.id)}>{a.name}</option>
            ))}
          </select>
        </div>
        <button onClick={onApply} disabled={loading} style={s.applyBtn}>
          {loading ? "Sampling…" : "Rebuild queue"}
        </button>
      </div>

      {/* List */}
      <div style={s.list}>
        {error && <div style={s.errorMsg}><strong>Error:</strong> {error}</div>}

        {!loading && agentGroups.length === 0 && (
          <div style={s.empty}>No tickets in queue this week</div>
        )}

        {agentGroups.map(({ id, agent, pending, doneCount }) => (
          <AgentGroup
            key={id}
            agent={agent}
            tickets={pending}
            doneCount={doneCount}
            reviewedIds={reviewedIds}
            selected={selected}
            onSelect={onSelect}
          />
        ))}
      </div>
    </aside>
  );
}

function AgentGroup({ agent, tickets, doneCount, selected, onSelect }) {
  const total = tickets.length + doneCount;

  return (
    <div style={s.group}>
      <div style={s.groupHeader}>
        <div>
          <span style={s.agentName}>{agent.name}</span>
          {agent.email && <span style={s.agentEmail}>{agent.email}</span>}
        </div>
        <div style={s.agentStats}>
          <span style={s.statPending}>{tickets.length} left</span>
          {doneCount > 0 && <span style={s.statDone}>{doneCount}/{total} done</span>}
        </div>
      </div>

      {tickets.length === 0 && (
        <div style={s.agentDone}>✓ All reviewed this week</div>
      )}

      {tickets.map((ticket) => (
        <TicketCard
          key={ticket.id}
          ticket={ticket}
          active={selected?.id === ticket.id}
          onClick={() => onSelect(ticket)}
        />
      ))}
    </div>
  );
}

function TicketCard({ ticket, active, onClick }) {
  const date = ticket.created_at
    ? new Date(ticket.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
    : "";
  const reason = ticket._reason;
  const rs = REASON_STYLES[reason] || {};

  return (
    <button onClick={onClick} style={{ ...s.card, ...(active ? s.cardActive : {}) }}>
      <div style={s.cardTop}>
        <span style={s.ticketId}>#{ticket.id}</span>
        <span style={s.cardDate}>{date}</span>
      </div>
      <div style={s.cardSubject}>{ticket.subject}</div>
      <div style={s.cardBottom}>
        {reason && (
          <span style={{ ...s.reasonBadge, background: rs.bg, color: rs.color }}>
            {reason}
          </span>
        )}
        {ticket.reply_count > 0 && (
          <span style={s.repliesTag}>{ticket.reply_count} replies</span>
        )}
      </div>
    </button>
  );
}

const s = {
  sidebar: {
    width: 300,
    minWidth: 300,
    background: "var(--sidebar-bg)",
    borderRight: "1px solid var(--sidebar-border)",
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "18px 16px 14px",
    borderBottom: "1px solid var(--sidebar-border)",
    flexShrink: 0,
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "var(--sidebar-text)",
    fontWeight: 600,
    fontSize: 15,
    letterSpacing: "-0.02em",
  },
  logoDot: {
    width: 8, height: 8,
    borderRadius: "50%",
    background: "var(--accent)",
    display: "inline-block",
  },
  badge: {
    background: "var(--accent-dim)",
    color: "var(--accent-hover)",
    borderRadius: 20,
    padding: "2px 8px",
    fontSize: 12,
    fontWeight: 600,
  },
  filters: {
    padding: "12px 16px",
    borderBottom: "1px solid var(--sidebar-border)",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    flexShrink: 0,
  },
  filterRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  label: {
    color: "var(--sidebar-muted)",
    fontSize: 11,
    fontWeight: 500,
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    width: 34,
    flexShrink: 0,
  },
  dateInput: {
    flex: 1,
    background: "var(--card-bg)",
    border: "1px solid var(--sidebar-border)",
    borderRadius: 6,
    color: "var(--sidebar-text)",
    padding: "6px 8px",
    fontSize: 12,
    outline: "none",
    colorScheme: "dark",
    width: "100%",
  },
  select: {
    flex: 1,
    background: "var(--card-bg)",
    border: "1px solid var(--sidebar-border)",
    borderRadius: 6,
    color: "var(--sidebar-text)",
    padding: "6px 8px",
    fontSize: 12,
    outline: "none",
    colorScheme: "dark",
    width: "100%",
    cursor: "pointer",
  },
  applyBtn: {
    background: "var(--accent)",
    color: "white",
    border: "none",
    borderRadius: 7,
    padding: "8px 0",
    fontSize: 13,
    fontWeight: 600,
    marginTop: 2,
    cursor: "pointer",
  },
  list: {
    flex: 1,
    overflowY: "auto",
    minHeight: 0,
  },
  group: {
    borderBottom: "2px solid var(--sidebar-border)",
  },
  groupHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: "10px 16px 8px",
    background: "rgba(255,255,255,0.03)",
    gap: 8,
  },
  agentName: {
    display: "block",
    color: "var(--sidebar-text)",
    fontSize: 13,
    fontWeight: 600,
  },
  agentEmail: {
    display: "block",
    color: "var(--sidebar-muted)",
    fontSize: 11,
    marginTop: 1,
  },
  agentStats: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 2,
    flexShrink: 0,
  },
  statPending: {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--accent-hover)",
  },
  statDone: {
    fontSize: 10,
    color: "var(--sidebar-muted)",
  },
  agentDone: {
    padding: "10px 16px",
    fontSize: 12,
    color: "#4ade80",
    fontStyle: "italic",
  },
  card: {
    display: "block",
    width: "100%",
    textAlign: "left",
    background: "transparent",
    border: "none",
    borderBottom: "1px solid var(--sidebar-border)",
    padding: "10px 16px",
    cursor: "pointer",
  },
  cardActive: {
    background: "var(--card-active)",
    borderLeft: "3px solid var(--accent)",
    paddingLeft: 13,
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  ticketId: {
    color: "var(--accent-hover)",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.04em",
  },
  cardDate: {
    color: "var(--sidebar-muted)",
    fontSize: 11,
  },
  cardSubject: {
    color: "var(--sidebar-text)",
    fontSize: 12,
    fontWeight: 500,
    lineHeight: 1.4,
    marginBottom: 6,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
  cardBottom: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  reasonBadge: {
    fontSize: 10,
    fontWeight: 700,
    padding: "2px 6px",
    borderRadius: 4,
    letterSpacing: "0.03em",
  },
  repliesTag: {
    fontSize: 10,
    color: "var(--sidebar-muted)",
  },
  errorMsg: {
    margin: 12,
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: 8,
    padding: "10px 12px",
    color: "#fca5a5",
    fontSize: 12,
  },
  empty: {
    padding: "32px 16px",
    textAlign: "center",
    color: "var(--sidebar-muted)",
    fontSize: 13,
  },
};
