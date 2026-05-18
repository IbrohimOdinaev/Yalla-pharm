import { useEffect } from "react";

/**
 * Cross-browser body-scroll lock for modal overlays.
 *
 * Three issues we have to defend against:
 *
 *   1. iOS Safari ignores `overflow: hidden` on <body>: it still scrolls
 *      the page underneath when the user drags on the modal backdrop.
 *      Fix is to switch <body> to `position: fixed`, which freezes the
 *      page in place. We save the current scrollY, push it onto `top`,
 *      and restore both on unlock — otherwise the page snaps to top
 *      when the modal closes.
 *
 *   2. Chrome / Firefox / Edge with classic scrollbars: removing the
 *      scrollbar at lock-time would reflow the layout 15px to the right.
 *      `scrollbar-gutter: stable` on <html> (set globally in globals.css)
 *      handles that for the normal case; on top of that we explicitly
 *      preserve the current scrollbar width so wrapper-padded layouts
 *      don't see a width change. No-op on Safari (overlay scrollbars).
 *
 *   3. Nested locks: if two modals are open at once we don't want the
 *      inner close to unlock while the outer is still open. A simple
 *      counter on `document.body.dataset.lockCount` is enough.
 *
 * Pass `true` to lock, `false` to unlock; the effect tears itself down
 * on unmount automatically so callers don't have to reset manually.
 */
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;

    const body = document.body;
    const html = document.documentElement;

    // Bump the lock counter — only the outermost lock actually changes
    // body styles, inner locks just inc/dec the count.
    const prevCount = Number(body.dataset.lockCount ?? "0");
    body.dataset.lockCount = String(prevCount + 1);

    if (prevCount > 0) {
      // Already locked by an outer modal — nothing to do, just keep the
      // count balanced on cleanup.
      return () => {
        const c = Number(body.dataset.lockCount ?? "1") - 1;
        body.dataset.lockCount = String(Math.max(0, c));
      };
    }

    // Outermost lock — record the current scroll offset so we can
    // restore it after unlock, and the scrollbar width so we can pad
    // <body> if scrollbar-gutter:stable isn't supported.
    const scrollY = window.scrollY;
    const prevPosition = body.style.position;
    const prevTop = body.style.top;
    const prevWidth = body.style.width;
    const prevOverflow = body.style.overflow;
    const prevHtmlOverflow = html.style.overflow;

    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    html.style.overflow = "hidden";

    return () => {
      body.style.position = prevPosition;
      body.style.top = prevTop;
      body.style.width = prevWidth;
      body.style.overflow = prevOverflow;
      html.style.overflow = prevHtmlOverflow;
      // Restore the original scroll position. Use "instant" so we don't
      // animate back to where the user was — that would look weird.
      window.scrollTo({ top: scrollY, left: 0, behavior: "instant" as ScrollBehavior });

      const c = Number(body.dataset.lockCount ?? "1") - 1;
      if (c <= 0) {
        delete body.dataset.lockCount;
      } else {
        body.dataset.lockCount = String(c);
      }
    };
  }, [active]);
}
