import { useState, useEffect } from "react";
import { fetchComments } from "../services/zendesk";
import { saveReview } from "../services/sheets";

const CRITERIA = [
  { key: "resolution", label: "Correct Resolution", desc: "Issue fully resolved?" },
  { key: "tone", label: "Tone & Professionalism", desc: "Appropriate communication style?" },
  { key: "process", label: "Followed Process", desc: "Internal procedures followed?" },
  { key: "speed", label: "Response Time", desc: "Timely replies?" },
  { key: "clarity", label: "Clarity & Grammar", desc: "Clear, error-free writing?" },
];

const SCORE_LABELS = { 1: "Poor", 2: "OK", 3: "Good" };
const SCORE_COLORS = { 1: "#ef4444", 2: "#f59e0b", 3: "#22c55e" };

export default function ReviewPanel({ ticket, agentMap, onReviewed }) {
  const [comments, setComments] = useState([]);
  const [commentAuthors, setCommentAuthors] = useState({});
  const [channel, setChannel] = useState(null);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [scores, setScores] = useState({});
  const [reviewComment, setReviewComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);

  useEffect(() => {
    if (!ticket) return;
    setScores({});
    setReviewComment("");
    setSaveStatus(null);
    setComments([]);
    setCommentsLoading(true);
    fetchComments(ticket.id)
      .then(({ comments: c, users, channel: ch }) => {
        setComments(c);
        setChannel(ch);
        const map = {};
        users.forEach((u) => { map[u.id] = { name: u.name, email: u.email }; });
        setCommentAuthors(map);
      })
      .catch(() => setComments([]))
      .finally(() => setCommentsLoading(false));
  }, [ticket?.id]);

  if (!ticket) {
    return (
      <div style={s.emptyState}>
        <div style={s.emptyIcon}>↖</div>
        <p style={s.emptyText}>Select a ticket to start reviewing</p>
      </div>
    );
  }

  const agent = agentMap[ticket.assignee_id];
  const agentDisplay = agent ? `${agent.name} — ${agent.email}` : `Agent #${ticket.assignee_id}`;

  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const maxScore = CRITERIA.length * 3;
  const allScored = Object.keys(scores).length === CRITERIA.length;
  const pct = allScored ? Math.round((total / maxScore) * 100) : null;
  const pctColor = pct === null ? "var(--text-muted)" : pct >= 80 ? "#22c55e" : pct >= 60 ? "#f59e0b" : "#ef4444";

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus(null);
    try {
      const agent = agentMap[ticket.assignee_id];
      await saveReview({
        date: new Date().toLocaleDateString("it-IT"),
        ticketId: ticket.id,
        subject: ticket.subject,
        agentName: agent?.name || `#${ticket.assignee_id}`,
        agentEmail: agent?.email || "",
        resolution: scores.resolution,
        tone: scores.tone,
        process: scores.process,
        speed: scores.speed,
        clarity: scores.clarity,
        total: `${total}/${maxScore}`,
        notes: reviewComment,
      });
      setSaveStatus("saved");
      setTimeout(() => onReviewed?.(ticket.id), 1200);
    } catch {
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={s.panel}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <span style={s.ticketNum}>#{ticket.id}</span>
          <h1 style={s.subject}>{ticket.subject}</h1>
        </div>
        <div style={s.headerMeta}>
          <span style={s.statusBadge}>{ticket.status}</span>
          <div style={s.metaBlock}>
            <span style={s.metaLabel}>Agent</span>
            <span style={s.metaValue}>{agentDisplay}</span>
          </div>
          {ticket.created_at && (
            <div style={s.metaBlock}>
              <span style={s.metaLabel}>Created</span>
              <span style={s.metaValue}>
                {new Date(ticket.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Two-column body */}
      <div style={s.body}>

        {/* Left: Conversation */}
        <div style={s.col}>
          <div style={s.colHeader}>
            <span style={s.colTitle}>Conversation</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {channel && (
                <span style={s.channelTag}>{channel.replace(/_/g, " ")}</span>
              )}
              <span style={s.colCount}>{comments.length} messages</span>
            </div>
          </div>
          <div style={s.thread}>
            {commentsLoading && <div style={s.loadingMsg}>Loading conversation…</div>}
            {!commentsLoading && comments.length === 0 && (
              <div style={s.loadingMsg}>No messages found</div>
            )}
            {comments.map((c) => (
              <CommentBubble
                key={c.id}
                comment={c}
                authors={commentAuthors}
                requesterId={ticket.requester_id}
              />
            ))}
          </div>
        </div>

        {/* Right: Scorecard */}
        <div style={s.col}>
          <div style={s.colHeader}>
            <span style={s.colTitle}>Scorecard</span>
            {pct !== null && (
              <span style={{ ...s.pct, color: pctColor }}>{pct}% · {total}/{maxScore}</span>
            )}
          </div>

          <div style={s.scorecard}>
            {CRITERIA.map((c) => (
              <div key={c.key} style={s.criteriaRow}>
                <div>
                  <div style={s.criteriaName}>{c.label}</div>
                  <div style={s.criteriaDesc}>{c.desc}</div>
                </div>
                <div style={s.scoreGroup}>
                  {[1, 2, 3].map((val) => {
                    const active = scores[c.key] === val;
                    return (
                      <button
                        key={val}
                        onClick={() => setScores((p) => ({ ...p, [c.key]: val }))}
                        title={SCORE_LABELS[val]}
                        style={{
                          ...s.scoreBtn,
                          background: active ? SCORE_COLORS[val] : "#eef0f6",
                          color: active ? "white" : "#5a6275",
                          transform: active ? "scale(1.1)" : "scale(1)",
                        }}
                      >
                        {val}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div style={s.commentBlock}>
              <label style={s.commentLabel}>Comment</label>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Coaching notes, observations, or feedback for this agent…"
                style={s.textarea}
              />
            </div>

            <div style={s.footer}>
              {saveStatus === "saved" && (
                <span style={s.savedMsg}>✓ Saved to Google Sheets</span>
              )}
              {saveStatus === "error" && (
                <span style={s.errorMsg}>Failed — check webhook URL</span>
              )}
              {!allScored && !saveStatus && (
                <span style={s.hint}>Score all 5 criteria to save</span>
              )}
              <button
                onClick={handleSave}
                disabled={!allScored || saving}
                style={{ ...s.saveBtn, opacity: !allScored || saving ? 0.45 : 1 }}
              >
                {saving ? "Saving…" : "Save Review"}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function CommentBubble({ comment, authors, requesterId }) {
  const author = authors[comment.author_id];
  const isCustomer = comment.author_id === requesterId;
  const authorName = author?.name || (isCustomer ? "Customer" : `Agent #${comment.author_id}`);
  const authorEmail = author?.email || "";
  const date = comment.created_at
    ? new Date(comment.created_at).toLocaleString("en-GB", {
        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
      })
    : "";

  return (
    <div style={{ ...bub.wrap, ...(isCustomer ? bub.customer : comment.public ? bub.public : bub.internal) }}>
      <div style={bub.header}>
        <div>
          <span style={bub.name}>{authorName}</span>
          {authorEmail && <span style={bub.email}>{authorEmail}</span>}
        </div>
        <div style={bub.right}>
          {!comment.public && <span style={bub.internalTag}>internal note</span>}
          <span style={bub.date}>{date}</span>
        </div>
      </div>
      <p style={bub.body}>{comment.body}</p>
    </div>
  );
}

const s = {
  panel: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    height: "100vh",
    overflow: "hidden",
    background: "var(--panel-bg)",
  },
  emptyState: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    color: "var(--text-muted)",
  },
  emptyIcon: { fontSize: 36, opacity: 0.3 },
  emptyText: { fontSize: 15 },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: "18px 24px 16px",
    background: "white",
    borderBottom: "1px solid var(--panel-border)",
    gap: 16,
    flexShrink: 0,
  },
  headerLeft: { flex: 1, minWidth: 0 },
  ticketNum: {
    display: "block",
    color: "var(--accent)",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.06em",
    marginBottom: 3,
  },
  subject: {
    fontSize: 17,
    fontWeight: 600,
    color: "var(--text-primary)",
    lineHeight: 1.3,
    letterSpacing: "-0.01em",
  },
  headerMeta: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    flexShrink: 0,
  },
  statusBadge: {
    background: "#dcfce7",
    color: "#15803d",
    padding: "3px 10px",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
    textTransform: "capitalize",
  },
  metaBlock: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 1,
  },
  metaLabel: {
    fontSize: 10,
    color: "var(--text-muted)",
    fontWeight: 500,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  metaValue: {
    fontSize: 12,
    color: "var(--text-secondary)",
    fontWeight: 500,
  },
  body: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    gap: 0,
    overflow: "hidden",
  },
  col: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    overflow: "hidden",
    borderRight: "1px solid var(--panel-border)",
  },
  colHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 20px",
    borderBottom: "1px solid var(--panel-border)",
    background: "white",
    flexShrink: 0,
  },
  colTitle: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    color: "var(--text-secondary)",
  },
  colCount: {
    fontSize: 11,
    color: "var(--text-muted)",
  },
  channelTag: {
    fontSize: 10,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    background: "#ede9fe",
    color: "#6d28d9",
    borderRadius: 4,
    padding: "2px 6px",
  },
  pct: {
    fontSize: 14,
    fontWeight: 700,
  },
  thread: {
    flex: 1,
    overflowY: "auto",
    minHeight: 0,
    padding: "16px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  loadingMsg: {
    color: "var(--text-muted)",
    fontSize: 13,
    textAlign: "center",
    padding: "24px 0",
  },
  scorecard: {
    flex: 1,
    overflowY: "auto",
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
  },
  criteriaRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 20px",
    borderBottom: "1px solid #f1f3f7",
    gap: 12,
  },
  criteriaName: {
    fontSize: 13,
    fontWeight: 500,
    color: "var(--text-primary)",
    marginBottom: 2,
  },
  criteriaDesc: {
    fontSize: 11,
    color: "var(--text-muted)",
  },
  scoreGroup: {
    display: "flex",
    gap: 6,
    flexShrink: 0,
  },
  scoreBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    border: "none",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
    transition: "all 0.12s",
  },
  commentBlock: {
    padding: "16px 20px",
    borderBottom: "1px solid var(--panel-border)",
  },
  commentLabel: {
    display: "block",
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "var(--text-muted)",
    marginBottom: 8,
  },
  textarea: {
    width: "100%",
    height: 96,
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid var(--panel-border)",
    fontSize: 13,
    color: "var(--text-primary)",
    resize: "vertical",
    outline: "none",
    lineHeight: 1.5,
  },
  footer: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "14px 20px",
    background: "#fafbfc",
    borderTop: "1px solid var(--panel-border)",
    marginTop: "auto",
  },
  hint: {
    flex: 1,
    fontSize: 12,
    color: "var(--text-muted)",
    fontStyle: "italic",
  },
  savedMsg: {
    flex: 1,
    fontSize: 13,
    color: "#15803d",
    fontWeight: 500,
  },
  errorMsg: {
    flex: 1,
    fontSize: 13,
    color: "#dc2626",
  },
  saveBtn: {
    background: "var(--accent)",
    color: "white",
    border: "none",
    borderRadius: 8,
    padding: "10px 24px",
    fontSize: 14,
    fontWeight: 600,
    marginLeft: "auto",
    cursor: "pointer",
    transition: "opacity 0.15s",
  },
};

const bub = {
  wrap: {
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
    lineHeight: 1.55,
  },
  customer: {
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
  },
  public: {
    background: "#f0f4ff",
    border: "1px solid #dde5ff",
  },
  internal: {
    background: "#fffbeb",
    border: "1px solid #fde68a",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
    gap: 8,
  },
  name: {
    fontWeight: 600,
    fontSize: 12,
    color: "var(--text-secondary)",
    display: "block",
  },
  email: {
    fontSize: 11,
    color: "var(--text-muted)",
    display: "block",
    marginTop: 1,
  },
  right: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  date: {
    fontSize: 11,
    color: "var(--text-muted)",
  },
  internalTag: {
    fontSize: 10,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "#92400e",
    background: "#fef3c7",
    borderRadius: 4,
    padding: "1px 5px",
  },
  body: {
    color: "var(--text-primary)",
    whiteSpace: "pre-wrap",
    margin: 0,
  },
};
