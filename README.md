# Derja Ai — Vercel

Mobile-first dark chat UI for Derja Ai, backed by a Python serverless function.

## Deploy on Vercel

1. Unzip and import the folder into Vercel (or push to a GitHub repo and import it).
2. In Vercel dashboard → Project Settings → Environment Variables, add:
   - `AGENTROUTER_API_KEY` = your agentrouter.org API key
   - `AGENTROUTER_MODEL` = `opus-5` (or whichever model you want)
3. Deploy.

The frontend is in `public/`. The API endpoint `/api/chat` is handled by `api/main.py` via a rewrite in `vercel.json`.

## Notes

- AgentRouter may block some server IPs with an Aliyun WAF/captcha page. If Vercel’s IP is blocked, try another region/provider or ask AgentRouter to whitelist it.
