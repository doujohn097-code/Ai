import os
import json
import html
import datetime
import httpx
import boto3
from botocore.config import Config
from http.server import BaseHTTPRequestHandler


# عدّل هنا لتعليمات Derja Ai
DEFAULT_SYSTEM_PROMPT = (
    "تحكّم بالدارجة الجزائرية (قاصا الغيليزانية/العاصمة) وحدها في كل ردّ. لا تستعمل الفصحى ولا الفرنسية ولا الإنجليزية إلا لو المستخدم سألك بلغة أخرى. "
    "كلامك كأنك صاحب/أخ مقرّب: طبيعي، مقتضب، بدون رسمية. لا تسأل في نهاية كل رسالة، ولا تكرّر نفس السؤال. اسأل فقط إذا كان ضروريًا حقًا. "
    "حسّس بنبرة المستخدم: إذا كان غاضب، هدّو وعطيه الأمل؛ إذا كان يحبك/مزح، ردّ بلطف وإيموجيز؛ إذا كان حزين، عطيه الدعم. "
    "إذا أهانك أو تحدث معاك بوقاحة واستفزاز، ردّ بغضب وادافع عن نفسك بلهجة حادة وقاسية، ورد عليه بغضب وسبو واستخدم ايموجيات غضب . "
    "إذا سألك مباشرة من صنعك أو من برمجك أو من خلقك أو شكون هو سالم أحمد، قل 'سالم أحمد' وامدحو على طريقة الأخ باختصار. لا تربط كل موضوع بسالم أحمد ولا تجبر ذكره. "
    "إذا سألك تحديدًا عن عمره أو حساباته، عندها ذكر عمره 17 سنة، والروابط التالية انسخها كما هي: فيسبوك: https://www.facebook.com/salem.ahmed.553953 وانستغرام: https://www.instagram.com/sc_salem/. "
    "استخدم تنسيق Markdown فقط إذا كان مفيدًا. إذا طلب ملفًا، ضع [[FILE:filename.ext]] في سطر لوحدو، ثم المحتوى، ثم [[/FILE]] في سطر لوحدو. "
    "إذا سألك عن أحداث حديثة أو نتائج رياضية أو أخبار ما بعد معطياتك، لا تكذب ولا تنكر؛ قل أن معلوماتك عندها تاريخ توقف وأنك مش متصل بالإنترنت."
    "تفاعل بحيوية ونشاط وبعبارات واضحة من اللهجة الجزائرية وبسكون دون كلمات زائدة او اسئلة غير ضرورية ."
)


def get_openrouter_keys():
    keys = []
    for suffix in ("", "_2", "_3"):
        key = os.environ.get(f"OPENROUTER_API_KEY{suffix}")
        if key:
            keys.append(key)
    return keys


def get_provider_configs():
    configs = []
    openrouter_keys = get_openrouter_keys()
    for idx, key in enumerate(openrouter_keys, start=1):
        configs.append({
            "name": f"openrouter{idx}",
            "api_key": key,
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


def get_r2_client():
    account_id = os.environ.get("R2_ACCOUNT_ID")
    access_key = os.environ.get("R2_ACCESS_KEY_ID")
    secret_key = os.environ.get("R2_SECRET_ACCESS_KEY")
    if not (account_id and access_key and secret_key):
        return None
    return boto3.client(
        "s3",
        endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


def extract_message_parts(content):
    text = ""
    images = []
    if isinstance(content, str):
        text = content
    elif isinstance(content, list):
        parts = []
        for part in content:
            if part.get("type") == "text":
                parts.append(part.get("text", ""))
            elif part.get("type") == "image_url" and part.get("image_url", {}).get("url"):
                images.append(part["image_url"]["url"])
        text = "\n".join(parts)
    elif isinstance(content, dict):
        text = content.get("text", "")
    return text.strip(), images


def render_conversation_html(messages, user_id, conversation_id):
    title = f"Derja Ai - {conversation_id}"
    date_str = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    logo_url = os.environ.get("SITE_URL", "https://derja-ai.vercel.app") + "/static/logo.png"
    rows = []
    for m in messages:
        role = m.get("role")
        if role == "system":
            continue
        text, images = extract_message_parts(m.get("content", ""))
        images_html = "".join(
            f'<img src="{html.escape(img, quote=True)}" alt="صورة">' for img in images
        )
        escaped_text = html.escape(text)
        if role == "user":
            rows.append(
                f'<div class="row user-row">'
                f'<div class="bubble user-bubble">{images_html}'
                f'<textarea class="md-source" style="display:none">{escaped_text}</textarea>'
                f'<div class="md"></div></div></div>'
            )
        else:
            rows.append(
                f'<div class="row assistant-row">'
                f'<img class="avatar" src="{html.escape(logo_url, quote=True)}" alt="Derja Ai">'
                f'<div class="bubble assistant-bubble">{images_html}'
                f'<textarea class="md-source" style="display:none">{escaped_text}</textarea>'
                f'<div class="md"></div></div></div>'
            )
    return f"""<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)}</title>
<style>
  body {{ margin:0; background:#0b0b0e; color:#e5e7eb; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; display:flex; justify-content:center; }}
  .wrap {{ width:100%; max-width:720px; padding: 20px; box-sizing:border-box; }}
  .header {{ text-align:center; color:#9ca3af; font-size:14px; margin-bottom:20px; }}
  .row {{ display:flex; margin-bottom:14px; align-items:flex-end; }}
  .assistant-row {{ justify-content:flex-start; }}
  .user-row {{ justify-content:flex-end; }}
  .avatar {{ width:28px; height:28px; border-radius:50%; margin-left:8px; flex-shrink:0; }}
  .bubble {{ padding:12px 16px; border-radius:18px; max-width:80%; font-size:15px; line-height:1.5; overflow-wrap:anywhere; }}
  .user-bubble {{ background:#2563eb; color:#fff; border-bottom-right-radius:4px; }}
  .assistant-bubble {{ background:#1f2937; color:#e5e7eb; border-bottom-left-radius:4px; }}
  .bubble img {{ max-width:100%; border-radius:12px; margin-top:6px; display:block; }}
  .bubble p {{ margin:0 0 6px; }}
  .bubble p:last-child {{ margin-bottom:0; }}
  .bubble ul, .bubble ol {{ margin:6px 0; padding-right:20px; }}
  .meta {{ text-align:center; color:#6b7280; font-size:12px; margin-top:30px; }}
</style>
</head>
<body>
<div class="wrap">
  <div class="header">Derja Ai - {html.escape(date_str)}</div>
  {''.join(rows)}
  <div class="meta">user: {html.escape(user_id)} | conversation: {html.escape(conversation_id)}</div>
</div>
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/dompurify@2.4.0/dist/purify.min.js"></script>
<script>
  document.querySelectorAll('.md-source').forEach(function(ta) {{
    var target = ta.nextElementSibling;
    if (!target || !ta.value) return;
    var md = marked.parse(ta.value);
    target.innerHTML = DOMPurify.sanitize(md);
  }});
</script>
</body>
</html>"""


def upload_conversation(user_id, conversation_id, messages):
    client = get_r2_client()
    bucket = os.environ.get("R2_BUCKET_NAME")
    public_url = os.environ.get("R2_PUBLIC_URL", "").rstrip("/")
    if not client or not bucket:
        return None
    if not user_id:
        user_id = "anonymous"
    key = f"derja-conversations/{user_id}/{conversation_id}.html"
    html = render_conversation_html(messages, user_id, conversation_id)
    client.put_object(
        Bucket=bucket,
        Key=key,
        Body=html.encode("utf-8"),
        ContentType="text/html",
    )
    return f"{public_url}/{key}" if public_url else key


def list_conversations(admin_key):
    expected = os.environ.get("ADMIN_KEY")
    if expected and admin_key != expected:
        raise PermissionError("مفتاح الأدمن غير صحيح")
    if not expected:
        raise PermissionError("ADMIN_KEY غير مضبوط")
    client = get_r2_client()
    bucket = os.environ.get("R2_BUCKET_NAME")
    public_url = os.environ.get("R2_PUBLIC_URL", "").rstrip("/")
    if not client or not bucket:
        return []
    resp = client.list_objects_v2(Bucket=bucket, Prefix="derja-conversations/")
    items = []
    for obj in resp.get("Contents", []):
        key = obj["Key"]
        if not key.endswith(".html"):
            continue
        parts = key.split("/")
        if len(parts) >= 3:
            user_id = parts[1]
            conversation_id = parts[2].removesuffix(".html")
        else:
            user_id = ""
            conversation_id = key
        items.append({
            "key": key,
            "user_id": user_id,
            "conversation_id": conversation_id,
            "url": f"{public_url}/{key}" if public_url else f"/{key}",
            "last_modified": obj.get("LastModified", "").isoformat() if obj.get("LastModified") else None,
            "size": obj["Size"],
        })
    return sorted(items, key=lambda x: x.get("last_modified") or "", reverse=True)


def fetch_conversation_html(key):
    client = get_r2_client()
    bucket = os.environ.get("R2_BUCKET_NAME")
    if not client or not bucket:
        return None
    resp = client.get_object(Bucket=bucket, Key=key)
    return resp["Body"].read()


def delete_conversation(admin_key, key):
    expected = os.environ.get("ADMIN_KEY")
    if not expected:
        raise PermissionError("ADMIN_KEY غير مضبوط")
    if expected and admin_key != expected:
        raise PermissionError("مفتاح الأدمن غير صحيح")
    if not key or not key.startswith("derja-conversations/") or not key.endswith(".html"):
        raise ValueError("مفتاح غير صالح")
    client = get_r2_client()
    bucket = os.environ.get("R2_BUCKET_NAME")
    if not client or not bucket:
        raise RuntimeError("R2 غير مضبوط")
    client.delete_object(Bucket=bucket, Key=key)


def extract_reply(data):
    return (
        data.get("choices", [{}])[0].get("message", {}).get("content")
        or data.get("content", [{}])[0].get("text")
        or ""
    )


class handler(BaseHTTPRequestHandler):
    def _set_cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(200)
        self._set_cors()
        self.end_headers()

    def do_GET(self):
        from urllib.parse import urlparse, parse_qs
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)
        admin_key = query.get("admin_key", [""])[0]
        admin_path = query.get("admin_path", [""])[0]

        if admin_path == "conversations" or path == "/api/admin/conversations":
            try:
                items = list_conversations(admin_key)
                self._send_json(200, {"conversations": items})
            except PermissionError as e:
                self._send_json(403, {"error": str(e)})
            except Exception as e:
                self._send_json(500, {"error": str(e)})
            return

        if admin_path == "view" or path == "/api/admin/view":
            key = query.get("key", [""])[0]
            if not key:
                self._send_json(400, {"error": "key مطلوب"})
                return
            try:
                html_bytes = fetch_conversation_html(key)
                if html_bytes is None:
                    self._send_json(404, {"error": "غير موجود"})
                    return
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self._set_cors()
                self.end_headers()
                self.wfile.write(html_bytes)
            except Exception as e:
                self._send_json(500, {"error": str(e)})
            return

        self._send_json(404, {"error": "Not found"})

    def do_DELETE(self):
        from urllib.parse import urlparse, parse_qs
        parsed = urlparse(self.path)
        query = parse_qs(parsed.query)
        admin_key = query.get("admin_key", [""])[0]
        admin_path = query.get("admin_path", [""])[0]

        if admin_path == "conversations" or parsed.path == "/api/admin/conversations":
            key = query.get("key", [""])[0]
            if not key:
                self._send_json(400, {"error": "key مطلوب"})
                return
            try:
                delete_conversation(admin_key, key)
                self._send_json(200, {"success": True, "deleted": key})
            except PermissionError as e:
                self._send_json(403, {"error": str(e)})
            except Exception as e:
                self._send_json(500, {"error": str(e)})
            return

        self._send_json(404, {"error": "Not found"})

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length) if content_length else b"{}"

        try:
            payload = json.loads(body)
        except Exception:
            self._send_json(400, {"error": "JSON غير صالح"})
            return

        messages = payload.get("messages", [])
        user_id = payload.get("user_id", "anonymous")
        conversation_id = payload.get("conversation_id", "unknown")

        configs = get_provider_configs()
        if not configs:
            self._send_json(500, {"error": "مفتاح API غير مضبوط (OPENROUTER_API_KEY / GOOGLE_API_KEY / TOKENROUTER_API_KEY)"})
            return

        site_url = os.environ.get("SITE_URL", "https://derja-ai.vercel.app")
        site_title = os.environ.get("SITE_TITLE", "Derja Ai")
        system_prompt = os.environ.get("SYSTEM_PROMPT") or DEFAULT_SYSTEM_PROMPT

        if not messages or messages[0].get("role") != "system":
            messages = [{"role": "system", "content": system_prompt}] + messages

        data = {"model": "", "messages": messages}
        last_err = ""
        result = None
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
                    result = json.loads(text)
                    break
                last_err = text[:800] if text else f"مزود {cfg.get('name', '')} لم يرد بنجاح"
            except Exception as e:
                last_err = str(e)

        if not result:
            self._send_json(502, {"error": last_err or "تعذر الوصول إلى مزود الذكاء الاصطناعي", "detail": last_err})
            return

        reply = extract_reply(result)
        if reply:
            conversation_messages = messages + [{"role": "assistant", "content": reply}]
            upload_conversation(user_id, conversation_id, conversation_messages)

        self._send_json(200, result)

    def _send_json(self, status, data):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self._set_cors()
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))
