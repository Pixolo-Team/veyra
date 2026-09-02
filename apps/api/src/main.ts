import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { Env } from './config/env';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: false,
    bodyParser: false,
  });
  const config = app.get(ConfigService<Env, true>);

  // JSON only, 1 MB — enough for a rich-text comment, not for abuse. File
  // uploads bypass this (multipart, handled by multer with its own 250 MB cap).
  app.useBodyParser('json', { limit: '1mb' });
  app.useBodyParser('urlencoded', { limit: '1mb', extended: true });

  app.use(helmet());
  app.use(cookieParser(config.get('SESSION_SECRET', { infer: true })));
  app.set('trust proxy', 1); // behind one reverse proxy — req.ip / rate limiting
  app.enableCors({ origin: config.get('CORS_ORIGIN', { infer: true }), credentials: true });
  app.setGlobalPrefix('api');
  // Request validation is done with zod (@veyra/contracts) via a ZodValidationPipe
  // added per-route, not class-validator.
  app.enableShutdownHooks();

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  new Logger('Bootstrap').log(`API listening on http://localhost:${port}/api`);
}

void bootstrap();
