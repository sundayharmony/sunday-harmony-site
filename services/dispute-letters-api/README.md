# Dispute Letters API (Railway)

Python FastAPI service for Cursor AI credit report analysis and dispute letter generation.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CURSOR_API_KEY` | Yes | Cursor agent API key for report analysis |
| `DISPUTE_LETTERS_API_SECRET` | Yes | Shared secret with Vercel (Bearer token) |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key for DB + storage |
| `DISPUTE_CORS_ORIGINS` | No | Comma-separated allowed origins |
| `PORT` | No | Set by Railway (default 8000) |

## Local development

```powershell
cd services/dispute-letters-api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:CURSOR_API_KEY="..."
$env:DISPUTE_LETTERS_API_SECRET="dev-secret"
$env:SUPABASE_URL="..."
$env:SUPABASE_SERVICE_ROLE_KEY="..."
uvicorn app.main:app --reload --port 8000
```

## Railway deploy

1. Create a Railway project from this repo with root directory `services/dispute-letters-api`
2. Set env vars above
3. Copy the public URL to Vercel as `DISPUTE_LETTERS_API_URL`

## Health check

`GET /health` → `{ "status": "ok" }`
