import { BotContext } from "../types";
import { config } from "../config/env";
import { NextFunction } from "grammy";

export async function authMiddleware(ctx: BotContext, next: NextFunction) {
  const userId = ctx.from?.id;
  if (!userId || !config.ALLOWED_USER_IDS.includes(userId)) {
    await ctx.reply("⛔ شما دسترسی به این ربات ندارید.");
    return;
  }
  await next();
}
