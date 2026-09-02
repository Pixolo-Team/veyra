/**
 * Storage contract. Every document byte in Veyra goes through this — originals,
 * converted PDFs, and per-viewer watermarked renditions. No object is ever
 * publicly readable (mvp-plan §3): callers get a short-TTL signed URL or a
 * stream, never a bucket path.
 *
 * Two drivers implement it:
 *   - LocalStorageService  — filesystem under STORAGE_LOCAL_ROOT (current default)
 *   - S3StorageService     — SSE-KMS private bucket, presigned PUT/GET (see
 *                            s3-storage.service.ts, commented until the bucket exists)
 */
export abstract class StorageService {
  /** Write bytes at `key`, creating any parent structure. */
  abstract put(key: string, body: Buffer | Uint8Array, contentType?: string): Promise<void>;

  /** Read the full object. Throws if `key` is missing. */
  abstract get(key: string): Promise<Buffer>;

  /** A URL the browser can GET directly, valid for `ttlSeconds`. */
  abstract getSignedUrl(key: string, ttlSeconds?: number): Promise<string>;

  abstract exists(key: string): Promise<boolean>;

  abstract delete(key: string): Promise<void>;
}

export const STORAGE_SIGNED_URL_TTL_SECONDS = 300;
