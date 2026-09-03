import { useMemo, useState } from 'react';
import { AutoComplete, Tag, Typography } from 'antd';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Button, useVeyraTokens } from '@veyra/design-system';
import { companiesApi } from '../lib/api/endpoints';
import { type CompanyChoice, hasCompany } from '../lib/company';
import { useDebounced } from '../lib/useDebounced';

const CREATE_PREFIX = 'create:';

/**
 * Company resolution (mvp-plan §5.2). Fuzzy-matches on name and verified
 * domains, and pre-suggests from the invitee's email domain.
 *
 * Typing alone chooses nothing. A near-miss on an existing company must not
 * quietly create a second one, so a choice only exists once the person picks a
 * suggestion or clicks the separately-labelled "create new company" option —
 * and editing the text afterwards drops the choice again.
 */
export function CompanyPicker({
  value,
  onChange,
  emailHint,
  placeholder = 'Company name',
  disabled,
  size = 'large',
}: {
  value: CompanyChoice;
  onChange: (next: CompanyChoice) => void;
  /** Resolves the domain before anything is typed, and pre-selects a domain hit. */
  emailHint?: string;
  placeholder?: string;
  disabled?: boolean;
  size?: 'middle' | 'large';
}) {
  const { colors } = useVeyraTokens();
  const [text, setText] = useState(value.companyName ?? '');
  const query = useDebounced(text.trim());
  const email = emailHint?.includes('@') ? emailHint : undefined;

  const suggestions = useQuery({
    queryKey: ['companies', { q: query, email }],
    queryFn: () => companiesApi.resolve({ q: query || undefined, email }),
    enabled: query.length >= 2 || Boolean(email),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  const found = useMemo(() => suggestions.data ?? [], [suggestions.data]);

  /*
   * A verified domain hit is the strongest signal we have, and the invitee's
   * address already told us — so it's offered as one click rather than as
   * typing. Offered, not applied: the whole point of this control is that a
   * company is never chosen on the person's behalf.
   */
  const domainMatch = email ? found.find((c) => c.matchedOn === 'domain') : undefined;
  const offerDomainMatch = domainMatch && !text && !hasCompany(value) ? domainMatch : undefined;

  const choose = (choice: CompanyChoice, label: string) => {
    setText(label);
    onChange(choice);
  };

  const options = useMemo(() => {
    const exact = found.some((c) => c.name.toLowerCase() === query.toLowerCase());
    return [
      ...found.map((company) => ({
        value: company.id,
        label: (
          <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <span>{company.name}</span>
            <Tag
              color={company.matchedOn === 'domain' ? 'blue' : 'default'}
              style={{ marginInlineEnd: 0 }}
            >
              {company.matchedOn === 'domain' ? 'domain' : 'name'}
            </Tag>
          </span>
        ),
      })),
      ...(query.length >= 2 && !exact
        ? [
            {
              value: `${CREATE_PREFIX}${query}`,
              label: (
                <span>
                  Create new company <strong>{query}</strong>
                </span>
              ),
            },
          ]
        : []),
    ];
  }, [found, query]);

  const chosen = value.companyId ? found.find((c) => c.id === value.companyId) : undefined;
  const undecided = text.trim().length > 0 && !hasCompany(value);

  return (
    <div>
      <AutoComplete
        style={{ width: '100%' }}
        size={size}
        disabled={disabled}
        value={text}
        options={options}
        placeholder={placeholder}
        status={undecided ? 'warning' : undefined}
        onChange={(next: string) => {
          // AutoComplete fires this for typing *and* selection; selection is
          // handled in onSelect, so only treat a real edit as un-choosing.
          if (next.startsWith(CREATE_PREFIX) || found.some((c) => c.id === next)) return;
          setText(next);
          if (hasCompany(value)) onChange({});
        }}
        onSelect={(picked: string) => {
          if (picked.startsWith(CREATE_PREFIX)) {
            const name = picked.slice(CREATE_PREFIX.length);
            choose({ companyName: name }, name);
            return;
          }
          const company = found.find((c) => c.id === picked);
          if (company) choose({ companyId: company.id }, company.name);
        }}
      />
      {offerDomainMatch ? (
        <Button
          intent="link"
          size="small"
          style={{ paddingInline: 0, height: 'auto', fontSize: 12 }}
          onClick={() => choose({ companyId: offerDomainMatch.id }, offerDomainMatch.name)}
        >
          Use {offerDomainMatch.name} — matched on the email domain
        </Button>
      ) : null}
      <Hint>
        {value.companyId ? (
          <span style={{ color: colors.textTertiary }}>
            Existing company{chosen?.primaryDomain ? ` · ${chosen.primaryDomain}` : ''}
          </span>
        ) : value.companyName ? (
          <span style={{ color: colors.textTertiary }}>
            New company — will be created as “{value.companyName}”
          </span>
        ) : undecided ? (
          <span style={{ color: colors.warning }}>
            Pick a company from the list, or choose “Create new company”.
          </span>
        ) : null}
      </Hint>
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <Typography.Text style={{ fontSize: 12, display: 'block', marginTop: 2 }}>
      {children}
    </Typography.Text>
  );
}
