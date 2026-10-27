// Thin Vercel serverless proxy. Local-first data never touches a server —
// this exists ONLY to read public external feeds (weather / RSS / calendar)
// that the browser can't fetch directly because of CORS. No accounts, no DB.

const ALLOWED_HOSTS = new Set(
  (process.env.PROXY_ALLOWED_HOSTS || 'api.open-meteo.com,wttr.in')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean),
)

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
}

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const target = req.query.url
  if (typeof target !== 'string' || !target) {
    res.status(400).json({ error: 'missing ?url=' })
    return
  }

  let parsed
  try {
    parsed = new URL(target)
  } catch {
    res.status(400).json({ error: 'invalid url' })
    return
  }

  if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.has(parsed.hostname)) {
    res.status(403).json({ error: `host not allowed: ${parsed.hostname}` })
    return
  }

  try {
    const upstream = await fetch(parsed, { headers: { 'User-Agent': 'Kiln-Feed/1.0' } })
    const text = await upstream.text()
    const type = upstream.headers.get('content-type') || 'text/plain'
    res.status(upstream.status).setHeader('Content-Type', type).send(text)
  } catch (err) {
    res.status(502).json({ error: 'upstream failed', detail: String(err?.message || err) })
  }
}
