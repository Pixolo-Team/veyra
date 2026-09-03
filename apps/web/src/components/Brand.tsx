import { useVeyraTokens } from '@veyra/design-system';
import { VeyraMark } from './VeyraMark';

/**
 * The lockup: mark plus wordmark.
 *
 * The word is live text, not part of the SVG. The supplied wordmark file bakes
 * the name in at `fill="#000000"`, which disappears in dark mode and can't be
 * corrected without editing the asset — text takes the theme's ink for free and
 * stays selectable and searchable.
 */
export function Brand({
  size = 20,
  showWordmark = true,
  /** On the brand panel the lockup sits on the mark's own ground, so the word
   *  takes white rather than the theme's ink. */
  onDark = false,
}: {
  size?: number;
  showWordmark?: boolean;
  onDark?: boolean;
}) {
  const { colors } = useVeyraTokens();

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size * 0.45,
        color: onDark ? '#ffffff' : colors.textPrimary,
      }}
    >
      <VeyraMark size={size * 1.45} color={onDark ? 'rgba(255,255,255,0.14)' : undefined} />
      {showWordmark ? (
        <span
          style={{
            fontSize: size,
            fontWeight: 700,
            letterSpacing: '-0.025em',
          }}
        >
          Veyra
        </span>
      ) : null}
    </span>
  );
}
