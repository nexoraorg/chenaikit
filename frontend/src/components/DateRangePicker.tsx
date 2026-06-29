import React from 'react';
import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import { DatePicker, DateValue, addDays, startOfDay, toDate } from './DatePicker';

export interface DateRangeValue {
  start: Date | null;
  end: Date | null;
}

export interface DateRangePreset {
  label: string;
  getValue: () => DateRangeValue;
}

export interface DateRangePickerProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  startLabel?: string;
  endLabel?: string;
  minDate?: DateValue;
  maxDate?: DateValue;
  disabledDates?: DateValue[];
  shouldDisableDate?: (date: Date) => boolean;
  presets?: DateRangePreset[];
  locale?: string;
  disabled?: boolean;
  required?: boolean;
  error?: boolean;
  helperText?: React.ReactNode;
  fullWidth?: boolean;
  onBlur?: () => void;
}

export const defaultDateRangePresets = (): DateRangePreset[] => [
  {
    label: 'Today',
    getValue: () => {
      const today = startOfDay(new Date());
      return { start: today, end: today };
    }
  },
  {
    label: 'Yesterday',
    getValue: () => {
      const yesterday = startOfDay(addDays(new Date(), -1));
      return { start: yesterday, end: yesterday };
    }
  },
  {
    label: 'Last 7 days',
    getValue: () => ({ start: startOfDay(addDays(new Date(), -6)), end: startOfDay(new Date()) })
  },
  {
    label: 'Last 30 days',
    getValue: () => ({ start: startOfDay(addDays(new Date(), -29)), end: startOfDay(new Date()) })
  },
  {
    label: 'This month',
    getValue: () => {
      const now = new Date();
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: startOfDay(now) };
    }
  }
];

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  value,
  onChange,
  startLabel = 'Start date',
  endLabel = 'End date',
  minDate,
  maxDate,
  disabledDates,
  shouldDisableDate,
  presets,
  locale,
  disabled = false,
  required = false,
  error = false,
  helperText,
  fullWidth = true,
  onBlur
}) => {
  const range = {
    start: toDate(value?.start),
    end: toDate(value?.end)
  };
  const pickerPresets = presets || defaultDateRangePresets();

  const setStart = (start: Date | null) => {
    onChange({
      start,
      end: start && range.end && start > range.end ? start : range.end
    });
  };

  const setEnd = (end: Date | null) => {
    onChange({
      start: end && range.start && end < range.start ? end : range.start,
      end
    });
  };

  return (
    <Stack spacing={1.5}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          gap: 2,
          width: fullWidth ? '100%' : 'auto'
        }}
      >
        <DatePicker
          value={range.start}
          onChange={setStart}
          label={startLabel}
          minDate={minDate}
          maxDate={range.end || maxDate}
          disabledDates={disabledDates}
          shouldDisableDate={shouldDisableDate}
          locale={locale}
          disabled={disabled}
          required={required}
          error={error}
          fullWidth
          onBlur={onBlur}
        />
        <DatePicker
          value={range.end}
          onChange={setEnd}
          label={endLabel}
          minDate={range.start || minDate}
          maxDate={maxDate}
          disabledDates={disabledDates}
          shouldDisableDate={shouldDisableDate}
          locale={locale}
          disabled={disabled}
          required={required}
          error={error}
          helperText={helperText}
          fullWidth
          onBlur={onBlur}
        />
      </Box>

      <Stack direction="row" flexWrap="wrap" gap={1}>
        {pickerPresets.map((preset) => (
          <Chip
            key={preset.label}
            label={preset.label}
            size="small"
            disabled={disabled}
            onClick={() => onChange(preset.getValue())}
          />
        ))}
        <Button size="small" onClick={() => onChange({ start: null, end: null })} disabled={disabled}>
          Clear
        </Button>
      </Stack>

      {range.start && range.end && range.start > range.end && (
        <Typography color="error" variant="caption">
          Start date must be before end date.
        </Typography>
      )}
    </Stack>
  );
};

export default DateRangePicker;
