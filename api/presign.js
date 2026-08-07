import { AwsClient } from 'aws4fetch'
import { createHash } from 'crypto'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0]
  const key = process.env.FIREBASE_ADMIN_KEY
  if (!key) throw new Error('FIREBASE_ADMIN_KEY not configured')
  const credential = cert(JSON.parse(Buffer.from(key, 'base64').toString('utf8')))
  return initializeApp({ credential, projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'gestion-67' })
}

// Reject keys that escape their prefix or contain traversal segments.
function isSafeKey(key) {
  return typeof key === 'string'
    && key.length > 0
    && key.length < 512
    && !key.includes('..')
    && !key.startsWith('/')
    && /^[A-Za-z0-9/._-]+$/.test(key)
}

const corsXml = `<?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <CORSRule>
    <AllowedOrigin>*</AllowedOrigin>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedMethod>POST</AllowedMethod>
    <AllowedMethod>DELETE</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedHeader>*</AllowedHeader>
    <ExposeHeader>ETag</ExposeHeader>
    <ExposeHeader>x-amz-request-id</ExposeHeader>
    <MaxAgeSeconds>86400</MaxAgeSeconds>
  </CORSRule>
</CORSConfiguration>`

const corsRules = {
  rules: [
    {
      allowed: {
        methods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
        origins: ['*'],
        headers: ['*'],
      },
      exposeHeaders: ['ETag', 'x-amz-request-id'],
      maxAgeSeconds: 86400,
    },
  ],
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

let corsEnsured = false
let publicUrlBase

async function cfApi(token, path, method = 'GET', body) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json.success) {
    const msg = json.errors?.map(e => e.message).join(', ') || `${res.status}`
    throw new Error(msg)
  }
  return json.result
}

async function publicUrlWorks(url) {
  try {
    const res = await fetch(`${url}/_probe_nonexistent_object_`, { method: 'HEAD' })
    return res.status !== 401 && res.status !== 403
  } catch (err) {
    return false
  }
}

async function resolvePublicUrl(token, accountId, bucket, envBase) {
  if (envBase) {
    const base = envBase.replace(/\/$/, '')
    if (await publicUrlWorks(base)) return base
    console.warn('R2_PUBLIC_URL is set but the bucket does not appear to be public. Falling back to signed URLs.')
  }
  if (!token) return null
  try {
    const managed = await cfApi(token, `/accounts/${accountId}/r2/buckets/${bucket}/domains/managed`)
    if (managed.enabled && managed.domain) {
      const base = `https://${managed.domain}`
      if (await publicUrlWorks(base)) return base
    }
  } catch (err) {
    console.warn('Could not fetch R2 public URL:', err.message)
  }
  return null
}

async function setCorsViaApi(token, accountId, bucket) {
  if (!token) return false
  try {
    await cfApi(token, `/accounts/${accountId}/r2/buckets/${bucket}/cors`, 'PUT', corsRules)
    console.log('R2 CORS configured via Cloudflare API')
    return true
  } catch (err) {
    console.warn('Could not set CORS via Cloudflare API:', err.message)
  }
  return false
}

async function setCorsViaS3(aws, endpoint, bucket) {
  const corsUrl = new URL(`${endpoint}/${bucket}?cors`)
  const md5 = createHash('md5').update(corsXml).digest('base64')

  try {
    const put = await aws.fetch(corsUrl.toString(), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/xml', 'Content-MD5': md5 },
      body: corsXml,
    })
    if (put.ok || put.status === 409) return true
    const text = await put.text().catch(() => '')
    console.warn('R2 CORS setup via S3 returned:', put.status, text)
  } catch (err) {
    console.warn('R2 CORS setup via S3 failed:', err.message)
  }
  return false
}

async function preflightCorsOk(objectUrl) {
  try {
    const res = await fetch(objectUrl, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://example.com',
        'Access-Control-Request-Method': 'PUT',
        'Access-Control-Request-Headers': 'Content-Type',
      },
    })
    const allowed = res.headers.get('access-control-allow-origin')
    return allowed != null && allowed.includes('*')
  } catch (err) {
    console.warn('R2 CORS probe failed:', err.message)
    return false
  }
}

async function ensureBucketCors(token, accountId, bucket, aws, endpoint, objectUrl) {
  if (corsEnsured) return true

  if (await preflightCorsOk(objectUrl)) {
    corsEnsured = true
    return true
  }

  if (await setCorsViaApi(token, accountId, bucket)) {
    if (await preflightCorsOk(objectUrl)) {
      corsEnsured = true
      return true
    }
  }

  if (await setCorsViaS3(aws, endpoint, bucket)) {
    if (await preflightCorsOk(objectUrl)) {
      corsEnsured = true
      return true
    }
  }

  return false
}

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}
  const { key, contentType } = body
  if (!key || !contentType) return res.status(400).json({ error: 'Missing key or contentType' })

  // Require a valid Firebase ID token so only signed-in users can upload.
  let uid
  try {
    const authHeader = req.headers.authorization || ''
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (!idToken) return res.status(401).json({ error: 'Missing token' })
    const decoded = await getAuth(getAdminApp()).verifyIdToken(idToken)
    uid = decoded.uid
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' })
  }

  if (!isSafeKey(key)) return res.status(400).json({ error: 'Invalid key' })

  // A user may only write to their own prefix or a group they belong to.
  if (key.startsWith('users/')) {
    if (key.split('/')[1] !== uid) return res.status(403).json({ error: 'Forbidden' })
  } else if (!key.startsWith('groups/')) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const accountId = process.env.R2_ACCOUNT_ID
  const accessKey = process.env.R2_ACCESS_KEY_ID
  const secretKey = process.env.R2_SECRET_ACCESS_KEY
  const bucket = process.env.R2_BUCKET_NAME
  const cfToken = process.env.CLOUDFLARE_API_TOKEN
  const envPublicUrl = process.env.R2_PUBLIC_URL

  if (!accountId || !accessKey || !secretKey || !bucket) {
    return res.status(500).json({ error: 'R2 not configured on server' })
  }

  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`
  const objectUrl = `${endpoint}/${bucket}/${key}`

  try {
    const aws = new AwsClient({
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
      service: 's3',
      region: 'auto',
    })

    const corsOk = await ensureBucketCors(cfToken, accountId, bucket, aws, endpoint, objectUrl)
    if (!corsOk) {
      return res.status(503).json({
        error: 'R2 CORS not configured. Please set it manually in the Cloudflare R2 dashboard: bucket → Settings → CORS Policy, or provide a Cloudflare API token with R2 Edit permission.',
      })
    }

    const signedPut = await aws.sign(objectUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      aws: { signQuery: true },
    })

    if (!publicUrlBase) {
      publicUrlBase = (await resolvePublicUrl(cfToken, accountId, bucket, envPublicUrl)) || null
    }

    let publicUrl
    let publicUrlType = 'signed'
    if (publicUrlBase) {
      const base = publicUrlBase.replace(/\/$/, '')
      publicUrl = `${base}/${key}`
      publicUrlType = 'public'
    } else {
      const getUrl = new URL(objectUrl)
      getUrl.searchParams.set('X-Amz-Expires', '604800')
      const signedGet = await aws.sign(getUrl.toString(), { method: 'GET', aws: { signQuery: true } })
      publicUrl = signedGet.url
    }

    return res.status(200).json({ uploadUrl: signedPut.url, publicUrl, publicUrlType, corsConfigured: true })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
