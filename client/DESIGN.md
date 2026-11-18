# Client design language

The client is a Vietnamese, light-theme messaging product. Its visual direction is calm and premium: clear type, restrained color, generous spacing, and direct feedback. Chat content has priority over decoration.

## Foundations

- `src/index.css` owns semantic RGB variables. `tailwind.config.js` maps them to `canvas`, `surface`, `surface-muted`, `ink`, `muted`, `line`, `accent`, `danger`, and `success`. Use these names in product components instead of raw color classes.
- `canvas` is the page background; `surface` holds interactive panels; `surface-muted` marks quiet selections and received messages. `accent` marks the primary action, active navigation, unread counts, and sent messages. Danger and success communicate outcome only.
- Manrope is the sole type family. Page titles use a tighter letter spacing and strong weight. Body copy stays readable at 14–16 px with generous line height. Tiny uppercase labels are reserved for orientation, not repeated decoration.
- Shared controls use a 44 px minimum target. The corner system is 10 px for controls and 16 px for major panels. Shadows are subtle and reserved for elevated surfaces and dialogs.
- Focus must remain visible. Labels and errors connect to fields; dialogs use Radix focus management; motion follows `prefers-reduced-motion`.

## Product surfaces

- Auth: one clear form, one restrained brand panel on wide screens. The form remains the first and most important content on narrow screens.
- Chat: contacts and the selected conversation form the main hierarchy. Make the current peer, sending state, read state, connection state, and call state easy to distinguish. Long text must wrap without horizontal scrolling.
- Video calls: the remote camera owns the main stage. Keep the local preview in a small corner inset; tapping it expands the local camera, and tapping again restores the remote view. Preserve both video elements while switching so their streams stay attached.
- Admin: users and audit events share typography, status styles, empty states, and responsive presentation. Mobile and desktop expose the same information.

## Implementation rules

- Add reusable primitives under `src/shared/ui` only when more than one feature needs them. Keep feature-specific views under `src/features`.
- Keep server responses and Socket.IO payloads out of presentational components; adapt data at the feature boundary.
- Keep the interface in Vietnamese. Do not introduce decorative animation that competes with message content.
- Review loading, empty, error, keyboard, 320 px width, and reduced-motion states when changing a surface.
