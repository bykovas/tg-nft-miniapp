import { useEffect, useState } from "react";
import WebApp from "@twa-dev/sdk";

export default function App() {
  const [userName, setUserName] = useState<string>("");
  const [user, setUser] = useState<any>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    WebApp.ready();
    WebApp.expand();

    // Try to read raw initData string. SDK exposes .initDataUnsafe (object) and
    // window.Telegram?.WebApp?.initData has raw string in many environments.
    const rawInitData = (window as any)?.Telegram?.WebApp?.initData || (WebApp as any).initData || "";

    // If we have an initData string, call backend to get /me
    if (rawInitData) {
      setLoading(true);
      fetch("/api/tg/me", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ initData: rawInitData }),
      })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok || !data.ok) {
            throw new Error(data?.error || `HTTP ${res.status}`);
          }
          setUser(data.user ?? null);
          setUserName(data.user?.first_name ?? "");
          // Expect balance.tokens from server
          setBalance(data.balance?.tokens ?? 0);
        })
        .catch((e) => {
          setError((e && e.message) || String(e));
        })
        .finally(() => setLoading(false));
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

      {loading ? (
        <p>Loading your account...</p>
      ) : error ? (
        <p style={{ color: "#ffb4b4" }}>Error: {error}</p>
      ) : (
        <>
          <p>Welcome to Bykovas NFT Mini App</p>
          <div style={{ marginTop: "1rem", textAlign: "center" }}>
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
                <div>{user?.first_name} {user?.last_name}</div>
                <div style={{ color: "#b9c2cc" }}>@{user?.username}</div>
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
              <div style={{ fontSize: 20, marginTop: 8 }}>{balance ?? 0} tokens</div>
            </div>
          </div>

          <button
            onClick={() => WebApp.showAlert("Wallet connection coming soon")}
            style={{
              marginTop: "1.5rem",
              background: WebApp.themeParams.button_color || "#FF6A00",
              color: WebApp.themeParams.button_text_color || "#fff",
              border: "none",
              borderRadius: "12px",
              padding: "12px 24px",
              fontSize: "16px",
              cursor: "pointer",
            }}
          >
            Connect Wallet
          </button>
        </>
      )}
    </main>
  );
}
