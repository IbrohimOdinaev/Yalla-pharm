// Parallel-route slot fallback. Next.js renders this when the active URL
// doesn't match any intercepting route inside @modal — e.g. on /, /cart, etc.
// Returning null keeps the slot invisible.
export default function ModalSlotDefault() {
  return null;
}
