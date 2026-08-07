import { AwsClient } from 'aws4fetch'
import { createHash } from 'crypto'

try { process.loadEnvFile('.env') } catch {}

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

async function enablePublicUrl(token, accountId, bucket) {
  if (!token) return null
  try {
    const managed = await cfApi(token, `/accounts/${accountId}/r2/buckets/${bucket}/domains/managed`)
    if (!managed.enabled) {
      console.log('Enabling R2 public development URL...')
      const updated = await cfApi(token, `/accounts/${accountId}/r2/buckets/${bucket}/domains/managed`, 'PUT', { enabled: true })
      console.log('R2 public development URL enabled:', `https://${updated.domain}`)
      return `https://${updated.domain}`
    }
    console.log('R2 public development URL already enabled:', `https://${managed.domain}`)
    return `https://${managed.domain}`
  } catch (err) {
    console.warn('Could not enable R2 public URL via API:', err.message)
    console.warn('Please enable it manually in Cloudflare R2 dashboard: bucket → Settings → Public Bucket URL.')
    return null
  }
}

async function setCorsViaApi(token, accountId, bucket) {
  if (!token) return false
  try {
    await cfApi(token, `/accounts/${accountId}/r2/buckets/${bucket}/cors`, 'PUT', corsRules)
    console.log('R2 CORS configured via Cloudflare API.')
    return true
  } catch (err) {
    console.warn('Could not set CORS via Cloudflare API:', err.message)
    return false
  }
}

async function setCorsViaS3(aws, endpoint, bucket) {
  const corsUrl = new URL(`${endpoint}/${bucket}?cors`)
  const md5 = createHash('md5').update(corsXml).digest('base64')

  try {
    const res = await aws.fetch(corsUrl.toString(), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/xml', 'Content-MD5': md5 },
      body: corsXml,
    })
    if (res.ok || res.status === 409) {
      console.log('R2 CORS configured via S3 API.')
      return true
    }
    const text = await res.text().catch(() => '')
    console.warn('R2 CORS setup via S3 returned:', res.status, text)
  } catch (err) {
    console.warn('R2 CORS setup via S3 failed:', err.message)
  }
  return false
}

async function main() {
  const token = process.env.CLOUDFLARE_API_TOKEN
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKey = process.env.R2_ACCESS_KEY_ID
  const secretKey = process.env.R2_SECRET_ACCESS_KEY
  const bucket = process.env.R2_BUCKET_NAME

  if (!accountId || !accessKey || !secretKey || !bucket) {
    console.warn('R2 S3 keys not configured; skipping R2 setup.')
    return
  }

  const publicUrl = await enablePublicUrl(token, accountId, bucket)
  if (publicUrl) {
    console.log('Use this public URL base in Vercel environment variables:')
    console.log(`R2_PUBLIC_URL=${publicUrl}`)
  }

  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`
  const aws = new AwsClient({
    accessKeyId: accessKey,
    secretAccessKey: secretKey,
    service: 's3',
    region: 'auto',
  })

  let corsOk = await setCorsViaApi(token, accountId, bucket)
  if (!corsOk) {
    corsOk = await setCorsViaS3(aws, endpoint, bucket)
  }

  if (!corsOk) {
    console.warn('R2 CORS could not be configured automatically.')
    console.warn('Please set it manually in Cloudflare R2 dashboard: bucket → Settings → CORS Policy.')
    console.warn('CORS XML to paste:')
    console.warn(corsXml)
  }
}

main().catch((err) => {
  console.error('R2 setup error:', err.message)
  // Do not fail the build; CORS/public can be set manually.
})
