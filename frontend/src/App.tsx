import { useEffect, useState } from "react";
import WebApp from "@twa-dev/sdk";

export default function App() {
  const [user, setUser] = useState<string>("");

  useEffect(() => {
    WebApp.ready();
    WebApp.expand();
    const initData = WebApp.initDataUnsafe;
    if (initData?.user?.first_name) setUser(initData.user.first_name);
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
      }}
    >
      <h1>👋 Hello {user || "friend"}!</h1>
      <p>Welcome to Bykovas NFT Mini App</p>
      <button
        onClick={() => WebApp.showAlert("Wallet connection coming soon")}
        style={{
          marginTop: "1rem",
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
    </main>
  );
}
