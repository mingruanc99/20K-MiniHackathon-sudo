/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f7ff',
          100: '#ebf0fe',
          200: '#d6e0fd',
          300: '#b4c8fb',
          400: '#8ca7f8',
          500: '#6384f5',
          600: '#4361eb',
          700: '#344ad5',
          800: '#2d3eac',
          900: '#293788',
        },
        slate: {
          850: '#172033',
        },
        // Sổ đầu bài world (lecturer / learner surfaces)
        cover: { DEFAULT: '#044a97', deep: '#134B88', foil: '#e6d9a8' },
        paper: { DEFAULT: '#f5f7f2', band: '#e9eee4', edge: '#dfe6da', sheet: '#fbfcf9', wash: '#fdf6f4' },
        rule: { DEFAULT: '#c9d6ca', strong: '#93aa98' },
        print: { DEFAULT: '#2c5a47', soft: '#557a69' },
        ink: { DEFAULT: '#1b2559', soft: '#4b5577', faint: '#5c6482' },
        pen: { DEFAULT: '#BE1E2D', soft: '#f9e3e5', line: '#eab4b9' },
        navy: { DEFAULT: '#134B88', soft: '#e4ecf6', line: '#b7cbe3' }
      },
      fontFamily: {
        sans: ['"Be Vietnam Pro"', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        ledger: ['"Be Vietnam Pro"', 'system-ui', 'sans-serif'],
        hand: ['"Patrick Hand"', '"Be Vietnam Pro"', 'cursive'],
      },
    },
  },
  plugins: [],
}
