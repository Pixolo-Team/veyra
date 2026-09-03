/**
 * The icon set.
 *
 * Icons live in the design system rather than in the app because both consume
 * them — `ThemeToggle` needs a sun and a moon, and a component library that
 * reaches into an app for its glyphs has the dependency backwards.
 *
 * The components themselves are generated; see `generated.tsx` and
 * `scripts/vendor-icons.py`.
 */

export * from './generated';
