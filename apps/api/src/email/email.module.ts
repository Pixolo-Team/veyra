import { Global, Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { MailerService } from './mailer.service';

@Global()
@Module({
  providers: [EmailService, MailerService],
  exports: [EmailService, MailerService],
})
export class EmailModule {}
