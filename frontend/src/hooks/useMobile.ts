import { useTheme, useMediaQuery } from '@mui/material';

/**
 * Mobile / tablet breakpoint helpers using MUI's theme breakpoints.
 * Mobile-first: `isMobile` is true below `md` (default 900px).
 */
export function useMobile() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isSmallMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  return {
    isMobile,
    isSmallMobile,
    isTablet,
    prefersReducedMotion,
    /** True when animations should be toned down (mobile networks / a11y). */
    reduceMotion: prefersReducedMotion || isMobile,
  };
}

export default useMobile;
