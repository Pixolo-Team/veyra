import { Controller, Get, Param } from '@nestjs/common';
import type { CompanyDashboard, MyCompany } from '@veyra/contracts';
import { CurrentUser } from '../auth/auth.decorators';
import { CompanyDashboardService } from './company-dashboard.service';

type Authed = NonNullable<import('../auth/auth.decorators').AuthedRequest['user']>;

/**
 * The company dashboard (Image 1). Both routes are session-guarded by the
 * global AuthGuard; `@CurrentUser` therefore always carries a real user.
 */
@Controller('companies')
export class CompanyDashboardController {
  constructor(private readonly dashboard: CompanyDashboardService) {}

  /** The companies this person can open a dashboard for. */
  @Get('mine')
  listMine(@CurrentUser() user: Authed): Promise<MyCompany[]> {
    return this.dashboard.listForUser(user.id);
  }

  @Get(':companyId/dashboard')
  get(
    @CurrentUser() user: Authed,
    @Param('companyId') companyId: string,
  ): Promise<CompanyDashboard> {
    return this.dashboard.getForUser(user.id, companyId);
  }
}
