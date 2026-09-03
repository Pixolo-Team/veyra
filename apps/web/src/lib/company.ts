/** What a company field resolves to: an existing company, or a name to create. */
export interface CompanyChoice {
  companyId?: string;
  companyName?: string;
}

export function hasCompany(choice: CompanyChoice): boolean {
  return Boolean(choice.companyId ?? choice.companyName);
}
