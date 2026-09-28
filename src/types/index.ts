import { Context, SessionFlavor } from "grammy";

export enum NoteCategory {
  RESOURCE = "resource",
  TOOL = "tool",
  IDEA = "idea",
  PROJECT_REF = "project_ref",
  PLAYBOOK = "playbook",
  INBOX = "inbox",
}

export enum NoteTopic {
  PROGRAMMING = "programming",
  DESIGN = "design",
  AI = "ai",
  PROPOSAL = "proposal",
  DEVTOOLS = "devtools",
  OTHER = "other",
}

export enum NextAction {
  REVIEW_TONIGHT = "review_tonight",
  CREATE_TASK = "create_task",
  JUST_SAVE = "just_save",
}

export enum ContentType {
  TEXT = "text",
  URL = "url",
  PHOTO = "photo",
  VOICE = "voice",
  AUDIO = "audio",
  DOCUMENT = "document",
  VIDEO = "video",
}

export enum ConversationStep {
  IDLE = "idle",
  AWAITING_CATEGORY = "awaiting_category",
  AWAITING_TOPIC = "awaiting_topic",
  AWAITING_ACTION = "awaiting_action",
}

export interface ScrapedLinkData {
  url: string;
  title: string | null;
  description: string | null;
  ogImage: string | null;
  siteName: string | null;
}

export interface DownloadedMedia {
  originalFileName: string;
  savedFileName: string;
  savedPath: string;
  mimeType: string;
  fileSize: number;
}

export interface CapturedContent {
  contentType: ContentType;
  rawText: string | null;
  urls: string[];
  scrapedData: ScrapedLinkData | null;
  media: DownloadedMedia | null;
  telegramMessageId: number;
  telegramChatId: number;
  capturedAt: Date;
}

export interface NoteData {
  content: CapturedContent;
  category: NoteCategory;
  topic: NoteTopic;
  action: NextAction;
}

export interface WriteResult {
  success: boolean;
  filePath: string;
  relativePath: string;
  fileName: string;
  folderName: string;
}

export interface SessionData {
  step: ConversationStep;
  pendingContent: CapturedContent | null;
  selectedCategory: NoteCategory | null;
  selectedTopic: NoteTopic | null;
  lastActivityAt: number;
  stats: {
    totalCaptured: number;
    byCategory: Record<NoteCategory, number>;
  };
}

export type BotContext = Context & SessionFlavor<SessionData>;

export const CATEGORY_FOLDER_MAP: Record<NoteCategory, string> = {
  [NoteCategory.RESOURCE]: "01_Resources",
  [NoteCategory.TOOL]: "02_Tools",
  [NoteCategory.IDEA]: "03_Ideas",
  [NoteCategory.PROJECT_REF]: "04_Projects-Ref",
  [NoteCategory.PLAYBOOK]: "05_Playbooks",
  [NoteCategory.INBOX]: "00_Inbox",
};

export function initialSession(): SessionData {
  return {
    step: ConversationStep.IDLE,
    pendingContent: null,
    selectedCategory: null,
    selectedTopic: null,
    lastActivityAt: 0,
    stats: {
      totalCaptured: 0,
      byCategory: {
        [NoteCategory.RESOURCE]: 0,
        [NoteCategory.TOOL]: 0,
        [NoteCategory.IDEA]: 0,
        [NoteCategory.PROJECT_REF]: 0,
        [NoteCategory.PLAYBOOK]: 0,
        [NoteCategory.INBOX]: 0,
      },
    },
  };
}
