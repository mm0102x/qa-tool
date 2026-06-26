export async function onRequest({ request, env, params }) {
  const path = params.path ? params.path.join("/") : "";
  const url = new URL(request.url);
  const target = `https://${env.ZENDESK_SUBDOMAIN}.zendesk.com/${path}${url.search}`;

  const auth = btoa(`${env.ZENDESK_EMAIL}/token:${env.ZENDESK_API_TOKEN}`);

  const res = await fetch(target, {
    method: request.method,
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
  });

  // Forward the response with CORS headers so the browser can read it
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
