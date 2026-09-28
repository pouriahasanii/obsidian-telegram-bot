import * as yaml from "js-yaml";
import { NoteData, NoteCategory, NoteTopic, NextAction, ContentType } from "../types";

export function formatMarkdown(noteData: NoteData): string {
  const { content, category, topic, action } = noteData;

  const title =
    content.scrapedData?.title ||
    (content.rawText ? content.rawText.split("\n")[0].slice(0, 60) : null) ||
    (content.media ? content.media.savedFileName : null) ||
    "Untitled";

  const source = content.urls.length > 0 ? content.urls[0] : "telegram";

  const tags: string[] = [`cat/${category}`, `topic/${topic}`];
  if (action === NextAction.REVIEW_TONIGHT) tags.push("review");
  if (action === NextAction.CREATE_TASK) tags.push("todo");
  if (content.contentType === ContentType.URL) tags.push("link");
  if (content.media) tags.push("has-attachment");

  const frontmatterObj: Record<string, unknown> = {
    title,
    category,
    topic,
    action,
    content_type: content.contentType,
    source,
    captured_at: content.capturedAt.toISOString(),
    tags,
  };

  if (content.scrapedData?.siteName) {
    frontmatterObj.site_name = content.scrapedData.siteName;
  }
  if (content.media) {
    frontmatterObj.attachment = content.media.savedFileName;
  }

  const frontmatter = yaml.dump(frontmatterObj, {
    lineWidth: -1,
    quotingType: '"',
    forceQuotes: false,
  });

  const lines: string[] = [];
  lines.push("---");
  lines.push(frontmatter.trimEnd());
  lines.push("---");
  lines.push("");
  lines.push(`# ${title}`);

  if (content.urls.length > 0) {
    lines.push("");
    lines.push("## 🔗 منبع");
    for (const url of content.urls) {
      lines.push(`- ${url}`);
    }
  }

  if (content.scrapedData?.description) {
    lines.push("");
    lines.push("## 📝 خلاصه");
    lines.push(`> ${content.scrapedData.description}`);
  }

  if (content.rawText) {
    lines.push("");
    lines.push("## 💬 محتوا");
    lines.push(content.rawText);
  }

  if (content.media) {
    lines.push("");
    lines.push("## 📎 پیوست");
    lines.push(`![[${content.media.savedFileName}]]`);
  }

  if (action === NextAction.REVIEW_TONIGHT || action === NextAction.CREATE_TASK) {
    lines.push("");
    lines.push("## ⚡ اقدام");
    if (action === NextAction.REVIEW_TONIGHT) {
      lines.push("- [ ] بررسی امشب");
    }
    if (action === NextAction.CREATE_TASK) {
      lines.push("- [ ] تسک جدید ایجاد شود");
    }
  }

  lines.push("");
  return lines.join("\n");
}
