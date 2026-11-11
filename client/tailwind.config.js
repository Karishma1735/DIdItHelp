/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['"Fraunces Variable"', 'Georgia', 'serif'],
        sans: ['"DM Sans Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"DM Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Primary blues. 400 = Blue Gray #88A9C3, 700 = Midnight Blue #2B4257, 900 = Navy Blue #14202E, 950 = Royal Blue #091235
        steel: {
          50: '#F1F5F8', 100: '#E2EAF0', 200: '#C9D8E4', 300: '#A9C0D3', 400: '#88A9C3',
          500: '#5F86A5', 600: '#3F5D76', 700: '#2B4257', 800: '#1E3042', 900: '#14202E', 950: '#091235',
        },
        // Forest green, used only for "it helped" and success states
        leaf: { 50: '#EAF5EE', 100: '#D3EBDC', 300: '#86C9A3', 600: '#2E7D55', 700: '#1F6B4A', 800: '#17563B' },
        // Light surfaces: very pale tints of Blue Gray
        mist: { 50: '#F9FBFD', 100: '#EEF3F7', 200: '#E1E9F0', 300: '#CDDAE5', 400: '#B2C6D7' },
        // Text and dark surfaces, built on Navy and Royal Blue
        ink: {
          50: '#F4F7FA', 100: '#E8EEF3', 200: '#D3DDE6', 300: '#B1C0CD', 400: '#8396A8', 500: '#5F7285',
          600: '#455768', 700: '#2F4050', 800: '#1B2A3A', 900: '#14202E', 950: '#091235',
        },
      },
      boxShadow: { soft: '0 1px 2px rgba(60,10,20,.05), 0 8px 24px -12px rgba(60,10,20,.18)' },
    },
  },
  plugins: [],
};
