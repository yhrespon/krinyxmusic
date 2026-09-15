import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerLocalStorageWorker } from "./localMedia.ts";

const nativeFetch = window.fetch.bind(window);
window.fetch = (input, init = {}) => { const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input); const method = String(init.method || (input instanceof Request ? input.method : "GET")).toUpperCase(); if (url.startsWith("/api/") && ["POST", "PUT", "PATCH", "DELETE"].includes(method)) { const token = document.cookie.match(/(?:^|;\s*)krinyx_csrf=([^;]+)/)?.[1]; const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined)); if (token) headers.set("X-CSRF-Token", token); init = { ...init, headers, credentials: "same-origin" }; } return nativeFetch(input, init); };
void registerLocalStorageWorker().catch(() => undefined);
createRoot(document.getElementById("root")!).render(<App />);
