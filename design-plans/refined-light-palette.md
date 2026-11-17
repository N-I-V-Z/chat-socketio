# Refine the Client Palette and Use a Light Appearance

Written against: `4a0ae3c`

## Evidence chain

- Surface: The authenticated chat workspace at `/chat` was audited, including its shared shell, message states, and dialogs. The palette owner is global, so this plan covers all client routes: `/`, `/register`, `/chat`, `/admin`, and the session-restore view.
- Problem: The user reports that the dominant colors feel unattractive and requests a more refined, simple, elegant palette with a light background. The user explicitly chose a light appearance regardless of OS color preference.
- Design evidence: No repository `DESIGN.md`, `AGENTS.md`, or existing `design-plans/` files govern the palette. `client/src/index.css` defines pale sage-tinted light tokens and a dark palette under `prefers-color-scheme: dark`. `client/tailwind.config.js` maps semantic Tailwind colors to those variables. `client/src/index.jsx` imports the global stylesheet. The chat shell, chat content, auth layout, and admin dashboard consume the semantic colors.
- Runtime check: No `dark:` utility classes or explicit `.dark` theme toggles are currently used in `client/src`.
- Owner: `client/src/index.css` owns the global color variables and OS media-query override. `client/tailwind.config.js` owns the semantic color aliases and Tailwind dark-mode strategy.
- Scope and affected surfaces: The shared palette affects login, registration, session restoration, chat, admin, dialogs, loading/error/empty states, and responsive navigation.
- Uncertainty: Exact RGB values are not specified. Choose one cohesive light palette that follows the user's stated mood; verify it in the rendered app before finalizing values.

## Design decision

Replace the current green-tinted palette with a restrained, refined light palette using a bright neutral canvas, clear ink and muted text, quiet surfaces and borders, and one subdued accent. Make the light appearance independent of OS preference by removing the `prefers-color-scheme: dark` token override and requiring an explicit `.dark` class for any Tailwind dark variants. Preserve semantic color roles for errors and success states.

## Reuse

- Reuse the existing `--color-*` variables in `client/src/index.css` and semantic Tailwind aliases in `client/tailwind.config.js`.
- Exemplar: The `/chat` shell and conversation use the shared `canvas`, `surface`, `surface-muted`, `ink`, `muted`, `line`, and `accent` roles without needing component-specific palette values.

## Changes

1. `client/src/index.css`
   - Change: Retune the existing light color variables to the requested neutral, refined palette. Remove the OS-driven dark variable override and retain `color-scheme: light`.
   - Preserve: Existing semantic variable names and danger/success roles; do not change layout, copy, or interaction behavior.
   - Verify: The app retains the same light appearance with both light- and dark-preferring OS settings.
2. `client/tailwind.config.js`
   - Change: Set `darkMode` to `"class"` so dark variants do not follow OS preference. Keep all semantic aliases mapped to the existing CSS variables.
   - Preserve: Existing component class names and Tailwind structure.
   - Verify: No route switches to dark colors unless an explicit `.dark` class is added; no `.dark` class or toggle should be introduced by this change.
3. `client/tailwind.config.js`
   - Change: Retint the existing `panel` and `float` shadows to neutral dark tones while preserving their geometry and opacity.
   - Preserve: Existing shadow names and layout.
   - Verify: Panels and dialogs read as neutral against the new surfaces.

## Scope

- Inherit: Login, registration, session restore, chat, admin, shared navigation, buttons, and dialogs receive the global token update.
- Verify: Auth's large accent panel, chat's selected contact and sent-message states, admin's active tabs, alerts and status colors, and dialog surfaces at narrow and wide viewports.
- Exclude: Layout changes, new theme controls, feature changes, message/call behavior, and changes to video preview's intentional dark background.

## Validation

- Product: Open every route with OS color preference set to light and dark; all routes must remain in the light appearance.
- Interface: Review login/register, session restore, chat contact and conversation states, message bubbles, call dialogs, admin users/logs, loading/empty/error states, and responsive navigation at narrow and wide viewports.
- System: Confirm existing components continue to use semantic tokens, danger/success remain distinct, and no new component-specific palette is introduced.
- Repository: `npm --prefix client test -- --watchAll=false` → tests pass; `npm --prefix client run build` → production build succeeds.

## Stop conditions

- Stop if an explicit user-controlled dark-theme feature is discovered; reconcile that separate behavior before removing or altering it.
- Stop if the requested light palette cannot be applied through the existing semantic tokens without adding component-specific colors.

## Design documentation

- After acceptance and validation: None; no governing design document exists, and this plan does not request one.
