import React from 'react';
import { Box } from '@mui/material';

export interface ChartAccessibleSummaryProps {
  title: string;
  rows: Array<{ label: string; value: string | number }>;
}

/**
 * Screen-reader accessible data table fallback for charts (WCAG 1.1.1).
 */
export const ChartAccessibleSummary: React.FC<ChartAccessibleSummaryProps> = ({
  title,
  rows,
}) => (
  <Box
    component="table"
    className="sr-only"
    aria-label={`${title} data summary`}
  >
    <caption>{title}</caption>
    <thead>
      <tr>
        <th scope="col">Label</th>
        <th scope="col">Value</th>
      </tr>
    </thead>
    <tbody>
      {rows.map((row) => (
        <tr key={`${row.label}-${row.value}`}>
          <td>{row.label}</td>
          <td>{row.value}</td>
        </tr>
      ))}
    </tbody>
  </Box>
);

export default ChartAccessibleSummary;
