import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/dev": "http://backend:8000",
      "/todos": "http://backend:8000",
    },
  },
});
