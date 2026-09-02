import { Injectable } from '@nestjs/common';
import type { CompanyResolveQuery, CompanySuggestion } from '@veyra/contracts';
import { PrismaService } from '../prisma/prisma.service';

function domainOf(email?: string): string | null {
  const at = email?.lastIndexOf('@') ?? -1;
  return at >= 0 ? email!.slice(at + 1).toLowerCase() : null;
}

/**
 * Company fuzzy-match for the invite flow (mvp-plan §5.2). Returns suggestions
 * only — a domain hit ranks above a name hit. Free-text creation is an explicit
 * client choice, not something this endpoint does.
 */
@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(query: CompanyResolveQuery): Promise<CompanySuggestion[]> {
    const suggestions = new Map<string, CompanySuggestion>();
    const domain = domainOf(query.email);

    if (domain) {
      const byDomain = await this.prisma.company.findMany({
        where: { domains: { some: { domain: { equals: domain, mode: 'insensitive' }, verified: true } } },
        take: 5,
      });
      for (const c of byDomain) {
        suggestions.set(c.id, {
          id: c.id,
          name: c.name,
          primaryDomain: c.primaryDomain,
          matchedOn: 'domain',
        });
      }
    }

    const term = query.q ?? query.email?.split('@')[0];
    if (term && term.length >= 2) {
      const byName = await this.prisma.company.findMany({
        where: { name: { contains: term, mode: 'insensitive' } },
        take: 8,
      });
      for (const c of byName) {
        if (!suggestions.has(c.id)) {
          suggestions.set(c.id, {
            id: c.id,
            name: c.name,
            primaryDomain: c.primaryDomain,
            matchedOn: 'name',
          });
        }
      }
    }

    return [...suggestions.values()];
  }
}
