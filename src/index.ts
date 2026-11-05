import { Bot, InlineKeyboard, Context } from "grammy";
import axios from "axios";
import * as cheerio from "cheerio";
import * as yaml from "js-yaml";
import * as dotenv from "dotenv";

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN || "";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const GITHUB_OWNER = process.env.GITHUB_OWNER || "pouriahasanii";
const GITHUB_REPO = process.env.GITHUB_REPO || "obsidian-pkm-vault";
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main";
const ALLOWED_USERS = (process.env.ALLOWED_USER_IDS || "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

if (!BOT_TOKEN || !GITHUB_TOKEN) {
  console.error("Missing BOT_TOKEN or GITHUB_TOKEN in environment variables.");
  process.exit(1);
}

const bot = new Bot(BOT_TOKEN);

const DEFAULT_FOLDERS = [
  "00_Inbox",
  "01_Learn",
  "02_AI",
  "03_Code",
  "04_Design",
  "05_Ebooks",
  "06_Tools",
  "07_Ideas",
  "99_Archive",
];

const STATUS_LIST = [
  "learn",
  "AI",
  "code",
  "design",
  "ebook",
  "to-read",
  "reference",
  "archived",
];

interface DraftNote {
  text: string;
  url?: string;
  title: string;
  source: string;
  folder?: string;
  awaitingNewFolder?: boolean;
}

const drafts = new Map<number, DraftNote>();
let customFolders: string[] = [];

const githubApi = axios.create({
  baseURL: `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`,
  headers: {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  },
});

async function getAvailableFolders(): Promise<string[]> {
  try {
    const res = await githubApi.get(`/contents?ref=${GITHUB_BRANCH}`);
    const repoDirs = Array.isArray(res.data)
      ? res.data
          .filter((item: any) => item.type === "dir" && !item.name.startsWith("."))
          .map((item: any) => item.name)
      : [];
    return Array.from(new Set([...DEFAULT_FOLDERS, ...customFolders, ...repoDirs])).sort();
  } catch {
    return Array.from(new Set([...DEFAULT_FOLDERS, ...customFolders])).sort();
  }
}

function detectSource(text: string): { source: string; url?: string } {
  const urlMatch = text.match(/https?:\/\/[^\s]+/i);
  const url = urlMatch ? urlMatch[0] : undefined;
  if (!url) return { source: "telegram" };
  const lower = url.toLowerCase();
  if (lower.includes("instagram.com")) return { source: "instagram", url };
  if (lower.includes("twitter.com") || lower.includes("x.com")) return { source: "twitter", url };
  if (lower.includes("youtube.com") || lower.includes("youtu.be")) return { source: "youtube", url };
  if (lower.includes("github.com")) return { source: "github", url };
  if (lower.includes("t.me")) return { source: "telegram", url };
  return { source: "web", url };
}

async function extractTitle(text: string, url?: string): Promise<string> {
  const cleanText = text.replace(/https?:\/\/[^\s]+/g, "").trim();
  if (cleanText.length > 3) {
    return cleanText.split("\n")[0].slice(0, 50).replace(/[\\/:*?"<>|]/g, "-");
  }
  if (url) {
    try {
      const res = await axios.get(url, { timeout: 5000 });
      const $ = cheerio.load(res.data);
      const pageTitle = $("title").first().text().trim();
      if (pageTitle) return pageTitle.slice(0, 50).replace(/[\\/:*?"<>|]/g, "-");
    } catch {
      // Fallback if scraping is blocked
    }
  }
  return `Note-${new Date().toISOString().slice(11, 19).replace(/:/g, "")}`;
}

async function buildFolderKeyboard(): Promise<InlineKeyboard> {
  const folders = await getAvailableFolders();
  const kb = new InlineKeyboard();
  folders.forEach((folder, idx) => {
    kb.text(`📁 ${folder}`, `folder:${folder}`);
    if (idx % 2 === 1) kb.row();
  });
  kb.row().text("➕ ساخت پوشه جدید", "folder:__NEW__");
  return kb;
}

function buildStatusKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  STATUS_LIST.forEach((st, idx) => {
    kb.text(`🏷 ${st}`, `status:${st}`);
    if (idx % 2 === 1) kb.row();
  });
  return kb;
}

async function saveNoteToGitHub(draft: DraftNote, status: string): Promise<string> {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const shortId = Math.random().toString(36).substring(2, 7);
  const folder = draft.folder || "00_Inbox";
  const category = folder.replace(/^\d+_/, "").toLowerCase();
  const safeTitle = draft.title.replace(/\s+/g, "-").slice(0, 40) || "capture";
  const filePath = `${folder}/${dateStr}_${safeTitle}_${shortId}.md`;

  const frontmatter: Record<string, any> = {
    title: draft.title,
    category,
    status,
    source: draft.source,
    captured_at: now.toISOString(),
    tags: [`cat/${category}`, `status/${status}`, `src/${draft.source}`],
  };
  if (draft.url) frontmatter.url = draft.url;

  const mdContent = [
    "---",
    yaml.dump(frontmatter).trim(),
    "---",
    "",
    `# ${draft.title}`,
    "",
    draft.url ? `🔗 **لینک منبع:** ${draft.url}\n` : "",
    "## 📝 محتوا",
    "",
    draft.text,
    "",
  ].join("\n");

  const base64Content = Buffer.from(mdContent, "utf8").toString("base64");

  const res = await githubApi.put(`/contents/${encodeURI(filePath)}`, {
    message: `📥 Capture [${category}/${status}]: ${draft.title}`,
    content: base64Content,
    branch: GITHUB_BRANCH,
  });

  return res.data?.content?.html_url || `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/blob/${GITHUB_BRANCH}/${filePath}`;
}

bot.use(async (ctx, next) => {
  const userId = String(ctx.from?.id || "");
  if (ALLOWED_USERS.length > 0 && !ALLOWED_USERS.includes(userId)) {
    await ctx.reply("⛔ شما مجاز به استفاده از این ربات نیستید.");
    return;
  }
  await next();
});

bot.command("start", async (ctx) => {
  await ctx.reply(
    "✅ ربات مدیریت دانش Obsidian آماده است!\n\nهر لینک (اینستاگرام، توییتر/X، یوتیوب، وب) یا متنی را بفرستید تا پوشه و Status آن را انتخاب کنید و مستقیم در گیت‌هاب و Obsidian ذخیره شود."
  );
});

bot.on(["message:text", "message:caption"], async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  const text = ctx.message?.text || ctx.message?.caption || "";
  if (text.startsWith("/")) return;

  const existingDraft = drafts.get(userId);
  if (existingDraft && existingDraft.awaitingNewFolder) {
    const cleanFolder = text.trim().replace(/[\\/:*?"<>|\s]+/g, "_");
    existingDraft.folder = cleanFolder;
    existingDraft.awaitingNewFolder = false;
    if (!customFolders.includes(cleanFolder)) customFolders.push(cleanFolder);
    await ctx.reply(`📁 پوشه جدید «${cleanFolder}» انتخاب شد.\nحالا Status یادداشت را انتخاب کنید:`, {
      reply_markup: buildStatusKeyboard(),
    });
    return;
  }

  const { source, url } = detectSource(text);
  const title = await extractTitle(text, url);

  drafts.set(userId, { text, url, title, source });
  const kb = await buildFolderKeyboard();
  await ctx.reply(
    `📌 **عنوان:** ${title}\n🌐 **منبع:** ${source}\n\nلطفاً پوشه مقصد در Obsidian را انتخاب کنید:`,
    { parse_mode: "Markdown", reply_markup: kb }
  );
});

bot.on("callback_query:data", async (ctx) => {
  const userId = ctx.from?.id;
  const data = ctx.callbackQuery.data;
  const draft = drafts.get(userId);

  if (!draft) {
    await ctx.answerCallbackQuery({ text: "یادداشتی در جریان نیست. لطفاً پیام را مجدد بفرستید." });
    return;
  }

  if (data.startsWith("folder:")) {
    const folder = data.replace("folder:", "");
    if (folder === "__NEW__") {
      draft.awaitingNewFolder = true;
      await ctx.answerCallbackQuery();
      await ctx.editMessageText("✏️ نام پوشه جدید را تایپ و ارسال کنید (مثلاً `08_Marketing` یا `Security`):", {
        parse_mode: "Markdown",
      });
      return;
    }
    draft.folder = folder;
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `📁 **پوشه انتخاب‌شده:** ${folder}\n\nحالا **Status** این مطلب را انتخاب کنید:`,
      { parse_mode: "Markdown", reply_markup: buildStatusKeyboard() }
    );
    return;
  }

  if (data.startsWith("status:")) {
    const status = data.replace("status:", "");
    await ctx.answerCallbackQuery({ text: "در حال ذخیره در GitHub..." });
    try {
      const fileUrl = await saveNoteToGitHub(draft, status);
      drafts.delete(userId);
      await ctx.editMessageText(
        `✅ **در Obsidian و GitHub ذخیره شد!**\n\n📁 **پوشه:** ${draft.folder}\n🏷 **وضعیت:** ${status}\n🌐 **منبع:** ${draft.source}\n🔗 [مشاهده فایل در گیت‌هاب](${fileUrl})`,
        { parse_mode: "Markdown" }
      );
    } catch (err: any) {
      await ctx.editMessageText(`❌ خطا در ذخیره فایل در گیت‌هاب:\n${err.message}`);
    }
  }
});

bot.start();
console.log("🚀 Obsidian Telegram Bot (GitHub API mode) is running...");
