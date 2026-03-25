export const dynamic = "force-dynamic";

const TARGET = "http://127.0.0.1:8000";

async function proxy(request: Request, path: string) {
  const url = new URL(path, TARGET);
  const headers = new Headers(request.headers);
  headers.delete("host");

  const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer();

  const response = await fetch(url, {
    method: request.method,
    headers,
    body
  });

  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete("content-encoding");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders
  });
}

export async function GET(request: Request, { params }: { params: { path: string[] } }) {
  const path = "/" + (params.path?.join("/") ?? "");
  const search = new URL(request.url).search;
  return proxy(request, path + search);
}

export async function POST(request: Request, { params }: { params: { path: string[] } }) {
  const path = "/" + (params.path?.join("/") ?? "");
  const search = new URL(request.url).search;
  return proxy(request, path + search);
}

export async function PUT(request: Request, { params }: { params: { path: string[] } }) {
  const path = "/" + (params.path?.join("/") ?? "");
  const search = new URL(request.url).search;
  return proxy(request, path + search);
}

export async function PATCH(request: Request, { params }: { params: { path: string[] } }) {
  const path = "/" + (params.path?.join("/") ?? "");
  const search = new URL(request.url).search;
  return proxy(request, path + search);
}

export async function DELETE(request: Request, { params }: { params: { path: string[] } }) {
  const path = "/" + (params.path?.join("/") ?? "");
  const search = new URL(request.url).search;
  return proxy(request, path + search);
}
