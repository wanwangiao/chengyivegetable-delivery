const assert = require('node:assert');
const Module = require('module');

const originalResolve = Module._resolveFilename;
const stubCache = new Map();

const registerStub = (request, exports) => {
  const virtualId = `virtual:${request}`;
  stubCache.set(request, virtualId);
  Module._cache[virtualId] = {
    id: virtualId,
    filename: virtualId,
    loaded: true,
    exports
  };
};

Module._resolveFilename = function (request, parent, isMain, options) {
  if (stubCache.has(request)) {
    return stubCache.get(request);
  }
  return originalResolve.call(this, request, parent, isMain, options);
};

const asyncStorageStub = {
  values: Object.create(null),
  calls: {
    get: [],
    set: [],
    remove: []
  },
  async getItem(key) {
    this.calls.get.push(key);
    return Object.prototype.hasOwnProperty.call(this.values, key) ? this.values[key] : null;
  },
  async setItem(key, value) {
    this.calls.set.push({ key, value });
    this.values[key] = value;
  },
  async removeItem(key) {
    this.calls.remove.push(key);
    delete this.values[key];
  }
};

const platformStub = {
  OS: 'ios',
  select: options => (options ? options.ios ?? options.default : undefined)
};

registerStub('@react-native-async-storage/async-storage', {
  __esModule: true,
  default: asyncStorageStub
});

registerStub('react-native', {
  __esModule: true,
  Platform: platformStub
});

const clearStorageModule = () => {
  const storagePath = require.resolve('../services/storage');
  delete require.cache[storagePath];
};

const run = async () => {
  // 非 Web 環境：應使用 AsyncStorage
  clearStorageModule();
  const storage = require('../services/storage');

  await storage.setItem('token', 'abc123');
  assert.strictEqual(asyncStorageStub.values.token, 'abc123', 'AsyncStorage 應寫入資料');

  asyncStorageStub.values.session = 'persisted';
  const session = await storage.getItem('session');
  assert.strictEqual(session, 'persisted', 'AsyncStorage 應讀取資料');

  await storage.removeItem('token');
  assert.strictEqual(asyncStorageStub.values.token, undefined, 'AsyncStorage 應刪除資料');

  // 模擬 Web localStorage
  platformStub.OS = 'web';
  const localStore = Object.create(null);
  global.window = {
    localStorage: {
      setItem(key, value) {
        localStore[key] = value;
      },
      getItem(key) {
        return Object.prototype.hasOwnProperty.call(localStore, key) ? localStore[key] : null;
      },
      removeItem(key) {
        delete localStore[key];
      }
    }
  };

  clearStorageModule();
  const webStorage = require('../services/storage');

  await webStorage.setItem('web-key', 'value');
  assert.strictEqual(localStore['web-key'], 'value', 'localStorage 應寫入資料');

  const readValue = await webStorage.getItem('web-key');
  assert.strictEqual(readValue, 'value', 'localStorage 應讀取資料');

  await webStorage.removeItem('web-key');
  assert.ok(!('web-key' in localStore), 'localStorage 應移除資料');

  delete global.window;
  Module._resolveFilename = originalResolve;
  for (const id of stubCache.values()) {
    delete Module._cache[id];
  }
  stubCache.clear();
  console.log('✅ Storage service 測試通過');
  return true;
};

module.exports = run();
