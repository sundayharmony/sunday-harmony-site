# Deploy Dispute Letters API (Credit Intelligence analysis)

The Next.js site on Vercel **cannot** run this Python service (PDF ingest, OCR, SSE, Cursor analysis). Host it separately, then point Vercel at it.

## Free option: Render (recommended Railway replacement)

Render still offers a **Free** web service: no card required, sleeps after ~15 minutes idle, first analyze after idle can take 30–60s. 512 MB RAM — enough for most PDF reports; upgrade to Starter if the service is killed during OCR.

1. Open [Render Dashboard](https://dashboard.render.com/) → **New** → **Blueprint**.
2. Connect `sundayharmony/sunday-harmony-site` and apply [`render.yaml`](../../render.yaml) at the repo root.
   - Or **New Web Service** → this repo → **Root Directory** `services/dispute-letters-api` → runtime **Docker** → instance **Free**.
3. Set environment variables:

   | Variable | Value |
   |----------|-------|
   | `CURSOR_API_KEY` | Cursor API key used for report analysis |
   | `DISPUTE_LETTERS_API_SECRET` | Long random string (**same** value as Vercel) |
   | `SUPABASE_URL` | Supabase project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | Service role key |
   | `DISPUTE_CORS_ORIGINS` | `https://www.sundayharmony.com,https://sundayharmony.com,https://sunday-harmony-site.vercel.app` |

4. Deploy and copy the public URL (`https://dispute-letters-api-xxxx.onrender.com`).
5. In **Vercel** (Production + Preview):

   ```
   DISPUTE_LETTERS_API_URL=https://<your-render-host>
   DISPUTE_LETTERS_API_SECRET=<same secret as Render>
   ```

6. Redeploy Vercel **and** ensure Render auto-deploys from `main` (or manually redeploy). Then:

   ```bash
   curl https://<your-render-host>/health
   # {"status":"ok"}
   ```

   Analysis no longer uses SSE through Vercel. The site starts a background job on Render and polls session status until ready. First upload after idle may wait for a cold start (30–60s).

## Troubleshooting “Analyze stream ended unexpectedly”

That error was from the old SSE path. After this deploy, uploads use start+poll instead. If analysis still fails:

1. Confirm Render logs show `/internal/analyze/start` and no OOM kill.
2. Confirm Vercel `DISPUTE_LETTERS_API_URL` / `DISPUTE_LETTERS_API_SECRET` match Render.
3. Image-heavy Credit Hero PDFs may need a paid Render plan (more RAM for OCR).

## Other options

| Host | Cost | Notes |
|------|------|--------|
| **Render Free** | $0 | Easiest swap; sleeps when idle |
| **Google Cloud Run** | Free tier | More reliable; Google account + billing profile |
| **Railway Hobby** | Paid | What you used before the trial ended |
| **Vercel** | — | Not viable for this Python API |

## Local (no cloud host)

```bash
cd services/dispute-letters-api
python -m venv .venv
pip install -r requirements.txt
export CURSOR_API_KEY=...
export DISPUTE_LETTERS_API_SECRET=dev-secret
export SUPABASE_URL=...
export SUPABASE_SERVICE_ROLE_KEY=...
uvicorn app.main:app --reload --port 8000
```

Point local Next.js `DISPUTE_LETTERS_API_URL` at `http://127.0.0.1:8000`. This does **not** fix production uploads on sundayharmony.com.

## Docker smoke test

```bash
cd services/dispute-letters-api
docker build -t dispute-letters-api .
docker run -p 8000:8000 \
  -e CURSOR_API_KEY=... \
  -e DISPUTE_LETTERS_API_SECRET=dev-secret \
  -e SUPABASE_URL=... \
  -e SUPABASE_SERVICE_ROLE_KEY=... \
  dispute-letters-api
```
