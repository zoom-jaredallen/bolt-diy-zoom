import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initPreviewRegistration } from './lib/preview-registration';

/*
 * Initialize preview URL registration with bolt.diy.
 * This enables Zoom to find and load this app via /api/zoom-home/{projectId}.
 */
initPreviewRegistration();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
