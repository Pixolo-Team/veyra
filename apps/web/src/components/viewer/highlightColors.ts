import type { AnnotationColor } from '@veyra/contracts';

/**
 * The three highlighter inks.
 *
 * Not from the status palette on purpose. Amber/blue/rose here mean whatever
 * the two sides agree they mean — "check this", "for counsel", "answered" —
 * and borrowing `warning` and `danger` would tell every reader that a rose
 * highlight is a problem before anyone had said so.
 *
 * The fills are laid down with `mix-blend-mode: multiply`, like a real
 * highlighter: the ink darkens the page but the words show through it. That is
 * also why they are opaque values rather than alpha — under multiply, alpha
 * would compound with the blend and turn muddy.
 */
export const HIGHLIGHT_FILL: Record<AnnotationColor, string> = {
  amber: '#ffe9a8',
  blue: '#bfdcff',
  rose: '#ffcede',
};

/** The selected highlight, one step deeper so the sidebar and page agree. */
export const HIGHLIGHT_FILL_ACTIVE: Record<AnnotationColor, string> = {
  amber: '#ffd76b',
  blue: '#95c6ff',
  rose: '#ffa9c6',
};

/** A solid dot for the colour, where there is no page to lay ink on. */
export const HIGHLIGHT_DOT: Record<AnnotationColor, string> = {
  amber: '#e8a800',
  blue: '#2b7fe0',
  rose: '#e0568c',
};

export const HIGHLIGHT_LABEL: Record<AnnotationColor, string> = {
  amber: 'Amber',
  blue: 'Blue',
  rose: 'Rose',
};

export const HIGHLIGHT_COLORS: AnnotationColor[] = ['amber', 'blue', 'rose'];
