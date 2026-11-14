import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// The service worker (app-shell precache) is registered by vite-plugin-pwa's injected registerSW.js.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
