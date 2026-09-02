/* eslint-disable */
/**
 * S3 storage driver — SSE-KMS, private bucket, presigned PUT/GET at a 5-minute
 * TTL (mvp-plan §3). Kept commented until the bucket + KMS key exist; wiring it
 * on is: uncomment, `npm i @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`,
 * set STORAGE_DRIVER=s3 and the S3_* vars, and add S3StorageService to the
 * provider switch in storage.module.ts.
 *
 * The class already satisfies StorageService, so nothing else in the app changes.
 */

// import { Injectable, Logger } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import {
//   DeleteObjectCommand,
//   GetObjectCommand,
//   HeadObjectCommand,
//   PutObjectCommand,
//   S3Client,
// } from '@aws-sdk/client-s3';
// import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
// import type { Env } from '../config/env';
// import { StorageService, STORAGE_SIGNED_URL_TTL_SECONDS } from './storage.service';
//
// @Injectable()
// export class S3StorageService extends StorageService {
//   private readonly logger = new Logger(S3StorageService.name);
//   private readonly client: S3Client;
//   private readonly bucket: string;
//
//   constructor(config: ConfigService<Env, true>) {
//     super();
//     this.bucket = config.get('S3_BUCKET', { infer: true })!;
//     this.client = new S3Client({
//       region: config.get('S3_REGION', { infer: true }),
//       endpoint: config.get('S3_ENDPOINT', { infer: true }) || undefined,
//       forcePathStyle: config.get('S3_FORCE_PATH_STYLE', { infer: true }) ?? false,
//       credentials: {
//         accessKeyId: config.get('S3_ACCESS_KEY_ID', { infer: true })!,
//         secretAccessKey: config.get('S3_SECRET_ACCESS_KEY', { infer: true })!,
//       },
//     });
//   }
//
//   async put(key: string, body: Buffer | Uint8Array, contentType?: string): Promise<void> {
//     await this.client.send(
//       new PutObjectCommand({
//         Bucket: this.bucket,
//         Key: key,
//         Body: body,
//         ContentType: contentType,
//         ServerSideEncryption: 'aws:kms',
//       }),
//     );
//   }
//
//   async get(key: string): Promise<Buffer> {
//     const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
//     const bytes = await res.Body!.transformToByteArray();
//     return Buffer.from(bytes);
//   }
//
//   async exists(key: string): Promise<boolean> {
//     try {
//       await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
//       return true;
//     } catch {
//       return false;
//     }
//   }
//
//   async delete(key: string): Promise<void> {
//     await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
//   }
//
//   async getSignedUrl(key: string, ttlSeconds = STORAGE_SIGNED_URL_TTL_SECONDS): Promise<string> {
//     return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
//       expiresIn: ttlSeconds,
//     });
//   }
//
//   /** Presigned PUT for direct browser upload (used by the batch-upload flow). */
//   async getSignedPutUrl(key: string, contentType: string, ttlSeconds = STORAGE_SIGNED_URL_TTL_SECONDS): Promise<string> {
//     return getSignedUrl(
//       this.client,
//       new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType, ServerSideEncryption: 'aws:kms' }),
//       { expiresIn: ttlSeconds },
//     );
//   }
// }

export {};
