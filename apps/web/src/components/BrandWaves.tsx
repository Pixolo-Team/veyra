/**
 * The mark's wave, repeated down a panel — decorative only.
 *
 * Shared by the signed-out brand panel and the onboarding preview so the two
 * full-height panels in the product carry one motif rather than two.
 */
export function BrandWaves({ opacity = 0.15 }: { opacity?: number }) {
  return (
    <svg
      aria-hidden
      focusable="false"
      viewBox="0 0 400 700"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity }}
    >
      {Array.from({ length: 9 }, (_, row) => (
        <path
          key={row}
          d={`M-40 ${70 + row * 78}C20 ${10 + row * 78} 100 ${10 + row * 78} 160 ${70 + row * 78}C220 ${130 + row * 78} 300 ${130 + row * 78} 360 ${70 + row * 78}C420 ${10 + row * 78} 500 ${10 + row * 78} 560 ${70 + row * 78}`}
          stroke="#ffffff"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          opacity={row % 2 === 0 ? 1 : 0.55}
        />
      ))}
    </svg>
  );
}
