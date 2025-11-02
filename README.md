# Gemini Agent Chat Bot

A TypeScript + Node.js Express service that wraps the Google Gemini API to provide a simple chat/agent endpoint, with JWT helpers, role/permission guards, and a small bootstrap for clean route registration.

> Repo: https://github.com/secretMan255/gemini_agent_chat_bot

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Scripts](#scripts)
- [Run](#run)
- [API](#api)
- [Development Notes](#development-notes)
- [License](#license)

## Overview
This service exposes HTTP endpoints (e.g. `/agent/general`) that call Google Gemini models (e.g. `gemini-2.0-flash`) through the official `@google/generative-ai` SDK. It also includes a simple framework-style wrapper (`ApiExpress`) for initializing Express, registering routes with auth/role guards, and graceful shutdown.

## Features
- **Express + TypeScript** with strict config and clean module boundaries.
- **Gemini client** via `@google/generative-ai`, key from `GEMINI_API_KEY`.
- **Auth helpers**: JWT signing/verification (`jsonwebtoken`).
- **Role/Permission guards**: middlewares like `roleAny`, `permAny`, `permAll`.
- **Unified response wrapper**: consistent JSON shape with `{ ret, data | msg }`.
- **CORS & cookies** via `cors`/`cookie-parser`.
- **Graceful shutdown**: `server.close()` on SIGINT/SIGTERM.

## Project Structure
> Key files may look like this (based on the repo and shared code):
```
.
├─ src/
│  ├─ service.ts                # Entry: boot ApiExpress, mount controllers
│  ├─ app.service.ts            # App-level bootstrap helpers
│  ├─ express.ts                # ApiExpress: init/listen, JWT/cookie auth, route helpers
│  ├─ google.gen.ai.ts          # Gemini client wrapper
│  └─ model/
│     └─ agent/
│        ├─ agent.controller.ts # Register routes like POST /agent/general
│        ├─ agent.service.ts    # Calls Gemini, streams/aggregates chunks
│        └─ agent.joi.ts        # (optional) request schema validation
├─ tsconfig.json
├─ jest.config.js
├─ .eslintrc.cjs
├─ .prettierrc
└─ package.json
```

## Prerequisites
- Node.js 18+ (Node 20/22 recommended)
- npm
- A Google **Gemini API key** from Google AI Studio

## Installation
```bash
# clone
git clone https://github.com/secretMan255/gemini_agent_chat_bot.git
cd gemini_agent_chat_bot

# install deps
npm i
```

## Environment Variables
Create a `.env` file in the project root:
```
# Google Gemini
GEMINI_API_KEY=your_api_key_here

# HTTP
HOST=0.0.0.0
PORT=8080

# CORS
ALLOWED_ORIGINS=http://localhost:5173
CORS_CREDENTIALS=true

# JWT
JWT_SECRET=change_me
JWT_EXPIRES=1d        # e.g. '1d' | '7d' | '3600s'

# Cookie/JWT mode & security
TOKEN_MODE=cookie     # or 'token'
SECURE=false          # set true in production (HTTPS)
```

> The service loads env via `dotenv`. Ensure `.env` exists or export envs in your shell.

## Scripts
Common scripts in `package.json`:
```json
{
  "scripts": {
    "dev": "tsx watch src/service.ts",
    "build": "tsc",
    "start": "node dist/service.js",
    "test": "jest",
    "lint": "eslint . --ext .ts",
    "fmt": "prettier -w .",
    "clean": "rimraf dist"
  }
}
```

If you don’t use `rimraf`, replace `clean` with `rm -rf dist` on Linux/macOS.

## Run
**Development (hot reload):**
```bash
npm run dev
```

**Production build & run:**
```bash
npm run build
npm start
```

You should see something like:
```
HTTP running at http://0.0.0.0:8080
```

## API
### POST `/agent/general`
A general chat/agent endpoint that forwards your prompt to Gemini and returns structured output.

**Request Body (JSON)**
```json
{
  "prompt": "Explain how AI works in a few words",
  "context": "optional extra context ...",
  "params": {
    "model": "gemini-2.0-flash"
  }
}
```

> Exact shape may vary with your `agent.joi.ts` schema. The controller calls `AgentService.GeneralAgent`, which aggregates streaming chunks from Gemini into a final `thoughts` summary and an `answer` (based on the provided code).

**Response (JSON)**
```json
{
  "ret": 0,
  "data": {
    "thoughts": "…model reasoning summary…",
    "answer": "…final answer text…"
  }
}
```
- On validation errors, it returns `{ ret: -1, msg: "…" }` with status 400.
- On internal errors, it returns `{ ret: -1, msg: "Internal Server Error" }` with status 500.

### Health Check
```
GET /ping
→ { "ok": true }
```

## Development Notes
- **Auth**: You can protect routes with `Auth.Bearer` or `Auth.Cookie`. Use helpers like `ApiExpress.generateToken()` to issue JWTs. Attach middlewares `permAny/permAll/roleAny` where needed.
- **CORS**: For development, you can set `origin: '*'`. In production, prefer a whitelist derived from `ALLOWED_ORIGINS`.
- **Shutdown**: The service traps `SIGINT`/`SIGTERM` and invokes `ApiExpress.terminate()` to close the HTTP server gracefully.
- **Model**: Default is `gemini-2.0-flash`, but you can change via request payload or configuration.
- **TypeScript**: `module/moduleResolution` set to `NodeNext`; `"type": "module"` in `package.json` is recommended for ESM.

## License
MIT (or your preferred license).

---

### Quickstart
```bash
git clone https://github.com/secretMan255/gemini_agent_chat_bot.git
cd gemini_agent_chat_bot
cp .env.example .env   # if present; otherwise create manually
npm i
npm run dev
```
