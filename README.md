# Derja Ai — Vercel

Mobile-first dark chat UI for Derja Ai, backed by a Python serverless function.

## Deploy on Vercel

1. Unzip and import the folder into Vercel (or push to a GitHub repo and import it).
2. In Vercel dashboard → Project Settings → Environment Variables, add:
   - `OPENROUTER_API_KEY` = your OpenRouter key
   - `OPENROUTER_MODEL` = `anthropic/claude-opus-5` (or any model from OpenRouter)
3. Deploy.

The frontend is in `public/`. The API endpoint `/api/chat` is handled by `api/main.py` via a rewrite in `vercel.json`.

## Notes

- The project defaults to OpenRouter (`https://openrouter.ai/api/v1`) because AgentRouter blocks shared server IPs with a WAF/captcha page.
- You can still override the provider with `OPENROUTER_BASE_URL` / `OPENROUTER_API_PATH` or the legacy `AGENTROUTER_*` variables.
