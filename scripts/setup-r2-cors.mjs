import { AwsClient } from 'aws4fetch'
import { createHash } from 'crypto'

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

async function main() {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKey = process.env.R2_ACCESS_KEY_ID
  const secretKey = process.env.R2_SECRET_ACCESS_KEY
  const bucket = process.env.R2_BUCKET_NAME

  if (!accountId || !accessKey || !secretKey || !bucket) {
    console.warn('R2 not configured; skipping CORS setup.')
    return
  }

  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`
  const aws = new AwsClient({
    accessKeyId: accessKey,
    secretAccessKey: secretKey,
    service: 's3',
    region: 'auto',
  })

  const corsUrl = new URL(`${endpoint}/${bucket}?cors`)
  const md5 = createHash('md5').update(corsXml).digest('base64')
  const signed = await aws.sign(corsUrl.toString(), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/xml', 'Content-MD5': md5 },
    aws: { signQuery: true },
  })

  let res
  try {
    res = await fetch(signed.url, { method: 'PUT', headers: { 'Content-Type': 'application/xml', 'Content-MD5': md5 }, body: corsXml })
  } catch (err) {
    console.error(`Could not reach R2 to set CORS. If the bucket already has CORS configured, you can ignore this, but the upload may fail otherwise. Error: ${err.message}`)
    return
  }

  if (res.ok) {
    console.log('R2 CORS configured.')
  } else if (res.status === 409) {
    console.log('R2 CORS already configured.')
  } else {
    const text = await res.text().catch(() => '')
    console.error(`R2 CORS setup failed (${res.status}): ${text}`)
    console.error('Please either:')
    console.error('  1. Use R2 keys with "Bucket Write" permission so the build can set CORS, or')
    console.error('  2. Manually set the bucket CORS in the Cloudflare R2 dashboard to allow PUT/GET/POST/DELETE/HEAD from * origin.')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('R2 CORS setup failed:', err.message)
  process.exit(1)
})
