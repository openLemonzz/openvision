import fs from "node:fs"
import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const supabaseAuthEntry = fs.existsSync(path.resolve(__dirname, "./node_modules/@supabase/auth-js/src/index.ts"))
  ? path.resolve(__dirname, "./node_modules/@supabase/auth-js/src/index.ts")
  : path.resolve(__dirname, "../node_modules/@supabase/auth-js/src/index.ts")

const lucideReactEntry = fs.existsSync(path.resolve(__dirname, "./node_modules/lucide-react/dist/cjs/lucide-react.js"))
  ? path.resolve(__dirname, "./node_modules/lucide-react/dist/cjs/lucide-react.js")
  : path.resolve(__dirname, "../node_modules/lucide-react/dist/cjs/lucide-react.js")

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      "@supabase/auth-js": supabaseAuthEntry,
      "lucide-react": lucideReactEntry,

      "@": path.resolve(__dirname, "./src"),
    },
  },
});
