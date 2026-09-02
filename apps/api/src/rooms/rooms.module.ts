import { Module } from '@nestjs/common';
import { RoomAccessService } from './room-access.service';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';

@Module({
  controllers: [RoomsController],
  providers: [RoomsService, RoomAccessService],
  exports: [RoomsService, RoomAccessService],
})
export class RoomsModule {}
