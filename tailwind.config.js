/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./frontend/pages/**/*.html",
    "./frontend/components/**/*.html",
    "./frontend/assets/js/**/*.js"
  ],
  theme: {
    extend: {
      colors: {
        darkBg: '#090d16',
        cardBg: '#111827',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['Fira Code', 'Courier New', 'monospace'],
      }
    },
  },
  plugins: [],
}
