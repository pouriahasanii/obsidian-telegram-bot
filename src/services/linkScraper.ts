import axios from "axios";
import * as cheerio from "cheerio";
import { ScrapedLinkData } from "../types";

export async function scrapeLink(url: string): Promise<ScrapedLinkData | null> {
  try {
    const response = await axios.get(url, {
      timeout: 8000,
      maxContentLength: 5 * 1024 * 1024,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      },
    });

    const contentType = String(response.headers["content-type"] || "");
    if (!contentType.includes("text/html")) {
      return { url, title: null, description: null, ogImage: null, siteName: null };
    }

    const $ = cheerio.load(response.data);

    const title =
      $('meta[property="og:title"]').attr("content") || $("title").text() || null;
    const description =
      $('meta[property="og:description"]').attr("content") ||
      $('meta[name="description"]').attr("content") ||
      null;
    const ogImage = $('meta[property="og:image"]').attr("content") || null;
    const siteName = $('meta[property="og:site_name"]').attr("content") || null;

    return { url, title, description, ogImage, siteName };
  } catch (err) {
    console.warn(`Failed to scrape ${url}:`, err instanceof Error ? err.message : err);
    return null;
  }
}
