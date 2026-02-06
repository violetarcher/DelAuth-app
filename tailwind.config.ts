import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2563eb', // blue-600
          dark: '#1e40af', // blue-700
          light: '#3b82f6', // blue-500
        },
        secondary: {
          DEFAULT: '#374151', // gray-700
          dark: '#1f2937', // gray-800
          light: '#4b5563', // gray-600
        },
      },
    },
  },
  plugins: [],
}
export default config
