import * as fs from "fs/promises";
import * as path from "path";
import { config } from "../config/env";
import { NoteData, WriteResult, CATEGORY_FOLDER_MAP } from "../types";

const VAULT_FOLDERS = [
  "00_Inbox",
  "01_Resources",
  "02_Tools",
  "03_Ideas",
  "04_Projects-Ref",
  "05_Playbooks",
  "06_Attachments",
];

function generateShortId(): string {
  return Math.random().toString(36).substring(2, 8);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s؀-ۿ-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 50) || "note";
}

export async function ensureVaultStructure(): Promise<void> {
  try {
    await fs.access(config.OBSIDIAN_VAULT_PATH);
  } catch {
    throw new Error(`Vault path does not exist: ${config.OBSIDIAN_VAULT_PATH}`);
  }

  for (const folder of VAULT_FOLDERS) {
    await fs.mkdir(path.join(config.OBSIDIAN_VAULT_PATH, folder), { recursive: true });
  }
  console.log("Vault structure verified.");
}

export async function writeNote(
  noteData: NoteData,
  markdownContent: string
): Promise<WriteResult> {
  const folderName = CATEGORY_FOLDER_MAP[noteData.category];
  const targetDir = path.join(config.OBSIDIAN_VAULT_PATH, folderName);

  const dateStr = new Date().toISOString().split("T")[0];
  const rawTitle =
    noteData.content.scrapedData?.title ||
    (noteData.content.rawText ? noteData.content.rawText.split("\n")[0] : null) ||
    noteData.category;
  const slug = slugify(rawTitle);
  const shortId = generateShortId();
  const fileName = `${dateStr}_${slug}_${shortId}.md`;
  const filePath = path.join(targetDir, fileName);
  const tmpPath = `${filePath}.tmp`;

  await fs.writeFile(tmpPath, markdownContent, "utf-8");
  await fs.rename(tmpPath, filePath);

  const relativePath = path.join(folderName, fileName);

  return {
    success: true,
    filePath,
    relativePath,
    fileName,
    folderName,
  };
}

export async function listFolder(
  folderName: string,
  limit = 10
): Promise<Array<{ name: string; date: Date }>> {
  try {
    const dirPath = path.join(config.OBSIDIAN_VAULT_PATH, folderName);
    const entries = await fs.readdir(dirPath);
    const mdFiles = entries.filter((f) => f.endsWith(".md"));

    const filesWithDates = await Promise.all(
      mdFiles.map(async (name) => {
        const stat = await fs.stat(path.join(dirPath, name));
        return { name, date: stat.mtime };
      })
    );

    filesWithDates.sort((a, b) => b.date.getTime() - a.date.getTime());
    return filesWithDates.slice(0, limit);
  } catch {
    return [];
  }
}
