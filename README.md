# 🚀 Obsidian Telegram Bot

ربات تلگرام هوشمند برای مدیریت دانش شخصی (PKM) و ذخیره مستقیم یادداشت‌ها، لینک‌ها و مطالب در مخزن گیت‌هاب Obsidian.

---

## 📋 ویژگی‌ها

- 📥 دریافت متن و لینک‌های مختلف (اینستاگرام، X/توییتر، یوتیوب، وب و ...)
- 📁 دسته‌بندی و انتخاب پوشه مقصد در Obsidian یا ساخت پوشه جدید
- 🏷 تعیین وضعیت (Status) یادداشت (learn, AI, code, design و ...)
- 🔗 ذخیره مستقیم فایل‌های Markdown در مخزن گیت‌هاب از طریق GitHub REST API
- 🔒 محدودسازی دسترسی کاربران براساس شناسه عددی تلگرام (`ALLOWED_USER_IDS`)

---

## ⚙️ تنظیم متغیرهای محیطی (Environment Variables)

برای راه‌اندازی ربات، متغیرهای زیر را در فایل `.env` یا در بخش Environment Variables پلتفرم دیپلوی خود تعریف کنید:

| نام متغیر | توضیحات | نمونه مقدار |
| :--- | :--- | :--- |
| `BOT_TOKEN` | توکن ربات تلگرام دریافت شده از BotFather | `123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ` |
| `GITHUB_TOKEN` | توکن دسترسی شخصی گیت‌هاب (Personal Access Token) با دسترسی write به مخزن | `ghp_xxxxxxxxxxxxxxxxxxxx` |
| `GITHUB_OWNER` | نام کاربری مالک مخزن گیت‌هاب Obsidian | `pouriahasanii` |
| `GITHUB_REPO` | نام مخزن Obsidian در گیت‌هاب | `obsidian-pkm-vault` |
| `GITHUB_BRANCH` | شاخه اصلی مخزن (اختیاری - پیش‌فرض: `main`) | `main` |
| `ALLOWED_USER_IDS` | شناسه عددی تلگرام کاربران مجاز (جداشده با کاما) | `123456789,987654321` |

---

## 🛠 نصب و اجرای محلی

۱. کلون کردن مخزن:
```bash
git clone git@github.com:pouriahasanii/obsidian-telegram-bot.git
cd obsidian-telegram-bot
```

۲. نصب وابستگی‌ها:
```bash
npm install
```

۳. تنظیم متغیرهای محیطی:
یک کپی از فایل `.env.example` با نام `.env` بسازید و مقادیر خود را وارد کنید:
```bash
cp .env.example .env
```

۴. بیلد و اجرای پروژه:
```bash
npm run build
npm start
```

---

## ☁️ نحوه دیپلوی (Deployment)

### روش اول: دیپلوی روی Railway

۱. وارد حساب کاربری خود در Railway شوید.
۲. یک پروژه جدید ایجاد کرده و مخزن `obsidian-telegram-bot` گیت‌هاب خود را متصل کنید.
۳. به تب **Variables** بروید و متغیرهای زیر را اضافه کنید:
   - `BOT_TOKEN`
   - `GITHUB_TOKEN`
   - `GITHUB_OWNER`
   - `GITHUB_REPO`
   - `GITHUB_BRANCH`
   - `ALLOWED_USER_IDS`
۴. به صورت خودکار دستور بیلد (`npm run build`) و اجرا (`npm start`) انجام شده و ربات آنلاین خواهد شد.

### روش دوم: دیپلوی روی سرور مجازی (VPS) با PM2

۱. کد را روی سرور کلون کرده و وابستگی‌ها را نصب کنید:
```bash
git clone git@github.com:pouriahasanii/obsidian-telegram-bot.git
cd obsidian-telegram-bot
npm install
```

۲. فایل `.env` را ایجاد و تنظیم کنید.

۳. پروژه را بیلد و با PM2 اجرا کنید:
```bash
npm run build
pm2 start dist/index.js --name "obsidian-bot"
pm2 save
```
