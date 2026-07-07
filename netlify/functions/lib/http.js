// Tiny helpers for Netlify Functions v2 (Request in, Response out).

export function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

export async function body(req) {
  try { return await req.json(); } catch { return {}; }
}

export function query(req, key) {
  return new URL(req.url).searchParams.get(key);
}

// Wrap a handler so thrown errors become a clean 500 instead of a stack dump.
export function guard(fn) {
  return async (req, context) => {
    try { return await fn(req, context); }
    catch (err) { return json(500, { ok: false, error: err.message || 'Server error' }); }
  };
}
