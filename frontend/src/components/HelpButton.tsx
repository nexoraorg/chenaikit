import React from 'react';
import { IconButton, Box } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import Tooltip from './Tooltip';

interface HelpButtonProps {
  onClick: () => void;
  tooltip?: string;
  ariaLabel?: string;
  size?: 'small' | 'medium';
}

const HelpButton: React.FC<HelpButtonProps> = ({
  onClick,
  tooltip = 'Open help center',
  ariaLabel = 'Open help center',
  size = 'medium',
}) => {
  return (
    <Tooltip title={tooltip} placement="bottom" followCursor>
      <Box>
        <IconButton
          onClick={onClick}
          size={size}
          color="primary"
          aria-label={ariaLabel}
          sx={{ borderRadius: 2, border: '1px solid rgba(0,0,0,0.08)' }}
        >
          <HelpOutlineIcon />
        </IconButton>
      </Box>
    </Tooltip>
  );
};

export default HelpButton;
