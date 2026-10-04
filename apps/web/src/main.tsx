import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import { ThemeProvider } from './theme.js';
import './index.css';

const rootEl = document.getElementById('root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </React.StrictMode>,
  );
}
