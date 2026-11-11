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
        // Cherry red
          cherry: {
          50: '#FEF4F4', 100: '#FCE6E7', 200: '#F8C9CD', 300: '#F2A5AD', 400: '#E97E8C',
          500: '#DE6074', 600: '#D0526A', 700: '#BE4358', 800: '#A33648', 900: '#852B3B', 950: '#5C1D29',
        },
        // Forest green, used only for "it helped" and success states
        leaf: { 50: '#EAF5EE', 100: '#D3EBDC', 300: '#86C9A3', 600: '#2E7D55', 700: '#1F6B4A', 800: '#17563B' },
        // Cream
        cream: { 50: '#FFFBF4', 100: '#FBF3E4', 200: '#F4E7CF', 300: '#EBD8B8', 400: '#DCC299' },
        // Warm wine-tinted neutrals (text, borders, dark surfaces)
        wine: {
          50: '#FAF5EE', 100: '#F3E9DD', 200: '#E7D7C6', 300: '#D2BBA8', 400: '#A98F83', 500: '#84696A',
          600: '#624C50', 700: '#483539', 800: '#33242A', 900: '#241519', 950: '#170B0E',
        },
      },
      boxShadow: { soft: '0 1px 2px rgba(60,10,20,.05), 0 8px 24px -12px rgba(60,10,20,.18)' },
    },
  },
  plugins: [],
};
