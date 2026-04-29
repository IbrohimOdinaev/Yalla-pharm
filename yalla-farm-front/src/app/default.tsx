// Fallback for the implicit `children` slot at the root segment. Required
// once `@modal` exists as a sibling slot — without it, certain navigation
// transitions (notably ones involving the intercepting `(.)product/[id]`)
// trip an "e is not iterable" crash inside Next.js's
// applyRouterStatePatchToTree because the patch contains an undefined
// segment for the children slot. Returning null delegates back to the
// matching page.tsx for the active URL.
export default function RootDefault() {
  return null;
}
