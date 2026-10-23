import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MermaidDiagrams } from "@/components/MermaidDiagrams";
import { DESIGN_DOCS, isDesignDoc, renderDesignDoc } from "@/lib/design-docs";

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(DESIGN_DOCS).map((doc) => ({ doc }));
}

export async function generateMetadata({ params }: PageProps<"/docs/design/[doc]">): Promise<Metadata> {
  const { doc } = await params;
  return { title: isDesignDoc(doc) ? DESIGN_DOCS[doc].title : "Design" };
}

export default async function DesignDocPage({ params }: PageProps<"/docs/design/[doc]">) {
  const { doc } = await params;
  if (!isDesignDoc(doc)) notFound();
  const { title, html } = await renderDesignDoc(doc);

  return (
    <div className="wrap page">
      <div className="page-head">
        <div>
          <div className="crumbs">
            <Link href="/docs">Developers</Link> / Design
          </div>
          <h1>{title}</h1>
          <p>The same Markdown as docs/{DESIGN_DOCS[doc].file} in the repo and the guides in the APIMatic portal.</p>
        </div>
        <nav className="tabs" aria-label="Design documents">
          {Object.entries(DESIGN_DOCS).map(([slug, item]) => (
            <Link key={slug} href={`/docs/design/${slug}`} className={slug === doc ? "on" : undefined} aria-current={slug === doc ? "page" : undefined}>
              {item.title}
            </Link>
          ))}
        </nav>
      </div>
      <article id="design-doc" className="card doc-prose" dangerouslySetInnerHTML={{ __html: html }} />
      <MermaidDiagrams rootId="design-doc" />
    </div>
  );
}
