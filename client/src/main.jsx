import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AppProvider } from './context/AppContext.jsx';
import './styles/original.css'; // the supplied homepage stylesheet, unchanged
import './styles/app.css'; // additions for the multi-page app
import './styles/phone.css'; // phone-only layer (scoped to html[data-phone]; desktop unaffected)
import './utils/install.js'; // captures the install prompt early

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppProvider>
        <App />
      </AppProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
