import React, { useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';

export interface CollapsiblePanelProps {
  title: string;
  children: React.ReactNode;
  /** On desktop, always expanded and render as a plain section. Default true. */
  collapseOnMobileOnly?: boolean;
  defaultExpanded?: boolean;
  id?: string;
}

/**
 * Collapsible sidebar/panel that stacks and collapses on mobile.
 */
export const CollapsiblePanel: React.FC<CollapsiblePanelProps> = ({
  title,
  children,
  collapseOnMobileOnly = true,
  defaultExpanded = true,
  id,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (collapseOnMobileOnly && !isMobile) {
    return (
      <Box component="section" id={id} aria-label={title} sx={{ width: '100%' }}>
        <Typography variant="h6" component="h3" sx={{ fontWeight: 600, mb: 2 }}>
          {title}
        </Typography>
        {children}
      </Box>
    );
  }

  return (
    <Accordion
      id={id}
      expanded={expanded}
      onChange={(_, next) => setExpanded(next)}
      disableGutters
      sx={{
        width: '100%',
        borderRadius: 2,
        '&:before': { display: 'none' },
        boxShadow: 1,
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        aria-controls={id ? `${id}-content` : undefined}
        id={id ? `${id}-header` : undefined}
        sx={{
          minHeight: 48,
          px: 2,
          '& .MuiAccordionSummary-content': { my: 1.5 },
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
      </AccordionSummary>
      <AccordionDetails id={id ? `${id}-content` : undefined} sx={{ px: 2, pb: 2 }}>
        {children}
      </AccordionDetails>
    </Accordion>
  );
};

export default CollapsiblePanel;
