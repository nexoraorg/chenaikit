import React from 'react';
import {
  Box,
  Chip,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField
} from '@mui/material';
import { AccessTime } from '@mui/icons-material';

export interface TimePreset {
  label: string;
  value: string;
}

export interface TimePickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
  label?: string;
  name?: string;
  timezone?: string;
  onTimezoneChange?: (timezone: string) => void;
  timezones?: string[];
  intervalMinutes?: number;
  format?: '12' | '24';
  presets?: TimePreset[];
  minTime?: string;
  maxTime?: string;
  disabled?: boolean;
  required?: boolean;
  error?: boolean;
  helperText?: React.ReactNode;
  fullWidth?: boolean;
  onBlur?: () => void;
}

export const commonTimezones = (): string[] => {
  const supported = (Intl as any).supportedValuesOf?.('timeZone') as string[] | undefined;
  return supported || ['UTC', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Europe/London', 'Africa/Lagos', 'Asia/Tokyo'];
};

export const defaultTimePresets = (): TimePreset[] => [
  { label: 'Now', value: formatTimeValue(new Date()) },
  { label: 'Start of day', value: '09:00' },
  { label: 'Noon', value: '12:00' },
  { label: 'End of day', value: '17:00' }
];

export const formatTimeValue = (date: Date): string => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

const timeToMinutes = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const parts = value.split(':');
  if (parts.length < 2) return null;
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
};

const displayTime = (value: string, format: '12' | '24'): string => {
  if (format === '24') return value;

  const minutes = timeToMinutes(value);
  if (minutes === null) return value;

  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`;
};

const buildTimeOptions = (intervalMinutes: number): string[] => {
  const interval = Math.max(1, intervalMinutes);
  const options: string[] = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += interval) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    options.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
  }
  return options;
};

export const TimePicker: React.FC<TimePickerProps> = ({
  value,
  onChange,
  label,
  name,
  timezone,
  onTimezoneChange,
  timezones,
  intervalMinutes = 15,
  format = '24',
  presets,
  minTime,
  maxTime,
  disabled = false,
  required = false,
  error = false,
  helperText,
  fullWidth = true,
  onBlur
}) => {
  const options = React.useMemo(() => buildTimeOptions(intervalMinutes), [intervalMinutes]);
  const timezoneOptions = React.useMemo(() => timezones || commonTimezones(), [timezones]);
  const pickerPresets = presets || defaultTimePresets();
  const minMinutes = timeToMinutes(minTime);
  const maxMinutes = timeToMinutes(maxTime);

  const isTimeDisabled = (time: string): boolean => {
    const minutes = timeToMinutes(time);
    if (minutes === null) return true;
    if (minMinutes !== null && minutes < minMinutes) return true;
    return maxMinutes !== null && minutes > maxMinutes;
  };

  const commit = (nextValue: string | null) => {
    if (nextValue && isTimeDisabled(nextValue)) return;
    onChange(nextValue);
  };

  return (
    <Stack spacing={1.5}>
      <TextField
        select
        name={name}
        label={label}
        value={value || ''}
        required={required}
        disabled={disabled}
        error={error}
        helperText={helperText}
        fullWidth={fullWidth}
        onChange={(event) => commit(event.target.value || null)}
        onBlur={onBlur}
        InputProps={{
          startAdornment: <AccessTime color={disabled ? 'disabled' : 'action'} fontSize="small" sx={{ mr: 1 }} />
        }}
      >
        <MenuItem value="">None</MenuItem>
        {options.map((option) => (
          <MenuItem key={option} value={option} disabled={isTimeDisabled(option)}>
            {displayTime(option, format)}
          </MenuItem>
        ))}
      </TextField>

      {pickerPresets.length > 0 && (
        <Stack direction="row" flexWrap="wrap" gap={1}>
          {pickerPresets.map((preset) => (
            <Chip
              key={preset.label}
              label={preset.label}
              size="small"
              disabled={disabled || isTimeDisabled(preset.value)}
              onClick={() => commit(preset.value)}
            />
          ))}
        </Stack>
      )}

      {onTimezoneChange && (
        <FormControl fullWidth={fullWidth} size="small" disabled={disabled} error={error}>
          <InputLabel id={`${name || 'time'}-timezone-label`}>Time zone</InputLabel>
          <Select
            labelId={`${name || 'time'}-timezone-label`}
            value={timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'}
            label="Time zone"
            onChange={(event) => onTimezoneChange(event.target.value)}
            onBlur={onBlur}
          >
            {timezoneOptions.map((zone) => (
              <MenuItem key={zone} value={zone}>
                {zone}
              </MenuItem>
            ))}
          </Select>
          {error && !helperText && <FormHelperText error />}
        </FormControl>
      )}

      <Box sx={{ display: 'none' }} aria-live="polite">
        {value ? displayTime(value, format) : 'No time selected'}
      </Box>
    </Stack>
  );
};

export default TimePicker;
