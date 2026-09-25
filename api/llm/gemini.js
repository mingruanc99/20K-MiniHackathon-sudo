// api/llm/gemini.js — Vercel serverless proxy for Gemini generateContent.
//
// The shared API key lives only in the server environment (GEMINI_API_KEY, no VITE_ prefix),
// so it never reaches the browser bundle. Users who enter their own key in the app call
// Google directly and do not use this route.
//
// GET  -> { ok: true, configured: boolean }   (lets the client know the shared key exists)
// POST -> { model, request } forwarded to models/{model}:generateContent

const MAX_BODY_BYTES = 4 * 1024 * 1024; // Vercel's request limit is 4.5 MB; OCR crops stay well under
const MODEL_RE = /^gemini-[a-z0-9.\-]+$/i;

function originAllowed(req) {
  const allowed = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowed.length === 0) return true; // not configured: rely on same-origin browser usage
  const origin = req.headers.origin || '';
  const referer = req.headers.referer || '';
  return allowed.some((a) => origin === a || referer.startsWith(a));
}

export default async function handler(req, res) {
  const key = process.env.GEMINI_API_KEY;

  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, configured: Boolean(key) });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!originAllowed(req)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  if (!key) {
    return res.status(503).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const { model, request } = body;
  if (!model || !MODEL_RE.test(model)) {
    return res.status(400).json({ error: 'Invalid model id.' });
  }
  const payload = JSON.stringify(request || {});
  if (payload.length > MAX_BODY_BYTES) {
    return res.status(413).json({ error: 'Request too large.' });
  }

  try {
    const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: payload
    });
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(text);
  } catch (err) {
    return res.status(502).json({ error: `Upstream error: ${err && err.message ? err.message : String(err)}` });
  }
}
