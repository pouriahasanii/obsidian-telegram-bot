import { Bot } from "grammy";
import { BotContext, ContentType, ConversationStep, CapturedContent } from "../../types";
import { getCategoryKeyboard } from "../keyboards/inlineKeyboards";
import { scrapeLink } from "../../services/linkScraper";
import { downloadMedia } from "../../services/mediaDownloader";

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;

function extractUrls(text: string): string[] {
  return text.match(URL_REGEX) || [];
}

export function registerMessageHandlers(bot: Bot<BotContext>) {
  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text;
    const urls = extractUrls(text);
    const contentType = urls.length > 0 ? ContentType.URL : ContentType.TEXT;

    let scrapedData = null;
    if (urls.length > 0) {
      scrapedData = await scrapeLink(urls[0]);
    }

    const content: CapturedContent = {
      contentType,
      rawText: text,
      urls,
      scrapedData,
      media: null,
      telegramMessageId: ctx.msgId,
      telegramChatId: ctx.chat.id,
      capturedAt: new Date(),
    };

    ctx.session.step = ConversationStep.AWAITING_CATEGORY;
    ctx.session.pendingContent = content;
    ctx.session.lastActivityAt = Date.now();

    const preview = text.length > 200 ? text.slice(0, 200) + "..." : text;
    let msg = `\u0645\u062D\u062A\u0648\u0627 \u062F\u0631\u06CC\u0627\u0641\u062A \u0634\u062F:\n\n${preview}`;
    if (scrapedData?.title) {
      msg += `\n\n\uD83D\uDD17 ${scrapedData.title}`;
    }
    msg += "\n\n\u062F\u0633\u062A\u0647\u200C\u0628\u0646\u062F\u06CC \u0631\u0627 \u0627\u0646\u062A\u062E\u0627\u0628 \u06A9\u0646:";

    await ctx.reply(msg, { reply_markup: getCategoryKeyboard() });
  });

  bot.on("message:photo", async (ctx) => {
    const photos = ctx.message.photo;
    const largestPhoto = photos[photos.length - 1];
    const fileId = largestPhoto.file_id;
    const caption = ctx.message.caption || "";
    const urls = extractUrls(caption);

    const media = await downloadMedia(ctx, fileId, "photo", ".jpg");

    const content: CapturedContent = {
      contentType: ContentType.PHOTO,
      rawText: caption || null,
      urls,
      scrapedData: null,
      media,
      telegramMessageId: ctx.msgId,
      telegramChatId: ctx.chat.id,
      capturedAt: new Date(),
    };

    ctx.session.step = ConversationStep.AWAITING_CATEGORY;
    ctx.session.pendingContent = content;
    ctx.session.lastActivityAt = Date.now();

    await ctx.reply(
      `\uD83D\uDDBC \u0639\u06A9\u0633 \u062F\u0631\u06CC\u0627\u0641\u062A \u0634\u062F.\n\n\u062F\u0633\u062A\u0647\u200C\u0628\u0646\u062F\u06CC \u0631\u0627 \u0627\u0646\u062A\u062E\u0627\u0628 \u06A9\u0646:`,
      { reply_markup: getCategoryKeyboard() }
    );
  });

  bot.on("message:voice", async (ctx) => {
    const fileId = ctx.message.voice.file_id;
    const media = await downloadMedia(ctx, fileId, "voice", ".ogg");

    const content: CapturedContent = {
      contentType: ContentType.VOICE,
      rawText: null,
      urls: [],
      scrapedData: null,
      media,
      telegramMessageId: ctx.msgId,
      telegramChatId: ctx.chat.id,
      capturedAt: new Date(),
    };

    ctx.session.step = ConversationStep.AWAITING_CATEGORY;
    ctx.session.pendingContent = content;
    ctx.session.lastActivityAt = Date.now();

    await ctx.reply(
      `\uD83C\uDFA4 \u0648\u0648\u06CC\u0633 \u062F\u0631\u06CC\u0627\u0641\u062A \u0634\u062F.\n\n\u062F\u0633\u062A\u0647\u200C\u0628\u0646\u062F\u06CC \u0631\u0627 \u0627\u0646\u062A\u062E\u0627\u0628 \u06A9\u0646:`,
      { reply_markup: getCategoryKeyboard() }
    );
  });

  bot.on("message:audio", async (ctx) => {
    const fileId = ctx.message.audio.file_id;
    const mimeType = ctx.message.audio.mime_type || ".mp3";
    const ext = mimeType.includes("/") ? "." + mimeType.split("/")[1] : ".mp3";
    const media = await downloadMedia(ctx, fileId, "audio", ext);

    const content: CapturedContent = {
      contentType: ContentType.AUDIO,
      rawText: ctx.message.audio.title || null,
      urls: [],
      scrapedData: null,
      media,
      telegramMessageId: ctx.msgId,
      telegramChatId: ctx.chat.id,
      capturedAt: new Date(),
    };

    ctx.session.step = ConversationStep.AWAITING_CATEGORY;
    ctx.session.pendingContent = content;
    ctx.session.lastActivityAt = Date.now();

    await ctx.reply(
      `\uD83C\uBFB5 \u0641\u0627\u06CC\u0644 \u0635\u0648\u062A\u06CC \u062F\u0631\u06CC\u0627\u0641\u062A \u0634\u062F.\n\n\u062F\u0633\u062A\u0647\u200C\u0628\u0646\u062F\u06CC \u0631\u0627 \u0627\u0646\u062A\u062E\u0627\u0628 \u06A9\u0646:`,
      { reply_markup: getCategoryKeyboard() }
    );
  });

  bot.on("message:document", async (ctx) => {
    const fileId = ctx.message.document.file_id;
    const originalName = ctx.message.document.file_name || undefined;
    const mimeType = ctx.message.document.mime_type || "";
    const ext = mimeType.includes("/") ? "." + mimeType.split("/").pop()! : ".bin";
    const media = await downloadMedia(ctx, fileId, "document", ext, originalName);

    const caption = ctx.message.caption || "";
    const urls = extractUrls(caption);

    const content: CapturedContent = {
      contentType: ContentType.DOCUMENT,
      rawText: caption || null,
      urls,
      scrapedData: null,
      media,
      telegramMessageId: ctx.msgId,
      telegramChatId: ctx.chat.id,
      capturedAt: new Date(),
    };

    ctx.session.step = ConversationStep.AWAITING_CATEGORY;
    ctx.session.pendingContent = content;
    ctx.session.lastActivityAt = Date.now();

    await ctx.reply(
      `\uD83D\uDCC4 \u0641\u0627\u06CC\u0644 \u062F\u0631\u06CC\u0627\u0641\u062A \u0634\u062F: ${media.savedFileName}\n\n\u062F\u0633\u062A\u0647\u200C\u0628\u0646\u062F\u06CC \u0631\u0627 \u0627\u0646\u062A\u062E\u0627\u0628 \u06A9\u0646:`,
      { reply_markup: getCategoryKeyboard() }
    );
  });

  bot.on("message:video", async (ctx) => {
    const fileId = ctx.message.video.file_id;
    const media = await downloadMedia(ctx, fileId, "video", ".mp4");

    const caption = ctx.message.caption || "";
    const urls = extractUrls(caption);

    const content: CapturedContent = {
      contentType: ContentType.VIDEO,
      rawText: caption || null,
      urls,
      scrapedData: null,
      media,
      telegramMessageId: ctx.msgId,
      telegramChatId: ctx.chat.id,
      capturedAt: new Date(),
    };

    ctx.session.step = ConversationStep.AWAITING_CATEGORY;
    ctx.session.pendingContent = content;
    ctx.session.lastActivityAt = Date.now();

    await ctx.reply(
      `\uD83C\uDFA5 \u0648\u06CC\u062F\u06CC\u0648 \u062F\u0631\u06CC\u0627\u0641\u062A \u0634\u062F.\n\n\u062F\u0633\u062A\u0647\u200C\u0628\u0646\u062F\u06CC \u0631\u0627 \u0627\u0646\u062A\u062E\u0627\u0628 \u06A9\u0646:`,
      { reply_markup: getCategoryKeyboard() }
    );
  });
}
