/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      // Warm Clarity color palette for dementia/amnesia accessibility
      colors: {
        // Warm backgrounds - avoid pure white glare
        cream: {
          50: '#FDFBF7',
          100: '#FAF7F0',
          200: '#F5F0E6',
          300: '#EDE5D4',
          400: '#E0D4BE',
        },
        // Warm charcoal text - avoid pure black
        charcoal: {
          600: '#4A4A4A',
          700: '#3D3D3D',
          800: '#333333',
          900: '#2A2A2A',
        },
        // Calming accent colors
        teal: {
          50: '#ECFEFF',
          100: '#CFFAFE',
          200: '#A5F3FC',
          300: '#67E8F9',
          400: '#22D3EE',
          500: '#06B6D4',
          600: '#0891B2',
          700: '#0E7490',
        },
        coral: {
          50: '#FBE9E7',
          100: '#FFCCBC',
          400: '#FF8A80',
          500: '#FF7043',
          600: '#F4511E',
        },
        // Soft navy for links/accents
        navy: {
          600: '#37474F',
          700: '#263238',
          800: '#1C2833',
        },
      },
      // Larger, more readable font sizes
      fontSize: {
        'accessible-sm': ['1rem', { lineHeight: '1.6' }],      // 16px
        'accessible-base': ['1.125rem', { lineHeight: '1.7' }], // 18px
        'accessible-lg': ['1.25rem', { lineHeight: '1.7' }],    // 20px
        'accessible-xl': ['1.5rem', { lineHeight: '1.6' }],     // 24px
        'accessible-2xl': ['1.875rem', { lineHeight: '1.5' }],  // 30px
        'accessible-3xl': ['2.25rem', { lineHeight: '1.4' }],   // 36px
      },
      // Accessible font family - Humanist Sans-Serif
      fontFamily: {
        accessible: ['Lato', 'Open Sans', 'system-ui', 'sans-serif'],
      },
      // Tactile button shadows
      boxShadow: {
        'tactile': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        'tactile-pressed': 'inset 0 2px 4px rgba(0, 0, 0, 0.1)',
        'tactile-hover': '0 6px 12px -2px rgba(0, 0, 0, 0.15), 0 3px 6px -2px rgba(0, 0, 0, 0.1)',
      },
      // Larger touch targets
      spacing: {
        'touch': '48px',  // Minimum touch target size
        'touch-lg': '56px',
      },
      // Rounded corners for tactile feel
      borderRadius: {
        'tactile': '12px',
        'tactile-lg': '16px',
      },
    },
  },
  plugins: [],
};
