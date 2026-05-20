# WarzoneWarriors Frontend

This repository is the React + Vite frontend for the WarzoneWarriors experience. It integrates with the 0G-backed API at `https://zerog-warzonewarriors.onrender.com`.

## Getting Started

### Install dependencies

```bash
npm install
```

### Run locally

```bash
npm run dev
```

Open the site in your browser at the URL shown by Vite (typically `http://localhost:5173`).

### Build and preview production output

```bash
npm run build
npm run preview
```

Use `npm run preview` after `npm run build` to run the production build locally.

## Game Build / Runtime Notes

The game build is loaded via an iframe in the React app. The app currently appends a `walletAddress` query parameter when a wallet is present, but all authenticated 0G backend routes require a JWT bearer token.

If you open the standalone game build directly or integrate a custom Unity/WebGL build, make sure to:

- authenticate through `POST /auth/login` using the wallet signature flow
- store the returned JWT token
- send `Authorization: Bearer <JWT>` for protected routes such as:
  - `POST /player/save/binary`
  - `GET /player/load/binary`
  - `GET /player/profile`
  - `PATCH /player/profile`
  - `GET /player/history`
  - `GET /player/sessions`
  - `GET /player/blockchain-stats`
  - `GET /0g/dashboard`
  - `GET /0g/activity`
  - `GET /0g/badge`
  - `GET /0g/player/history`

> Important: do not send `walletAddress` in place of a JWT token for authenticated requests. The token must be sent in the `Authorization` header.

### Custom game URL

The embedded game URL can be overridden with an environment variable:

```bash
VITE_CLOUDFLARE_R2_GAME_URL=https://your-game-url.example.com/index.html
```

## API Base URL

The frontend uses:

```ts
https://zerog-warzonewarriors.onrender.com
```

This can also be overridden with `VITE_API_ORIGIN` in your environment.

## JWT Authentication Flow

1. Request a nonce from `/auth/nonce?wallet=<walletAddress>`.
2. Sign the returned message with the wallet.
3. Send `wallet`, `signature`, and `nonce` to `/auth/login`.
4. Store the returned `token` locally.
5. Use `Authorization: Bearer <JWT>` for authenticated API requests.

## Running a Game Build

To run the game build, use the frontend's normal Vite commands and then load the `Game` or `Game2` route in the app. If you are loading a standalone game build, make sure the game has access to the JWT and uses it for backend API requests rather than using only the wallet address.

If you need to ship a build artifact for testing, build the app with:

```bash
npm run build
```

then serve it with:

```bash
npm run preview
```

## Notes

- The current React app stores `walletAddress` and `token` in `localStorage`.
- Protected API calls are routed through `src/api/zerog.ts` and attach the bearer token where required.
- Public read-only API routes such as `/0g/stats`, `/0g/network`, and `/player/leaderboard` do not require authentication.
