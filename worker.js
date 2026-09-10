// Only these Zendesk endpoints may be proxied. The path here is what remains
// after "/api/zendesk/" is stripped, e.g. "api/v2/tickets/12345.json".
const ALLOWED_ZENDESK_PATHS = [
  /^api\/v2\/users\.json$/,
  /^api\/v2\/groups\.json$/,
  /^api\/v2\/group_memberships\.json$/,
  /^api\/v2\/search\.json$/,
  /^api\/v2\/tickets\/\d+\.json$/,
  /^api\/v2\/tickets\/\d+\/comments\.json$/,
  /^api\/v2\/tickets\/\d+\/metrics\.json$/,
];

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function proxyZendesk(request, env, url) {
  if (request.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const path = url.pathname.replace("/api/zendesk/", "");
  if (!ALLOWED_ZENDESK_PATHS.some((re) => re.test(path))) {
    return json({ error: "Endpoint not allowed" }, 403);
  }

  const target = `https://${env.ZENDESK_SUBDOMAIN}.zendesk.com/${path}${url.search}`;
  const auth = btoa(`${env.ZENDESK_EMAIL}/token:${env.ZENDESK_API_TOKEN}`);

  const res = await fetch(target, {
    method: "GET",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
  });

  return new Response(await res.text(), {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/zendesk/")) {
      return proxyZendesk(request, env, url);
    }

    return env.ASSETS.fetch(request);
  },
};
