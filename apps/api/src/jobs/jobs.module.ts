import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DigestJob } from './digest.job';
import { InvitationsJob } from './invitations.job';
import { OutboxWorker } from './outbox.worker';
import { SessionsJob } from './sessions.job';

/**
 * Scheduled work. All jobs no-op when WORKERS_ENABLED=false, so a second API
 * instance (or a test run) can leave them off.
 */
@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [OutboxWorker, InvitationsJob, DigestJob, SessionsJob],
})
export class JobsModule {}
