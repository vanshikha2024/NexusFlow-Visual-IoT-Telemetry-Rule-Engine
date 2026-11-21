import { env } from "../config/env.js";
import { ApiError } from "../utils/apiError.js";

export class TelegramService {
  async sendMessage(message) {
    const token = env.TELEGRAM_BOT_TOKEN;
    const chatId = env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      throw ApiError.badRequest(
        "Telegram bot credentials are not configured."
      );
    }

    if (
      typeof message !== "string" ||
      !message.trim() ||
      message.length > 4096
    ) {
      throw ApiError.badRequest(
        "Telegram message must contain 1–4096 characters."
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chat_id: chatId,
            text: message.trim(),
          }),
          signal: controller.signal,
        }
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data.description || `Telegram API returned HTTP ${response.status}.`
        );
      }

      return {
        delivered: true,
        channel: "telegram",
        chatId,
        messageId: data.result.message_id,
        date: data.result.date,
      };
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error("Telegram notification timed out.");
      }

      if (error instanceof SyntaxError) {
        throw new Error("Invalid response received from Telegram.");
      }

      throw new Error(
        `Telegram notification failed: ${error.message}`
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const telegramService = new TelegramService();

export default telegramService;