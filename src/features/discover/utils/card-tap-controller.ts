/** Keeps delayed profile navigation mutually exclusive with double-tap Pick and swipe. */
export function createCardTapController(delay: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastTap: number | null = null;

  const cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    lastTap = null;
  };

  return {
    cancel,
    tap(onSingle: () => void, onDouble: () => void) {
      const now = Date.now();
      const doubleTap = timer !== null && lastTap !== null && now - lastTap <= delay;
      cancel();
      if (doubleTap) {
        onDouble();
        return;
      }
      lastTap = now;
      timer = setTimeout(() => {
        timer = null;
        lastTap = null;
        onSingle();
      }, delay);
    },
  };
}
