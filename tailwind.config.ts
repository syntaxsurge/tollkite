import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: ['class', '.dark'],
  theme: {
    extend: {}
  },
  plugins: []
}

export default config
