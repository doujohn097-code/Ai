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

        api_key = os.environ.get("OPENROUTER_API_KEY") or os.environ.get("AGENTROUTER_API_KEY", "")
        model = os.environ.get("OPENROUTER_MODEL") or os.environ.get("AGENTROUTER_MODEL", "anthropic/claude-opus-5")
        base_url = os.environ.get("OPENROUTER_BASE_URL") or os.environ.get("AGENTROUTER_BASE_URL", "https://openrouter.ai/api/v1")
        api_path = os.environ.get("OPENROUTER_API_PATH") or os.environ.get("AGENTROUTER_API_PATH", "/chat/completions")
        site_url = os.environ.get("SITE_URL", "https://derja-ai.vercel.app")
        site_title = os.environ.get("SITE_TITLE", "Derja Ai")

        if not api_key:
            self._send(500, {"error": "مفتاح API غير مضبوط (OPENROUTER_API_KEY)"})
            return

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "HTTP-Referer": site_url,
            "X-Title": site_title,
        }

        data = {"model": model, "max_tokens": 1024, "messages": messages}

        try:
            with httpx.Client(http2=True, follow_redirects=True, timeout=60) as client:
                resp = client.post(
                    f"{base_url}{api_path}",
                    headers=headers,
                    json=data,
                )
                text = resp.text
                content_type = resp.headers.get("content-type", "")

            if resp.status_code != 200 or "json" not in content_type.lower() or not text.lstrip().startswith(("{", "[")):
                self._send(502, {
                    "error": text[:500] if text else "تعذر الوصول إلى مزود الذكاء الاصطناعي",
                    "detail": "المزود أرجع رداً غير JSON",
                })
                return

            self._send(200, json.loads(text))
        except Exception as e:
            self._send(500, {"error": str(e)})

    def _send(self, status, data):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))
