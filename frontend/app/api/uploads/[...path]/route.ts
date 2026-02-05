import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function GET(request: NextRequest, { params }: { params?: { path?: string[] } } = {}) {
  try {
    // Try to extract path segments robustly. In dev the params may be a Promise or missing.
    // Prefer using the request pathname so encoded names are preserved.
    const urlPath = request.nextUrl?.pathname || new URL(request.url).pathname;
    // Expecting route like /api/uploads/<file...>
    const prefix = '/api/uploads/';
    let tail = '';
    if (urlPath.startsWith(prefix)) {
      tail = urlPath.slice(prefix.length);
    } else if (params && Array.isArray(params.path) && params.path.length > 0) {
      tail = params.path.map(String).join('/');
    }

    if (!tail) {
      return NextResponse.json({ error: 'Missing path' }, { status: 400 });
    }

    // Remove any leading slash and preserve encoding
    if (tail.startsWith('/')) tail = tail.slice(1);

    const backendFileUrl = `${BACKEND_URL}/uploads/${tail}`;

    // Redirect to backend file URL so the backend serves it.
    return NextResponse.redirect(backendFileUrl);
  } catch (err) {
    console.error('Uploads proxy error:', err);
    return NextResponse.json({ error: 'Failed to proxy upload' }, { status: 500 });
  }
}
