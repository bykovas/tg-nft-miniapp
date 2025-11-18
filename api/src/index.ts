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

// ---- JSON response helper ----
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=UTF-8",
      "cache-control": "no-store",
    },
  });
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
  const hash = data["hash"];
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
  return ourHex === hash;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    // Root: keep existing alive text
    if (pathname === "/") {
      return new Response(`tg-nft-miniapp-api alive (${env.STAGE ?? "prod"})`, {
        status: 200,
        headers: { "content-type": "text/plain; charset=UTF-8" },
      });
    }

    // JSON ping
    if (request.method === "GET" && pathname === "/api/ping") {
      return json({ pong: true, stage: env.STAGE ?? "prod" });
    }

    // D1 health check (expects table app_info with key 'health')
    if (request.method === "GET" && pathname === "/api/db/health") {
      if (!env.DB) return json({ ok: false, error: "DB binding is missing" }, 500);
      try {
        const row = await env.DB.prepare(
          "SELECT key, value, updated_at FROM app_info WHERE key = ?"
        )
          .bind("health")
          .first<{ key: string; value: string; updated_at: string }>();

        if (!row) return json({ ok: false, reason: "No health row found" }, 404);
        return json({ ok: row.value === "ok", info: row, stage: env.STAGE ?? "prod" });
      } catch (e) {
        return json({ ok: false, error: (e as Error).message }, 500);
      }
    }

    // Telegram webhook: validates secret header, handles /start and generic text
    if (pathname === "/tg/webhook" && request.method === "POST") {
      const secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
      if (!secret || secret !== env.TG_WEBHOOK_SECRET) {
        return json({ ok: false, error: "Unauthorized webhook" }, 401);
      }

      let update: any;
      try {
        update = await request.json();
      } catch {
        return json({ ok: false, error: "Invalid JSON" }, 400);
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
        return json({ ok: true });
      } catch (e) {
        return json({ ok: false, error: (e as Error).message }, 500);
      }
    }

    // Telegram initData validation endpoint
    // Expects JSON body { initData: "..." } or form/query containing initData string
    if (pathname === "/api/tg/validate-init" && request.method === "POST") {
      let initDataRaw: string | null = null;

      const contentType = request.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        try {
          const body = await request.json();
          if (body && typeof body.initData === "string") initDataRaw = body.initData;
        } catch {
          return json({ ok: false, error: "Invalid JSON body" }, 400);
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

      if (!initDataRaw) return json({ ok: false, error: "initData not found" }, 400);

      if (!env.TG_BOT_TOKEN) return json({ ok: false, error: "Bot token not configured" }, 500);

      try {
        const valid = await verifyInitData(initDataRaw, env.TG_BOT_TOKEN);
        if (!valid) return json({ ok: false, error: "Invalid initData" }, 401);

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

        return json({ ok: true, user });
      } catch (e) {
        return json({ ok: false, error: (e as Error).message }, 500);
      }
    }

    // Default 404
    return json({ error: "Not Found", path: pathname }, 404);
  },
};
