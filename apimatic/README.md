# Fixsure APIMatic portal

This folder is an APIMatic build directory. It produces a developer portal with the Fixsure API reference, a live API playground, TypeScript and Python SDKs, and the design documents as guides.

```
apimatic/
  src/
    APIMATIC-BUILD.json        portal build settings (languages)
    content/toc.yml            sidebar: Getting Started, Design, API Endpoints, Models
    content/guides/*.md        generated from docs/HLD.md and docs/LLD.md
    spec/openapi.json          generated from openapi/openapi.json
```

Don't edit `content/guides/` or `spec/` by hand. Edit `docs/*.md` or `openapi/openapi.json`, then run this from the repo root:

```bash
npm run docs:apimatic
```

## Preview the portal

You need a free APIMatic account. The CLI builds the portal on APIMatic's servers.

```bash
npm install -g @apimatic/cli     # 1.5.0 or later 1.x
apimatic auth login
cd apimatic                      # the folder that contains src/
apimatic portal serve --open
```

To publish a static copy instead, run `apimatic portal generate --destination=./dist` and host `dist/` on any static host, such as a Render static site.

## Without the CLI

- **APIMatic web app:** import `src/spec/openapi.json` (or the live `/api/v1/openapi.json`) to get the API reference and SDKs. Then add the two files in `src/content/guides/` as custom pages.
- **GitHub:** `docs/HLD.md` and `docs/LLD.md` render with their Mermaid diagrams directly in the repo view.
- **The app itself:** `/docs/design/hld` and `/docs/design/lld` render the same Markdown with live diagrams.
- **Postman:** the collection description in `public/postman/fixsure.postman_collection.json` summarizes the design. Postman shows Markdown tables but not Mermaid diagrams.

## Diagrams

The guides use standard fenced `mermaid` code blocks. GitHub and the app render them. APIMatic portals ship a Mermaid component; if your portal shows a block as code rather than a diagram, wrap the diagram source in the portal's Mermaid component in the generated guide.
