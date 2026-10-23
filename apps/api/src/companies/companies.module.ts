import { Module } from '@nestjs/common';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { CompanyDashboardController } from './company-dashboard.controller';
import { CompanyDashboardService } from './company-dashboard.service';

@Module({
  // Two controllers under the one `companies` prefix: resolution, and the
  // dashboard. Nest routes by path, so they coexist without clashing.
  controllers: [CompaniesController, CompanyDashboardController],
  providers: [CompaniesService, CompanyDashboardService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
