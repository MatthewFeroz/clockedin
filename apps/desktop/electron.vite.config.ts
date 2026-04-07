import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin({
        exclude: ["@clockedin/shared", "@clockedin/storage"]
      })
    ],
    build: {
      rollupOptions: {
        external: ["better-sqlite3"]
      }
    }
  },
  preload: {
    plugins: [
      externalizeDepsPlugin({
        exclude: ["@clockedin/shared", "@clockedin/storage"]
      })
    ]
  },
  renderer: {
    plugins: [react()]
  }
});
