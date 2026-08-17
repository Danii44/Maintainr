import { randomUUID } from "node:crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./_core/env";

function normalizeKey(relKey: string) { return relKey.replace(/^\/+/, ""); }
function appendHashSuffix(relKey: string) { const hash = randomUUID().replace(/-/g, "").slice(0, 8); const lastDot = relKey.lastIndexOf("."); return lastDot === -1 ? `${relKey}_${hash}` : `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`; }

function s3Config() {
  const bucket = process.env.S3_BUCKET;
  const region = process.env.S3_REGION || "us-east-1";
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!bucket || !accessKeyId || !secretAccessKey) return null;
  return { bucket, region, accessKeyId, secretAccessKey, endpoint: process.env.S3_ENDPOINT, publicBaseUrl: process.env.S3_PUBLIC_BASE_URL?.replace(/\/+$/, "") };
}

function s3Client(config: NonNullable<ReturnType<typeof s3Config>>) {
  return new S3Client({ region: config.region, endpoint: config.endpoint || undefined, forcePathStyle: Boolean(config.endpoint), credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey } });
}

async function forgeStoragePut(key: string, data: Buffer | Uint8Array | string, contentType: string) {
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) throw new Error("Storage config missing: set S3_* variables for independent hosting");
  const presignUrl = new URL("v1/storage/presign/put", ENV.forgeApiUrl.replace(/\/+$/, "") + "/");
  presignUrl.searchParams.set("path", key);
  const presignResp = await fetch(presignUrl, { headers: { Authorization: `Bearer ${ENV.forgeApiKey}` } });
  if (!presignResp.ok) throw new Error(`Storage presign failed (${presignResp.status})`);
  const { url } = (await presignResp.json()) as { url: string };
  const uploadResp = await fetch(url, { method: "PUT", headers: { "Content-Type": contentType }, body: typeof data === "string" ? data : Buffer.from(data) });
  if (!uploadResp.ok) throw new Error(`Storage upload failed (${uploadResp.status})`);
  return { key, url: `/manus-storage/${key}` };
}

export async function storagePut(relKey: string, data: Buffer | Uint8Array | string, contentType = "application/octet-stream") {
  const key = appendHashSuffix(normalizeKey(relKey));
  const config = s3Config();
  if (!config) return forgeStoragePut(key, data, contentType);
  await s3Client(config).send(new PutObjectCommand({ Bucket: config.bucket, Key: key, Body: typeof data === "string" ? Buffer.from(data) : Buffer.from(data), ContentType: contentType }));
  return { key, url: config.publicBaseUrl ? `${config.publicBaseUrl}/${key}` : `/storage/${key}` };
}

export async function storageGet(relKey: string) { const key = normalizeKey(relKey); return { key, url: await storageGetSignedUrl(key) }; }

export async function storageGetSignedUrl(relKey: string) {
  const key = normalizeKey(relKey);
  const config = s3Config();
  if (config) return getSignedUrl(s3Client(config), new GetObjectCommand({ Bucket: config.bucket, Key: key }), { expiresIn: 900 });
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) throw new Error("Storage config missing: set S3_* variables for independent hosting");
  const getUrl = new URL("v1/storage/presign/get", ENV.forgeApiUrl.replace(/\/+$/, "") + "/");
  getUrl.searchParams.set("path", key);
  const resp = await fetch(getUrl, { headers: { Authorization: `Bearer ${ENV.forgeApiKey}` } });
  if (!resp.ok) throw new Error(`Storage signed URL failed (${resp.status})`);
  const { url } = (await resp.json()) as { url: string };
  return url;
}

export function independentStorageConfigured() { return Boolean(s3Config()); }
