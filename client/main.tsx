/**
 * @fileoverview This file is the main entry point for the React application. It renders the root `App` component into the DOM element with the ID 'root' using `ReactDOM.createRoot`.
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
