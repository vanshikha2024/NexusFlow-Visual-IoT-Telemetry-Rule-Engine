import https from "node:https";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { env } from "../config/env.js";
import { ApiError } from "../utils/apiError.js";

const MAX_RESPONSE_SIZE = 64 * 1024;

function isPrivateIPv4(address) {
  const [a, b, c] = address.split(".").map(Number);

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113)
  );
}

function isPublicAddress(address) {
  const family = isIP(address);

  if (family === 4) {
    return !isPrivateIPv4(address);
  }

  if (family === 6) {
    const ip = address.toLowerCase();

    if (
      ip === "::" ||
      ip === "::1" ||
      ip.startsWith("::ffff:") ||
      ip.startsWith("fc") ||
      ip.startsWith("fd") ||
      /^fe[89ab]/.test(ip) ||
      ip.startsWith("ff") ||
      ip.startsWith("2001:db8:") ||
      ip.startsWith("64:ff9b:")
    ) {
      return false;
    }

    return /^[23][0-9a-f]{0,3}:/i.test(ip);
  }

  return false;
}

export class WebhookService {
  async sendWebhook({ url: rawUrl, method = "POST", payload }) {
    let url;

    try {
      url = new URL(rawUrl);
    } catch {
      throw ApiError.badRequest("Invalid Webhook URL.");
    }

    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.hash
    ) {
      throw ApiError.badRequest(
        "Webhook URL must use HTTPS and cannot contain credentials or fragments."
      );
    }

    if (url.port && url.port !== "443") {
      throw ApiError.badRequest(
        "Only the standard HTTPS port 443 is allowed."
      );
    }

    const hostname = url.hostname
      .toLowerCase()
      .replace(/\.$/, "");

    if (isIP(hostname.replace(/^\[|\]$/g, ""))) {
      throw ApiError.badRequest(
        "Webhook IP addresses are not allowed. Use an approved hostname."
      );
    }

    if (!env.WEBHOOK_ALLOWED_HOSTS.includes(hostname)) {
      throw ApiError.forbidden(
        `Webhook hostname "${hostname}" is not in the allowed-host list.`
      );
    }

    const requestMethod = String(method).toUpperCase();

    if (!["POST", "PUT"].includes(requestMethod)) {
      throw ApiError.badRequest(
        "Webhook method must be POST or PUT."
      );
    }

    let addresses;

    try {
      addresses = await lookup(hostname, {
        all: true,
        verbatim: true,
      });
    } catch {
      throw ApiError.badRequest(
        "Webhook hostname could not be resolved."
      );
    }

    if (
      !addresses.length ||
      addresses.some((item) => !isPublicAddress(item.address))
    ) {
      throw ApiError.forbidden(
        "Webhook hostname resolves to a private or restricted IP address."
      );
    }

    const requestBody = Buffer.from(JSON.stringify(payload));

    // Pin the HTTPS connection to the addresses we just validated.
    const pinnedLookup = (_hostname, options, callback) => {
      if (options?.all) {
        callback(null, addresses);
      } else {
        const selected = addresses[0];
        callback(null, selected.address, selected.family);
      }
    };

    return new Promise((resolve, reject) => {
      const request = https.request(
        url,
        {
          method: requestMethod,
          agent: false,
          servername: hostname,
          lookup: pinnedLookup,
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "Content-Length": requestBody.length,
            "User-Agent": "NexusFlow-Webhook/1.0",
          },
        },
        (response) => {
          const chunks = [];
          let totalSize = 0;

          response.on("data", (chunk) => {
            totalSize += chunk.length;

            if (totalSize > MAX_RESPONSE_SIZE) {
              request.destroy(
                new Error("Webhook response exceeded 64 KB.")
              );
              return;
            }

            chunks.push(chunk);
          });

          response.on("end", () => {
            const responseText = Buffer.concat(chunks).toString("utf8");
            const statusCode = response.statusCode || 0;

            if (statusCode < 200 || statusCode >= 300) {
              reject(
                new Error(
                  `Webhook endpoint returned HTTP ${statusCode}.`
                )
              );
              return;
            }

            let responseBody = responseText.slice(0, 2000);

            try {
              if (responseText) {
                responseBody = JSON.parse(responseText);
              } else {
                responseBody = null;
              }
            } catch {
              // Keep a limited text response when the endpoint is not JSON.
            }

            resolve({
              delivered: true,
              hostname,
              method: requestMethod,
              statusCode,
              response: responseBody,
            });
          });
        }
      );

      request.setTimeout(env.WEBHOOK_TIMEOUT_MS, () => {
        request.destroy(
          new Error("Webhook request timed out.")
        );
      });

      request.on("error", reject);

      request.write(requestBody);
      request.end();
    });
  }
}

export const webhookService = new WebhookService();

export default webhookService;