import logging
import asyncio
import os
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from telegram import Update
from telegram.ext import ApplicationBuilder, ContextTypes, MessageHandler, filters

from database import Database
from services.factory import StrategyFactory

from contextlib import asynccontextmanager

# 1. Initialize FastAPI with Lifespan
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    logging.info("🚀 Saqr Engine is starting up...")
    asyncio.create_task(start_telegram_bot())
    yield
    # Shutdown logic
    logging.info("🛑 Saqr Engine is shutting down...")

app = FastAPI(title="Saqr Strategy Factory API", lifespan=lifespan)

# Setup CORS to allow React frontend to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Setup Logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)

# 3. Request Models
class KitchenRunRequest(BaseModel):
    session_id: str

# 4. Strategy Factory Instance
factory = StrategyFactory()

@app.post("/api/kitchen/run")
async def run_kitchen(request: KitchenRunRequest, background_tasks: BackgroundTasks):
    """
    Endpoint triggered by the frontend when a session is created.
    Starts the full AI factory process in the background.
    """
    logging.info(f"Received request to run kitchen for session: {request.session_id}")
    background_tasks.add_task(factory.run_session, request.session_id)
    return {"status": "processing", "session_id": request.session_id}

@app.get("/health")
async def health_check():
    return {"status": "alive", "engine": "Saqr Strategy Factory"}

# --- Telegram Bot Logic ---

async def handle_signal(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Callback for all incoming Telegram messages."""
    if not update.message or not update.message.text: return
    
    message_text = update.message.text
    chat_id = update.effective_chat.id
    username = update.effective_user.username or "Unknown"
    
    logging.info(f"Signal received from @{username} ({chat_id}): {message_text[:50]}...")
    settings = Database.get_telegram_settings()
    if not settings: return

    user_id = settings['user_id']
    target_chat_id = settings['chat_id']

    if target_chat_id and str(chat_id) != str(target_chat_id): return

    message_payload = { "text": message_text, "from": username, "chat_id": chat_id, "timestamp": str(update.message.date) }
    Database.save_raw_message(user_id, message_payload)

    try:
        session = Database.create_meeting_session(user_id, message_text)
        if session:
            await update.message.reply_text(f"🚀 صقر استلم الإشارة! تم فتح 'اجتماع خبراء' جديد لمراجعة الصفقة.")
            asyncio.create_task(factory.run_session(session['id']))
    except Exception as e:
        logging.error(f"❌ Error during signal handling: {e}")

async def start_telegram_bot():
    """Initializes and starts the Telegram bot listener."""
    settings = Database.get_telegram_settings()
    if not settings or not settings.get('token'):
        logging.warning("Telegram token missing. Bot listener not started.")
        return

    token = settings['token']
    try:
        application = ApplicationBuilder().token(token).build()
        msg_handler = MessageHandler(filters.TEXT & (~filters.COMMAND), handle_signal)
        application.add_handler(msg_handler)
        
        logging.info("✅ Telegram Bot listener is starting...")
        await application.initialize()
        await application.start()
        await application.updater.start_polling()
        logging.info("✅ Telegram Bot is now polling.")
    except Exception as e:
        logging.error(f"❌ Critical Error starting Telegram bot: {e}")

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

