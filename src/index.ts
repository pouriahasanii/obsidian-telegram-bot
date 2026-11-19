import { Bot, InlineKeyboard, Context } from "grammy";
import axios from "axios";
import * as cheerio from "cheerio";
import * as yaml from "js-yaml";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

const envCandidates = [
  path.resolve(process.cwd(), ".env"),
  "/home/container/.env",
];

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    const raw = fs.readFileSync(envPath, "utf8").replace(/^\uFEFF/, "");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, "");
        if (!process.env[key]) process.env[key] = val;
      }
    }
    break;
  }
}

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
  console.error("Missing env vars:", {
    cwd: process.cwd(),
    hasBotToken: Boolean(BOT_TOKEN),
    hasGithubToken: Boolean(GITHUB_TOKEN),
  });
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
  userNote: string;
  caption?: string;
  author?: string;
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

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|\n\r]+/g, "-").trim().slice(0, 50);
}

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

async function extractPostContent(
  text: string,
  url: string | undefined,
  source: string
): Promise<{ title: string; caption?: string; author?: string; userNote: string }> {
  const userNote = text.replace(/https?:\/\/[^\s]+/g, "").trim();
  let title = userNote.length > 3 ? sanitizeFilename(userNote.split("\n")[0]) : "";
  let caption: string | undefined;
  let author: string | undefined;

  if (url) {
    try {
      if (source === "twitter") {
        const match = url.match(/(?:twitter\.com|x\.com)\/([^/]+)\/status\/(\d+)/i);
        if (match) {
          const res = await axios.get(`https://api.fxtwitter.com/${match[1]}/status/${match[2]}`, {
            timeout: 6000,
          });
          const tweet = res.data?.tweet;
          if (tweet) {
            caption = tweet.text || undefined;
            author = tweet.author?.name ? `${tweet.author.name} (@${tweet.author.screen_name})` : `@${match[1]}`;
            if (!title && caption) title = sanitizeFilename(caption.split("\n")[0]);
          }
        }
      } else if (source === "youtube") {
        const res = await axios.get(
          `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
          { timeout: 6000 }
        );
        if (res.data?.title) {
          if (!title) title = sanitizeFilename(res.data.title);
          caption = res.data.title;
          author = res.data.author_name || undefined;
        }
      } else {
        const res = await axios.get(url, {
          timeout: 6000,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9,fa;q=0.8",
          },
        });
        const $ = cheerio.load(res.data);
        const ogTitle = $('meta[property="og:title"]').attr("content")?.trim() || $("title").first().text().trim();
        const ogDesc =
          $('meta[property="og:description"]').attr("content")?.trim() ||
          $('meta[name="description"]').attr("content")?.trim();

        if (ogDesc) {
          if (source === "instagram") {
            const quoted = ogDesc.match(/:\s*["“]([\s\S]+)["”]\s*\.?$/);
            caption = quoted ? quoted[1].trim() : ogDesc;
            const igAuthor = ogDesc.match(/-\s*([^-\n]+?)\s+on\s+/i);
            if (igAuthor) author = igAuthor[1].trim();
          } else {
            caption = ogDesc;
          }
        }
        if (!title && ogTitle) title = sanitizeFilename(ogTitle);
      }
    } catch {
      // Fallback gracefully when scraping is blocked
    }
  }

  if (!title) {
    title = `Note-${new Date().toISOString().slice(11, 19).replace(/:/g, "")}`;
  }

  return { title, caption, author, userNote };
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
  const sourceLabel = draft.source.charAt(0).toUpperCase() + draft.source.slice(1);
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
  if (draft.author) frontmatter.author = draft.author;
  if (draft.url) frontmatter.url = draft.url;

  const lines: string[] = [
    "---",
    yaml.dump(frontmatter).trim(),
    "---",
    "",
    `# ${draft.title}`,
    "",
    `🧭 **گراف و اتصالات:** [[${folder}]] · [[${sourceLabel}]] · [[Visual_Board.canvas|بورد تصویری]]`,
  ];

  if (draft.author) lines.push(`👤 **نویسنده / پیج:** ${draft.author}`);
  if (draft.url) lines.push(`🔗 **لینک منبع:** ${draft.url}`);

  lines.push("");

  if (draft.caption) {
    lines.push("## 📝 کپشن پست", "", draft.caption, "");
    if (draft.userNote) {
      lines.push("## 💬 یادداشت شخصی", "", draft.userNote, "");
    }
  } else {
    lines.push("## 📝 محتوا", "", draft.userNote || draft.text, "");
  }

  const base64Content = Buffer.from(lines.join("\n"), "utf8").toString("base64");

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
    "✅ ربات مدیریت دانش Obsidian آماده است!\n\nهر لینک (اینستاگرام، توییتر/X، یوتیوب، وب) یا متنی را بفرستید تا کپشن آن استخراج شود، پوشه و Status را انتخاب کنید و مستقیم در گیت‌هاب و گراف Obsidian ذخیره شود."
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
    await ctx.reply(
      `📁 <b>پوشه جدید انتخاب شد:</b> <code>${escapeHtml(cleanFolder)}</code>\n\nحالا <b>Status</b> یادداشت را انتخاب کنید:`,
      { parse_mode: "HTML", reply_markup: buildStatusKeyboard() }
    );
    return;
  }

  const { source, url } = detectSource(text);
  const { title, caption, author, userNote } = await extractPostContent(text, url, source);

  drafts.set(userId, { text, userNote, caption, author, url, title, source });
  const kb = await buildFolderKeyboard();
  const captionPreview = caption ? `\n📝 <b>کپشن استخراج شد</b> (${caption.length} کاراکتر)` : "";

  await ctx.reply(
    `📌 <b>عنوان:</b> ${escapeHtml(title)}\n🌐 <b>منبع:</b> ${escapeHtml(source)}${captionPreview}\n\nلطفاً پوشه مقصد در Obsidian را انتخاب کنید:`,
    { parse_mode: "HTML", reply_markup: kb }
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
      await ctx.editMessageText(
        "✏️ نام پوشه جدید را تایپ و ارسال کنید (مثلاً <code>08_Marketing</code> یا <code>Security</code>):",
        { parse_mode: "HTML" }
      );
      return;
    }
    draft.folder = folder;
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `📁 <b>پوشه انتخاب‌شده:</b> <code>${escapeHtml(folder)}</code>\n\nحالا <b>Status</b> این مطلب را انتخاب کنید:`,
      { parse_mode: "HTML", reply_markup: buildStatusKeyboard() }
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
        `✅ <b>در Obsidian و GitHub ذخیره شد!</b>\n\n📁 <b>پوشه:</b> <code>${escapeHtml(draft.folder || "00_Inbox")}</code>\n🏷 <b>وضعیت:</b> <code>${escapeHtml(status)}</code>\n🌐 <b>منبع:</b> ${escapeHtml(draft.source)}\n🔗 <a href="${fileUrl}">مشاهده فایل در گیت‌هاب</a>`,
        { parse_mode: "HTML" }
      );
    } catch (err: any) {
      await ctx.editMessageText(`❌ خطا در ذخیره فایل در گیت‌هاب:\n${err.message}`);
    }
  }
});

bot.catch((err) => {
  console.error("Bot error:", err.message || err);
});

bot.start();
console.log("🚀 Obsidian Telegram Bot (GitHub API mode) is running...");
