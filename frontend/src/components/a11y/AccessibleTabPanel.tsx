import React from 'react';

export interface AccessibleTabPanelProps {
  children?: React.ReactNode;
  value: number;
  index: number;
  idPrefix: string;
}

/**
 * WAI-ARIA tab panel wired to MUI Tabs via shared idPrefix.
 * Tab buttons should use id={`${idPrefix}-tab-${index}`} and
 * aria-controls={`${idPrefix}-panel-${index}`}.
 */
export const AccessibleTabPanel: React.FC<AccessibleTabPanelProps> = ({
  children,
  value,
  index,
  idPrefix,
}) => (
  <div
    role="tabpanel"
    id={`${idPrefix}-panel-${index}`}
    aria-labelledby={`${idPrefix}-tab-${index}`}
    hidden={value !== index}
    tabIndex={0}
  >
    {value === index && children}
  </div>
);

export default AccessibleTabPanel;
