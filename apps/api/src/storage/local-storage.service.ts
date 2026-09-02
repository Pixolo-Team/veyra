import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, normalize, resolve, sep } from 'node:path';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import { StorageService, STORAGE_SIGNED_URL_TTL_SECONDS } from './storage.service';

/**
 * Filesystem-backed storage for local dev and the pilot. Objects live under
 * STORAGE_LOCAL_ROOT; `getSignedUrl` returns a route on this API that streams
 * the file after re-checking access (see StorageController), with an HMAC token
 * so the URL alone can't be replayed past its TTL.
 */
@Injectable()
export class LocalStorageService extends StorageService {
  private readonly logger = new Logger(LocalStorageService.name);
  private readonly root: string;
  private readonly secret: string;

  constructor(config: ConfigService<Env, true>) {
    super();
    this.root = resolve(process.cwd(), config.get('STORAGE_LOCAL_ROOT', { infer: true }));
    this.secret = config.get('SESSION_SECRET', { infer: true });
    this.logger.log(`Local storage root: ${this.root}`);
  }

  private absolute(key: string): string {
    const clean = normalize(key).replace(/^([/\\]|\.\.([/\\]|$))+/, '');
    const abs = join(this.root, clean);
    if (isAbsolute(key) || !resolve(abs).startsWith(this.root + sep)) {
      throw new Error(`Refusing storage key outside root: ${key}`);
    }
    return abs;
  }

  async put(key: string, body: Buffer | Uint8Array, _contentType?: string): Promise<void> {
    const abs = this.absolute(key);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, body);
  }

  async get(key: string): Promise<Buffer> {
    const abs = this.absolute(key);
    if (!existsSync(abs)) throw new NotFoundException(`No object at ${key}`);
    return readFile(abs);
  }

  async exists(key: string): Promise<boolean> {
    return existsSync(this.absolute(key));
  }

  async delete(key: string): Promise<void> {
    await rm(this.absolute(key), { force: true });
  }

  async getSignedUrl(key: string, ttlSeconds = STORAGE_SIGNED_URL_TTL_SECONDS): Promise<string> {
    const expires = Date.now() + ttlSeconds * 1000;
    const sig = this.sign(key, expires);
    const params = new URLSearchParams({ key, expires: String(expires), sig });
    // Matches StorageController under the global `api` prefix.
    return `/api/storage/object?${params.toString()}`;
  }

  /** Used by StorageController to validate a signed link. */
  verify(key: string, expires: number, sig: string): boolean {
    if (Number.isNaN(expires) || expires < Date.now()) return false;
    return timingSafeEqualHex(this.sign(key, expires), sig);
  }

  private sign(key: string, expires: number): string {
    return createHash('sha256').update(`${key}:${expires}:${this.secret}`).digest('hex');
  }
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
