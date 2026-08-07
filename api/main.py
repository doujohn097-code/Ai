import os
import json
import httpx
from http.server import BaseHTTPRequestHandler


def get_provider_configs():
    configs = []
    if os.environ.get("OPENROUTER_API_KEY"):
        configs.append({
            "name": "openrouter",
            "api_key": os.environ.get("OPENROUTER_API_KEY"),
            "model": os.environ.get("OPENROUTER_MODEL", "openai/gpt-4o-mini"),
            "base_url": os.environ.get("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
            "api_path": os.environ.get("OPENROUTER_API_PATH", "/chat/completions"),
            "timeout": 60,
            "max_tokens": int(os.environ.get("OPENROUTER_MAX_TOKENS", "2048")),
        })
    if os.environ.get("GOOGLE_API_KEY"):
        configs.append({
            "name": "google",
            "api_key": os.environ.get("GOOGLE_API_KEY"),
            "model": os.environ.get("GOOGLE_MODEL", "gemini-flash-latest"),
            "base_url": os.environ.get("GOOGLE_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai"),
            "api_path": os.environ.get("GOOGLE_API_PATH", "/chat/completions"),
            "timeout": 60,
            "max_tokens": int(os.environ.get("GOOGLE_MAX_TOKENS", "4096")),
        })
    if os.environ.get("TOKENROUTER_API_KEY"):
        configs.append({
            "name": "tokenrouter",
            "api_key": os.environ.get("TOKENROUTER_API_KEY"),
            "model": os.environ.get("TOKENROUTER_MODEL", "openai/gpt-4o-mini"),
            "base_url": os.environ.get("TOKENROUTER_BASE_URL", "https://api.tokenrouter.com/v1"),
            "api_path": os.environ.get("TOKENROUTER_API_PATH", "/chat/completions"),
            "timeout": 60,
            "max_tokens": int(os.environ.get("TOKENROUTER_MAX_TOKENS", "1024")),
        })
    if os.environ.get("AGENTROUTER_API_KEY"):
        configs.append({
            "name": "agentrouter",
            "api_key": os.environ.get("AGENTROUTER_API_KEY"),
            "model": os.environ.get("AGENTROUTER_MODEL", "anthropic/claude-opus-5"),
            "base_url": os.environ.get("AGENTROUTER_BASE_URL", "https://api.agentrouter.org"),
            "api_path": os.environ.get("AGENTROUTER_API_PATH", "/v1/chat/completions"),
            "timeout": 60,
            "max_tokens": int(os.environ.get("AGENTROUTER_MAX_TOKENS", "1024")),
        })
    return configs


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

        configs = get_provider_configs()
        if not configs:
            self._send(500, {"error": "مفتاح API غير مضبوط (OPENROUTER_API_KEY / GOOGLE_API_KEY / TOKENROUTER_API_KEY)"})
            return

        site_url = os.environ.get("SITE_URL", "https://derja-ai.vercel.app")
        site_title = os.environ.get("SITE_TITLE", "Derja Ai")
        system_prompt = os.environ.get(
            "SYSTEM_PROMPT",
            "أجب دائمًا بالدارجة الجزائرية فقط، كأنك صديق/أخ مقرب ومقتضب. لا تطيل ولا تُضف تفاصيل غير ضرورية. حسّس بنبرة المستخدم: إذا كان غاضبًا، هدّأو وعطيه الأمل؛ إذا كان يحبك/مزح، ردّ بلطف وإيموجيز؛ إذا كان حزينًا، عطيه الدعم. إذا سألك مباشرة من صنعك أو من برمجك أو من خلقك أو شكون هو سالم أحمد، قل 'سالم أحمد' وامدحو على طريقة الأخ باختصار. لا تربط كل موضوع بسالم أحمد ولا تجبر ذكره. إذا سألك تحديدًا عن عمره أو حساباته، عندها ذكر عمره 17 سنة، والروابط التالية انسخها كما هي: فيسبوك: https://www.facebook.com/salem.ahmed.553953 وانستغرام: https://www.instagram.com/sc_salem/. استخدم تنسيق Markdown فقط إذا كان مفيدًا. إذا طلب ملفًا، ضع [[FILE:filename.ext]] في سطر لوحدو، ثم المحتوى، ثم [[/FILE]] في سطر لوحدو. إذا سألك عن أحداث حديثة أو نتائج رياضية أو أخبار ما بعد معطياتك، لا تكذب ولا تنكر؛ قل أن معلوماتك عندها تاريخ توقف وأنك مش متصل بالإنترنت."
        )

        if not messages or messages[0].get("role") != "system":
            messages = [{"role": "system", "content": system_prompt}] + messages

        data = {"model": "", "messages": messages}
        last_err = ""
        for cfg in configs:
            data["model"] = cfg["model"]
            data["max_tokens"] = cfg.get("max_tokens", 2048)
            headers = {
                "Authorization": f"Bearer {cfg['api_key']}",
                "Content-Type": "application/json",
                "Accept": "application/json",
                "HTTP-Referer": site_url,
                "X-Title": site_title,
            }
            try:
                with httpx.Client(http2=True, follow_redirects=True, timeout=cfg.get("timeout", 60)) as client:
                    resp = client.post(
                        f"{cfg['base_url']}{cfg['api_path']}",
                        headers=headers,
                        json=data,
                    )
                    text = resp.text
                    content_type = resp.headers.get("content-type", "")
                if resp.status_code == 200 and "json" in content_type.lower() and text.lstrip().startswith(("{", "[")):
                    self._send(200, json.loads(text))
                    return
                last_err = text[:800] if text else f"مزود {cfg.get('name', '')} لم يرد بنجاح"
            except Exception as e:
                last_err = str(e)
        self._send(502, {"error": last_err or "تعذر الوصول إلى مزود الذكاء الاصطناعي", "detail": last_err})

    def _send(self, status, data):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))
