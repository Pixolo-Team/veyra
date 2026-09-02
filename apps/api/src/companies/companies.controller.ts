import { Controller, Get, Query } from '@nestjs/common';
import {
  type CompanyResolveQuery,
  companyResolveQuerySchema,
  type CompanySuggestion,
} from '@veyra/contracts';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CompaniesService } from './companies.service';

@Controller('companies')
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Get('resolve')
  resolve(
    @Query(new ZodValidationPipe(companyResolveQuerySchema)) query: CompanyResolveQuery,
  ): Promise<CompanySuggestion[]> {
    return this.companies.resolve(query);
  }
}
