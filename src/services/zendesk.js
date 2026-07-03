const BASE = "/api/zendesk/api/v2";
const ZD_DOMAIN = `https://${import.meta.env.VITE_ZENDESK_SUBDOMAIN}.zendesk.com/api/v2`;

// Rewrite absolute Zendesk next_page URLs to go through the proxy
function proxyUrl(url) {
  if (!url) return null;
  return url.replace(ZD_DOMAIN, BASE);
}

async function apiFetch(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`Zendesk ${res.status}: ${res.statusText}`);
  return res.json();
}

async function fetchAll(path, key) {
  let url = `${BASE}${path}`;
  const results = [];
  while (url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Zendesk ${res.status}`);
    const data = await res.json();
    results.push(...(data[key] || []));
    url = proxyUrl(data.next_page);
  }
  return results;
}

export async function fetchAgents() {
  return fetchAll(`/users.json?role[]=agent&role[]=admin&per_page=100`, "users");
}

export async function fetchL1AgentIds(groupNames) {
  const groups = await fetchAll(`/groups.json?per_page=100`, "groups");
  const targetIds = groups
    .filter((g) => groupNames.some((n) => g.name.toLowerCase().includes(n.toLowerCase())))
    .map((g) => g.id);

  if (targetIds.length === 0) return new Set();

  const memberSets = await Promise.all(
    targetIds.map((id) =>
      fetchAll(`/group_memberships.json?group_id=${id}&per_page=100`, "group_memberships")
    )
  );
  const ids = new Set();
  memberSets.flat().forEach((m) => ids.add(m.user_id));
  return ids;
}

// Fetch solved tickets for L1 groups with metric_sets (includes reply count).
// Deduplicates across groups by ticket ID.
export async function fetchL1Tickets(groupIds, startDate, endDate) {
  const seen = new Set();
  const allTickets = [];

  for (const gid of groupIds) {
    let url = `${BASE}/tickets.json?group_id=${gid}&status=solved&sort_by=created_at&sort_order=desc&per_page=100&include=metric_sets`;
    while (url) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Zendesk ${res.status}`);
      const data = await res.json();

      const metrics = {};
      (data.metric_sets || []).forEach((m) => { metrics[m.ticket_id] = m; });

      let pastWindow = false;
      for (const t of (data.tickets || [])) {
        const d = t.created_at?.slice(0, 10);
        if (startDate && d < startDate) { pastWindow = true; continue; }
        if (endDate && d > endDate) continue;
        if (seen.has(t.id)) continue;
        seen.add(t.id);
        t._replies = metrics[t.id]?.replies ?? 0;
        allTickets.push(t);
      }

      if (pastWindow) break;
      url = proxyUrl(data.next_page);
    }
  }

  return allTickets;
}

// Fetch the group IDs for the L1 groups (by name)
export async function fetchL1GroupIds(groupNames) {
  const groups = await fetchAll(`/groups.json?per_page=100`, "groups");
  return groups
    .filter((g) => groupNames.some((n) => g.name.toLowerCase().includes(n.toLowerCase())))
    .map((g) => g.id);
}

export async function fetchComments(ticketId) {
  const [commentsData, ticketData] = await Promise.all([
    apiFetch(`/tickets/${ticketId}/comments.json?include=users`),
    apiFetch(`/tickets/${ticketId}.json?include=users`),
  ]);

  const comments = commentsData.comments || [];
  const users = commentsData.users || [];

  // For chat/messaging tickets the description holds the transcript.
  // Inject it as a synthetic first message if no customer comments are visible.
  const channel = ticketData.ticket?.via?.channel;
  const isChatChannel = ["chat", "native_messaging", "sunshine_conversations_partner"].includes(channel);
  const description = ticketData.ticket?.description;
  const requesterId = ticketData.ticket?.requester_id;

  // Merge users from both responses
  const allUsers = [...users];
  const seenIds = new Set(users.map((u) => u.id));
  (ticketData.users || []).forEach((u) => {
    if (!seenIds.has(u.id)) allUsers.push(u);
  });

  if (isChatChannel && description) {
    // Check if the customer's messages already appear in comments
    const hasCustomerComments = comments.some((c) => c.author_id === requesterId && c.public);
    if (!hasCustomerComments) {
      // Prepend the description as the opening message from the customer
      comments.unshift({
        id: `desc-${ticketId}`,
        author_id: requesterId,
        body: description,
        public: true,
        created_at: ticketData.ticket?.created_at,
        _synthetic: true,
      });
    }
  }

  return { comments, users: allUsers, channel };
}
