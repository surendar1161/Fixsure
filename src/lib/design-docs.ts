import { readFile } from "node:fs/promises";
import path from "node:path";
import { Marked } from "marked";

export const DESIGN_DOCS = {
  hld: { file: "HLD.md", title: "High-level design" },
  lld: { file: "LLD.md", title: "Low-level design" },
} as const;

export type DesignDocSlug = keyof typeof DESIGN_DOCS;

export function isDesignDoc(slug: string): slug is DesignDocSlug {
  return slug in DESIGN_DOCS;
}

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const marked = new Marked({
  gfm: true,
  renderer: {
    code({ text, lang }) {
      if (lang === "mermaid") return `<pre class="mermaid">${escapeHtml(text)}</pre>`;
      return false;
    },
  },
});

/** Links between the docs point at files in the repo; on the site they point at these pages and the live spec. */
function siteLinks(markdown: string) {
  return markdown
    .replace(/\]\(HLD\.md\)/g, "](/docs/design/hld)")
    .replace(/\]\(LLD\.md\)/g, "](/docs/design/lld)")
    .replace(/\]\(\.\.\/openapi\/openapi\.json\)/g, "](/api/v1/openapi.json)");
}

/** Renders a design doc from docs/. The files are part of the repo, so their HTML is trusted. */
export async function renderDesignDoc(slug: DesignDocSlug) {
  const source = await readFile(path.join(process.cwd(), "docs", DESIGN_DOCS[slug].file), "utf8");
  const body = source.replace(/^---\n[\s\S]*?\n---\n/, "");
  return { title: DESIGN_DOCS[slug].title, html: await marked.parse(siteLinks(body)) };
}
