// Runs the Expo CLI against the local backend. backend/.env.local (written by
// `npx convex dev`) names the URL VITE_CONVEX_URL, the web app's name; Expo only
// inlines EXPO_PUBLIC_* variables, so it gets that name here.
process.env.EXPO_PUBLIC_CONVEX_URL ||= process.env.VITE_CONVEX_URL;
require("expo/bin/cli");
