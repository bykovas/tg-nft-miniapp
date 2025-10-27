// Cloudflare Worker entry (TypeScript)
// Handles / (keep alive), /api/ping (JSON), and a placeholder for /api/db/health.

export interface Env {
  STAGE?: string; // e.g., "prod" | "dev"
}

export default {
  // Main fetch handler for Worker
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    // Keep existing behavior for root ("/") to not break your alive-check
    if (pathname === "/") {
      return new Response("tg-nft-miniapp-api alive (prod)", {
        status: 200,
        headers: { "content-type": "text/plain; charset=UTF-8" },
      });
    }

    // New JSON ping endpoint
    if (request.method === "GET" && pathname === "/api/ping") {
      // Prefer STAGE env var; fallback to "prod" to mirror current domain
      const stage = env.STAGE ?? "prod";
      return json({ pong: true, stage });
    }

    // Placeholder for DB health (will implement after D1 is wired)
    if (request.method === "GET" && pathname === "/api/db/health") {
      return json({ ok: false, reason: "Not Implemented yet" }, 501);
    }

    // 404 for everything else
    return json({ error: "Not Found", path: pathname }, 404);
  },
};

// Small helper to return JSON consistently
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=UTF-8",
      "cache-control": "no-store",
    },
  });
}
