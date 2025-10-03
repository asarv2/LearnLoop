import crypto from "crypto";

const R2_BUCKET = process.env.R2_BUCKET!;
const R2_AUDIO_BUCKET = process.env.R2_AUDIO_BUCKET || R2_BUCKET; // Fall back to main bucket if no audio bucket specified
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY!;
const R2_SECRET = process.env.R2_SECRET!;

// Simple V4-style signer for Cloudflare R2 (S3-compatible API)
export const r2Adapter = {
  async getSignedUrl(key: string, expiresIn: number) {
    // Generate AWS Signature V4 for R2
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const datetime = new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:-]/g, "")
      .replace("T", "");

    const credential = `${R2_ACCESS_KEY}/${date}/auto/s3/aws4_request`;
    const signedHeaders = "host";

    const canonicalRequest = [
      "GET",
      `/${key}`,
      `X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=${encodeURIComponent(
        credential
      )}&X-Amz-Date=${datetime}&X-Amz-Expires=${expiresIn}&X-Amz-SignedHeaders=${signedHeaders}`,
      `host:${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      "",
      signedHeaders,
      "UNSIGNED-PAYLOAD",
    ].join("\n");

    const stringToSign = [
      "AWS4-HMAC-SHA256",
      datetime,
      `${date}/auto/s3/aws4_request`,
      crypto.createHash("sha256").update(canonicalRequest).digest("hex"),
    ].join("\n");

    const dateKey = crypto
      .createHmac("sha256", `AWS4${R2_SECRET}`)
      .update(date)
      .digest();
    const dateRegionKey = crypto
      .createHmac("sha256", dateKey)
      .update("auto")
      .digest();
    const dateRegionServiceKey = crypto
      .createHmac("sha256", dateRegionKey)
      .update("s3")
      .digest();
    const signingKey = crypto
      .createHmac("sha256", dateRegionServiceKey)
      .update("aws4_request")
      .digest();

    const signature = crypto
      .createHmac("sha256", signingKey)
      .update(stringToSign)
      .digest("hex");

    return `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=${encodeURIComponent(
      credential
    )}&X-Amz-Date=${datetime}&X-Amz-Expires=${expiresIn}&X-Amz-SignedHeaders=${signedHeaders}&X-Amz-Signature=${signature}`;
  },

  async getSignedUrlAudio(key: string, expiresIn: number) {
    // Generate AWS Signature V4 for R2 (same logic as getSignedUrl but for audio bucket)
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const datetime = new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:-]/g, "")
      .replace("T", "");

    const credential = `${R2_ACCESS_KEY}/${date}/auto/s3/aws4_request`;
    const signedHeaders = "host";

    const canonicalRequest = [
      "GET",
      `/${key}`,
      `X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=${encodeURIComponent(
        credential
      )}&X-Amz-Date=${datetime}&X-Amz-Expires=${expiresIn}&X-Amz-SignedHeaders=${signedHeaders}`,
      `host:${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      "",
      signedHeaders,
      "UNSIGNED-PAYLOAD",
    ].join("\n");

    const stringToSign = [
      "AWS4-HMAC-SHA256",
      datetime,
      `${date}/auto/s3/aws4_request`,
      crypto.createHash("sha256").update(canonicalRequest).digest("hex"),
    ].join("\n");

    const dateKey = crypto
      .createHmac("sha256", `AWS4${R2_SECRET}`)
      .update(date)
      .digest();
    const dateRegionKey = crypto
      .createHmac("sha256", dateKey)
      .update("auto")
      .digest();
    const dateRegionServiceKey = crypto
      .createHmac("sha256", dateRegionKey)
      .update("s3")
      .digest();
    const signingKey = crypto
      .createHmac("sha256", dateRegionServiceKey)
      .update("aws4_request")
      .digest();

    const signature = crypto
      .createHmac("sha256", signingKey)
      .update(stringToSign)
      .digest("hex");

    return `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_AUDIO_BUCKET}/${key}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=${encodeURIComponent(
      credential
    )}&X-Amz-Date=${datetime}&X-Amz-Expires=${expiresIn}&X-Amz-SignedHeaders=${signedHeaders}&X-Amz-Signature=${signature}`;
  },

  async uploadFile(file: File, key: string) {
    // Generate presigned URL for PUT request
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const datetime = new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:-]/g, "")
      .replace("T", "");

    const credential = `${R2_ACCESS_KEY}/${date}/auto/s3/aws4_request`;
    const signedHeaders = "host";

    const canonicalRequest = [
      "PUT",
      `/${key}`,
      `X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=${encodeURIComponent(
        credential
      )}&X-Amz-Date=${datetime}&X-Amz-SignedHeaders=${signedHeaders}`,
      `host:${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      "",
      signedHeaders,
      crypto
        .createHash("sha256")
        .update(Buffer.from(await file.arrayBuffer()))
        .digest("hex"),
    ].join("\n");

    const stringToSign = [
      "AWS4-HMAC-SHA256",
      datetime,
      `${date}/auto/s3/aws4_request`,
      crypto.createHash("sha256").update(canonicalRequest).digest("hex"),
    ].join("\n");

    const dateKey = crypto
      .createHmac("sha256", `AWS4${R2_SECRET}`)
      .update(date)
      .digest();
    const dateRegionKey = crypto
      .createHmac("sha256", dateKey)
      .update("auto")
      .digest();
    const dateRegionServiceKey = crypto
      .createHmac("sha256", dateRegionKey)
      .update("s3")
      .digest();
    const signingKey = crypto
      .createHmac("sha256", dateRegionServiceKey)
      .update("aws4_request")
      .digest();

    const signature = crypto
      .createHmac("sha256", signingKey)
      .update(stringToSign)
      .digest("hex");

    const presignedUrl = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=${encodeURIComponent(
      credential
    )}&X-Amz-Date=${datetime}&X-Amz-SignedHeaders=${signedHeaders}&X-Amz-Signature=${signature}`;

    // Upload the file using the presigned URL
    const response = await fetch(presignedUrl, {
      method: "PUT",
      body: file,
      headers: {
        "Content-Type": file.type,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to upload file: ${response.statusText}`);
    }

    return key;
  },

  async uploadFileAudio(file: File, key: string) {
    // Generate presigned URL for PUT request to audio bucket
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const datetime = new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:-]/g, "")
      .replace("T", "");

    const credential = `${R2_ACCESS_KEY}/${date}/auto/s3/aws4_request`;
    const signedHeaders = "host";

    const canonicalRequest = [
      "PUT",
      `/${key}`,
      `X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=${encodeURIComponent(
        credential
      )}&X-Amz-Date=${datetime}&X-Amz-SignedHeaders=${signedHeaders}`,
      `host:${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      "",
      signedHeaders,
      crypto
        .createHash("sha256")
        .update(Buffer.from(await file.arrayBuffer()))
        .digest("hex"),
    ].join("\n");

    const stringToSign = [
      "AWS4-HMAC-SHA256",
      datetime,
      `${date}/auto/s3/aws4_request`,
      crypto.createHash("sha256").update(canonicalRequest).digest("hex"),
    ].join("\n");

    const dateKey = crypto
      .createHmac("sha256", `AWS4${R2_SECRET}`)
      .update(date)
      .digest();
    const dateRegionKey = crypto
      .createHmac("sha256", dateKey)
      .update("auto")
      .digest();
    const dateRegionServiceKey = crypto
      .createHmac("sha256", dateRegionKey)
      .update("s3")
      .digest();
    const signingKey = crypto
      .createHmac("sha256", dateRegionServiceKey)
      .update("aws4_request")
      .digest();

    const signature = crypto
      .createHmac("sha256", signingKey)
      .update(stringToSign)
      .digest("hex");

    const presignedUrl = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_AUDIO_BUCKET}/${key}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=${encodeURIComponent(
      credential
    )}&X-Amz-Date=${datetime}&X-Amz-SignedHeaders=${signedHeaders}&X-Amz-Signature=${signature}`;

    // Upload the file using the presigned URL
    const response = await fetch(presignedUrl, {
      method: "PUT",
      body: file,
      headers: {
        "Content-Type": file.type,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to upload audio file: ${response.statusText}`);
    }

    return key;
  },
};
