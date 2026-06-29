import React, { useState, useEffect, useId } from "react";
import {
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  InputAdornment,
  IconButton,
} from "@mui/material";
import { Search as SearchIcon, Clear as ClearIcon } from "@mui/icons-material";

export type FilterType = "text" | "select" | "date-range";

export interface FilterOption {
  label: string;
  value: string;
}

export interface DateRangeValue {
  start: string;
  end: string;
}

export type FilterValue = string | string[] | DateRangeValue | undefined;

export interface TableFilterProps {
  columnId: string;
  filterType: FilterType;
  value: FilterValue;
  onChange: (value: FilterValue) => void;
  options?: FilterOption[];
  placeholder?: string;
}

const DEBOUNCE_MS = 300;

const TextFilter: React.FC<{
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
}> = ({ value, onChange, placeholder }) => {
  const [localValue, setLocalValue] = useState(value || "");

  useEffect(() => {
    setLocalValue(value || "");
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== (value || "")) {
        onChange(localValue || undefined);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [localValue, onChange, value]);

  return (
    <TextField
      size="small"
      variant="outlined"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      placeholder={placeholder || "Search..."}
      fullWidth
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon sx={{ fontSize: 18, color: "action.active" }} />
          </InputAdornment>
        ),
        endAdornment: localValue ? (
          <InputAdornment position="end">
            <IconButton
              size="small"
              onClick={() => {
                setLocalValue("");
                onChange(undefined);
              }}
            >
              <ClearIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </InputAdornment>
        ) : null,
      }}
      sx={{ minWidth: 140 }}
    />
  );
};

const SelectFilter: React.FC<{
  value: string | string[] | undefined;
  onChange: (value: string | string[] | undefined) => void;
  options?: FilterOption[];
}> = ({ value, onChange, options }) => {
  const currentValue = value || "";
  const filterId = useId();

  return (
    <FormControl size="small" sx={{ minWidth: 140 }}>
      <InputLabel id={filterId} shrink>
        Filter
      </InputLabel>
      <Select
        labelId={filterId}
        value={currentValue}
        label="Filter"
        displayEmpty
        onChange={(e) => {
          const v = e.target.value;
          onChange(v || undefined);
        }}
        renderValue={(selected) => {
          if (!selected) return <em>All</em>;
          const opt = options?.find((o) => o.value === selected);
          return opt?.label || selected;
        }}
      >
        <MenuItem value="">
          <em>All</em>
        </MenuItem>
        {options?.map((opt) => (
          <MenuItem key={opt.value} value={opt.value}>
            {opt.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

const DateRangeFilter: React.FC<{
  value: DateRangeValue | undefined;
  onChange: (value: DateRangeValue | undefined) => void;
}> = ({ value, onChange }) => {
  return (
    <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
      <TextField
        size="small"
        type="date"
        label="From"
        value={value?.start || ""}
        onChange={(e) => {
          const newVal: DateRangeValue = {
            start: e.target.value,
            end: value?.end || "",
          };
          onChange(newVal.start || newVal.end ? newVal : undefined);
        }}
        InputLabelProps={{ shrink: true }}
        sx={{ minWidth: 130 }}
      />
      <TextField
        size="small"
        type="date"
        label="To"
        value={value?.end || ""}
        onChange={(e) => {
          const newVal: DateRangeValue = {
            start: value?.start || "",
            end: e.target.value,
          };
          onChange(newVal.start || newVal.end ? newVal : undefined);
        }}
        InputLabelProps={{ shrink: true }}
        sx={{ minWidth: 130 }}
      />
      {(value?.start || value?.end) && (
        <IconButton size="small" onClick={() => onChange(undefined)}>
          <ClearIcon sx={{ fontSize: 16 }} />
        </IconButton>
      )}
    </Box>
  );
};

const TableFilter: React.FC<TableFilterProps> = ({
  columnId,
  filterType,
  value,
  onChange,
  options,
  placeholder,
}) => {
  switch (filterType) {
    case "select":
      return (
        <SelectFilter
          value={value as string | string[] | undefined}
          onChange={onChange as (v: string | string[] | undefined) => void}
          options={options}
        />
      );
    case "date-range":
      return (
        <DateRangeFilter
          value={value as DateRangeValue | undefined}
          onChange={onChange as (v: DateRangeValue | undefined) => void}
        />
      );
    case "text":
    default:
      return (
        <TextFilter
          value={value as string | undefined}
          onChange={onChange as (v: string | undefined) => void}
          placeholder={placeholder}
        />
      );
  }
};

export default TableFilter;
