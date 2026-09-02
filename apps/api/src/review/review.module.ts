import { Module } from '@nestjs/common';
import { RoomsModule } from '../rooms/rooms.module';
import { AnnotationsService } from './annotations.service';
import { ReviewAccess } from './review-access';
import { ReviewController } from './review.controller';
import { ThreadsService } from './threads.service';

@Module({
  imports: [RoomsModule],
  controllers: [ReviewController],
  providers: [ReviewAccess, AnnotationsService, ThreadsService],
})
export class ReviewModule {}
