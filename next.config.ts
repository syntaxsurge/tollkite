import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    const demoVideo = process.env.DEMO_VIDEO_URL || 'https://www.youtube.com/'
    const pitchDeck = process.env.PITCH_DECK_URL || 'https://canva.com'

    return [
      {
        source: '/demo-video',
        destination: demoVideo,
        permanent: false
      },
      {
        source: '/pitch-deck',
        destination: pitchDeck,
        permanent: false
      }
    ]
  },
  webpack(config) {
    config.resolve = config.resolve ?? {}
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      '@react-native-async-storage/async-storage': false
    }

    return config
  }
}

export default nextConfig
