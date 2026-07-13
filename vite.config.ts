import { defineConfig } from "vite";

export default defineConfig({
  // Relative Pfade, damit das Spiel in einem GitHub-Pages-Unterordner
  // (https://<user>.github.io/<repo>/) korrekt lädt – unabhängig vom Repo-Namen.
  base: "./",
});
