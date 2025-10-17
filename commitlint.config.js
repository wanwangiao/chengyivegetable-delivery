module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat', // 新功能
        'fix', // 修復 bug
        'docs', // 文件更新
        'style', // 格式調整
        'refactor', // 重構
        'perf', // 性能優化
        'test', // 測試
        'chore', // 雜項
        'revert', // 回退
        'ci', // CI/CD 相關
        'build', // 建構相關
      ],
    ],
    'subject-case': [0], // 允許任何大小寫
    'body-max-line-length': [0], // 不限制 body 長度
  },
};
