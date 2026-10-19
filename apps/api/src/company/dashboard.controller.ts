import { Controller, Get, Param } from '@nestjs/common';
import { CompanyDashboardService } from './dashboard.service';
import { CompanyDashboard } from '@veyra/contracts';

@Controller('companies')
export class CompanyDashboardController {
  constructor(private readonly dashboard: CompanyDashboardService) {}

  @Get(':companyId/dashboard')
  async get(@Param('companyId') companyId: string): Promise<CompanyDashboard> {
    return this.dashboard.getForUser(null, companyId);
  }
}