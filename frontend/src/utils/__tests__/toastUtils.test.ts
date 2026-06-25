import {
  toastTypeToSeverity,
  toastAriaLabel,
  toastProgressColor,
  positionToAnchor,
  stackAlignment,
  remainingDuration,
  progressPercent,
  createToastId,
} from '../toastUtils';
import type { ToastType, ToastPosition } from '../../contexts/ToastContext';

describe('utils/toastUtils', () => {
  // ─── toastTypeToSeverity ──────────────────────────────────────────────────

  describe('toastTypeToSeverity', () => {
    const cases: ToastType[] = ['success', 'error', 'warning', 'info'];
    cases.forEach((type) => {
      it(`maps "${type}" to itself`, () => {
        expect(toastTypeToSeverity(type)).toBe(type);
      });
    });
  });

  // ─── toastAriaLabel ────────────────────────────────────────────────────────

  describe('toastAriaLabel', () => {
    it('returns "Success notification" for success', () => {
      expect(toastAriaLabel('success')).toBe('Success notification');
    });
    it('returns "Error notification" for error', () => {
      expect(toastAriaLabel('error')).toBe('Error notification');
    });
    it('returns "Warning notification" for warning', () => {
      expect(toastAriaLabel('warning')).toBe('Warning notification');
    });
    it('returns "Info notification" for info', () => {
      expect(toastAriaLabel('info')).toBe('Info notification');
    });
  });

  // ─── toastProgressColor ───────────────────────────────────────────────────

  describe('toastProgressColor', () => {
    it('returns a colour string for success', () => {
      expect(toastProgressColor('success')).toMatch(/^#/);
    });
    it('returns a colour string for error', () => {
      expect(toastProgressColor('error')).toMatch(/^#/);
    });
    it('returns a colour string for warning', () => {
      expect(toastProgressColor('warning')).toMatch(/^#/);
    });
    it('returns a colour string for info', () => {
      expect(toastProgressColor('info')).toMatch(/^#/);
    });
    it('returns distinct colours for different types', () => {
      const colours = (['success', 'error', 'warning', 'info'] as ToastType[]).map(
        toastProgressColor
      );
      const unique = new Set(colours);
      expect(unique.size).toBe(4);
    });
  });

  // ─── positionToAnchor ─────────────────────────────────────────────────────

  describe('positionToAnchor', () => {
    const cases: [ToastPosition, { vertical: string; horizontal: string }][] = [
      ['top-left',      { vertical: 'top',    horizontal: 'left'   }],
      ['top-center',    { vertical: 'top',    horizontal: 'center' }],
      ['top-right',     { vertical: 'top',    horizontal: 'right'  }],
      ['bottom-left',   { vertical: 'bottom', horizontal: 'left'   }],
      ['bottom-center', { vertical: 'bottom', horizontal: 'center' }],
      ['bottom-right',  { vertical: 'bottom', horizontal: 'right'  }],
    ];

    cases.forEach(([position, expected]) => {
      it(`parses "${position}" correctly`, () => {
        expect(positionToAnchor(position)).toEqual(expected);
      });
    });
  });

  // ─── stackAlignment ───────────────────────────────────────────────────────

  describe('stackAlignment', () => {
    it('returns a fixed-position style object', () => {
      const style = stackAlignment('top-right');
      expect(style.position).toBe('fixed');
    });

    it('sets top:0 for top positions', () => {
      expect(stackAlignment('top-left').top).toBe(0);
      expect(stackAlignment('top-center').top).toBe(0);
      expect(stackAlignment('top-right').top).toBe(0);
    });

    it('sets bottom:0 for bottom positions', () => {
      expect(stackAlignment('bottom-left').bottom).toBe(0);
      expect(stackAlignment('bottom-center').bottom).toBe(0);
      expect(stackAlignment('bottom-right').bottom).toBe(0);
    });

    it('sets left:0 for left positions', () => {
      expect(stackAlignment('top-left').left).toBe(0);
      expect(stackAlignment('bottom-left').left).toBe(0);
    });

    it('sets right:0 for right positions', () => {
      expect(stackAlignment('top-right').right).toBe(0);
      expect(stackAlignment('bottom-right').right).toBe(0);
    });

    it('sets transform for center positions', () => {
      const style = stackAlignment('top-center');
      expect(style.transform).toBe('translateX(-50%)');
      expect(style.left).toBe('50%');
    });

    it('uses column direction for top positions', () => {
      expect(stackAlignment('top-left').flexDirection).toBe('column');
    });

    it('uses column-reverse direction for bottom positions', () => {
      expect(stackAlignment('bottom-left').flexDirection).toBe('column-reverse');
    });

    it('includes a z-index above dialogs', () => {
      expect((stackAlignment('top-left') as { zIndex?: number | string }).zIndex).toBeGreaterThan(1300);
    });

    it('uses string pixel values for gap and padding (not raw numbers)', () => {
      const style = stackAlignment('top-left');
      expect(typeof style.gap).toBe('string');
      expect(typeof style.padding).toBe('string');
    });
  });

  // ─── remainingDuration ────────────────────────────────────────────────────

  describe('remainingDuration', () => {
    it('returns full duration when no time has elapsed', () => {
      const now = Date.now();
      expect(remainingDuration(now, 4000)).toBeCloseTo(4000, -2);
    });

    it('returns 0 when elapsed time exceeds duration', () => {
      const past = Date.now() - 5000;
      expect(remainingDuration(past, 4000)).toBe(0);
    });

    it('never returns a negative value', () => {
      const farPast = Date.now() - 100000;
      expect(remainingDuration(farPast, 1000)).toBeGreaterThanOrEqual(0);
    });

    it('returns partial remaining when partially elapsed', () => {
      const halfWayPast = Date.now() - 2000;
      const remaining = remainingDuration(halfWayPast, 4000);
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThan(4000);
    });
  });

  // ─── progressPercent ──────────────────────────────────────────────────────

  describe('progressPercent', () => {
    it('returns 100 at the moment of creation', () => {
      const now = Date.now();
      expect(progressPercent(now, 4000)).toBeCloseTo(100, 0);
    });

    it('returns 0 when all time has elapsed', () => {
      const past = Date.now() - 5000;
      expect(progressPercent(past, 4000)).toBe(0);
    });

    it('returns 0 when duration is 0', () => {
      expect(progressPercent(Date.now(), 0)).toBe(0);
    });

    it('returns a value between 0 and 100 when partially elapsed', () => {
      const halfWayPast = Date.now() - 2000;
      const pct = progressPercent(halfWayPast, 4000);
      expect(pct).toBeGreaterThanOrEqual(0);
      expect(pct).toBeLessThanOrEqual(100);
    });

    it('never exceeds 100', () => {
      expect(progressPercent(Date.now() + 1000, 4000)).toBe(100);
    });
  });

  // ─── createToastId ────────────────────────────────────────────────────────

  describe('createToastId', () => {
    it('returns a non-empty string', () => {
      expect(typeof createToastId()).toBe('string');
      expect(createToastId().length).toBeGreaterThan(0);
    });

    it('uses the default prefix "toast"', () => {
      expect(createToastId()).toMatch(/^toast-/);
    });

    it('uses a custom prefix when provided', () => {
      expect(createToastId('notif')).toMatch(/^notif-/);
    });

    it('generates unique IDs across multiple calls', () => {
      const ids = Array.from({ length: 50 }, () => createToastId());
      const unique = new Set(ids);
      expect(unique.size).toBe(50);
    });
  });
});
