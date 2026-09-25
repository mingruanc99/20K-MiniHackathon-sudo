// api/telemetry/langfuse.js — forwards ingestion batches to Langfuse with server-side credentials.
// Env: LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, optional LANGFUSE_BASE_URL (default cloud.langfuse.com).

const MAX_BODY_BYTES = 512 * 1024;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const pk = process.env.LANGFUSE_PUBLIC_KEY;
  const sk = process.env.LANGFUSE_SECRET_KEY;
  if (!pk || !sk) {
    // Telemetry is optional: accept and drop so the client never retries or errors.
    return res.status(202).json({ accepted: false, reason: 'Langfuse not configured' });
  }

  const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
  if (body.length > MAX_BODY_BYTES) {
    return res.status(413).json({ error: 'Batch too large.' });
  }

  try {
    const base = (process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com').replace(/\/$/, '');
    const upstream = await fetch(`${base}/api/public/ingestion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${pk}:${sk}`).toString('base64')}`
      },
      body
    });
    return res.status(upstream.status).send(await upstream.text());
  } catch (err) {
    return res.status(502).json({ error: `Upstream error: ${err && err.message ? err.message : String(err)}` });
  }
}
