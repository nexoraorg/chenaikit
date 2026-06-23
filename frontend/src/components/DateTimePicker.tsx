import React from 'react';
import { Box, Chip, FormControlLabel, Stack, Switch, TextField } from '@mui/material';
import DatePicker, { DateValue, addBusinessDays, addDays, startOfDay, toDate } from './DatePicker';
import TimePicker, { formatTimeValue } from './TimePicker';

export type DateTimeMode = 'date' | 'time' | 'datetime';

export interface DateTimeValue {
  date: Date | null;
  time: string | null;
  timezone?: string;
  relative?: string;
}

export interface RelativeDatePreset {
  label: string;
  value: string;
  getDate: () => Date;
}

export interface DateTimePickerProps {
  value: DateTimeValue | DateValue;
  onChange: (value: DateTimeValue) => void;
  mode?: DateTimeMode;
  label?: string;
  dateLabel?: string;
  timeLabel?: string;
  minDate?: DateValue;
  maxDate?: DateValue;
  disabledDates?: DateValue[];
  shouldDisableDate?: (date: Date) => boolean;
  timezone?: string;
  onTimezoneChange?: (timezone: string) => void;
  intervalMinutes?: number;
  minTime?: string;
  maxTime?: string;
  timeFormat?: '12' | '24';
  locale?: string;
  enableRelativeDates?: boolean;
  relativePresets?: RelativeDatePreset[];
  disabled?: boolean;
  required?: boolean;
  error?: boolean;
  helperText?: React.ReactNode;
  fullWidth?: boolean;
  onBlur?: () => void;
}

export const defaultRelativeDatePresets = (): RelativeDatePreset[] => [
  { label: 'Today', value: 'today', getDate: () => startOfDay(new Date()) },
  { label: 'Yesterday', value: 'yesterday', getDate: () => startOfDay(addDays(new Date(), -1)) },
  { label: '7 days ago', value: 'days:7', getDate: () => startOfDay(addDays(new Date(), -7)) },
  { label: '30 days ago', value: 'days:30', getDate: () => startOfDay(addDays(new Date(), -30)) },
  { label: 'Next business day', value: 'business:1', getDate: () => startOfDay(addBusinessDays(new Date(), 1)) }
];

const normalizeValue = (value: DateTimeValue | DateValue, timezone?: string): DateTimeValue => {
  if (value && typeof value === 'object' && 'date' in value) {
    return {
      date: toDate(value.date),
      time: value.time || null,
      timezone: value.timezone || timezone,
      relative: value.relative
    };
  }

  const parsed = toDate(value);
  return {
    date: parsed,
    time: parsed ? formatTimeValue(parsed) : null,
    timezone
  };
};

export const combineDateAndTime = (date: Date | null, time: string | null): Date | null => {
  if (!date) return null;

  const combined = new Date(date);
  if (time) {
    const parts = time.split(':');
    combined.setHours(Number(parts[0]) || 0, Number(parts[1]) || 0, 0, 0);
  }

  return combined;
};

export const DateTimePicker: React.FC<DateTimePickerProps> = ({
  value,
  onChange,
  mode = 'datetime',
  label,
  dateLabel,
  timeLabel,
  minDate,
  maxDate,
  disabledDates,
  shouldDisableDate,
  timezone,
  onTimezoneChange,
  intervalMinutes = 15,
  minTime,
  maxTime,
  timeFormat = '24',
  locale,
  enableRelativeDates = true,
  relativePresets,
  disabled = false,
  required = false,
  error = false,
  helperText,
  fullWidth = true,
  onBlur
}) => {
  const current = normalizeValue(value, timezone);
  const [isRelative, setIsRelative] = React.useState(Boolean(current.relative));
  const presets = relativePresets || defaultRelativeDatePresets();

  const emit = (patch: Partial<DateTimeValue>) => {
    onChange({
      date: current.date,
      time: current.time,
      timezone: current.timezone || timezone,
      ...patch
    });
  };

  const applyRelative = (preset: RelativeDatePreset) => {
    emit({ date: preset.getDate(), relative: preset.value });
  };

  return (
    <Stack spacing={1.5} sx={{ width: fullWidth ? '100%' : 'auto' }}>
      {label && (
        <TextField
          label={label}
          value={combineDateAndTime(current.date, current.time)?.toISOString() || ''}
          sx={{ display: 'none' }}
          required={required}
          error={error}
          helperText={helperText}
          inputProps={{ 'aria-hidden': true }}
        />
      )}

      {enableRelativeDates && mode !== 'time' && (
        <FormControlLabel
          control={
            <Switch
              checked={isRelative}
              onChange={(event) => {
                setIsRelative(event.target.checked);
                if (!event.target.checked) emit({ relative: undefined });
              }}
              disabled={disabled}
            />
          }
          label="Relative date"
        />
      )}

      {isRelative && mode !== 'time' && (
        <Stack direction="row" flexWrap="wrap" gap={1}>
          {presets.map((preset) => (
            <Chip
              key={preset.value}
              label={preset.label}
              color={current.relative === preset.value ? 'primary' : 'default'}
              disabled={disabled}
              onClick={() => applyRelative(preset)}
            />
          ))}
        </Stack>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: mode === 'datetime' ? '1fr 1fr' : '1fr' },
          gap: 2
        }}
      >
        {mode !== 'time' && (
          <DatePicker
            value={current.date}
            onChange={(date) => emit({ date, relative: undefined })}
            label={dateLabel || label || 'Date'}
            minDate={minDate}
            maxDate={maxDate}
            disabledDates={disabledDates}
            shouldDisableDate={shouldDisableDate}
            locale={locale}
            disabled={disabled}
            required={required}
            error={error}
            helperText={mode === 'date' ? helperText : undefined}
            fullWidth
            onBlur={onBlur}
          />
        )}

        {mode !== 'date' && (
          <TimePicker
            value={current.time}
            onChange={(time) => emit({ time, relative: undefined })}
            label={timeLabel || label || 'Time'}
            timezone={current.timezone || timezone}
            onTimezoneChange={(zone) => {
              onTimezoneChange?.(zone);
              emit({ timezone: zone });
            }}
            intervalMinutes={intervalMinutes}
            minTime={minTime}
            maxTime={maxTime}
            format={timeFormat}
            disabled={disabled}
            required={required}
            error={error}
            helperText={helperText}
            fullWidth
            onBlur={onBlur}
          />
        )}
      </Box>
    </Stack>
  );
};

export default DateTimePicker;
