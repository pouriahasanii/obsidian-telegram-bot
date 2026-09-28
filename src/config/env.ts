import { z } from "zod";
import * as dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  BOT_TOKEN: z.string().min(1, "BOT_TOKEN is required"),
  ALLOWED_USER_IDS: z
    .string()
    .optional()
    .default("")
    .transform((val) =>
      val
        ? val.split(",").map((id) => {
            const num = Number(id.trim());
            if (!Number.isInteger(num) || num <= 0) {
              throw new Error(`Invalid user ID: ${id}`);
            }
            return num;
          })
        : []
    ),
  OBSIDIAN_VAULT_PATH: z.string().min(1, "OBSIDIAN_VAULT_PATH is required"),
  NODE_ENV: z.enum(["development", "production"]).default("development"),
  SESSION_TIMEOUT: z
    .string()
    .default("300")
    .transform((val) => {
      const num = Number(val);
      if (!Number.isInteger(num) || num <= 0) {
        throw new Error("SESSION_TIMEOUT must be a positive integer");
      }
      return num;
    }),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Environment validation failed:");
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const config = parsed.data;
