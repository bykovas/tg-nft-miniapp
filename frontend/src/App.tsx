import { useEffect, useState } from "react";
import WebApp from "@twa-dev/sdk";

export default function App() {
  const [userName, setUserName] = useState<string>("");
  const [user, setUser] = useState<any>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Choose API base depending on Pages host so frontend calls the correct Worker
  const API_BASE = (() => {
    try {
      const host = typeof window !== 'undefined' ? window.location.host : '';
      if (host.startsWith('dev.')) return 'https://dev.api.tg-nft.bykovas.lt';
      return 'https://api.tg-nft.bykovas.lt';
    } catch {
      return 'https://api.tg-nft.bykovas.lt';
    }
  })();
  const API_URL_FOR_POSTMAN = `${API_BASE}/api/tg/me`;

  useEffect(() => {
    WebApp.ready();
    WebApp.expand();

    // Try to read raw initData string. SDK exposes .initDataUnsafe (object) and
    // window.Telegram?.WebApp?.initData has raw string in many environments.
    const rawInitData = (window as any)?.Telegram?.WebApp?.initData || (WebApp as any).initData || "";
    // Debug: expose raw initData for troubleshooting Telegram issues
    (window as any).__DEBUG_TG_INITDATA__ = rawInitData;
    console.debug("rawInitData:", rawInitData);

    async function fetchMe(initDataRaw: string) {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/tg/me`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ initData: initDataRaw }),
        });
        const text = await res.text();
        let data: any = null;
        try {
          data = JSON.parse(text);
        } catch {
          data = { ok: false, error: `Invalid JSON response: ${text}` };
        }
        if (!res.ok || !data.ok) throw new Error(data?.error || `HTTP ${res.status} - ${text}`);
        setUser(data.user ?? null);
        setUserName(data.user?.first_name ?? "");
        setBalance(data.balance?.tokens ?? 0);
      } catch (e) {
        const msg = (e && (e as Error).message) || String(e);
        console.error("/api/tg/me error:", msg);
        setError(String(msg));
      } finally {
        setLoading(false);
      }
    }

    if (rawInitData) {
      fetchMe(rawInitData);
    } else {
      // Fallback: use initDataUnsafe from SDK for display only
      const initUnsafe = (WebApp as any).initDataUnsafe;
      if (initUnsafe?.user?.first_name) setUserName(initUnsafe.user.first_name);
    }
  }, []);

  return (
    <main
      style={{
        fontFamily: "Inter, sans-serif",
        color: WebApp.themeParams.text_color || "#fff",
        background: WebApp.themeParams.bg_color || "#1E2A38",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <h1>👋 Hello {userName || "friend"}!</h1>
      <div style={{ marginTop: 8, marginBottom: 8, fontSize: 13, color: '#cbd5e1' }}>
        API endpoint for testing: 
        <code style={{ background: 'rgba(0,0,0,0.12)', padding: '2px 6px', borderRadius: 6, marginLeft: 8 }}>{API_URL_FOR_POSTMAN}</code>
      </div>

      {loading ? (
        <p>Loading your account...</p>
      ) : error ? (
        <p style={{ color: "#ffb4b4" }}>Error: {error}</p>
      ) : (
        <>
          <p>Welcome to Bykovas NFT Mini App</p>
          <div style={{ marginTop: "1rem", textAlign: "center" }}>
            {/* show demo/mock data when real user missing */}
            {(() => {
              const mockUser = { first_name: "Demo", last_name: "User", username: "demo_user" };
              const display = user ?? mockUser;
              const displayBalance = (balance ?? (user ? 0 : 5)); // show 5 tokens in demo
              return (
                <>
                  <div
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      padding: "12px 16px",
                      borderRadius: 12,
                      minWidth: 220,
                    }}
                  >
                    <strong>Profile</strong>
                    <div style={{ fontSize: 14, marginTop: 8 }}>
                      <div>{display.first_name} {display.last_name}</div>
                      <div style={{ color: "#b9c2cc" }}>@{display.username}</div>
                    </div>
                  </div>

                  <div style={{ height: 12 }} />

                  <div
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      padding: "12px 16px",
                      borderRadius: 12,
                      minWidth: 220,
                    }}
                  >
                    <strong>Balance</strong>
                    <div style={{ fontSize: 20, marginTop: 8 }}>{displayBalance} tokens</div>
                  </div>

                  <div style={{ height: 14 }} />

                  <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                    <button
                      onClick={() => ((WebApp as any).showAlert ? (WebApp as any).showAlert("Buying demo NFT — not implemented") : alert("Buying demo NFT — not implemented"))}
                      style={{
                        background: "#10B981",
                        color: "white",
                        border: "none",
                        borderRadius: 10,
                        padding: "8px 14px",
                        cursor: "pointer",
                      }}
                    >
                      Buy Demo NFT
                    </button>

                    <button
                      onClick={() => ((WebApp as any).showAlert ? (WebApp as any).showAlert("Opening inventory") : alert("Opening inventory"))}
                      style={{
                        background: "#2563EB",
                        color: "white",
                        border: "none",
                        borderRadius: 10,
                        padding: "8px 14px",
                        cursor: "pointer",
                      }}
                    >
                      Open Inventory
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </>
      )}
    </main>
  );
}
