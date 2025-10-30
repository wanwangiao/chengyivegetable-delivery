import withPWA from 'next-pwa';

const isProd = process.env.NODE_ENV === 'production';

export default withPWA({
  dest: 'public',
  disable: !isProd,
})({
  experimental: {
    typedRoutes: true
  },
  // 使用 Git commit hash 作為 build ID，確保每次部署都會產生新的靜態文件 hash
  // 這樣可以避免瀏覽器快取舊版本的 CSS/JS 文件
  generateBuildId: async () => {
    // 在 CI 環境使用 Git commit SHA
    if (process.env.RAILWAY_GIT_COMMIT_SHA) {
      return process.env.RAILWAY_GIT_COMMIT_SHA;
    }
    if (process.env.GITHUB_SHA) {
      return process.env.GITHUB_SHA;
    }
    // 本地開發使用時間戳
    return `dev-${Date.now()}`;
  }
});
