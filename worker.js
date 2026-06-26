export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/zendesk/")) {
      const path = url.pathname.replace("/api/zendesk/", "");
      const target = `https://${env.ZENDESK_SUBDOMAIN}.zendesk.com/${path}${url.search}`;
      const auth = btoa(`${env.ZENDESK_EMAIL}/token:${env.ZENDESK_API_TOKEN}`);

      const res = await fetch(target, {
        method: request.method,
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
      });

      const body = await res.text();
      return new Response(body, {
        status: res.status,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    return env.ASSETS.fetch(request);
  },
};
