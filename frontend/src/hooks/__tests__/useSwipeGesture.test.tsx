import { renderHook, act } from '@testing-library/react';
import type { TouchEvent } from 'react';
import { useSwipeGesture } from '../useSwipeGesture';

const touch = (clientX: number, clientY: number) =>
  ({
    touches: [{ clientX, clientY }],
    changedTouches: [{ clientX, clientY }],
  }) as unknown as TouchEvent;

describe('useSwipeGesture', () => {
  it('detects left and right swipes past the threshold', () => {
    const onSwipe = jest.fn();
    const { result } = renderHook(() => useSwipeGesture({ onSwipe, threshold: 50 }));

    act(() => {
      result.current.onTouchStart(touch(200, 100));
      result.current.onTouchEnd(touch(120, 105));
    });
    expect(onSwipe).toHaveBeenCalledWith('left');

    onSwipe.mockClear();
    act(() => {
      result.current.onTouchStart(touch(100, 100));
      result.current.onTouchEnd(touch(180, 102));
    });
    expect(onSwipe).toHaveBeenCalledWith('right');
  });

  it('ignores small movements under the threshold', () => {
    const onSwipe = jest.fn();
    const { result } = renderHook(() => useSwipeGesture({ onSwipe, threshold: 50 }));

    act(() => {
      result.current.onTouchStart(touch(100, 100));
      result.current.onTouchEnd(touch(120, 100));
    });
    expect(onSwipe).not.toHaveBeenCalled();
  });
});
