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
        'mongodb-text': '#FFFFFF',
        'mongodb-text-secondary': '#C8C8C8',
        'mongodb-text-muted': '#9CA3AF',
        'mongodb-border': '#3C4650',
        'primary-blue': '#3B82F6',
        'primary-blue-hover': '#2563EB',
        'status-blue': '#60A5FA',
        'status-blue-bg': '#DBEAFE',
        'link-blue': '#3B82F6',
      },
      backgroundColor: {
        'mongodb-dark': '#1A2C38',
        'card-white': '#FFFFFF',
        'table-header': '#F9FAFB',
      },
    },
  },
  plugins: [],
}

