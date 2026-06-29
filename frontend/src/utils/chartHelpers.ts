export const hexToRgba = (hex: string, alpha: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const generateCrosshairData = (xValue: unknown, yValue: unknown, label?: string) => ({
  x: xValue,
  y: yValue,
  label: label ?? String(yValue),
});

export const debounce = <T extends (...args: Parameters<T>) => void>(fn: T, delay: number) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

export const clampZoom = (zoom: { scale: number; translateX: number; translateY: number }, bounds: { minScale: number; maxScale: number }) => ({
  scale: Math.max(bounds.minScale, Math.min(bounds.maxScale, zoom.scale)),
  translateX: zoom.translateX,
  translateY: zoom.translateY,
});