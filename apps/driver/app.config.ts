import type { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: '誠憶外送員',
  slug: 'chengyi-driver',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  platforms: ['ios', 'android', 'web'],
  scheme: 'chengyi-driver',
  web: {
    bundler: 'metro',
    output: 'single'
  },
  extra: {
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE || 'http://localhost:3000'
  }
});
