# Animated Icons

Source-copied animated icons from [itshover](https://github.com/itshover/itshover) (or custom). License: MIT.

## Adding a new animated icon

1. Run `npx shadcn@latest add https://itshover.com/r/<name>.json` to generate the component into a scratch dir.
2. Move the generated file from `components/<name>-icon.tsx` to `web/packages/ui/src/animated-icons/<name>-icon.tsx`.
3. Strip Tailwind classes; rely on `size` and `className` props only.
4. Confirm the component signature is `({ className?: string; size?: number }) => JSX.Element` (matches `AnimatedIconComponent` in `Icon.tsx`).
5. Re-export from `index.ts`.
6. Add the icon to `web/packages/ui/src/index.ts` (the public package barrel).
7. Add a usage site only after `frontend-design` + `taste-skill` review.

## Rules

- Every animated icon component must accept `size?: number` and `className?: string`.
- Never render an animated icon outside the `<Icon icon={…} animated label="…" />` wrapper.
- Never import animated icons directly outside `@hydrax/ui`.
- The wrapper `<span aria-label={label} role="img">` owns a11y; do not duplicate `aria-label` on the inner component.
