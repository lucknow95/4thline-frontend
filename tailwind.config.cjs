/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./**/*.{js,ts,jsx,tsx,mdx}",
    "!./node_modules/**",
    "!./.next/**",
  ],
  theme: {
    extend: {
      colors: {
        // Use CSS variables so you can match the right-column color exactly
        // without rebuilding or risking other pages.
        brand: {
          // defaults match Tailwind blue-200 / blue-800; override in CSS to your exact hex
          light: "rgb(var(--brand-light) / <alpha-value>)",
          dark: "rgb(var(--brand-dark) / <alpha-value>)",
        },
      },
    },
  },
  plugins: [
    // Leave empty for now; add plugins here once confirmed v4-compatible.
    // require('@tailwindcss/typography'), // enable later if needed
  ],
};
