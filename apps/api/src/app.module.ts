import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { throttlerModule } from './common/throttler';
import { AuditModule } from './audit/audit.module';
import { DeniedAccessFilter } from './audit/denied-access.filter';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';
import { CompaniesModule } from './companies/companies.module';
import { validateEnv } from './config/env';
import { DocumentsModule } from './documents/documents.module';
import { EmailModule } from './email/email.module';
import { HealthModule } from './health/health.module';
import { InvitationsModule } from './invitations/invitations.module';
import { JobsModule } from './jobs/jobs.module';
import { OverviewModule } from './overview/overview.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReviewModule } from './review/review.module';
import { RoomsModule } from './rooms/rooms.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    throttlerModule,
    CommonModule,
    PrismaModule,
    AuditModule,
    EmailModule,
    AuthModule,
    RoomsModule,
    CompaniesModule,
    InvitationsModule,
    DocumentsModule,
    ReviewModule,
    OverviewModule,
    StorageModule,
    HealthModule,
    JobsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Refusals are the half of the log nothing else records — see the filter.
    { provide: APP_FILTER, useClass: DeniedAccessFilter },
  ],
})
export class AppModule {}
