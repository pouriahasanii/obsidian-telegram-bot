import { Bot } from "grammy";
import {
  BotContext,
  NoteCategory,
  NoteTopic,
  NextAction,
  ConversationStep,
  NoteData,
} from "../../types";
import { config } from "../../config/env";
import { getTopicKeyboard, getActionKeyboard } from "../keyboards/inlineKeyboards";
import { formatMarkdown } from "../../services/markdownFormatter";
import { writeNote } from "../../services/vaultManager";

const CATEGORY_LABELS: Record<NoteCategory, string> = {
  [NoteCategory.RESOURCE]: "📚 آموزشی",
  [NoteCategory.TOOL]: "🛠️ ابزار",
  [NoteCategory.IDEA]: "💡 ایده",
  [NoteCategory.PROJECT_REF]: "📂 مرجع پروژه",
  [NoteCategory.PLAYBOOK]: "📋 چک‌لیست/SOP",
  [NoteCategory.INBOX]: "📥 Inbox",
};

const TOPIC_LABELS: Record<NoteTopic, string> = {
  [NoteTopic.PROGRAMMING]: "💻 برنامه‌نویسی",
  [NoteTopic.DESIGN]: "🎨 طراحی",
  [NoteTopic.AI]: "🤖 هوش مصنوعی",
  [NoteTopic.PROPOSAL]: "📝 پروپوزال",
  [NoteTopic.DEVTOOLS]: "⚡ ابزارهای فنی",
  [NoteTopic.OTHER]: "📎 سایر",
};

const ACTION_LABELS: Record<NextAction, string> = {
  [NextAction.REVIEW_TONIGHT]: "🔍 بررسی امشب",
  [NextAction.CREATE_TASK]: "✅ تسک جدید",
  [NextAction.JUST_SAVE]: "📁 فقط ذخیره",
};

function isSessionExpired(ctx: BotContext): boolean {
  const elapsed = Date.now() - ctx.session.lastActivityAt;
  return elapsed > config.SESSION_TIMEOUT * 1000;
}

function resetSession(ctx: BotContext) {
  ctx.session.step = ConversationStep.IDLE;
  ctx.session.pendingContent = null;
  ctx.session.selectedCategory = null;
  ctx.session.selectedTopic = null;
}

async function finalizeAndSave(ctx: BotContext, action: NextAction) {
  if (!ctx.session.pendingContent || !ctx.session.selectedCategory || !ctx.session.selectedTopic) {
    await ctx.reply("⚠️ داده‌های ناقص. لطفاً دوباره ارسال کن.");
    resetSession(ctx);
    return;
  }

  const noteData: NoteData = {
    content: ctx.session.pendingContent,
    category: ctx.session.selectedCategory,
    topic: ctx.session.selectedTopic,
    action,
  };

  try {
    const markdown = formatMarkdown(noteData);
    const result = await writeNote(noteData, markdown);

    ctx.session.stats.totalCaptured++;
    ctx.session.stats.byCategory[noteData.category]++;

    await ctx.editMessageText(
      `✅ ذخیره شد!\n\n` +
        `📁 ${result.relativePath}\n` +
        `🏷 دسته: ${CATEGORY_LABELS[noteData.category]}\n` +
        `📌 موضوع: ${TOPIC_LABELS[noteData.topic]}\n` +
        `⚡ اقدام: ${ACTION_LABELS[action]}`
    );
  } catch (err) {
    console.error("Failed to save note:", err);
    await ctx.reply("❌ خطا در ذخیره‌سازی. لطفاً دوباره تلاش کن.");
  }

  resetSession(ctx);
}

export function registerCallbackHandlers(bot: Bot<BotContext>) {
  bot.on("callback_query:data", async (ctx) => {
    await ctx.answerCallbackQuery();
    const data = ctx.callbackQuery.data;

    if (isSessionExpired(ctx)) {
      resetSession(ctx);
      await ctx.reply("⏰ زمان تمام شد. لطفاً دوباره محتوا بفرست.");
      return;
    }

    if (data === "cancel") {
      resetSession(ctx);
      await ctx.editMessageText("❌ لغو شد.");
      return;
    }

    const [prefix, value] = data.split(":");

    if (prefix === "cat") {
      if (ctx.session.step !== ConversationStep.AWAITING_CATEGORY) {
        await ctx.reply("⚠️ وضعیت نامعتبر.");
        resetSession(ctx);
        return;
      }

      const category = value as NoteCategory;
      ctx.session.selectedCategory = category;
      ctx.session.lastActivityAt = Date.now();

      if (category === NoteCategory.INBOX) {
        ctx.session.selectedTopic = NoteTopic.OTHER;
        await finalizeAndSave(ctx, NextAction.JUST_SAVE);
        return;
      }

      ctx.session.step = ConversationStep.AWAITING_TOPIC;
      await ctx.editMessageText("موضوع را انتخاب کن:", {
        reply_markup: getTopicKeyboard(),
      });
    } else if (prefix === "topic") {
      if (ctx.session.step !== ConversationStep.AWAITING_TOPIC) {
        await ctx.reply("⚠️ وضعیت نامعتبر.");
        resetSession(ctx);
        return;
      }

      ctx.session.selectedTopic = value as NoteTopic;
      ctx.session.step = ConversationStep.AWAITING_ACTION;
      ctx.session.lastActivityAt = Date.now();

      await ctx.editMessageText("اقدام بعدی را انتخاب کن:", {
        reply_markup: getActionKeyboard(),
      });
    } else if (prefix === "action") {
      if (ctx.session.step !== ConversationStep.AWAITING_ACTION) {
        await ctx.reply("⚠️ وضعیت نامعتبر.");
        resetSession(ctx);
        return;
      }

      ctx.session.lastActivityAt = Date.now();
      await finalizeAndSave(ctx, value as NextAction);
    }
  });
}
