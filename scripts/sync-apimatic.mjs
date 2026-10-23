// Copies the design docs and the OpenAPI spec into the APIMatic build directory.
// docs/*.md and openapi/openapi.json stay the only sources; run `npm run docs:apimatic` after editing them.
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const build = path.join(root, "apimatic", "src");

const guides = [
  { from: "HLD.md", to: "high-level-design.md" },
  { from: "LLD.md", to: "low-level-design.md" },
];

function forPortal(markdown) {
  return (
    markdown
      // The portal titles the page from toc.yml, so drop the front matter.
      .replace(/^---\n[\s\S]*?\n---\n/, "")
      // Repo-relative links do not resolve inside the portal; name the sibling guide or section instead.
      .replace(/\[([^\]]+)\]\((?:HLD|LLD)\.md\)/g, "**$1** guide")
      .replace(/\[`openapi\/openapi\.json`\]\(\.\.\/openapi\/openapi\.json\)/g, "the **API Endpoints** section of this portal")
      .replace(/ \(see `apimatic\/README\.md`\)/g, "")
      .trimStart()
  );
}

await mkdir(path.join(build, "content", "guides"), { recursive: true });
await mkdir(path.join(build, "spec"), { recursive: true });

for (const guide of guides) {
  const source = await readFile(path.join(root, "docs", guide.from), "utf8");
  await writeFile(path.join(build, "content", "guides", guide.to), forPortal(source));
  console.log(`docs/${guide.from} -> apimatic/src/content/guides/${guide.to}`);
}

await copyFile(path.join(root, "openapi", "openapi.json"), path.join(build, "spec", "openapi.json"));
console.log("openapi/openapi.json -> apimatic/src/spec/openapi.json");
