import * as cheerio from "cheerio";
import { salonProfile } from "@/lib/salonProfile";

const allowedTags = new Set([
  "a",
  "blockquote",
  "br",
  "h2",
  "h3",
  "h4",
  "li",
  "ol",
  "p",
  "strong",
  "ul",
]);
const blockedTags = new Set([
  "embed",
  "form",
  "iframe",
  "input",
  "link",
  "meta",
  "object",
  "script",
  "style",
]);

function isSafeHref(value: string) {
  return (
    value.startsWith("/") ||
    value.startsWith("https://ef-mayke-s.com/") ||
    value === salonProfile.ctaUrl
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function sanitizeBlogHtmlServer(value: string) {
  const $ = cheerio.load(value, null, false);

  $("*").each((_, element) => {
    if (element.type !== "tag") {
      return;
    }

    const tagName = element.tagName.toLowerCase();
    const current = $(element);

    if (blockedTags.has(tagName)) {
      current.remove();
      return;
    }

    if (!allowedTags.has(tagName)) {
      current.replaceWith(current.contents());
      return;
    }

    Object.keys(element.attribs ?? {}).forEach((attribute) => {
      if (tagName !== "a" || !["href", "rel", "target"].includes(attribute)) {
        current.removeAttr(attribute);
      }
    });

    if (tagName === "a") {
      const href = current.attr("href") ?? "";

      if (!isSafeHref(href)) {
        current.removeAttr("href");
      }

      if (current.attr("target") === "_blank") {
        current.attr("rel", "noopener noreferrer");
      } else {
        current.removeAttr("target");
        current.removeAttr("rel");
      }
    }
  });

  return $.root().html()?.trim() ?? "";
}

export function createWordPressHtmlServer(bodyHtml: string, ctaText: string) {
  const safeBody = sanitizeBlogHtmlServer(bodyHtml);
  const ctaHtml = `<p><a href="${salonProfile.ctaUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(
    ctaText || salonProfile.ctaText,
  )}</a></p>`;

  return sanitizeBlogHtmlServer([safeBody, ctaHtml].filter(Boolean).join("\n\n"));
}

export function htmlToEditableContent(value: string) {
  const $ = cheerio.load(sanitizeBlogHtmlServer(value), null, false);
  const blocks: string[] = [];

  $("h2, h3, h4, p, li, blockquote").each((_, element) => {
    const text = $(element).text().replace(/\s+/g, " ").trim();

    if (!text) {
      return;
    }

    if (element.type === "tag" && element.tagName === "h2") {
      blocks.push(`## ${text}`);
    } else if (element.type === "tag" && element.tagName === "h3") {
      blocks.push(`### ${text}`);
    } else if (element.type === "tag" && element.tagName === "h4") {
      blocks.push(`#### ${text}`);
    } else if (element.type === "tag" && element.tagName === "li") {
      blocks.push(`- ${text}`);
    } else {
      blocks.push(text);
    }
  });

  return blocks.join("\n\n");
}
