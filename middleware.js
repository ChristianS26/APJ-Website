// Vercel Edge Middleware — runs before static file matching.
// Handles host-based routing for admin.padeljalisco.com.
//
// On the admin subdomain:
//   /             -> rewrite to /admin/                   (clean root)
//   /:path        -> rewrite to /admin/:path              (clean nested URLs)
//   /admin/:path  -> redirect (307) to /:path             (strip prefix)
// Static asset prefixes (css, js, img, etc.) bypass via the matcher below.

export const config = {
  // Run on everything except shared static asset paths and /api/ endpoints
  // (Serverless Functions like /api/config must reach Vercel's runtime
  // unrewritten — otherwise the middleware would rewrite them under /admin
  // and produce a 404).
  matcher: ['/((?!api/|css/|js/|img/|apk/|favicon|robots|sitemap|_vercel).*)'],
};

const ADMIN_HOSTS = new Set([
  'admin.padeljalisco.com',
  'stage.admin.padeljalisco.com',
]);

export default function middleware(request) {
  const url = new URL(request.url);
  const host = (request.headers.get('host') || '').toLowerCase();

  if (!ADMIN_HOSTS.has(host)) return; // pass through unchanged

  const path = url.pathname;

  // Strip /admin prefix → redirect for clean URLs in the address bar
  if (path === '/admin' || path === '/admin/') {
    return Response.redirect(new URL('/', request.url), 307);
  }
  if (path.startsWith('/admin/')) {
    const stripped = path.slice('/admin'.length); // keep leading slash + trailing
    return Response.redirect(new URL(stripped, request.url), 307);
  }

  // Rewrite "/" and "/foo" to "/admin/" and "/admin/foo" so the admin
  // pages are served while the URL stays on the subdomain root.
  const targetPath = path === '/' ? '/admin/' : `/admin${path}`;
  const target = new URL(targetPath + url.search, request.url);
  return new Response(null, {
    headers: {
      'x-middleware-rewrite': target.toString(),
    },
  });
}
