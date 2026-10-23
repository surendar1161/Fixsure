import spec from "../../../../../openapi/openapi.json";

export function GET() {
  return Response.json(spec, { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=300" } });
}
