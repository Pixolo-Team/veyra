# Veyra Design System

A design token layer over [Ant Design](https://ant.design) v6, built with Vite,
React 19 and TypeScript. Ant Design supplies the components; this package
supplies the decisions — colour roles, type scale, spacing grid, elevation,
motion — and translates them into an antd `ThemeConfig`.

```bash
npm install
npm run dev          # playground app  → http://localhost:5173
npm run storybook    # token reference → http://localhost:6006
```

## Monorepo layout

npm workspaces. `packages/*` holds shared libraries, `apps/*` holds things that
get deployed. New projects go in one of those two directories — nothing lives at
the root except config.

```
veyra/
├─ package.json              # workspace root; scripts here delegate
├─ tsconfig.base.json        # compiler options every workspace extends
├─ packages/
│  └─ design-system/         # @veyra/design-system — tokens, theme, components, Storybook
└─ apps/
   └─ playground/            # @veyra/playground — demo app consuming the design system
```

`@veyra/design-system` is consumed straight from TypeScript source via its
`exports` map — no build step between editing a token and seeing it in the app.
Anything published externally later would add one; internal consumers don't need
it.

### Adding a workspace

```bash
mkdir -p apps/my-app            # or packages/my-lib
```

Give it a `package.json` named `@veyra/<name>`, a `tsconfig.json` that extends
`../../tsconfig.base.json`, and add it to the `references` array in the root
`tsconfig.json`. `npm install` from the root links it. Depend on the design
system with `"@veyra/design-system": "*"`.

### Inside `packages/design-system`

| Path | Holds |
| --- | --- |
| `src/tokens/palette.ts` | Raw 10-step colour ramps. The only file with literal hex. |
| `src/tokens/primitives.ts` | Type scale, spacing, radius, elevation, motion, z-index. |
| `src/tokens/semantic.ts` | Colour **roles**, defined once per mode. |
| `src/theme/createTheme.ts` | Maps tokens onto antd's `ThemeConfig`. |
| `src/theme/ThemeProvider.tsx` | The provider an app mounts. Owns mode + persistence. |
| `src/theme/useTokens.ts` | `useAntdToken()` and `useVeyraTokens()`. |
| `src/components/` | Thin wrappers that add semantics antd doesn't have. |
| `src/docs/` | Storybook Foundations pages. Not part of the public API. |

## The one rule

Tokens flow in one direction:

```
palette.ts  →  semantic.ts  →  createTheme.ts  →  antd components
(raw ramps)    (roles)         (ThemeConfig)
```

Reach past a layer and the theme stops being swappable. Concretely: never import
from `tokens/palette` outside `tokens/semantic.ts`, and prefer a role
(`colors.textSecondary`) over a ramp step (`neutral[7]`). If a component needs a
colour that has no role yet, add the role rather than inlining the hex.

## Usage

```tsx
import { ThemeProvider } from '@veyra/design-system';

createRoot(el).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>,
);
```

`ThemeProvider` defaults to `system`, tracks the OS preference live, persists the
user's choice to `localStorage`, and mounts antd's `<App>` so `message`,
`notification` and `modal` inherit the theme.

Reading tokens inside a component:

```tsx
const { colors, space, shadows } = useVeyraTokens(); // our semantic layer
const token = useAntdToken();                        // antd's resolved aliases
```

Use `useAntdToken()` when styling *around* an antd component — it returns every
alias antd itself is using, after its light/dark algorithm has run. Use
`useVeyraTokens()` when the role name is what matters.

## Wrapped components

Each wrapper earns its place by adding a distinction antd leaves open. Anything
antd already does well is used directly from `antd`.

| Component | Adds |
| --- | --- |
| `Button` | A semantic `intent`. antd v6 can express one look through `type`, `color`, `variant`, `danger` or `ghost`; `intent` names the job so it maps to exactly one appearance. |
| `Card` | `elevation` from the shadow scale, resolved per mode — a shadow tuned for white is invisible on near-black. |
| `Stack` | `gap` restricted to spacing-token names. Arbitrary pixel gaps are how a 4px grid quietly erodes. |
| `ThemeToggle` | Three states, not two. A binary toggle can't say "follow the OS". |

## Accessibility

Contrast is treated as a property of the tokens, not something checked later.
Every pairing the system relies on is measured live in
**Foundations → Contrast**, against antd's *resolved* tokens rather than the raw
seeds, since the light/dark algorithm shifts them.

`npm run a11y` runs axe-core over every story in both themes and exits non-zero
on any violation (needs Storybook running). Current state: 21 stories × 2 themes,
zero violations.

Four token decisions came directly out of that audit:

- **Status roles use darker ramp steps.** antd spends a single token on two jobs
  — `Tag` and `Alert` paint `colorSuccess` as *text* on `colorSuccessBg`, while
  `Badge` and `Progress` use it as a *fill*. A vivid amber that works as a fill
  failed at 2.03:1 as text. (`colorWarningText` exists but `Tag` never reads it.)
- **`danger` was darkened** until a white label on a solid button cleared AA.
- **`borderStrong` was darkened** to clear the 3:1 that WCAG asks of the outline
  identifying a control.
- **Dark-mode solid buttons use dark ink.** In dark mode the fill must be light
  enough to read as text on a near-black canvas and dark enough for a white
  label — no single value does both, so the label takes its contrast from below.

One deliberate deviation from antd's defaults: `opacityLoading` is `1`. antd dims
a loading control to 65%, which drops its label under AA, and a loading `Button`
is not marked `aria-disabled`, so it doesn't qualify for the WCAG exemption that
covers inactive components. The spinner already signals the state without relying
on colour.

## Changing the brand

Edit the `veyra` ramp in `tokens/palette.ts`. Every seed token, alias, component
override and both modes follow from it. Re-run `npm run a11y` afterwards — the
ramps are tuned to specific contrast thresholds.

## Scripts

All of these run from the repo root and delegate to the right workspace.

| Script | Does |
| --- | --- |
| `npm run dev` | Vite dev server for the playground app. |
| `npm run build` | Builds every workspace that defines a `build` script. |
| `npm run typecheck` | `tsc -b --force` across all workspaces. |
| `npm run lint` | oxlint over the repo. |
| `npm run storybook` | Storybook dev server on 6006. |
| `npm run build-storybook` | Static Storybook into `packages/design-system/storybook-static/`. |
| `npm run a11y` | axe-core sweep over every story, both themes. Needs Storybook running. |
