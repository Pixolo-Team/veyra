import { Typography } from 'antd';
import { useVeyraTokens } from '@veyra/design-system';
import { BrandWaves } from './BrandWaves';

/**
 * The brand half of the signed-out screens — inset from the page edge with a
 * generous radius, so it reads as a panel sitting on the page rather than as a
 * wall bolted to the side of it.
 *
 * The field of waves is the logo mark's own motif scaled up: the identity
 * repeated, not a stock illustration parked beside it. Ground and waves both
 * derive from `brandMark`, so re-seeding the ramp moves this too.
 */
const POINTS = [
  'Company watermarks, burned into every page',
  'Highlight and comment directly on the document',
  'An append-only record of every view and download',
];

export function AuthPanel() {
  const { colors, space } = useVeyraTokens();

  return (
    <aside
      className="veyra-auth-panel"
      style={{
        padding: space['3xl'],
        background: `linear-gradient(155deg, ${colors.brandMark} 0%, color-mix(in oklab, ${colors.brandMark}, #000 58%) 100%)`,
      }}
    >
      <BrandWaves />

      <div style={{ position: 'relative', maxWidth: 520 }}>
        <Typography.Title
          level={1}
          style={{
            color: '#ffffff',
            margin: 0,
            fontSize: 'clamp(28px, 3.2vw, 44px)',
            lineHeight: 1.14,
            fontWeight: 600,
            letterSpacing: '-0.03em',
          }}
        >
          Every page, every reader, on the record.
        </Typography.Title>
        <p
          style={{
            marginTop: space.xl,
            marginBottom: 0,
            fontSize: 16,
            lineHeight: 1.6,
            color: 'rgba(255,255,255,0.8)',
          }}
        >
          A data room for regulatory dossiers. Counterparties read in the browser, comment in
          place, and nothing leaves without a trace.
        </p>
      </div>

      <ul
        style={{
          position: 'relative',
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'grid',
          gap: space.lg,
        }}
      >
        {POINTS.map((point) => (
          <li
            key={point}
            style={{
              display: 'flex',
              gap: space.md,
              alignItems: 'center',
              fontSize: 15,
              color: 'rgba(255,255,255,0.92)',
            }}
          >
            <Tick />
            {point}
          </li>
        ))}
      </ul>
    </aside>
  );
}

function Tick() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden focusable="false">
      <circle cx="10" cy="10" r="10" fill="rgba(255,255,255,0.18)" />
      <path
        d="M6 10.2 8.6 12.8 14 7.4"
        stroke="#ffffff"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

