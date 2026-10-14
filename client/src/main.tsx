import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/App";
import "./index.css";

const container = document.getElementById("root");

if (!container) {
  throw new Error('Unable to mount: index.html is missing <div id="root">.');
}

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
