# 🧩 Bykovas NFT Mini App

![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)
![Cloudflare](https://img.shields.io/badge/Cloudflare-Workers%20%7C%20Pages-orange)
![Database](https://img.shields.io/badge/DB-D1-lightgrey)
![Storage](https://img.shields.io/badge/Storage-R2-yellow)
![Telegram](https://img.shields.io/badge/Telegram-MiniApp-blue)
![Build](https://img.shields.io/github/actions/workflow/status/bykovas/tg-nft-miniapp/pages-deploy.yml?label=Pages)
![API](https://img.shields.io/github/actions/workflow/status/bykovas/tg-nft-miniapp/worker-deploy.yml?label=API)
![License](https://img.shields.io/badge/license-MIT-green)

> Telegram Mini App for NFT minting and trading — a **self-learning project** exploring Telegram WebApp integration, smart contracts (TON / EVM), and the Cloudflare stack (Workers, Pages, D1, R2).
> Add @bykovas_nft_bot to Telegram 

---

### 🚀 Tech Stack
| Layer | Technology |
|-------|-------------|
| **Frontend** | Cloudflare Pages · Vite · React · Telegram WebApp SDK |
| **Backend (API)** | Cloudflare Workers (TypeScript) |
| **Database** | Cloudflare D1 (SQLite) |
| **Storage** | Cloudflare R2 / Images |
| **CI/CD** | GitHub Actions + Wrangler Deploy |
| **Blockchain** | TON or EVM (Polygon / Base) |
| **On/Off-Ramp** | Embedded provider widget (to be integrated) |

---

### 🛠️ Status & Build

| Service | Branch | Status |
|----------|--------|--------|
| **Frontend (Pages)** | `main` | [![Pages Deploy](https://github.com/bykovas/tg-nft-miniapp/actions/workflows/pages-deploy.yml/badge.svg?branch=main)](https://github.com/bykovas/tg-nft-miniapp/actions/workflows/pages-deploy.yml) |
| **API (Worker)** | `main` | [![Worker Deploy](https://github.com/bykovas/tg-nft-miniapp/actions/workflows/worker-deploy.yml/badge.svg?branch=main)](https://github.com/bykovas/tg-nft-miniapp/actions/workflows/worker-deploy.yml) |
| **DB Migrations** | `main` | [![D1 Migrate](https://github.com/bykovas/tg-nft-miniapp/actions/workflows/d1-migrate.yml/badge.svg?branch=main)](https://github.com/bykovas/tg-nft-miniapp/actions/workflows/d1-migrate.yml) |

---

### 🌍 Environments
| Stage | App URL | API URL |
|-------|----------|---------|
| **Prod** | [tg-nft.bykovas.lt](https://tg-nft.bykovas.lt) | [api.tg-nft.bykovas.lt](https://api.tg-nft.bykovas.lt) |
| **Dev** | [dev.tg-nft.bykovas.lt](https://dev.tg-nft.bykovas.lt) | [dev.api.tg-nft.bykovas.lt](https://dev.api.tg-nft.bykovas.lt) |

---

### 📁 Monorepo structure
```
tg-nft-miniapp/
 ├── frontend/        # React + Vite (Telegram WebApp)
 ├── api/             # Cloudflare Worker (D1 + Telegram webhook)
 ├── db/              # D1 schema + migrations
 ├── infra/           # notes, scripts, curl webhook setup
 └── .github/workflows/ (CI/CD)
```

---

### 🧠 Goals
- Learn and document **end-to-end Telegram MiniApp** design  
- Explore **smart contract minting** (TON / EVM)  
- Integrate **fiat on-ramp/off-ramp flows**  
- Deploy **fully serverless stack** on Cloudflare  
- Automate everything via **GitHub Actions**

---

### 📜 License
MIT © 2025 · [Bykovas Tech](https://bykovas.lt)

---

### 🏷️ Topics
`telegram-bot` · `miniapp` · `nft` · `ton` · `evm` · `cloudflare-workers` · `cloudflare-pages` · `d1` · `r2` · `vite` · `react`
