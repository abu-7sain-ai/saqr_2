# saqr\_rules.md — القيود والأساسيات التقنية

الإصدار: 23.0 | أبريل 2026

\---

## 1\. اللغات والأدوات

|الطبقة|اللغة|الأدوات|
|-|-|-|
|Frontend|JavaScript|React + Bootstrap + WebSockets|
|Backend|Python|FastAPI|
|AI Agents|Python|CrewAI|
|Backtesting|Python|VectorBT + yfinance|
|ML|Python|LSTM via Keras|
|Database|SQL|Supabase (PostgreSQL)|
|Monitoring|-|Grafana OSS|
|IDE|-|Antigravity|
|Planning|-|Spec-Kit|
|Backup|-|GitHub Auto Backup|

\---

## 2\. هيكل ملفات Frontend (JavaScript)

```
src/
├── app/
│   ├── store.js
│   └── router.jsx
├── assets/
├── components/
│   ├── ui/          # buttons, inputs, modals
│   └── common/      # Navbar, Sidebar
├── features/
│   ├── auth/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services.js
│   │   └── hooks.js
│   ├── workers/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services.js
│   │   └── hooks.js
│   ├── kitchen/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services.js
│   │   └── hooks.js
│   ├── analytics/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services.js
│   │   └── hooks.js
│   └── advisor/
│       ├── components/
│       ├── pages/
│       ├── services.js
│       └── hooks.js
├── pages/
│   ├── Home.jsx
│   └── NotFound.jsx
├── hooks/
│   └── useFetch.js
├── services/
│   └── api.js
├── utils/
├── constants/
│   └── roles.js
├── layouts/
│   └── MainLayout.jsx
├── styles/
│   └── index.css
├── App.jsx
└── main.jsx
```

\---

## 3\. هيكل ملفات Backend (Python)

```
backend/
├── main.py              # FastAPI entry point
├── routers/
│   ├── workers.py
│   ├── kitchen.py
│   ├── analytics.py
│   ├── advisor.py
│   └── auth.py
├── services/
│   ├── market.py        # فحص السوق
│   ├── trading.py       # منطق التداول
│   ├── backtesting.py   # VectorBT
│   ├── telegram.py      # إشعارات
│   └── ai\_agents.py     # CrewAI
├── models/
│   └── schemas.py
├── utils/
│   ├── indicators.py    # ATR, RSI, MACD
│   └── helpers.py
├── config.py
└── requirements.txt
```

\---

## 4\. قاعدة البيانات — Supabase

### جدول workers:

```sql
id UUID PRIMARY KEY
number INTEGER UNIQUE NOT NULL
name TEXT NOT NULL
type TEXT CHECK (type IN ('paper', 'live'))
market\_type TEXT CHECK (market\_type IN ('stable', 'volatile'))
owner TEXT CHECK (owner IN ('prince', 'king', 'sniper'))
paired\_with UUID REFERENCES workers(id)
status TEXT CHECK (status IN ('running', 'stopped', 'paused'))
strategy\_name TEXT
strategy\_details JSONB
user\_settings JSONB
starting\_capital DECIMAL
current\_capital DECIMAL
total\_profit\_loss DECIMAL
released\_amount DECIMAL DEFAULT 0
color TEXT CHECK (color IN ('green', 'red', 'gray'))
kitchen\_session\_id UUID
created\_at TIMESTAMPTZ DEFAULT NOW()
last\_run\_at TIMESTAMPTZ
tag TEXT
project\_tag TEXT
```

### جدول trades:

```sql
id UUID PRIMARY KEY
worker\_id UUID REFERENCES workers(id)
worker\_number INTEGER
pair TEXT NOT NULL
entry\_price DECIMAL
exit\_price DECIMAL
amount\_planned DECIMAL
amount\_actual DECIMAL
is\_trimmed BOOLEAN DEFAULT FALSE
trim\_reason TEXT
slippage DECIMAL DEFAULT 0.001
commission DECIMAL
spread DECIMAL
result DECIMAL
result\_percentage DECIMAL
color\_base TEXT CHECK (color\_base IN ('green', 'red', 'gray'))
is\_trimmed\_flag BOOLEAN DEFAULT FALSE
entry\_reason TEXT
exit\_reason TEXT
exit\_type TEXT CHECK (exit\_type IN ('target', 'stop\_loss', 'expired', 'manual'))
manual\_exit\_reason TEXT
ai\_summary TEXT
duration\_minutes INTEGER
entry\_at TIMESTAMPTZ
exit\_at TIMESTAMPTZ
tag TEXT
project\_tag TEXT
```

### جدول kitchen\_sessions:

```sql
id UUID PRIMARY KEY
date TIMESTAMPTZ DEFAULT NOW()
market\_type TEXT
risk\_level DECIMAL
angle TEXT
capital\_target DECIMAL
expert\_opinions JSONB
final\_decision JSONB
workers\_created JSONB
created\_at TIMESTAMPTZ DEFAULT NOW()
tag TEXT
project\_tag TEXT
```

### جدول profiles:

```sql
id UUID PRIMARY KEY REFERENCES auth.users(id)
name TEXT NOT NULL
email TEXT NOT NULL
mobile TEXT
role TEXT CHECK (role IN ('admin', 'owner', 'viewer'))
package TEXT DEFAULT 'free'
balance DECIMAL DEFAULT 0
status TEXT CHECK (status IN ('pending', 'active', 'rejected'))
created\_at TIMESTAMPTZ DEFAULT NOW()
```

### جدول local\_backup:

```sql
id UUID PRIMARY KEY
trade\_data JSONB
synced BOOLEAN DEFAULT FALSE
created\_at TIMESTAMPTZ DEFAULT NOW()
```

### ألوان الصفقات:

```
أخضر = ربح كامل
أحمر = خسارة كاملة
رمادي = متساوي
أخضر + نقطة برتقالية = ربح + مقلّصة
أحمر + نقطة برتقالية = خسارة + مقلّصة
```

\---

## 5\. متغيرات البيئة المطلوبة

```env
# Grok API
GROK\_API\_KEY=xai-...

# OpenRouter
OPENROUTER\_API\_KEY=sk-...

# Alpaca
ALPACA\_API\_KEY=...
ALPACA\_SECRET\_KEY=...
ALPACA\_BASE\_URL=https://paper-api.alpaca.markets

# Supabase
SUPABASE\_URL=...
SUPABASE\_KEY=...

# Telegram
TELEGRAM\_BOT\_TOKEN=...
TELEGRAM\_CHAT\_ID=...

# Binance (لما تكون جاهز للحقيقي)
BINANCE\_API\_KEY=...
BINANCE\_SECRET\_KEY=...
```

⚠️ هذا الملف لا يُرفع على GitHub أبداً — يبقى محلي فقط.

\---

## 6\. المكتبات المطلوبة

### Python (requirements.txt):

```
fastapi
uvicorn
crewai
vectorbt
yfinance
pandas
numpy
ta
python-binance
alpaca-trade-api
supabase
keras
tensorflow
python-telegram-bot
openai
httpx
python-dotenv
```

### JavaScript (package.json):

```json
{
  "dependencies": {
    "react": "^18",
    "react-dom": "^18",
    "react-router-dom": "^6",
    "bootstrap": "^5",
    "axios": "^1",
    "socket.io-client": "^4",
    "recharts": "^2",
    "zustand": "^4"
  },
  "devDependencies": {
    "vite": "^5",
    "vitest": "^1"
  }
}
```

\---

## 7\. قواعد الموظفين الثابتة (لا تتغير إلا بالاستنساخ)

```
✅ 1% مخاطرة قصوى
✅ Trailing Stop Loss مفعّل دائماً
✅ Stop Loss ثابت على المنصة (مستقل عن الصقر)
✅ 0.1% انزلاق سعري محسوب تلقائياً
✅ عمولة المنصة محسوبة تلقائياً
✅ Spread محسوب تلقائياً
✅ لا يتجاوز 1% من حجم التداول اللحظي
✅ حلال فقط (قائمة العملات يدوية)
✅ كل موظف = محفظة مستقلة تماماً
✅ Compounding على محفظة الموظف نفسه فقط
✅ كل موظف مرن — ما تطوف أي فرصة لو في رصيد متاح
```

\---

## 8\. قواعد الكود العامة

```
✅ لا تكتب كوداً لم تختبره
✅ كل صفقة تُحفظ محلياً أولاً ثم Supabase
✅ Stop Loss يُرسل للمنصة مباشرة عند كل صفقة
✅ لو فشل API 3 مرات → تليجرام فوراً
✅ لو Grok ما رد 30 ثانية → تليجرام للمستخدم
✅ كل تغيير في الكود يُحفظ في GitHub تلقائياً
✅ متغيرات البيئة في Railway — مو في الكود
✅ API Keys تظهر نجوم فقط في الواجهة \*\*\*\*
```

\---

## 9\. قواعد نظام الأصدقاء

```
✅ كل مشاة مرتبط بطيار محدد عند الإنشاء
✅ الرابط ثابت ولا يتغير
✅ فلوس المشاة تروح لطياره فقط (مو لأي طيار ثاني)
✅ القناص محفظة مستقلة — لا يشارك مع أحد
✅ الفلوس دائماً تشتغل — ما في فلوس نايمة
```

\---

## 10\. قواعد اجتماع الخبراء

```
✅ الزناد يدوي فقط (أنت تضغط)
✅ 4 جولات نقاش إلزامية
✅ 3 استراتيجيات فقط من الأمير (لا أكثر لا أقل)
✅ ممنوع تكرار استراتيجيات فاشلة
✅ لو أي خبير ما رد → الاجتماع يوقف + تليجرام
✅ اجتماع الخبراء خارج نطاق الطبقتين
✅ تكلفة الجلسة الكاملة: \~0.10$
```

\---

## 11\. قواعد التبديل الأوتوماتيكي

```
✅ Python يفحص السوق كل 15 دقيقة
✅ ATR > متوسط × 1.5 أو Volume > متوسط × 2 = متوتر
✅ التبديل أوتوماتيكي + تليجرام للمستخدم
✅ 30 دقيقة للرد — سكت = يكمل التبديل
✅ القرار النهائي دائماً بيدك
```

\---

## 12\. قواعد الأمان

```
✅ Supabase Auth + JWT + 2FA لكل حساب
✅ RLS مفعّل على كل الجداول
✅ API Keys مخزنة في Supabase Vault (AES-256)
✅ API Keys تظهر نجوم \*\*\*\* في الواجهة فقط
✅ Python يشتغل على السيرفر — المستخدم لا يوصل للكود
✅ HTTPS على كل الاتصالات
✅ Rate Limiting مفعّل
✅ ملف .env لا يُرفع على GitHub أبداً
```

\---

## 13\. نظام العمل في Antigravity

```
التخطيط: Claude Opus
التنفيذ: DeepSeek V3
المراجعة: Claude
```

### الملفات التي يقرأها Antigravity في بداية كل جلسة:

1. saqr\_project.md — فهم المشروع كاملاً
2. saqr\_rules.md — القيود والأساسيات (هذا الملف)
3. saqr\_plan.md — الخطة والمراحل
4. saqr\_env.md — متغيرات البيئة (محلي فقط)

