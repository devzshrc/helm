import "server-only";

import sanitizeHtml from "sanitize-html";

/**
 * Sanitize untrusted email HTML before it is rendered in the thread reader.
 *
 * The reader renders this inside a sandboxed iframe (no allow-scripts), so this
 * is defense-in-depth: strip scripts, event handlers, forms, embedded frames,
 * and javascript: URLs while preserving the formatting/layout of a normal email.
 * Remote images are kept (emails rely on them) but only over https/cid/data.
 */
export function sanitizeEmailHtml(html: string): string {
  if (!html) return "";
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      "img",
      "style",
      "table",
      "thead",
      "tbody",
      "tfoot",
      "tr",
      "td",
      "th",
      "span",
      "center",
      "font",
      "u",
    ]),
    allowedAttributes: {
      "*": [
        "style",
        "align",
        "valign",
        "width",
        "height",
        "bgcolor",
        "color",
        "dir",
      ],
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "width", "height"],
      font: ["color", "face", "size"],
      table: ["border", "cellpadding", "cellspacing", "width", "bgcolor"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"],
    },
    allowedSchemes: ["https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["https", "data", "cid"] },
    // Force links to open safely in a new tab.
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        target: "_blank",
        rel: "noopener noreferrer nofollow",
      }),
    },
    disallowedTagsMode: "discard",
  });
}
