export interface Env {
  STAGE: "dev" | "prod";
  // D1 / R2 bindings will be added later:
  // DB: D1Database;
  // R2: R2Bucket;
  // TG_BOT_TOKEN: string;
}

/**
 * Minimal Worker entry point.
 * - GET /                : health probe ("alive")
 * - GET /api/ping        : returns JSON { pong: true, stage }
 * - POST /tg/webhook     : placeholder for Telegram webhook (returns 200)
 *
 * Notes:
 * - CORS headers are applied for /api/* paths (simple dev-friendly defaults).
 * - No Node.js APIs: Workers run on V8 isolates with Web APIs only.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Health probe
    if (url.pathname === "/" && request.method === "GET") {
      return new Response(`tg-nft-miniapp-api alive (${env?.STAGE ?? "unknown"})`, { status: 200 });
    }

    // Simple JSON ping
    if (url.pathname === "/api/ping" && request.method === "GET") {
      return json({ pong: true, stage: env?.STAGE ?? "unknown" }, 200);
    }

    // Telegram webhook placeholder
    if (url.pathname === "/tg/webhook" && request.method === "POST") {
      // TODO: verify Telegram signature, parse update, route commands.
      return new Response("ok", { status: 200 });
    }

    return new Response("Not Found", { status: 404 });
  },
};

/** Helper: JSON response with minimal CORS for /api/* paths. */
function json(payload: unknown, status = 200): Response {
  const body = JSON.stringify(payload);
  return new Response(body, {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type,authorization",
      "cache-control": "no-store",
    },
  });
}
