import { useCallback, useRef, type TouchEvent } from 'react';

export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

export interface UseSwipeGestureOptions {
  onSwipe?: (direction: SwipeDirection) => void;
  threshold?: number;
  horizontalOnly?: boolean;
}

export function useSwipeGesture({
  onSwipe,
  threshold = 50,
  horizontalOnly = true,
}: UseSwipeGestureOptions = {}) {
  const startX = useRef(0);
  const startY = useRef(0);

  const onTouchStart = useCallback((event: TouchEvent) => {
    const touchPoint = event.touches[0];
    startX.current = touchPoint.clientX;
    startY.current = touchPoint.clientY;
  }, []);

  const onTouchEnd = useCallback(
    (event: TouchEvent) => {
      if (!onSwipe) return;
      const touchPoint = event.changedTouches[0];
      const deltaX = touchPoint.clientX - startX.current;
      const deltaY = touchPoint.clientY - startY.current;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      if (horizontalOnly && absX < absY) return;
      if (Math.max(absX, absY) < threshold) return;

      if (absX >= absY) {
        onSwipe(deltaX > 0 ? 'right' : 'left');
      } else {
        onSwipe(deltaY > 0 ? 'down' : 'up');
      }
    },
    [horizontalOnly, onSwipe, threshold]
  );

  return { onTouchStart, onTouchEnd };
}

export default useSwipeGesture;
