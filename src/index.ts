import { Bot, session } from "grammy";
import { config } from "./config/env";
import { BotContext, initialSession } from "./types";
import { ensureVaultStructure } from "./services/vaultManager";
import { registerCommandHandlers } from "./bot/handlers/commandHandler";
import { registerMessageHandlers } from "./bot/handlers/messageHandler";
import { registerCallbackHandlers } from "./bot/handlers/callbackHandler";

async function main() {
  await ensureVaultStructure();

  const bot = new Bot<BotContext>(config.BOT_TOKEN);

  bot.use(session({ initial: initialSession }));

  registerCommandHandlers(bot);
  registerCallbackHandlers(bot);
  registerMessageHandlers(bot);

  bot.catch((err) => {
    console.error("Bot error:", err);
    const ctx = err.ctx;
    ctx.reply("❌ خطایی رخ داد. لطفاً دوباره تلاش کن.").catch(() => {});
  });

  const shutdown = () => {
    console.log("\nShutting down...");
    bot.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  console.log("Bot started in long polling mode...");
  await bot.start();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
