"""
Saqr (الصقر) — Direct Supabase REST Client
بديل عن supabase-py لتجنب تعارضات pyiceberg مع Python 3.14

يستخدم httpx مباشرة مع Supabase REST API (PostgREST).
"""
import os
import httpx
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL", os.environ.get("VITE_SUPABASE_URL", ""))
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", os.environ.get("VITE_SUPABASE_ANON_KEY", ""))
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

# --- Telegram & AI ---
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY")
ADVISOR_TIMEOUT_SECONDS = int(os.environ.get("ADVISOR_TIMEOUT_SECONDS", "10"))
DB_TIMEOUT_SECONDS = int(os.environ.get("DB_TIMEOUT_SECONDS", "30"))

# ✅ FIX: رفعنا الـ MEETING_ROUND_TIMEOUT من 60 لـ 120 ثانية
# الجلسة فيها 8 جولات × كل جولة تاخد وقت — 60 ثانية مش كفاية
MEETING_ROUND_TIMEOUT = int(os.environ.get("MEETING_ROUND_TIMEOUT", "120"))

# ✅ FIX: رفعنا الـ GLOBAL_SESSION_TIMEOUT من 20 دقيقة لـ 40 دقيقة
# 8 جولات + data fetch + backtest = بيحتاج وقت أطول
GLOBAL_SESSION_TIMEOUT = int(os.environ.get("GLOBAL_SESSION_TIMEOUT", "2400"))

LOCAL_MODE: bool = not bool(SUPABASE_URL)

# أضف في أعلى الملف — client مشترك بدل فتح connection جديد كل مرة
_shared_http_client = httpx.Client(
    timeout=DB_TIMEOUT_SECONDS,
    limits=httpx.Limits(max_keepalive_connections=10, max_connections=20)
)

def execute(self):
    # استخدم _shared_http_client بدل فتح client جديد
    r = _shared_http_client.get(url, ...)

def _headers(service: bool = False) -> dict:
    key = SUPABASE_SERVICE_KEY if service else SUPABASE_KEY
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def _url(table: str) -> str:
    return f"{SUPABASE_URL}/rest/v1/{table}"


def _rpc_url(fn: str) -> str:
    return f"{SUPABASE_URL}/rest/v1/rpc/{fn}"


class SupabaseTable:
    def __init__(self, table: str, service: bool = False):
        self.table = table
        self.service = service
        self._params: dict = {}
        self._body = None
        self._method = "GET"
        self._not_next = False
        self._count = None
        self._upsert = False
        self._on_conflict = None
        self._single = False

    def _add_param(self, col: str, op: str, val):
        prefix = "not." if self._not_next else ""
        self._params[col] = f"{prefix}{op}.{val}"
        self._not_next = False
        return self

    def select(self, cols: str = "*", count: str = None):
        self._params["select"] = cols
        if count:
            self._count = count
        return self

    def eq(self, col: str, val):
        return self._add_param(col, "eq", val)

    def in_(self, col: str, vals: list):
        val_str = ",".join(str(v) for v in vals)
        return self._add_param(col, "in", f"({val_str})")

    def lt(self, col: str, val):
        return self._add_param(col, "lt", val)

    def gt(self, col: str, val):
        return self._add_param(col, "gt", val)

    def lte(self, col: str, val):
        return self._add_param(col, "lte", val)

    def gte(self, col: str, val):
        return self._add_param(col, "gte", val)

    def neq(self, col: str, val):
        return self._add_param(col, "neq", val)

    def is_(self, col: str, val: str):
        return self._add_param(col, "is", val)

    def not_(self):
        self._not_next = True
        return self

    def order(self, col: str, desc: bool = False):
        self._params["order"] = f"{col}.{'desc' if desc else 'asc'}"
        return self

    def limit(self, n: int):
        self._params["limit"] = str(n)
        return self

    def insert(self, data):
        self._method = "POST"
        self._body = data
        return self

    def update(self, data: dict):
        self._method = "PATCH"
        self._body = data
        return self

    def delete(self):
        self._method = "DELETE"
        return self

    def upsert(self, data, on_conflict: str = None):
        """Insert أو Update إذا موجود — يحل مشكلة التكرار."""
        self._method = "POST"
        self._body = data if isinstance(data, list) else [data]
        self._upsert = True
        self._on_conflict = on_conflict
        return self

    def single(self):
        """إرجاع نتيجة واحدة فقط — يرفع خطأ لو مفيش نتائج."""
        self._params["limit"] = "1"
        self._single = True
        return self

    def maybe_single(self):
        """إرجاع نتيجة واحدة أو None — بدون خطأ لو مفيش نتائج."""
        self._params["limit"] = "1"
        return self

    def execute(self):
        url = _url(self.table)
        headers = _headers(self.service)

        if self._count == "exact":
            headers["Prefer"] = "count=exact"

        with httpx.Client(timeout=DB_TIMEOUT_SECONDS) as client:
            if self._method == "GET":
                r = client.get(url, headers=headers, params=self._params)

            elif self._method == "POST":
                post_headers = headers.copy()
                if self._upsert:
                    prefer = "resolution=merge-duplicates,return=representation"
                    post_headers["Prefer"] = prefer
                    if self._on_conflict:
                        self._params["on_conflict"] = self._on_conflict
                r = client.post(url, headers=post_headers, json=self._body, params=self._params)

            elif self._method == "PATCH":
                r = client.patch(url, headers=headers, json=self._body, params=self._params)

            elif self._method == "DELETE":
                r = client.delete(url, headers=headers, params=self._params)

        if r.status_code >= 400:
            raise Exception(f"HTTP {r.status_code}: {r.text[:1000]}")

        result = r.json() if r.content else []

        if isinstance(result, dict) and "message" in result:
            raise Exception(result.get("message", "Unknown error"))

        count_val = None
        if self._count == "exact" and "Content-Range" in r.headers:
            cr = r.headers["Content-Range"]
            parts = cr.split("/")
            if len(parts) == 2 and parts[1].isdigit():
                count_val = int(parts[1])

        data_list = result if isinstance(result, list) else [result]

        if self._single:
            single_val = data_list[0] if data_list else None
            return type("Response", (), {
                "data": single_val, "error": None, "count": None
            })()

        return type("Response", (), {
            "data": data_list, "error": None, "count": count_val
        })()


class SupabaseRPC:
    def __init__(self, fn: str, params: dict, service: bool = False):
        self.fn = fn
        self.params = params
        self.service = service

    def execute(self):
        url = _rpc_url(self.fn)
        headers = _headers(self.service)
        with httpx.Client(timeout=DB_TIMEOUT_SECONDS) as client:
            r = client.post(url, headers=headers, json=self.params)
        if r.status_code >= 400:
            raise Exception(f"RPC HTTP {r.status_code}: {r.text[:300]}")
        data = r.json() if r.content else None
        return type("Response", (), {"data": data, "error": None})()


class SimpleSupabaseClient:
    def __init__(self, service: bool = False):
        self.service = service

    def table(self, name: str) -> SupabaseTable:
        return SupabaseTable(name, self.service)

    def rpc(self, fn: str, params: dict) -> SupabaseRPC:
        return SupabaseRPC(fn, params, self.service)

    def from_(self, view: str) -> SupabaseTable:
        return SupabaseTable(view, self.service)


def get_supabase_client() -> SimpleSupabaseClient:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ConnectionError("Missing SUPABASE_URL or SUPABASE_KEY in .env")
    return SimpleSupabaseClient(service=False)


def get_supabase_admin_client() -> SimpleSupabaseClient:
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise ConnectionError("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env")
    return SimpleSupabaseClient(service=True)


def get_openai_client():
    """Returns an OpenAI-compatible client configured for OpenRouter."""
    from openai import OpenAI
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise ProviderConfigError("OPENROUTER_API_KEY is not configured")
    return OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
        timeout=ADVISOR_TIMEOUT_SECONDS,
    )


def get_gemini_client():
    """Returns a Google Generative AI client configured for Gemini."""
    import google.generativeai as genai
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ProviderConfigError("GEMINI_API_KEY is not configured")
    genai.configure(api_key=api_key)
    # gemini-2.0-flash has its own separate quota from the older 3.5-flash
    model_name = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")
    return genai.GenerativeModel(model_name)


def get_groq_client():
    """Returns an OpenAI-compatible client configured for Groq."""
    from openai import OpenAI
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise ProviderConfigError("GROQ_API_KEY is not configured")
    # ✅ FIX: رفعنا الـ timeout لـ 90 ثانية بدل الـ ADVISOR_TIMEOUT_SECONDS اللي 10 ثواني
    return OpenAI(
        base_url="https://api.groq.com/openai/v1",
        api_key=api_key,
        timeout=90.0,
    )


class ProviderConfigError(Exception):
    pass