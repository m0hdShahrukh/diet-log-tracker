import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

const redirectParam = new URLSearchParams(window.location.search).get('redirect');
if (redirectParam) {
  window.history.replaceState(null, '', redirectParam);
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch((error) => {
      // eslint-disable-next-line no-console
      console.error('Service worker registration failed:', error);
    });
  });
}
