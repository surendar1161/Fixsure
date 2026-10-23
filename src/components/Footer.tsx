import Link from "next/link";

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer-inner">
        <span>Fixsure · built for the PayPal AI Hackathon · MIT licensed</span>
        <div className="row" style={{ gap: 20 }}>
          <Link href="/docs">API reference</Link>
          <a href="/api/v1/openapi.json">OpenAPI</a>
          <a href="/postman/fixsure.postman_collection.json" download>
            Postman collection
          </a>
          <a href="/api/v1/health">Status</a>
        </div>
      </div>
    </footer>
  );
}
