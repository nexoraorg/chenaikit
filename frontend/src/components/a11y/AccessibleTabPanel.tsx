import React from 'react';

export interface AccessibleTabPanelProps {
  children?: React.ReactNode;
  value: number;
  index: number;
  idPrefix: string;
}

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
  >
    {children}
  </div>
);

export default AccessibleTabPanel;
