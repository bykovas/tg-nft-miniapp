// Cloudflare Worker entry (TypeScript)
// - GET /                  -> alive text
// - GET /api/ping          -> JSON ping
// - GET /api/db/health     -> D1 health check (reads from app_info)
// - POST /tg/webhook       -> Telegram webhook (/start + inline "Open Mini App")

export interface Env {
  STAGE?: string;             // "prod" | "dev"
  DB?: D1Database;            // D1 binding (optional in types to avoid build errors on dev)
  TG_BOT_TOKEN: string;       // wrangler secret (prod)
  TG_WEBHOOK_SECRET: string;  // wrangler secret (prod)
}

// ---- Minimal Telegram API helper ----
const tg = {
  base: (token: string) => `https://api.telegram.org/bot${token}`,
  async sendMessage(token: string, chatId: number, text: string, extra?: Record<string, unknown>) {
    const url = `${tg.base(token)}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, ...(extra ?? {}) }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`sendMessage failed: ${res.status} ${body}`);
    }
    return res.json();
  },
};

// ---- JSON response helper + CORS utilities ----
const ALLOWED_ORIGINS = [
  "https://tg-nft.bykovas.lt",
  "https://dev.tg-nft.bykovas.lt",
  "https://tg-nft.pages.dev",
  "http://localhost:5173",
];

function withCors(request: Request, response: Response): Response {
  const origin = request.headers.get("Origin");
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Vary", "Origin");
  } else {
    response.headers.set("Access-Control-Allow-Origin", "*");
  }
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With"
  );
  response.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.headers.set("Access-Control-Max-Age", "86400");
  return response;
}

function json(data: unknown, status = 200, request?: Request): Response {
  const res = new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=UTF-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "Content-Type, X-Requested-With",
      "access-control-allow-methods": "GET, POST, OPTIONS",
    },
  });
  return request ? withCors(request, res) : res;
}

function corsPreflight(request: Request): Response {
  const res = new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "Content-Type, X-Requested-With",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-max-age": "86400",
    },
  });
  return withCors(request, res);
}

// ---- Telegram initData verification helpers ----
async function sha256(data: Uint8Array | ArrayBuffer) {
  const buf = data instanceof Uint8Array ? data.buffer : data;
  return await crypto.subtle.digest("SHA-256", buf as ArrayBuffer);
}

function ab2hex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function parseInitData(initData: string): Record<string, string> {
  const obj: Record<string, string> = {};
  const parts = initData.split("&");
  for (const p of parts) {
    const [k, ...rest] = p.split("=");
    if (!k) continue;
    const v = rest.join("=");
    try {
      obj[k] = decodeURIComponent(v.replace(/\+/g, " "));
    } catch {
      obj[k] = v;
    }
  }
  return obj;
}

async function verifyInitData(initData: string, botToken: string): Promise<boolean> {
  const data = parseInitData(initData);
  const hash = data["hash"] ?? data["signature"] ?? data["sig"];
  if (!hash) return false;

  // Build data_check_string: all fields except hash, sorted by key
  const keys = Object.keys(data).filter((k) => k !== "hash").sort();
  const dataCheck = keys.map((k) => `${k}=${data[k]}`).join("\n");

  const enc = new TextEncoder();
  const keyHash = await sha256(enc.encode(botToken));
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyHash,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    enc.encode(dataCheck).buffer
  );

  const ourHex = ab2hex(signature);
  return ourHex.toLowerCase() === String(hash).toLowerCase();
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    // helper: allow matching when Worker is mounted under a prefix
    const matchPath = (p: string) => pathname === p || pathname.endsWith(p);

    // Handle CORS preflight
    if (request.method === "OPTIONS") return corsPreflight(request);

    // Root: keep existing alive text
    if (matchPath("/")) {
      return new Response(`tg-nft-miniapp-api alive (${env.STAGE ?? "prod"})`, {
        status: 200,
        headers: { "content-type": "text/plain; charset=UTF-8" },
      });
    }

    // JSON ping
    if (request.method === "GET" && matchPath("/api/ping")) {
      return json({ pong: true, stage: env.STAGE ?? "prod" });
    }

    // D1 health check (expects table app_info with key 'health')
    if (request.method === "GET" && matchPath("/api/db/health")) {
      if (!env.DB) return json({ ok: false, error: "DB binding is missing" }, 500);
      try {
        const row = await env.DB.prepare(
          "SELECT key, value, updated_at FROM app_info WHERE key = ?"
        )
          .bind("health")
          .first<{ key: string; value: string; updated_at: string }>();

        if (!row) return json({ ok: false, reason: "No health row found" }, 404, request);
        return json({ ok: row.value === "ok", info: row, stage: env.STAGE ?? "prod" }, 200, request);
      } catch (e) {
        return json({ ok: false, error: (e as Error).message }, 500, request);
      }
    }

    // Telegram webhook: validates secret header, handles /start and generic text
    if (matchPath("/tg/webhook") && request.method === "POST") {
      const secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
      if (!secret || secret !== env.TG_WEBHOOK_SECRET) {
        return json({ ok: false, error: "Unauthorized webhook" }, 401, request);
      }

      let update: any;
      try {
        update = await request.json();
      } catch {
        return json({ ok: false, error: "Invalid JSON" }, 400, request);
      }

      try {
        const msg = update.message ?? update.edited_message ?? null;
        if (msg && msg.chat && msg.chat.type === "private") {
          const chatId: number = msg.chat.id;
          const text = (msg.text ?? "").trim();

          if (text === "/start") {
            await tg.sendMessage(
              env.TG_BOT_TOKEN,
              chatId,
              "👋 Welcome to Bykovas NFT Mini App!\nTap below to open the app ⬇️",
              {
                reply_markup: {
                  inline_keyboard: [
                    [
                      {
                        text: "🚀 Open Mini App",
                        web_app: { url: "https://tg-nft.bykovas.lt" }, // Cloudflare Pages frontend
                      },
                    ],
                  ],
                },
                disable_web_page_preview: true,
              }
            );
          } else if (text.length > 0) {
            await tg.sendMessage(
              env.TG_BOT_TOKEN,
              chatId,
              `👋 Hi, ${msg.from?.first_name ?? "there"}! You said: ${text}`,
              { disable_web_page_preview: true }
            );
          }
        }

        // Always acknowledge to Telegram within 10s
        return json({ ok: true }, 200, request);
      } catch (e) {
        return json({ ok: false, error: (e as Error).message }, 500, request);
      }
    }

    // Telegram initData validation endpoint
    // Expects JSON body { initData: "..." } or form/query containing initData string
    if (matchPath("/api/tg/validate-init") && request.method === "POST") {
      let initDataRaw: string | null = null;

      const contentType = request.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        try {
          const body = await request.json();
          if (body && typeof body.initData === "string") initDataRaw = body.initData;
        } catch {
          return json({ ok: false, error: "Invalid JSON body" }, 400, request);
        }
      } else if (contentType.includes("application/x-www-form-urlencoded")) {
        const form = await request.formData();
        const v = form.get("initData");
        if (typeof v === "string") initDataRaw = v;
      }

      // fallback: try to read raw text
      if (!initDataRaw) {
        try {
          const text = await request.text();
          if (text && text.includes("hash=")) initDataRaw = text.trim();
        } catch {}
      }

      if (!initDataRaw) return json({ ok: false, error: "initData not found" }, 400, request);

      if (!env.TG_BOT_TOKEN) return json({ ok: false, error: "Bot token not configured" }, 500, request);

      try {
        const valid = await verifyInitData(initDataRaw, env.TG_BOT_TOKEN);
        if (!valid) return json({ ok: false, error: "Invalid initData" }, 401, request);

        const parsed = parseInitData(initDataRaw);
        // extract user JSON if present
        let user: any = null;
        if (parsed.user) {
          try {
            user = JSON.parse(parsed.user);
          } catch {
            // ignore parse errors
            user = null;
          }
        }

        // Register user in D1 if present and DB bound
        if (user && env.DB) {
          try {
            const id = Number(user.id);
            if (!Number.isNaN(id)) {
              const exists = await env.DB.prepare("SELECT id FROM users WHERE id = ?").bind(id).first();
              if (!exists) {
                await env.DB.prepare(
                  "INSERT INTO users (id, first_name, last_name, username, language_code) VALUES (?, ?, ?, ?, ?)"
                )
                  .bind(id, user.first_name ?? null, user.last_name ?? null, user.username ?? null, user.language_code ?? null)
                  .run();
              }
            }
          } catch (e) {
            // don't fail the whole request on DB error; just log
            console.error("DB register user error:", (e as Error).message);
          }
        }

        return json({ ok: true, user }, 200, request);
      } catch (e) {
        return json({ ok: false, error: (e as Error).message }, 500, request);
      }
    }

    // Return authenticated user details via initData
    if (matchPath("/api/tg/me")) {
      if (request.method !== "POST") {
        return json(
          {
            ok: false,
            error: "Use POST with Telegram initData to fetch /api/tg/me",
            hint: "Send JSON { initData: \"...\" } as described in https://core.telegram.org/bots/webapps#initializing-mini-apps",
          },
          405,
          request
        );
      }

      let initDataRaw: string | null = null;

      const contentType = request.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        try {
          const body = await request.json();
          if (body && typeof body.initData === "string") initDataRaw = body.initData;
        } catch {
          return json({ ok: false, error: "Invalid JSON body" }, 400, request);
        }
      } else if (contentType.includes("application/x-www-form-urlencoded")) {
        const form = await request.formData();
        const v = form.get("initData");
        if (typeof v === "string") initDataRaw = v;
      }

      if (!initDataRaw) {
        try {
          const text = await request.text();
          if (text && text.includes("hash=")) initDataRaw = text.trim();
        } catch {}
      }

      if (!initDataRaw) return json({ ok: false, error: "initData not found" }, 400, request);
      if (!env.TG_BOT_TOKEN) return json({ ok: false, error: "Bot token not configured" }, 500, request);

      try {
        const valid = await verifyInitData(initDataRaw, env.TG_BOT_TOKEN);
        if (!valid) return json({ ok: false, error: "Invalid initData" }, 401, request);

        const parsed = parseInitData(initDataRaw);
        let user: any = null;
        if (parsed.user) {
          try {
            user = JSON.parse(parsed.user);
          } catch {
            user = null;
          }
        }

        // If DB bound, try to load stored user and compute fake balance = ownerships count
        let storedUser: any = null;
        let balance = 0;
        if (env.DB && user) {
          try {
            const id = Number(user.id);
            if (!Number.isNaN(id)) {
              const row = await env.DB.prepare("SELECT id, first_name, last_name, username, language_code, created_at FROM users WHERE id = ?")
                .bind(id)
                .first<any>();
              if (row) storedUser = row;

              const cntRow = await env.DB.prepare("SELECT COUNT(*) as cnt FROM ownerships WHERE owner_id = ?").bind(id).first<{ cnt: number }>();
              if (cntRow && typeof cntRow.cnt !== "undefined") balance = Number(cntRow.cnt);
            }
          } catch (e) {
            console.error("DB /me error:", (e as Error).message);
          }
        }

        const resultUser = storedUser ?? user ?? null;
        // For MVP, if DB not present, return fake balance 0
        return json({ ok: true, user: resultUser, balance: { tokens: balance } }, 200, request);
      } catch (e) {
        return json({ ok: false, error: (e as Error).message }, 500, request);
      }
    }

    // Dev helper: accept a raw user object for testing (no initData required)
    // POST { user: { id, first_name, last_name, username, language_code } }
    if (matchPath("/api/tg/me-dev") && request.method === "POST") {
      let body: any;
      try {
        body = await request.json();
      } catch {
        return json({ ok: false, error: "Invalid JSON body" }, 400, request);
      }

      const user = body?.user ?? null;
      if (!user || !user.id) return json({ ok: false, error: "user with id is required" }, 400, request);

      // Register user in D1 if present
      try {
        const id = Number(user.id);
        if (!Number.isNaN(id) && env.DB) {
          const exists = await env.DB.prepare("SELECT id FROM users WHERE id = ?").bind(id).first();
          if (!exists) {
            await env.DB.prepare(
              "INSERT INTO users (id, first_name, last_name, username, language_code) VALUES (?, ?, ?, ?, ?)"
            )
              .bind(id, user.first_name ?? null, user.last_name ?? null, user.username ?? null, user.language_code ?? null)
              .run();
          }

          const cntRow = await env.DB.prepare("SELECT COUNT(*) as cnt FROM ownerships WHERE owner_id = ?").bind(id).first<{ cnt: number }>();
          const balance = cntRow && typeof cntRow.cnt !== "undefined" ? Number(cntRow.cnt) : 0;
          return json({ ok: true, user, balance: { tokens: balance } }, 200, request);
        }
      } catch (e) {
        console.error("/api/tg/me-dev DB error:", (e as Error).message);
      }

      // Fallback success response without DB
      return json({ ok: true, user, balance: { tokens: 5 } });
    }

    // Diagnostic endpoint: useful to see where request landed
    if (matchPath("/api/_whoami") || matchPath("/_whoami")) {
      const headers: Record<string, string | null> = {};
      request.headers.forEach((v, k) => (headers[k] = v));
      return json({ ok: true, host: url.host, pathname, method: request.method, headers });
    }

    // Default 404
    return json({ error: "Not Found", path: pathname }, 404, request);
  },
};
