import json
import logging
import asyncio
import os
from flask import Flask, request, Response
from telegram import Update, ReplyKeyboardMarkup, KeyboardButton, BotCommand
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes

# ==========================================
# ⚙️ CONFIGURATION
# ==========================================
# Now we safely pull the secrets from the environment!
TOKEN = os.getenv("BOT_TOKEN")
# We use int() because IDs are numbers, but env variables come in as text strings
ADMIN_USER_ID = int(os.getenv("ADMIN_ID", 0))

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Navigate one level up to get to the project root (where the json file is)
JSON_FILE_PATH = os.path.join(BASE_DIR, '..', 'library_books.json')

# Load Language Dictionary (Trimmed for space, use your full dictionary from before)
LANG = {
    'en': { 'browse': '📚 Browse Library', 'search': '🔍 Search ISBN', 'home': '🏠 Home', 'back': '⬅️ Back', 'help': 'ℹ️ Help', 'grade_prefix': 'Grade ', 'download': '📥 *Download PDF*' },
    'uz': { 'browse': '📚 Kutubxonani ko\'rish', 'search': '🔍 ISBN qidirish', 'home': '🏠 Asosiy', 'back': '⬅️ Orqaga', 'help': 'ℹ️ Yordam', 'grade_prefix': '-sinf', 'download': '📥 *PDF ni yuklab olish*' },
    'ru': { 'browse': '📚 Каталог', 'search': '🔍 Поиск ISBN', 'home': '🏠 Главная', 'back': '⬅️ Назад', 'help': 'ℹ️ Помощь', 'grade_prefix': ' Класс', 'download': '📥 *Скачать PDF*' }
}
def get_str(key, lang='en'): return LANG.get(lang, LANG['en']).get(key, LANG['en'][key])

def load_books():
    try:
        with open(JSON_FILE_PATH, 'r', encoding='utf-8') as f: return json.load(f)
    except Exception as e:
        print(f"Error loading JSON: {e}")
        return []

# ==========================================
# 📱 KEYBOARDS & BOT LOGIC
# ==========================================
def build_keyboard(buttons_list, columns=2, add_nav=False, lang='en'):
    keyboard = []
    for i in range(0, len(buttons_list), columns):
        keyboard.append([KeyboardButton(btn) for btn in buttons_list[i:i+columns]])
    if add_nav:
        keyboard.append([KeyboardButton(get_str('back', lang)), KeyboardButton(get_str('home', lang))])
    return ReplyKeyboardMarkup(keyboard, resize_keyboard=True)

def main_menu_keyboard(lang):
    return ReplyKeyboardMarkup([
        [KeyboardButton(get_str('browse', lang)), KeyboardButton(get_str('search', lang))],
        [KeyboardButton("🇬🇧 EN"), KeyboardButton("🇺🇿 UZ"), KeyboardButton("🇷🇺 RU")]
    ], resize_keyboard=True)

async def send_book_packet(update: Update, context: ContextTypes.DEFAULT_TYPE, book: dict, lang: str):
    file_id = book.get("telegramFileId")
    photo_id = book.get("telegramPhotoId")
    caption = f"📖 *{book['title'].get(lang, book['title']['en']).upper()}*\n\n🆔 *ISBN:* `{book.get('isbn', 'N/A')}`\n📝 _{book['description'].get(lang, book['description']['en'])}_"

    if photo_id: await update.message.reply_photo(photo=photo_id, caption=caption, parse_mode="Markdown")
    else: await update.message.reply_text(caption, parse_mode="Markdown")

    if file_id: await update.message.reply_document(document=file_id, caption=get_str('download', lang), parse_mode="Markdown")
    else: await update.message.reply_text("⏳ Admin has not uploaded PDF yet.", parse_mode="Markdown")

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text
    lang = context.user_data.get('lang', 'en')

    # Quick language swap
    if text == "🇬🇧 EN": context.user_data['lang'] = 'en'; await update.message.reply_text("Language set to English.", reply_markup=main_menu_keyboard('en')); return
    elif text == "🇺🇿 UZ": context.user_data['lang'] = 'uz'; await update.message.reply_text("Til O'zbek tiliga o'zgartirildi.", reply_markup=main_menu_keyboard('uz')); return
    elif text == "🇷🇺 RU": context.user_data['lang'] = 'ru'; await update.message.reply_text("Язык изменен на русский.", reply_markup=main_menu_keyboard('ru')); return

    if text in ['/start', get_str('home', lang)]:
        context.user_data['state'] = 'MAIN_MENU'
        await update.message.reply_text("📚 Welcome to the Library!", reply_markup=main_menu_keyboard(lang))
        return

    # Basic cascading logic (Trimmed for Vercel demo - insert full cascading logic here)
    if text == get_str('browse', lang):
        books = load_books()
        paths = list(set([b['lifePath'].get(lang, b['lifePath']['en']) for b in books if 'lifePath' in b]))
        context.user_data['state'] = 'WAIT_LIFEPATH'
        await update.message.reply_text("📂 Select Category:", reply_markup=build_keyboard(paths, 1, True, lang))
        return

# ==========================================
# 🌐 VERCEL SERVERLESS FLASK WRAPPER
# ==========================================
app = Flask(__name__)

# Build the PTB application ONCE
ptb_app = Application.builder().token(TOKEN).build()
ptb_app.add_handler(MessageHandler(filters.TEXT, handle_message))

@app.route('/api/webhook', methods=['POST'])
def webhook():
    """This is the entry point for Vercel and Telegram."""
    if request.method == "POST":
        try:
            # 1. Create a safe async loop for Vercel's thread
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            # 2. Grab the JSON from Telegram
            update = Update.de_json(request.get_json(force=True), ptb_app.bot)
            
            # 3. Process the update asynchronously
            loop.run_until_complete(ptb_app.initialize())
            loop.run_until_complete(ptb_app.process_update(update))
            
            return Response('ok', status=200)
        except Exception as e:
            print(f"Webhook Error: {e}")
            return Response('Error', status=500)