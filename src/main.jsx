import React from 'react';
import ReactDOM from 'react-dom/client';
import Root from './App.jsx'; // Renamed App.js to App.jsx and it now exports Root
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);