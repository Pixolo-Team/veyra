import { Module } from '@nestjs/common';
import { CompanyDashboardService } from './dashboard.service';
import { CompanyDashboardController } from './dashboard.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  providers: [CompanyDashboardService, PrismaService],
  controllers: [CompanyDashboardController],
})
export class CompanyDashboardModule {}