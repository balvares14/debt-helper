/** Run after the current DOM has been painted so CSS transitions can start from their initial styles. */
export function afterPaint(callback: () => void): () => void {
  let inner = 0;
  const outer = window.requestAnimationFrame(() => {
    inner = window.requestAnimationFrame(callback);
  });
  return () => {
    window.cancelAnimationFrame(outer);
    window.cancelAnimationFrame(inner);
  };
}
