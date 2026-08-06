import os
import json
import httpx
from http.server import BaseHTTPRequestHandler


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length) if content_length else b"{}"

        try:
            payload = json.loads(body)
        except Exception:
            self._send(400, {"error": "JSON غير صالح"})
            return

        messages = payload.get("messages", [])
        api_key = os.environ.get("AGENTROUTER_API_KEY", "")
        model = os.environ.get("AGENTROUTER_MODEL", "opus-5")
        base_url = os.environ.get("AGENTROUTER_BASE_URL", "https://agentrouter.org")
        api_path = os.environ.get("AGENTROUTER_API_PATH", "/v1/messages")

        if not api_key:
            self._send(500, {"error": "مفتاح API غير مضبوط (AGENTROUTER_API_KEY)"})
            return

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "claude-cli/2.1.158 (external, sdk-cli)",
            "anthropic-version": "2023-06-01",
            "anthropic-beta": "claude-code-20250219,interleaved-thinking-2025-05-14,effort-2025-11-24,redact-thinking-2026-02-12",
            "anthropic-dangerous-direct-browser-access": "true",
            "x-app": "cli",
        }

        data = {"model": model, "max_tokens": 1024, "messages": messages}

        try:
            resp = httpx.post(
                f"{base_url}{api_path}",
                headers=headers,
                json=data,
                timeout=60,
                http2=True,
                follow_redirects=True,
            )
            text = resp.text
            content_type = resp.headers.get("content-type", "")

            if resp.status_code != 200 or "json" not in content_type.lower() or not text.lstrip().startswith(("{", "[")):
                self._send(502, {
                    "error": text[:500] if text else "تعذر الوصول إلى AgentRouter",
                    "detail": "AgentRouter returned a non-JSON response (likely WAF/captcha block)",
                })
                return

            self._send(200, resp.json())
        except Exception as e:
            self._send(500, {"error": str(e)})

    def _send(self, status, data):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))
