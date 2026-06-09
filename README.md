# Prasanna Digital Twin

A personal AI agent powered by Claude. Chat interface with persistent memory that syncs across devices.

---

## What's in this repo

| File | Purpose |
|---|---|
| `index.html` | Full chat UI — file upload, memory panel, typing indicators |
| `api/chat.js` | Vercel serverless function — proxies Anthropic API, reads/writes memory to Vercel KV |
| `vercel.json` | Routes `/api/*` to the serverless function |
| `package.json` | Dependencies: `@anthropic-ai/sdk`, `@vercel/kv` |

---

## Deploy in 5 steps

### 1. Push to GitHub

Create a new GitHub repo and push this folder:

```bash
cd prasanna-digital-twin
git init
git add .
git commit -m "initial"
gh repo create prasanna-digital-twin --private --source=. --push
```

### 2. Install Vercel CLI and connect

```bash
npm i -g vercel
vercel login
vercel link   # follow prompts, link to new project
```

### 3. Add environment variables

Go to **vercel.com → your project → Settings → Environment Variables** and add:

| Variable | Where to get it |
|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `KV_REST_API_URL` | Vercel dashboard → Storage → your KV store → `.env.local` tab |
| `KV_REST_API_TOKEN` | Same place as above |

> **Don't have a KV store yet?** In the Vercel dashboard go to Storage → Create → KV (Upstash). Takes 30 seconds. Then copy the two env vars from the `.env.local` tab.

### 4. Deploy

```bash
vercel --prod
```

Vercel will install dependencies, build, and give you a URL like `https://prasanna-digital-twin.vercel.app`.

### 5. Open and test

- Visit the URL
- Send a message — confirm you get a reply
- Check **🧠 Memory** — after a few messages it should start learning
- Upload a `.csv` or `.xlsx` — it will analyse immediately

---

## How memory works

After each exchange, a background call to `/api/chat` (action: `extract`) asks Claude to pull out any concrete facts worth remembering. Those are stored in Vercel KV under the key `prasanna_twin_memories`. On the next page load they're fetched and injected into the system prompt.

Memory panel (top-right) lets you view, delete individual items, export as `.txt`, or clear all.

---

## Local dev

```bash
npm install
vercel dev   # starts local server at localhost:3000 with env vars from .vercel/
```

You'll need a `.env.local` with the three env vars for local dev.

---

## Troubleshooting

**"API error: authentication_error"** — `ANTHROPIC_API_KEY` is missing or wrong. Check Vercel env vars.

**Memory not persisting** — `KV_REST_API_URL` or `KV_REST_API_TOKEN` is missing. Go to Vercel Storage, make sure the KV store is connected to this project, then redeploy.

**File upload not working** — Make sure you're uploading `.xlsx`, `.xls`, or `.csv`. The XLSX library is loaded from CDN so you need an internet connection.
