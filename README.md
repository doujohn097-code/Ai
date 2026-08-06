# Derja Ai — Vercel

Mobile-first dark chat UI for Derja Ai, backed by a Python serverless function.

## Deploy on Vercel

1. Unzip and `cd` into this folder.
2. Run `vercel` (or import the folder from the Vercel dashboard).
3. In the Vercel dashboard → Project Settings → Environment Variables, add:
   - `AGENTROUTER_API_KEY` = your agentrouter.org API key
   - `AGENTROUTER_MODEL` = `opus-5` (or whichever model you want)
4. Redeploy if needed.

The frontend is served from `public/`, the API endpoint is `/api/chat`.

## Notes

- AgentRouter currently blocks server requests from some IPs with an Aliyun WAF/captcha page. If Vercel’s IP is blocked, try a different region or provider, or ask AgentRouter to whitelist the IP.
- The frontend sends requests to `/api/chat` relative to the same domain.
