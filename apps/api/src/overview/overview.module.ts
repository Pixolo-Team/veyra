import { Module } from '@nestjs/common';
import { RoomsModule } from '../rooms/rooms.module';
import { ActivityService } from './activity.service';
import { DashboardService } from './dashboard.service';
import { OverviewController } from './overview.controller';
import { OverviewService } from './overview.service';

@Module({
  imports: [RoomsModule],
  controllers: [OverviewController],
  providers: [OverviewService, ActivityService, DashboardService],
})
export class OverviewModule {}
