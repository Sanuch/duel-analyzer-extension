import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const target = mode === "background" ? "background" : "content";

  return {
    build: {
      outDir: "dist",
      emptyOutDir: target === "content",
      sourcemap: true,
      rollupOptions: {
        input: resolve(__dirname, target === "content" ? "src/content/main.ts" : "src/background/main.ts"),
        output: {
          format: "iife",
          entryFileNames: target === "content" ? "content.js" : "background.js",
          inlineDynamicImports: true,
          assetFileNames: "assets/[name]-[hash][extname]",
        },
      },
    },
  };
});
