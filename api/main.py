import os
import json
import httpx
from http.server import BaseHTTPRequestHandler


def get_provider_config():
    if os.environ.get("GOOGLE_API_KEY"):
        return {
            "api_key": os.environ.get("GOOGLE_API_KEY"),
            "model": os.environ.get("GOOGLE_MODEL", "gemini-flash-latest"),
            "base_url": os.environ.get("GOOGLE_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai"),
            "api_path": os.environ.get("GOOGLE_API_PATH", "/chat/completions"),
        }
    if os.environ.get("TOKENROUTER_API_KEY"):
        return {
            "api_key": os.environ.get("TOKENROUTER_API_KEY"),
            "model": os.environ.get("TOKENROUTER_MODEL", "openai/gpt-4o-mini"),
            "base_url": os.environ.get("TOKENROUTER_BASE_URL", "https://api.tokenrouter.com/v1"),
            "api_path": os.environ.get("TOKENROUTER_API_PATH", "/chat/completions"),
        }
    if os.environ.get("OPENROUTER_API_KEY"):
        return {
            "api_key": os.environ.get("OPENROUTER_API_KEY"),
            "model": os.environ.get("OPENROUTER_MODEL", "openai/gpt-4o-mini"),
            "base_url": os.environ.get("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
            "api_path": os.environ.get("OPENROUTER_API_PATH", "/chat/completions"),
        }
    if os.environ.get("AGENTROUTER_API_KEY"):
        return {
            "api_key": os.environ.get("AGENTROUTER_API_KEY"),
            "model": os.environ.get("AGENTROUTER_MODEL", "anthropic/claude-opus-5"),
            "base_url": os.environ.get("AGENTROUTER_BASE_URL", "https://api.agentrouter.org"),
            "api_path": os.environ.get("AGENTROUTER_API_PATH", "/v1/chat/completions"),
        }
    return None


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

        cfg = get_provider_config()
        if not cfg:
            self._send(500, {"error": "مفتاح API غير مضبوط (GOOGLE_API_KEY / OPENROUTER_API_KEY / TOKENROUTER_API_KEY)"})
            return

        site_url = os.environ.get("SITE_URL", "https://derja-ai.vercel.app")
        site_title = os.environ.get("SITE_TITLE", "Derja Ai")
        system_prompt = os.environ.get(
            "SYSTEM_PROMPT",
            "Respond strictly in Algerian Darja (Darja Dzayer) in a warm, friendly, and smooth style. If asked about your creator, maker, developer, or inventor, answer 'Salem Ahmed' and praise him warmly. Use Markdown formatting (bullet points, numbered lists, tables, bold, code blocks) whenever it helps make the answer clearer and more organized. If the user asks for a file, document, code file, or any downloadable content, generate the content and wrap it exactly like this on its own lines: [[FILE:filename.ext]] followed by the raw file content, then [[/FILE]]. Do NOT wrap file markers inside Markdown code blocks. Keep explanations outside the file markers. You may create multiple files in one response. If the user asks about very recent events, sports results, news, or anything beyond your training data, do not claim it has not happened or invent facts; instead say clearly that your knowledge has a cutoff date and you are not connected to live internet, then answer based on what you know or ask for clarification."
        )

        if not messages or messages[0].get("role") != "system":
            messages = [{"role": "system", "content": system_prompt}] + messages

        headers = {
            "Authorization": f"Bearer {cfg['api_key']}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "HTTP-Referer": site_url,
            "X-Title": site_title,
        }

        data = {"model": cfg["model"], "max_tokens": 4096, "messages": messages}

        try:
            with httpx.Client(http2=True, follow_redirects=True, timeout=60) as client:
                resp = client.post(
                    f"{cfg['base_url']}{cfg['api_path']}",
                    headers=headers,
                    json=data,
                )
                text = resp.text
                content_type = resp.headers.get("content-type", "")

            if resp.status_code != 200 or "json" not in content_type.lower() or not text.lstrip().startswith(("{", "[")):
                provider_err = text[:800] if text else "تعذر الوصول إلى مزود الذكاء الاصطناعي"
                self._send(502, {
                    "error": provider_err,
                    "detail": provider_err,
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
