import json
import logging
import asyncio
import os
from flask import Flask, request, Response
from telegram import Update, ReplyKeyboardMarkup, KeyboardButton, BotCommand
from telegram.ext import Application, MessageHandler, filters, ContextTypes

# ==========================================
# ⚙️ CONFIGURATION
# ==========================================
logging.basicConfig(format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO)

# Fetching from Vercel Environment Variables
TOKEN = os.getenv("BOT_TOKEN", "8982458138:AAEb7ieSOfCCHAb5DtmdFNtfhmT4JyIWpDI") 
ADMIN_USER_ID = int(os.getenv("ADMIN_ID", "1560668553"))

# Absolute path for Vercel
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_FILE_PATH = os.path.join(BASE_DIR, '..', 'library_books.json')

ITEMS_PER_PAGE = 8

# ==========================================
# 🌐 LANGUAGE DICTIONARY (I18N)
# ==========================================
LANG = {
    'en': {
        'browse': '📚 Browse Library', 'search': '🔍 Search by ISBN', 'settings': '⚙️ Language', 'help': 'ℹ️ Help',
        'back': '⬅️ Back', 'home': '🏠 Home', 'admin': '🛠️ Admin Dashboard',
        'choose_lang': '🌍 Please select your language:',
        'welcome': 'Welcome to the Digital Library! 📚\nChoose an option below:',
        'help_text': '💡 *Help Desk*\n• Use *Browse Library* to find books.\n• Use *Search ISBN* to find a specific book.\n• Use *Language* to change interface language.',
        'ask_isbn': '🔢 *Please type the exact ISBN number:*',
        'not_found': '❌ *Not found.* Please try again.',
        'pdf_wait': '⏳ *The Admin has not uploaded the PDF yet.*',
        'download': '📥 *Download PDF*',
        'grade_prefix': 'Grade ',
        'select_path': '📂 *Select a Category:*',
        'select_field': '🔬 *Select a Field:*',
        'select_subject': '📑 *Select a Subject:*',
        'select_grade': '🎓 *Select a Grade:*',
        'select_book': '📘 *Select a Book:*',
        'invalid': '⚠️ *Invalid selection.* Please use the buttons below.'
    },
    'uz': {
        'browse': '📚 Kutubxonani ko\'rish', 'search': '🔍 ISBN qidirish', 'settings': '⚙️ Til', 'help': 'ℹ️ Yordam',
        'back': '⬅️ Orqaga', 'home': '🏠 Asosiy', 'admin': '🛠️ Admin Panel',
        'choose_lang': '🌍 Iltimos, tilingizni tanlang:',
        'welcome': 'Raqamli Kutubxonaga Xush Kelibsiz! 📚\nQuyidagi variantni tanlang:',
        'help_text': '💡 *Yordam*\n• Kitoblarni topish uchun *Kutubxonani ko\'rish* dan foydalaning.\n• Aniq kitobni topish uchun *ISBN qidirish* dan foydalaning.',
        'ask_isbn': '🔢 *Iltimos, aniq ISBN raqamini kiriting:*',
        'not_found': '❌ *Topilmadi.* Qaytadan urinib ko\'ring.',
        'pdf_wait': '⏳ *Admin hali bu PDF ni yuklamagan.*',
        'download': '📥 *PDF ni yuklab olish*',
        'grade_prefix': '-sinf',
        'select_path': '📂 *Kategoriyani tanlang:*',
        'select_field': '🔬 *Yo\'nalishni tanlang:*',
        'select_subject': '📑 *Fanni tanlang:*',
        'select_grade': '🎓 *Sinfni tanlang:*',
        'select_book': '📘 *Kitobni tanlang:*',
        'invalid': '⚠️ *Noto\'g\'ri tanlov.* Iltimos, quyidagi tugmalardan foydalaning.'
    },
    'ru': {
        'browse': '📚 Каталог библиотеки', 'search': '🔍 Поиск по ISBN', 'settings': '⚙️ Язык', 'help': 'ℹ️ Помощь',
        'back': '⬅️ Назад', 'home': '🏠 Главная', 'admin': '🛠️ Панель админа',
        'choose_lang': '🌍 Пожалуйста, выберите ваш язык:',
        'welcome': 'Добро пожаловать в Цифровую библиотеку! 📚\nВыберите опцию ниже:',
        'help_text': '💡 *Помощь*\n• Используйте *Каталог библиотеки* для поиска.\n• Используйте *Поиск по ISBN* для точного поиска.',
        'ask_isbn': '🔢 *Пожалуйста, введите точный номер ISBN:*',
        'not_found': '❌ *Не найдено.* Попробуйте еще раз.',
        'pdf_wait': '⏳ *Админ еще не загрузил PDF.*',
        'download': '📥 *Скачать PDF*',
        'grade_prefix': ' Класс',
        'select_path': '📂 *Выберите категорию:*',
        'select_field': '🔬 *Выберите направление:*',
        'select_subject': '📑 *Выберите предмет:*',
        'select_grade': '🎓 *Выберите класс:*',
        'select_book': '📘 *Выберите книгу:*',
        'invalid': '⚠️ *Неверный выбор.* Пожалуйста, используйте кнопки ниже.'
    }
}

# ==========================================
# 🗄️ DATABASE UTILITIES
# ==========================================
def load_books():
    try:
        with open(JSON_FILE_PATH, 'r', encoding='utf-8') as f: return json.load(f)
    except FileNotFoundError: return []

def save_books(books):
    with open(JSON_FILE_PATH, 'w', encoding='utf-8') as f: json.dump(books, f, indent=2, ensure_ascii=False)

def get_str(key, lang='en'):
    return LANG.get(lang, LANG['en']).get(key, LANG['en'][key])

# ==========================================
# 📱 KEYBOARD BUILDERS
# ==========================================
def build_keyboard(buttons_list, columns=2, add_nav=False, lang='en'):
    keyboard = []
    for i in range(0, len(buttons_list), columns):
        row = [KeyboardButton(btn) for btn in buttons_list[i:i+columns]]
        keyboard.append(row)
    
    if add_nav:
        keyboard.append([KeyboardButton(get_str('back', lang)), KeyboardButton(get_str('home', lang))])
    return ReplyKeyboardMarkup(keyboard, resize_keyboard=True)

def main_menu_keyboard(is_admin, lang):
    btns = [
        [KeyboardButton(get_str('browse', lang)), KeyboardButton(get_str('search', lang))],
        [KeyboardButton(get_str('settings', lang)), KeyboardButton(get_str('help', lang))]
    ]
    if is_admin: btns.append([KeyboardButton(get_str('admin', lang))])
    return ReplyKeyboardMarkup(btns, resize_keyboard=True)

def lang_keyboard():
    return ReplyKeyboardMarkup([
        [KeyboardButton("🇬🇧 English"), KeyboardButton("🇺🇿 O'zbekcha")],
        [KeyboardButton("🇷🇺 Русский")]
    ], resize_keyboard=True)

# ==========================================
# 📦 SEND BOOK PACKET
# ==========================================
async def send_book_packet(update: Update, context: ContextTypes.DEFAULT_TYPE, book: dict, lang: str):
    file_id = book.get("telegramFileId")
    photo_id = book.get("telegramPhotoId")

    grades = [f"{g}{get_str('grade_prefix', lang)}" if lang=='uz' else f"{get_str('grade_prefix', lang)} {g}" for g in book.get('grades', [])]
    grades_str = ', '.join(grades)
    authors_str = ', '.join(book.get('authors', []))
    
    caption = (
        f"📖 *{book['title'].get(lang, book['title']['en']).upper()}*\n"
        f"━︎━︎━︎━︎━︎━︎━︎━︎━︎━︎━︎━︎━︎━︎━︎━︎\n"
        f"✍️ *Author:* {authors_str}\n"
        f"🏢 *Publisher:* {book.get('publisher', 'N/A')}\n"
        f"🎓 *Grade:* {grades_str}\n"
        f"🆔 *ISBN:* `{book.get('isbn', 'N/A')}`\n\n"
        f"📝 *Description:*\n_{book['description'].get(lang, book['description']['en'])}_\n"
    )

    if photo_id:
        await update.message.reply_photo(photo=photo_id, caption=caption, parse_mode="Markdown")
    else:
        await update.message.reply_text(caption, parse_mode="Markdown")

    if file_id:
        await update.message.reply_document(document=file_id, caption=get_str('download', lang), parse_mode="Markdown")
    else:
        await update.message.reply_text(get_str('pdf_wait', lang), parse_mode="Markdown")

# ==========================================
# 🗂️ MENU HELPER FUNCTIONS
# ==========================================
async def show_lifepaths(update: Update, context: ContextTypes.DEFAULT_TYPE, books: list, lang: str):
    context.user_data['state'] = 'WAIT_LIFEPATH'
    paths = list(set([b.get('lifePath', {}).get(lang, b.get('lifePath', {}).get('en')) for b in books if 'lifePath' in b]))
    await update.message.reply_text(get_str('select_path', lang), reply_markup=build_keyboard(paths, 1, True, lang), parse_mode="Markdown")

async def show_fields(update: Update, context: ContextTypes.DEFAULT_TYPE, books: list, lang: str):
    context.user_data['state'] = 'WAIT_FIELD'
    selected_path = context.user_data.get('selected_lifepath')
    fields = list(set([b.get('field', {}).get(lang, b.get('field', {}).get('en')) for b in books 
                       if b.get('lifePath', {}).get(lang, b.get('lifePath', {}).get('en')) == selected_path]))
    await update.message.reply_text(get_str('select_field', lang), reply_markup=build_keyboard(fields, 2, True, lang), parse_mode="Markdown")

async def show_subjects(update: Update, context: ContextTypes.DEFAULT_TYPE, books: list, lang: str):
    context.user_data['state'] = 'WAIT_SUBJECT'
    selected_path = context.user_data.get('selected_lifepath')
    selected_field = context.user_data.get('selected_field')
    subjects = list(set([b.get('Subject', {}).get(lang, b.get('Subject', {}).get('en')) for b in books 
                         if b.get('lifePath', {}).get(lang, b.get('lifePath', {}).get('en')) == selected_path 
                         and b.get('field', {}).get(lang, b.get('field', {}).get('en')) == selected_field]))
    await update.message.reply_text(get_str('select_subject', lang), reply_markup=build_keyboard(subjects, 2, True, lang), parse_mode="Markdown")

async def show_grades(update: Update, context: ContextTypes.DEFAULT_TYPE, books: list, lang: str):
    context.user_data['state'] = 'WAIT_GRADE'
    selected_path = context.user_data.get('selected_lifepath')
    selected_field = context.user_data.get('selected_field')
    selected_subject = context.user_data.get('selected_subject')
    
    grades = []
    for b in books:
        if (b.get('lifePath', {}).get(lang, b.get('lifePath', {}).get('en')) == selected_path and 
            b.get('field', {}).get(lang, b.get('field', {}).get('en')) == selected_field and
            b.get('Subject', {}).get(lang, b.get('Subject', {}).get('en')) == selected_subject):
            grades.extend(b.get('grades', []))
    grades = sorted(list(set(grades)))
    
    grade_btns = [f"{g}{get_str('grade_prefix', lang)}" if lang=='uz' else f"{get_str('grade_prefix', lang)} {g}" for g in grades]
    await update.message.reply_text(get_str('select_grade', lang), reply_markup=build_keyboard(grade_btns, 2, True, lang), parse_mode="Markdown")

async def show_books(update: Update, context: ContextTypes.DEFAULT_TYPE, books: list, lang: str):
    context.user_data['state'] = 'WAIT_BOOK'
    selected_path = context.user_data.get('selected_lifepath')
    selected_field = context.user_data.get('selected_field')
    selected_subject = context.user_data.get('selected_subject')
    selected_grade = context.user_data.get('selected_grade')
    
    filtered_books = [b for b in books if 
                      b.get('lifePath', {}).get(lang, b.get('lifePath', {}).get('en')) == selected_path and 
                      b.get('field', {}).get(lang, b.get('field', {}).get('en')) == selected_field and 
                      b.get('Subject', {}).get(lang, b.get('Subject', {}).get('en')) == selected_subject and
                      selected_grade in b.get('grades', [])]
                      
    book_btns = [b['title'].get(lang, b['title']['en']) for b in filtered_books]
    await update.message.reply_text(get_str('select_book', lang), reply_markup=build_keyboard(book_btns, 1, True, lang), parse_mode="Markdown")


# ==========================================
# 🚦 CORE MESSAGE ROUTER
# ==========================================
async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message or not update.message.text:
        return
        
    text = update.message.text
    user_id = update.message.from_user.id
    is_admin = (user_id == ADMIN_USER_ID)
    
    # --- COMMAND TRANSLATION ---
    if text == '/start':
        context.user_data['state'] = 'MAIN_MENU'
        if not context.user_data.get('lang'):
            await update.message.reply_text("🌍 Please select your language / Iltimos, tilingizni tanlang / Пожалуйста, выберите язык:", reply_markup=lang_keyboard())
            return
        else:
            text = get_str('home', context.user_data['lang'])
            
    elif text == '/help': text = get_str('help', context.user_data.get('lang', 'en'))
    elif text == '/search': text = get_str('search', context.user_data.get('lang', 'en'))

    # --- 1. LANGUAGE SELECTOR ---
    if not context.user_data.get('lang') or text in ["🇬🇧 English", "🇺🇿 O'zbekcha", "🇷🇺 Русский"]:
        if text == "🇬🇧 English": context.user_data['lang'] = 'en'
        elif text == "🇺🇿 O'zbekcha": context.user_data['lang'] = 'uz'
        elif text == "🇷🇺 Русский": context.user_data['lang'] = 'ru'
        else:
            await update.message.reply_text("🌍 Please select your language:", reply_markup=lang_keyboard())
            return
            
        context.user_data['state'] = 'MAIN_MENU'
        await update.message.reply_text(get_str('welcome', context.user_data['lang']), reply_markup=main_menu_keyboard(is_admin, context.user_data['lang']))
        return

    lang = context.user_data['lang']
    state = context.user_data.get('state', 'MAIN_MENU')
    books = load_books()

    # --- 2. GLOBAL COMMANDS ---
    if text == get_str('home', lang):
        context.user_data['state'] = 'MAIN_MENU'
        await update.message.reply_text(get_str('welcome', lang), reply_markup=main_menu_keyboard(is_admin, lang))
        return
        
    if text == get_str('help', lang):
        await update.message.reply_text(get_str('help_text', lang), parse_mode="Markdown")
        return

    if text == get_str('settings', lang):
        await update.message.reply_text(get_str('choose_lang', lang), reply_markup=lang_keyboard())
        return

    # --- 🔙 BACK BUTTON FIX ---
    if text == get_str('back', lang):
        if state == 'WAIT_LIFEPATH':
            context.user_data['state'] = 'MAIN_MENU'
            await update.message.reply_text(get_str('welcome', lang), reply_markup=main_menu_keyboard(is_admin, lang))
        elif state == 'WAIT_FIELD':
            await show_lifepaths(update, context, books, lang)
        elif state == 'WAIT_SUBJECT':
            await show_fields(update, context, books, lang)
        elif state == 'WAIT_GRADE':
            await show_subjects(update, context, books, lang)
        elif state == 'WAIT_BOOK':
            await show_grades(update, context, books, lang)
        elif state in ['ADMIN_EDIT', 'WAIT_ADMIN_IMG', 'WAIT_ADMIN_PDF', 'WAIT_ISBN']:
            context.user_data['state'] = 'MAIN_MENU'
            await update.message.reply_text(get_str('welcome', lang), reply_markup=main_menu_keyboard(is_admin, lang))
        return

    # --- 3. BROWSE LIBRARY (Cascading Menu) ---
    if text == get_str('browse', lang) or (state == 'MAIN_MENU' and text == get_str('browse', lang)):
        await show_lifepaths(update, context, books, lang)
        return

    elif state == 'WAIT_LIFEPATH':
        valid_paths = [b.get('lifePath', {}).get(lang, b.get('lifePath', {}).get('en')) for b in books]
        if text in valid_paths:
            context.user_data['selected_lifepath'] = text
            await show_fields(update, context, books, lang)
        else:
            await update.message.reply_text(get_str('invalid', lang))
        return

    elif state == 'WAIT_FIELD':
        valid_fields = [b.get('field', {}).get(lang, b.get('field', {}).get('en')) for b in books if b.get('lifePath', {}).get(lang, b.get('lifePath', {}).get('en')) == context.user_data.get('selected_lifepath')]
        if text in valid_fields:
            context.user_data['selected_field'] = text
            await show_subjects(update, context, books, lang)
        else:
            await update.message.reply_text(get_str('invalid', lang))
        return
        
    elif state == 'WAIT_SUBJECT':
        valid_subjects = [b.get('Subject', {}).get(lang, b.get('Subject', {}).get('en')) for b in books if b.get('field', {}).get(lang, b.get('field', {}).get('en')) == context.user_data.get('selected_field')]
        if text in valid_subjects:
            context.user_data['selected_subject'] = text
            await show_grades(update, context, books, lang)
        else:
            await update.message.reply_text(get_str('invalid', lang))
        return

    elif state == 'WAIT_GRADE':
        selected_grade = int(''.join(filter(str.isdigit, text))) if any(c.isdigit() for c in text) else -1
        context.user_data['selected_grade'] = selected_grade
        await show_books(update, context, books, lang)
        return

    elif state == 'WAIT_BOOK':
        book = next((b for b in books if b['title'].get(lang, b['title']['en']) == text), None)
        if book:
            await send_book_packet(update, context, book, lang)
        else:
            await update.message.reply_text(get_str('invalid', lang))
        return

    # --- 4. ISBN SEARCH ---
    if text == get_str('search', lang):
        context.user_data['state'] = 'WAIT_ISBN'
        await update.message.reply_text(get_str('ask_isbn', lang), reply_markup=build_keyboard([], 2, True, lang), parse_mode="Markdown")
        return
        
    elif state == 'WAIT_ISBN':
        isbn_query = text.strip().replace("-", "")
        book = next((b for b in books if b.get("isbn") == isbn_query), None)
        if book:
            await send_book_packet(update, context, book, lang)
        else:
            await update.message.reply_text(get_str('not_found', lang), parse_mode="Markdown")
        return

    # --- 5. ADMIN MENU ---
    if text == get_str('admin', lang) and is_admin:
        context.user_data['state'] = 'ADMIN_DASHBOARD'
        book_btns = []
        for b in books:
            i_stat = "✅" if b.get("telegramPhotoId") else "❌"
            p_stat = "✅" if b.get("telegramFileId") else "❌"
            book_btns.append(f"[🖼️{i_stat} 📄{p_stat}] {b['id']}") 
            
        await update.message.reply_text(
            "🛠 *Admin Mode*\nSelect an ID below to edit it.", 
            reply_markup=build_keyboard(book_btns, 1, True, lang), parse_mode="Markdown"
        )
        return

    elif state == 'ADMIN_DASHBOARD' and text.startswith("[🖼️"):
        book_id = text.split("] ")[1].strip()
        book = next((b for b in books if b["id"] == book_id), None)
        
        if book:
            context.user_data['admin_edit_id'] = book_id
            context.user_data['state'] = 'ADMIN_EDIT'
            btns = ["🖼️ Upload Cover Image", "📄 Upload PDF Document"]
            await update.message.reply_text(f"Editing: *{book['title']['en']}*\nChoose upload type:", reply_markup=build_keyboard(btns, 1, True, lang), parse_mode="Markdown")
        return

    elif state == 'ADMIN_EDIT':
        if text == "🖼️ Upload Cover Image":
            context.user_data['state'] = 'WAIT_ADMIN_IMG'
            await update.message.reply_text("🖼️ Send the Cover Photo now.", reply_markup=build_keyboard([], 1, True, lang))
        elif text == "📄 Upload PDF Document":
            context.user_data['state'] = 'WAIT_ADMIN_PDF'
            await update.message.reply_text("📄 Drop the PDF Document here now.", reply_markup=build_keyboard([], 1, True, lang))
        return

# ==========================================
# 📥 ADMIN FILE RECEIVER
# ==========================================
async def handle_uploads(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.message.from_user.id != ADMIN_USER_ID: return
    lang = context.user_data.get('lang', 'en')
    state = context.user_data.get('state')
    book_id = context.user_data.get('admin_edit_id')

    if not state or not book_id: return 

    books = load_books()
    book_index = next((i for i, b in enumerate(books) if b.get("id") == book_id), None)

    if state == 'WAIT_ADMIN_IMG' and update.message.photo:
        books[book_index]["telegramPhotoId"] = update.message.photo[-1].file_id 
        save_books(books)
        context.user_data['state'] = 'MAIN_MENU'
        await update.message.reply_text("✅ Cover Image Saved to Cloud!", reply_markup=main_menu_keyboard(True, lang))

    elif state == 'WAIT_ADMIN_PDF' and update.message.document:
        books[book_index]["telegramFileId"] = update.message.document.file_id
        save_books(books)
        context.user_data['state'] = 'MAIN_MENU'
        await update.message.reply_text("✅ PDF Document Saved to Cloud!", reply_markup=main_menu_keyboard(True, lang))

# ==========================================
# 🌐 VERCEL WEBHOOK INTEGRATION
# ==========================================
# 1. Build the PTB app
ptb_app = Application.builder().token(TOKEN).build()
ptb_app.add_handler(MessageHandler(filters.TEXT, handle_message))
ptb_app.add_handler(MessageHandler(filters.PHOTO | filters.Document.ALL, handle_uploads))

# 2. Setup the Flask app
app = Flask(__name__)

# 3. Create a safe wrapper to execute the async code on Vercel
async def process_update_wrapper(update):
    if not ptb_app._initialized:
        await ptb_app.initialize()
        # Force set the blue native menu commands on startup
        await ptb_app.bot.set_my_commands([
            BotCommand("start", "Restart the library bot"),
            BotCommand("search", "Find a book by ISBN"),
            BotCommand("help", "Get support and instructions")
        ])
    await ptb_app.process_update(update)

# 4. The webhook endpoint that Vercel targets
@app.route('/api/webhook', methods=['POST'])
def webhook():
    if request.method == "POST":
        try:
            update = Update.de_json(request.get_json(force=True), ptb_app.bot)
            # Safely run the async wrapper
            asyncio.run(process_update_wrapper(update))
            return Response('ok', status=200)
        except Exception as e:
            logging.error(f"Webhook Error: {e}")
            return Response('Error', status=500)
    return Response('Only POST allowed', status=405)