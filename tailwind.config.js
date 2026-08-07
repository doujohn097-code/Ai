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
          pink: '#ff6ec7',
          purple: '#b25cff',
          blue: '#4facfe',
        },
        bg: '#0f0f12',
        surface: '#18181d',
        'surface-light': '#25252e',
      },
      fontFamily: {
        sans: ['Cairo', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
