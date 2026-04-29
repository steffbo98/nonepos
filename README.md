# NonePOS

NonePOS is a desktop point-of-sale application built with Electron, React, TypeScript, Vite, Express, and SQLite.

It provides a local POS experience where the Electron shell runs a React renderer and an Express backend that stores data in a local `better-sqlite3` database.

## How the application works

- `src/main/index.ts` is the Electron entry point.
  - It initializes the local SQLite database.
  - It starts an Express server on `http://localhost:5000`.
  - It opens a browser window that loads the Vite frontend.
- `src/main/server.ts` exposes REST API endpoints under `/api` for:
  - auth, users
  - products
  - orders
  - customers
  - expenses
  - suppliers and purchases
  - settings
  - backups and reports
- `src/main/database.ts` creates and manages the local SQLite database file located in the app user data folder.
- `src/lib/dataService.ts` is the frontend API client.
  - The React UI calls this service to perform CRUD operations against the Electron backend.
- `src/lib/syncManager.ts` manages cloud sync state and queues local changes for remote replication.
- `src/main/preload.ts` exposes a small secure Electron bridge for window controls, file dialogs, and printing.

## Key features

- Desktop POS app with Electron
- Local database persistence using `better-sqlite3`
- Express backend for API routing
- React + Vite frontend
- Product, order, customer, expense, supplier, and purchase management
- User authentication and role support
- Local backups and restore support
- Window controls and native dialogs via Electron preload

## Project structure

- `src/main/` - Electron main process and backend server
- `src/lib/` - frontend services and utilities
- `src/pages/` - React pages for the app UI
- `src/App.tsx`, `src/main.tsx` - React application entry
- `scripts/` - Electron build helpers
- `release/` - generated Electron build artifacts

## Setup

### Prerequisites

- Node.js 18+ or compatible
- npm

### Install dependencies

```bash
npm install
```

## Run locally

### Run the renderer and backend together in development

```bash
npm run dev
```

This runs:
- `npm run dev:server` → `tsx watch src/main/index.ts`
- `npm run dev:renderer` → `vite`

### Start Electron in development

```bash
npm run electron-dev
```

### Build for production

```bash
npm run build
```

### Run Electron from built files

```bash
npm run electron
```

### Build installer for Windows

```bash
npm run electron-build:win
```

## Useful scripts

- `npm run build:renderer` — build Vite frontend
- `npm run build:server` — compile Electron main process TypeScript
- `npm run preview` — preview Vite production build
- `npm run lint` — type-check the project with `tsc`

## Notes

- The SQLite database file is stored in Electron's `app.getPath('userData')` location.
- In development, the app runs the frontend from Vite and the backend on `http://localhost:5000`.
- In production, Electron serves the built frontend and uses the same local Express API.

## Recommended workflow

1. Install dependencies.
2. Run `npm run dev` while developing the frontend.
3. Use `npm run electron-dev` to test the full Electron app.
4. Build with `npm run build` before packaging.

## License

This repository does not include a license file. Use it according to your own project requirements.
