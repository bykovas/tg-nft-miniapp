// Cloudflare Worker entry (TypeScript)
// Handles / (keep alive), /api/ping (JSON), and /api/db/health (D1 check)

export interface Env {
  STAGE?: string;        // e.g. "prod" | "dev"
  DB: D1Database;        // D1 binding defined in wrangler.toml
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    // --- Root endpoint: keep-alive text ---
    if (pathname === "/") {
      return new Response(`tg-nft-miniapp-api alive (${env.STAGE ?? "prod"})`, {
        status: 200,
        headers: { "content-type": "text/plain; charset=UTF-8" },
      });
    }

    // --- Ping endpoint: JSON echo ---
    if (request.method === "GET" && pathname === "/api/ping") {
      const stage = env.STAGE ?? "prod";
      return json({ pong: true, stage });
    }

    // --- D1 health endpoint ---
    if (request.method === "GET" && pathname === "/api/db/health") {
      try {
        const row = await env.DB.prepare(
          "SELECT key, value, updated_at FROM app_info WHERE key = ?"
        )
          .bind("health")
          .first<{ key: string; value: string; updated_at: string }>();

        if (!row) {
          return json({ ok: false, reason: "No health row found" }, 404);
        }

        return json({
          ok: row.value === "ok",
          info: row,
          stage: env.STAGE ?? "prod",
        });
      } catch (e) {
        return json({ ok: false, error: (e as Error).message }, 500);
      }
    }

    // --- Default 404 ---
    return json({ error: "Not Found", path: pathname }, 404);
  },
};

// Helper to send JSON responses
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=UTF-8",
      "cache-control": "no-store",
    },
  });
}
