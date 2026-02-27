/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: "#1A2E35", // Deep Navy for primary actions
        secondary: "#D4AF37", // Muted Gold accent
        "primary-hover": "#253b44",
        "background-light": "#F5F5F2", // Ivory/Light Gray
        "background-dark": "#121212", // Deep Dark for dark mode
        "surface-light": "#FFFFFF",
        "surface-dark": "#1E1E1E",
        "text-light": "#1A2E35", // Deep Navy text
        "text-dark": "#E2E2E2", // Off-white text
        "accent-sage": "#8FA38F",
        "navy-deep": "#1a237e",
        "ivory-warm": "#fdfaf1",
        "sage-soft": "#e8f5e9",
        // Keep some legacy colors just in case they are used in other pages temporarily
        charcoal: {
          600: '#4A4A4A',
          700: '#3D3D3D',
          800: '#333333',
        },
        teal: {
          50: '#ECFEFF',
          100: '#CFFAFE',
          500: '#06B6D4',
          600: '#0891B2',
        },
        coral: {
          50: '#FBE9E7',
        },
        cream: {
          50: '#FDFBF7',
          200: '#F5F0E6',
        }
      },
      fontFamily: {
        display: ["Lexend", "sans-serif"],
        serif: ["Playfair Display", "serif"],
        accessible: ['Lato', 'Open Sans', 'system-ui', 'sans-serif'], // Legacy fallback
      },
      borderRadius: { "DEFAULT": "0.25rem", "lg": "0.5rem", "xl": "0.75rem", "full": "9999px" },
    },
  },
  plugins: [
    require('@tailwindcss/container-queries') || function () { }, // Safe fallback if not installed
  ],
};
