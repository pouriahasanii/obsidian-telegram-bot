import * as fs from "fs/promises";
import * as path from "path";
import axios from "axios";
import { BotContext, DownloadedMedia } from "../types";
import { config } from "../config/env";

const MIME_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".pdf": "application/pdf",
};

function generateShortId(): string {
  return Math.random().toString(36).substring(2, 8);
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, "-")
    .slice(0, 100);
}

function guessMimeType(ext: string): string {
  return MIME_MAP[ext.toLowerCase()] || "application/octet-stream";
}

export async function downloadMedia(
  ctx: BotContext,
  fileId: string,
  mediaType: string,
  defaultExt: string,
  originalName?: string
): Promise<DownloadedMedia> {
  const file = await ctx.api.getFile(fileId);

  let ext = defaultExt;
  if (originalName) {
    const parsed = path.extname(originalName);
    if (parsed) ext = parsed;
  } else if (file.file_path) {
    const parsed = path.extname(file.file_path);
    if (parsed) ext = parsed;
  }

  const dateStr = new Date().toISOString().split("T")[0];
  const savedFileName = originalName
    ? `${dateStr}_${sanitizeFileName(path.basename(originalName, path.extname(originalName)))}${ext}`
    : `${dateStr}_${mediaType}_${generateShortId()}${ext}`;

  const attachmentsDir = path.join(config.OBSIDIAN_VAULT_PATH, "06_Attachments");
  await fs.mkdir(attachmentsDir, { recursive: true });
  const savePath = path.join(attachmentsDir, savedFileName);

  const downloadUrl = `https://api.telegram.org/file/bot${config.BOT_TOKEN}/${file.file_path}`;
  const response = await axios.get(downloadUrl, { responseType: "arraybuffer" });
  const buffer = Buffer.from(response.data);
  await fs.writeFile(savePath, buffer);

  return {
    originalFileName: originalName || savedFileName,
    savedFileName,
    savedPath: savePath,
    mimeType: guessMimeType(ext),
    fileSize: buffer.length,
  };
}
