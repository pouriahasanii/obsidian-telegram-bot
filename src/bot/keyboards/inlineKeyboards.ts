import { InlineKeyboard } from "grammy";

export function getCategoryKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("📚 آموزشی", "cat:resource")
    .text("🛠️ ابزار", "cat:tool").row()
    .text("💡 ایده", "cat:idea")
    .text("📂 مرجع پروژه", "cat:project_ref").row()
    .text("📋 چک‌لیست/SOP", "cat:playbook")
    .text("📥 Inbox مستقیم", "cat:inbox").row()
    .text("❌ لغو", "cancel");
}

export function getTopicKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("💻 برنامه‌نویسی", "topic:programming")
    .text("🎨 طراحی", "topic:design").row()
    .text("🤖 هوش مصنوعی", "topic:ai")
    .text("📝 پروپوزال", "topic:proposal").row()
    .text("⚡ ابزارهای فنی", "topic:devtools")
    .text("📎 سایر", "topic:other").row()
    .text("❌ لغو", "cancel");
}

export function getActionKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🔍 بررسی امشب", "action:review_tonight").row()
    .text("✅ تسک جدید", "action:create_task").row()
    .text("📁 فقط ذخیره", "action:just_save").row()
    .text("❌ لغو", "cancel");
}
