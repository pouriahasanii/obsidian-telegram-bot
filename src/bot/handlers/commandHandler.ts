import { Bot } from "grammy";
import { BotContext, NoteCategory, NoteTopic, NextAction, ContentType, ConversationStep, CapturedContent } from "../../types";
import { formatMarkdown } from "../../services/markdownFormatter";
import { writeNote, listFolder } from "../../services/vaultManager";

const CATEGORY_LABELS: Record<NoteCategory, string> = {
  [NoteCategory.RESOURCE]: "\uD83D\uDCDA \u0622\u0645\u0648\u0632\u0634\u06CC",
  [NoteCategory.TOOL]: "\uD83D\uDEE0\uFE0F \u0627\u0628\u0632\u0627\u0631",
  [NoteCategory.IDEA]: "\uD83D\uDCA1 \u0627\u06CC\u062F\u0647",
  [NoteCategory.PROJECT_REF]: "\uD83D\uDCC2 \u0645\u0631\u062C\u0639 \u067E\u0631\u0648\u0698\u0647",
  [NoteCategory.PLAYBOOK]: "\uD83D\uDCCB \u0686\u06A9\u200C\u0644\u06CC\u0633\u062A/SOP",
  [NoteCategory.INBOX]: "\uD83D\uDCE5 Inbox",
};

export function registerCommandHandlers(bot: Bot<BotContext>) {
  bot.command("start", async (ctx) => {
    await ctx.reply(
      "\u0633\u0644\u0627\u0645! \uD83D\uDC4B\n" +
        "\u0645\u0646 \u0631\u0628\u0627\u062A \u062F\u0633\u062A\u0647\u200C\u0628\u0646\u062F\u06CC \u0645\u062D\u062A\u0648\u0627 \u0628\u0631\u0627\u06CC Obsidian \u0647\u0633\u062A\u0645.\n\n" +
        "\u0645\u062A\u0646\u060C \u0644\u06CC\u0646\u06A9\u060C \u0639\u06A9\u0633\u060C \u0641\u0627\u06CC\u0644 \u06CC\u0627 \u0648\u0648\u06CC\u0633 \u0628\u0641\u0631\u0633\u062A \u062A\u0627 \u062F\u0633\u062A\u0647\u200C\u0628\u0646\u062F\u06CC \u06A9\u0646\u0645.\n\n" +
        "\u062F\u0633\u062A\u0648\u0631\u0627\u062A:\n" +
        "/quick <\u0645\u062A\u0646> - \u0630\u062E\u06CC\u0631\u0647 \u0633\u0631\u06CC\u0639 \u062F\u0631 Inbox\n" +
        "/inbox - \u0646\u0645\u0627\u06CC\u0634 \u0622\u062E\u0631\u06CC\u0646 \u0641\u0627\u06CC\u0644\u200C\u0647\u0627\u06CC Inbox\n" +
        "/stats - \u0622\u0645\u0627\u0631 \u0630\u062E\u06CC\u0631\u0647\u200C\u0633\u0627\u0632\u06CC"
    );
  });

  bot.command("quick", async (ctx) => {
    const text = ctx.match?.trim();
    if (!text || typeof text !== "string" || text.length === 0) {
      await ctx.reply("\u0627\u0633\u062A\u0641\u0627\u062F\u0647: /quick <\u0645\u062A\u0646 \u06CC\u0627\u062F\u062F\u0627\u0634\u062A>");
      return;
    }

    const content: CapturedContent = {
      contentType: ContentType.TEXT,
      rawText: text as string,
      urls: [],
      scrapedData: null,
      media: null,
      telegramMessageId: ctx.msgId,
      telegramChatId: ctx.chat.id,
      capturedAt: new Date(),
    };

    const noteData = {
      content,
      category: NoteCategory.INBOX,
      topic: NoteTopic.OTHER,
      action: NextAction.JUST_SAVE,
    };

    try {
      const markdown = formatMarkdown(noteData);
      const result = await writeNote(noteData, markdown);
      ctx.session.stats.totalCaptured++;
      ctx.session.stats.byCategory[NoteCategory.INBOX]++;
      await ctx.reply(`\u2705 \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F!\n\uD83D\uDCC1 ${result.relativePath}`);
    } catch (err) {
      await ctx.reply("\u274C \u062E\u0637\u0627 \u062F\u0631 \u0630\u062E\u06CC\u0631\u0647\u200C\u0633\u0627\u0632\u06CC.");
    }
  });

  bot.command("inbox", async (ctx) => {
    const files = await listFolder("00_Inbox", 10);
    if (files.length === 0) {
      await ctx.reply("\uD83D\uDCE5 Inbox \u062E\u0627\u0644\u06CC \u0627\u0633\u062A.");
      return;
    }
    const lines = files.map((f) => `\u2022 ${f.name} (${f.date.toLocaleDateString("fa-IR")})`);
    await ctx.reply(`\uD83D\uDCE5 \u0622\u062E\u0631\u06CC\u0646 \u0641\u0627\u06CC\u0644\u200C\u0647\u0627\u06CC Inbox:\n\n${lines.join("\n")}`);
  });

  bot.command("stats", async (ctx) => {
    const s = ctx.session.stats;
    const lines = Object.entries(CATEGORY_LABELS).map(
      ([cat, label]) => `${label}: ${s.byCategory[cat as NoteCategory] || 0}`
    );
    await ctx.reply(`\uD83D\uDCCA \u0622\u0645\u0627\u0631:\n\n\u0645\u062C\u0645\u0648\u0639: ${s.totalCaptured}\n\n${lines.join("\n")}`);
  });
}
