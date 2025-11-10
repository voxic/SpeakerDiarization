/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'mongodb-bg': '#1A2C38',
        'mongodb-green': '#00ED64',
        'mongodb-text': '#FFFFFF',
        'mongodb-text-secondary': '#C8C8C8',
        'mongodb-border': '#3C4650',
      },
      backgroundColor: {
        'mongodb-dark': '#1A2C38',
      },
    },
  },
  plugins: [],
}

