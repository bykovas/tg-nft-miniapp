| # | Title | Description |
|---|-------|-------------|
| 1 | Implement Telegram initData validation (Backend) | Add secure initData verification using bot token, extract Telegram user info, and register user in D1 if first launch. |
| 2 | Create D1 schema for core entities | Add migrations for: users, items, orders (or ownerships). Minimal fields only. |
| 3 | Implement `/me` endpoint | Return authenticated user details (via initData), including user profile and balance (fake balance for MVP). |
| 4 | Implement `/market` endpoint | Return full list of items (pictures) from the D1 database. |
| 5 | Implement `/wallet` endpoint | Return items purchased/owned by the user. |
| 6 | Implement `/buy` endpoint (off-chain purchase) | Validate initData, validate item, create new order/ownership record. No payments for MVP. |
| 7 | Set up R2 bucket for picture files | Create bucket, upload several sample pictures, make public URLs, prepare them for the `items` table. |
| 8 | Seed initial pictures into D1 | Add 5–10 sample items into the `items` table manually or via seed script. |
| 9 | Connect frontend to initData | Read initData, send it to `/me`; handle user registration on first open. |
|10 | Create basic frontend layout | Add top navigation / tabs: **Market**, **My Collection**, **Profile**. |
|11 | Display Market items (frontend) | Fetch `/market`, display picture cards with image, title, and price. |
|12 | Implement Buy flow (frontend) | Call `/buy`, display success message, refresh `/wallet`. |
|13 | Implement “My Collection” page | Fetch `/wallet`, show purchased items with images. |
|14 | Add loading states and error states | Skeletons/loader components for Market & Wallet, user-friendly error messages. |
|15 | Add simple notifications / popups | Show success/failure popups after buy operations; use Telegram MainButton if needed. |
|16 | Minimal Profile page | Show Telegram user info (from initData), maybe fake balance for MVP. |
|17 | Add minimal server-side logging | Log API errors and buy actions in Worker logs. |
|18 | Add basic rate limiting (optional) | Protect `/buy` from spam (simple in-memory or KV-based limiter). |
|19 | Final UI polish for MVP | Consistent spacing, mobile layout, Telegram theme adaptation. |
|20 | Prepare demo content | Add a few nice sample images to R2, make the Market visually appealing. |
