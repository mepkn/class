import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import App from "./App";
import "./index.css";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
if (!convexUrl) {
  throw new Error("VITE_CONVEX_URL is not set. Run `npx convex dev` to create .env.local.");
}

/**
 * Local dev: VITE_CONVEX_URL points at 127.0.0.1, which on a phone/other laptop means
 * *that* device. When the page was opened via the Mac's LAN address (e.g.
 * http://192.168.0.155:5173), talk to the backend on that same host instead.
 * Production URLs (https://<name>.convex.cloud) are never touched.
 */
function resolveConvexUrl(url: string): string {
  const parsed = new URL(url);
  const isLoopback = ["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname);
  const pageHost = window.location.hostname;
  if (import.meta.env.DEV && isLoopback && !["127.0.0.1", "localhost", "[::1]"].includes(pageHost)) {
    parsed.hostname = pageHost;
  }
  return parsed.toString().replace(/\/$/, "");
}

const convex = new ConvexReactClient(resolveConvexUrl(convexUrl));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexAuthProvider client={convex}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ConvexAuthProvider>
  </StrictMode>,
);
