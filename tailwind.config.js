import forms from '@tailwindcss/forms'
import containerQueries from '@tailwindcss/container-queries'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        mist: '#efefef',
        paper: '#ffffff',
        carbon: '#202020',
        signal: '#ff682c',
        'signal-orange': '#ff682c',
        graphite: '#4d4d4d',
        chalk: '#e8e8e8',
        fog: '#f5f5f5',
        'primary-container': '#202020',
      },
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        heading: ["'Plus Jakarta Sans'", '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      borderRadius: {
        card: '12px',
      },
    },
  },
  plugins: [forms, containerQueries],
}
