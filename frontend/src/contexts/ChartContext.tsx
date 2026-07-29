import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

export type ChartTheme = 'default' | 'dark' | 'colorblind' | 'monochrome';

export interface ChartConfigValue {
  theme: ChartTheme;
  colorPalette: string[];
  animationEnabled: boolean;
  showCrosshair: boolean;
  exportQuality: 'low' | 'medium' | 'high';
  zoomEnabled: boolean;
  panEnabled: boolean;
}

interface ChartContextValue {
  config: ChartConfigValue;
  setTheme: (theme: ChartTheme) => void;
  setColorPalette: (palette: string[]) => void;
  setAnimationEnabled: (enabled: boolean) => void;
  setShowCrosshair: (show: boolean) => void;
  setExportQuality: (quality: 'low' | 'medium' | 'high') => void;
  setZoomEnabled: (enabled: boolean) => void;
  setPanEnabled: (enabled: boolean) => void;
  getColor: (index: number) => string;
}

const THEME_PALETTES: Record<ChartTheme, string[]> = {
  default: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'],
  dark: ['#60A5FA', '#34D399', '#FBBF24', '#F87171', '#A78BFA', '#F472B6'],
  colorblind: ['#0072B2', '#E69F00', '#56B4E9', '#009E73', '#F0E442', '#D55E00'],
  monochrome: ['#111827', '#374151', '#6B7280', '#9CA3AF', '#D1D5DB', '#F9FAFB'],
};

const defaultConfig: ChartConfigValue = {
  theme: 'default',
  colorPalette: THEME_PALETTES.default,
  animationEnabled: true,
  showCrosshair: true,
  exportQuality: 'medium',
  zoomEnabled: true,
  panEnabled: true,
};

const ChartContext = createContext<ChartContextValue | undefined>(undefined);

export const ChartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<ChartConfigValue>(defaultConfig);

  const setTheme = useCallback((theme: ChartTheme) => {
    setConfig((prev) => ({
      ...prev,
      theme,
      colorPalette: THEME_PALETTES[theme],
    }));
  }, []);

  const setColorPalette = useCallback((palette: string[]) => {
    setConfig((prev) => ({ ...prev, colorPalette: palette }));
  }, []);

  const setAnimationEnabled = useCallback((enabled: boolean) => {
    setConfig((prev) => ({ ...prev, animationEnabled: enabled }));
  }, []);

  const setShowCrosshair = useCallback((show: boolean) => {
    setConfig((prev) => ({ ...prev, showCrosshair: show }));
  }, []);

  const setExportQuality = useCallback((quality: 'low' | 'medium' | 'high') => {
    setConfig((prev) => ({ ...prev, exportQuality: quality }));
  }, []);

  const setZoomEnabled = useCallback((enabled: boolean) => {
    setConfig((prev) => ({ ...prev, zoomEnabled: enabled }));
  }, []);

  const setPanEnabled = useCallback((enabled: boolean) => {
    setConfig((prev) => ({ ...prev, panEnabled: enabled }));
  }, []);

  const getColor = useCallback(
    (index: number) => {
      return config.colorPalette[index % config.colorPalette.length];
    },
    [config.colorPalette]
  );

  const value = useMemo(
    () => ({
      config,
      setTheme,
      setColorPalette,
      setAnimationEnabled,
      setShowCrosshair,
      setExportQuality,
      setZoomEnabled,
      setPanEnabled,
      getColor,
    }),
    [config, setTheme, setColorPalette, setAnimationEnabled, setShowCrosshair, setExportQuality, setZoomEnabled, setPanEnabled, getColor]
  );

  return <ChartContext.Provider value={value}>{children}</ChartContext.Provider>;
};

export const useChart = (): ChartContextValue => {
  const context = useContext(ChartContext);
  if (!context) {
    throw new Error('useChart must be used within a ChartProvider');
  }
  return context;
};