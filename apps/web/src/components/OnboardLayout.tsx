import type { ReactNode } from 'react';
import { Typography } from 'antd';
import { Stack, useVeyraTokens } from '@veyra/design-system';
import { Brand } from './Brand';
import { BrandWaves } from './BrandWaves';
import { ChevronLeftIcon } from './icons';
import { HeaderActions } from './HeaderBar';

/**
 * The frame for setting a room up: form on the left, a panel previewing what
 * you're building on the right.
 *
 * Same split as the signed-out screens, mirrored — there the panel argues for
 * the product, here it shows the room taking shape as you fill the form in, so
 * it belongs on the side you read towards rather than the one you start from.
 * Below 1080px it steps aside entirely (`veyra-onboard-split`): a half-width
 * preview squeezing the form it illustrates helps nobody.
 */
export function OnboardLayout({
  step,
  stepCount,
  title,
  subtitle,
  onBack,
  backLabel,
  aside,
  width = 560,
  children,
}: {
  /** 1-based. Fills that fraction of the progress track. */
  step: number;
  stepCount: number;
  title: string;
  subtitle?: ReactNode;
  /** Omitted when there is nowhere truthful to go back to. */
  onBack?: () => void;
  backLabel?: string;
  aside: ReactNode;
  /** Form column width. Wider where a step's controls are a row rather than a field. */
  width?: number;
  children: ReactNode;
}) {
  const { colors, space } = useVeyraTokens();

  return (
    <div className="veyra-onboard-split" style={{ background: colors.bgSurface }}>
      <main
        style={{
          display: 'flex',
          flexDirection: 'column',
          padding: `${space.xl}px ${space['2xl']}px ${space['3xl']}px`,
          overflowY: 'auto',
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: space.lg,
          }}
        >
          <Brand size={19} />
          <HeaderActions withUserMenu />
        </header>

        <div
          style={{
            width: '100%',
            maxWidth: width,
            margin: '0 auto',
            paddingBlock: space['3xl'],
          }}
        >
          <Stack gap="xl">
            <Stack gap="lg">
              <Progress step={step} stepCount={stepCount} onBack={onBack} backLabel={backLabel} />
              <Stack gap="sm">
                <Typography.Title
                  level={1}
                  style={{ margin: 0, fontSize: 32, lineHeight: 1.18, letterSpacing: '-0.03em' }}
                >
                  {title}
                </Typography.Title>
                {subtitle ? (
                  <Typography.Text type="secondary" style={{ fontSize: 15 }}>
                    {subtitle}
                  </Typography.Text>
                ) : null}
              </Stack>
            </Stack>
            {children}
          </Stack>
        </div>
      </main>

      <aside
        className="veyra-onboard-aside"
        style={{
          background: `linear-gradient(155deg, ${colors.brandMark} 0%, color-mix(in oklab, ${colors.brandMark}, #000 58%) 100%)`,
        }}
      >
        <BrandWaves />
        <div style={{ position: 'relative' }}>{aside}</div>
      </aside>
    </div>
  );
}

/**
 * Where you are, as a filled fraction rather than as numbered titles. Two steps
 * don't need naming twice — the heading under the bar already says which one
 * you're on, and a bar reads at a glance where a Steps component asks to be
 * read.
 */
function Progress({
  step,
  stepCount,
  onBack,
  backLabel,
}: {
  step: number;
  stepCount: number;
  onBack?: () => void;
  backLabel?: string;
}) {
  const { colors, space } = useVeyraTokens();

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: space.md }}>
      {/* No empty slot when there's nowhere back: the track runs the full width
          instead, which reads as deliberate where a gap reads as a missing
          button. */}
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label={backLabel ?? 'Back'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: '0 0 auto',
            width: 24,
            height: 24,
            padding: 0,
            border: 'none',
            borderRadius: 6,
            background: 'none',
            color: colors.textSecondary,
            cursor: 'pointer',
          }}
        >
          <ChevronLeftIcon size={18} />
        </button>
      ) : null}

      <div
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={stepCount}
        aria-valuenow={step}
        aria-label={`Step ${step} of ${stepCount}`}
        style={{
          flex: 1,
          height: 6,
          borderRadius: 999,
          background: colors.bgActive,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${(step / stepCount) * 100}%`,
            height: '100%',
            borderRadius: 999,
            background: colors.brand,
            transition: 'width 260ms ease',
          }}
        />
      </div>
    </div>
  );
}
