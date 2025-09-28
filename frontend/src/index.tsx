// ChenAIKit Frontend Application
// TODO: Implement frontend application - See frontend issues in .github/ISSUE_TEMPLATE/

import React from 'react';
import ReactDOM from 'react-dom/client';

const App: React.FC = () => {
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>ChenAIKit Frontend</h1>
      <p>Frontend implementation pending - see issue templates for contributors</p>
      <p>Check .github/ISSUE_TEMPLATE/ for frontend development tasks</p>
    </div>
  );
};

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
