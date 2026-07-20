import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "../index.css";

export function mountApp(selector) {
  const el = document.querySelector(selector);
  if (!el) return;

  const root = createRoot(el);
  root.render(<App />);
}
