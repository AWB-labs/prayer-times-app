/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#F2F2F7',
          100: '#E5E5EA',
          200: '#D1D1D6',
          300: '#C7C7CC',
          400: '#AEAEB2',
          500: '#8E8E93',
          900: '#2C2C2E',
          950: '#1C1C1E',
          1000: '#000000',
        },
        gold: {
          300: '#E8C547',
          400: '#D9B030',
          500: '#C9A227',
          600: '#A8841C',
          700: '#8A6D00',
        },
      },
    },
  },
  plugins: [],
};
