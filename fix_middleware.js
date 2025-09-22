#!/usr/bin/env node

/**
 * 修復app.js中缺失的ensureDriver中間件
 */

const fs = require('fs');
const path = require('path');

async function fixMiddleware() {
  const appPath = path.join(__dirname, 'src', 'app.js');

  try {
    let content = await fs.promises.readFile(appPath, 'utf8');

    // 在ensureDriverPage之後添加ensureDriver中間件
    const ensureDriverMiddleware = `
  /**
   * 外送員API權限檢查中間件
   */
  ensureDriver = (req, res, next) => {
    if (req.session && req.session.driverId) {
      next();
    } else {
      res.status(401).json({ error: '需要外送員登入' });
    }
  };`;

    // 找到ensureDriverPage的位置
    const insertPosition = content.indexOf('  ensureDriverPage = (req, res, next) => {');

    if (insertPosition !== -1) {
      // 找到ensureDriverPage方法的結束位置
      const methodStart = insertPosition;
      const methodEnd = content.indexOf('  };', methodStart) + 4;

      // 在ensureDriverPage之後插入ensureDriver
      content = content.slice(0, methodEnd) + ensureDriverMiddleware + content.slice(methodEnd);

      await fs.promises.writeFile(appPath, content, 'utf8');
      console.log('✅ ensureDriver中間件已成功添加到app.js');
    } else {
      console.error('❌ 無法找到ensureDriverPage方法的位置');
    }

  } catch (error) {
    console.error('❌ 修復中間件時發生錯誤:', error);
  }
}

fixMiddleware();