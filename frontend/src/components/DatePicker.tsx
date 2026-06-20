import React from 'react';
import {
  Box,
  Button,
  Chip,
  FormHelperText,
  Grid,
  IconButton,
  Popover,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material';
import { ChevronLeft, ChevronRight, Today } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

export type DateValue = Date | string | null;

export interface DatePreset {
  label: string;
  getValue: () => Date;
}

export interface DatePickerProps {
  value: DateValue;
  onChange: (value: Date | null) => void;
  label?: string;
  name?: string;
  minDate?: DateValue;
  maxDate?: DateValue;
  disabledDates?: DateValue[];
  shouldDisableDate?: (date: Date) => boolean;
  presets?: DatePreset[];
  locale?: string;
  disabled?: boolean;
  required?: boolean;
  error?: boolean;
  helperText?: React.ReactNode;
  placeholder?: string;
  fullWidth?: boolean;
  onBlur?: () => void;
}

export const toDate = (value: DateValue): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const startOfDay = (date: Date): Date => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

export const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export const isSameDay = (left: Date, right: Date): boolean =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

export const isBusinessDay = (date: Date): boolean => {
  const day = date.getDay();
  return day !== 0 && day !== 6;
};

export const addBusinessDays = (date: Date, days: number): Date => {
  const direction = days < 0 ? -1 : 1;
  let remaining = Math.abs(days);
  let cursor = new Date(date);

  while (remaining > 0) {
    cursor = addDays(cursor, direction);
    if (isBusinessDay(cursor)) remaining -= 1;
  }

  return cursor;
};

export const defaultDatePresets = (): DatePreset[] => [
  { label: 'Today', getValue: () => new Date() },
  { label: 'Yesterday', getValue: () => addDays(new Date(), -1) },
  { label: '7 days ago', getValue: () => addDays(new Date(), -7) },
  { label: '30 days ago', getValue: () => addDays(new Date(), -30) },
  { label: 'Next business day', getValue: () => addBusinessDays(new Date(), 1) }
];

const getMonthDays = (month: Date): Array<Date | null> => {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: Array<Date | null> = [];

  for (let index = 0; index < first.getDay(); index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), day));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
};

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  label,
  name,
  minDate,
  maxDate,
  disabledDates = [],
  shouldDisableDate,
  presets,
  locale,
  disabled = false,
  required = false,
  error = false,
  helperText,
  placeholder,
  fullWidth = true,
  onBlur
}) => {
  const { i18n } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const activeLocale = locale || i18n.language || navigator.language || 'en';
  const selectedDate = toDate(value);
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
  const [visibleMonth, setVisibleMonth] = React.useState<Date>(selectedDate || new Date());

  React.useEffect(() => {
    if (selectedDate) setVisibleMonth(selectedDate);
  }, [selectedDate?.getTime()]);

  const min = minDate ? startOfDay(toDate(minDate) as Date) : null;
  const max = maxDate ? startOfDay(toDate(maxDate) as Date) : null;
  const disabledDateValues = disabledDates.map(toDate).filter(Boolean) as Date[];
  const monthDays = getMonthDays(visibleMonth);
  const open = Boolean(anchorEl);
  const pickerPresets = presets || defaultDatePresets();

  const formatter = React.useMemo(
    () => new Intl.DateTimeFormat(activeLocale, { year: 'numeric', month: 'short', day: 'numeric' }),
    [activeLocale]
  );

  const monthLabel = React.useMemo(
    () => new Intl.DateTimeFormat(activeLocale, { month: 'long', year: 'numeric' }).format(visibleMonth),
    [activeLocale, visibleMonth]
  );

  const weekdays = React.useMemo(() => {
    const base = new Date(2024, 0, 7);
    return Array.from({ length: 7 }, (_, index) =>
      new Intl.DateTimeFormat(activeLocale, { weekday: 'short' }).format(addDays(base, index))
    );
  }, [activeLocale]);

  const isDateDisabled = (date: Date): boolean => {
    const day = startOfDay(date);
    if (min && day < min) return true;
    if (max && day > max) return true;
    if (disabledDateValues.some((disabledDate) => isSameDay(disabledDate, day))) return true;
    return shouldDisableDate ? shouldDisableDate(day) : false;
  };

  const commitDate = (date: Date | null) => {
    if (date && isDateDisabled(date)) return;
    onChange(date ? startOfDay(date) : null);
    setAnchorEl(null);
    onBlur?.();
  };

  const moveMonth = (amount: number) => {
    setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + amount, 1));
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>, date: Date | null) => {
    if (!date) return;
    const moves: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7
    };

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      commitDate(date);
    } else if (moves[event.key] !== undefined) {
      event.preventDefault();
      const next = addDays(date, moves[event.key]);
      setVisibleMonth(next);
    }
  };

  const calendar = (
    <Box sx={{ width: isMobile ? 'calc(100vw - 32px)' : 360, p: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <IconButton aria-label="Previous month" onClick={() => moveMonth(-1)} size="small">
          <ChevronLeft />
        </IconButton>
        <Typography id={`${name || 'date'}-calendar-label`} variant="subtitle1" sx={{ fontWeight: 600 }}>
          {monthLabel}
        </Typography>
        <IconButton aria-label="Next month" onClick={() => moveMonth(1)} size="small">
          <ChevronRight />
        </IconButton>
      </Stack>

      <Grid container columns={7} spacing={0.5} role="grid" aria-labelledby={`${name || 'date'}-calendar-label`}>
        {weekdays.map((weekday) => (
          <Grid item xs={1} key={weekday}>
            <Typography align="center" variant="caption" color="text.secondary">
              {weekday}
            </Typography>
          </Grid>
        ))}
        {monthDays.map((date, index) => {
          const isSelected = Boolean(date && selectedDate && isSameDay(date, selectedDate));
          const isDisabled = Boolean(date && isDateDisabled(date));

          return (
            <Grid item xs={1} key={date ? date.toISOString() : `empty-${index}`}>
              {date ? (
                <Button
                  role="gridcell"
                  aria-selected={isSelected}
                  aria-label={formatter.format(date)}
                  disabled={isDisabled}
                  onClick={() => commitDate(date)}
                  onKeyDown={(event) => handleKeyDown(event, date)}
                  variant={isSelected ? 'contained' : 'text'}
                  sx={{ minWidth: 40, width: '100%', height: 40, borderRadius: 1 }}
                >
                  {date.getDate()}
                </Button>
              ) : (
                <Box sx={{ height: 40 }} />
              )}
            </Grid>
          );
        })}
      </Grid>

      {pickerPresets.length > 0 && (
        <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 2 }}>
          {pickerPresets.map((preset) => {
            const presetDate = preset.getValue();
            return (
              <Chip
                key={preset.label}
                label={preset.label}
                size="small"
                disabled={isDateDisabled(presetDate)}
                onClick={() => commitDate(presetDate)}
              />
            );
          })}
        </Stack>
      )}
    </Box>
  );

  return (
    <>
      <TextField
        name={name}
        label={label}
        value={selectedDate ? formatter.format(selectedDate) : ''}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        error={error}
        helperText={helperText}
        fullWidth={fullWidth}
        inputProps={{ readOnly: true, 'aria-haspopup': 'dialog' }}
        InputProps={{
          endAdornment: <Today color={disabled ? 'disabled' : 'action'} fontSize="small" />
        }}
        onClick={(event) => !disabled && setAnchorEl(event.currentTarget)}
        onKeyDown={(event) => {
          if ((event.key === 'Enter' || event.key === ' ') && !disabled) {
            event.preventDefault();
            setAnchorEl(event.currentTarget);
          }
        }}
        onBlur={onBlur}
      />
      {!helperText && error && <FormHelperText error />}
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => {
          setAnchorEl(null);
          onBlur?.();
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{ role: 'dialog', 'aria-modal': false }}
      >
        {calendar}
      </Popover>
    </>
  );
};

export default DatePicker;
