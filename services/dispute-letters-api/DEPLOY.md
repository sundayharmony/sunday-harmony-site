# Deploy Dispute Letters API to Railway

## Prerequisites

- Railway account linked to GitHub
- Supabase migration `022` applied
- `CURSOR_API_KEY` from Cursor

## Steps

1. **New Railway service**
   - Root directory: `services/dispute-letters-api`
   - Builder: Dockerfile (see `railway.toml`)

2. **Environment variables** (Railway dashboard)

   | Variable | Value |
   |----------|-------|
   | `CURSOR_API_KEY` | Your Cursor API key |
   | `DISPUTE_LETTERS_API_SECRET` | Long random string (same as Vercel) |
   | `SUPABASE_URL` | From Supabase project settings |
   | `SUPABASE_SERVICE_ROLE_KEY` | Service role key |
   | `DISPUTE_CORS_ORIGINS` | `https://www.sundayharmony.com,https://sunday-harmony-site.vercel.app` |

3. **Deploy** and copy the public URL (e.g. `https://dispute-letters-api-production.up.railway.app`)

4. **Vercel** (Production + Preview)

   ```
   DISPUTE_LETTERS_API_URL=https://<railway-url>
   DISPUTE_LETTERS_API_SECRET=<same secret as Railway>
   ```

5. **Verify**

   ```bash
   curl https://<railway-url>/health
   # {"status":"ok"}

   curl https://<railway-url>/config
   # {"cursor_api_configured":true}
   ```

6. **Redeploy Vercel** after setting env vars.

## Local Docker test

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
