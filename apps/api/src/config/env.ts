import { z } from 'zod';

/**
 * Validated at boot. A missing or malformed var fails the process immediately
 * rather than surfacing as a confusing runtime error later.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().url().default('http://localhost:5173'),

  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),

  SESSION_COOKIE_NAME: z.string().default('veyra_session'),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(12),
  SESSION_SECRET: z.string().min(32),

  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_ROOT: z.string().default('storage'),

  // Background jobs (outbox worker, invite reminders, digests, session sweep).
  WORKERS_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  MAILER_DRIVER: z.enum(['noop', 'console']).default('console'),
  MAIL_FROM: z.string().default('Veyra <no-reply@veyra.example>'),
  // RESEND_API_KEY: z.string().optional(),

  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export type Env = z.infer<typeof schema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment:\n${issues}`);
  }
  if (parsed.data.STORAGE_DRIVER === 's3') {
    const missing = (['S3_REGION', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'] as const).filter(
      (k) => !parsed.data[k],
    );
    if (missing.length) {
      throw new Error(`STORAGE_DRIVER=s3 needs: ${missing.join(', ')}`);
    }
  }
  return parsed.data;
}
