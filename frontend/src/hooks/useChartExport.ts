import { useCallback, useRef } from 'react';
import html2canvas from 'html2canvas';

export type ExportFormat = 'png' | 'jpeg' | 'svg';

export const useChartExport = (() => {
  let inProgress = false;

  return () => {
    if (inProgress) return;
    inProgress = true;

    const exportChart = useCallback(
      async (
        element: HTMLElement | null,
        filename = 'chart',
        format: ExportFormat = 'png',
        quality: 'low' | 'medium' | 'high' = 'medium'
      ) => {
        if (!element) {
          inProgress = false;
          return;
        }

        try {
          const scale = quality === 'high' ? 3 : quality === 'medium' ? 2 : 1;
          const canvas = await html2canvas(element, {
            scale,
            backgroundColor: '#ffffff',
            logging: false,
          });

          const dataUrl = canvas.toDataURL(`image/${format}`, 1);
          const link = document.createElement('a');
          link.href = dataUrl;
          link.download = `${filename}.${format}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } finally {
          inProgress = false;
        }
      },
      []
    );

    return { exportChart };
  };
})();