/**
 * The Veyra mark — two waves in a rounded square.
 *
 * Inline SVG rather than an <img>: it has to sit in the sidebar, the auth
 * screens and the favicon at different sizes, and inlining means one file, no
 * network request, and no flash of a missing logo on first paint.
 *
 * The ground comes from the `brandMark` role, which is the same value in both
 * modes — see that role's note in `tokens/semantic.ts`. The mark's blue is now
 * the brand's base step, so the logo and the UI are one colour rather than two.
 */
import { useVeyraTokens } from '@veyra/design-system';

export function VeyraMark({ size = 28, color }: { size?: number; color?: string }) {
  const { colors } = useVeyraTokens();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      focusable="false"
      style={{ display: 'block', flex: `0 0 ${size}px` }}
    >
      <rect width="40" height="40" rx="9" fill={color ?? colors.brandMark} />
      <path
        d="M9 16.5C12 11.5 16 11.5 20 16.5C24 21.5 28 21.5 31 16.5"
        stroke="#FFFFFF"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 24.5C12 19.5 16 19.5 20 24.5C24 29.5 28 29.5 31 24.5"
        stroke="#FFFFFF"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.6"
      />
    </svg>
  );
}
