
/**
 * Copyright(c) 2013 jKey Lu
 * MIT Licensed
 */

var connect = require('connect');

module.exports = function (opts) {
  var FileStore, RedisStore;
  opts = opts || {};

  if (opts.storeType == 'file') {
    FileStore = require('connect-file-store')(connect);
    return new FileStore(opts.storeOptions);

  } else if (opts.storeType == 'redis') {
    RedisStore = require('connect-redis')(connect);
    return new RedisStore(opts.storeOptions);

  }

  throw new Error('store type: ' + opts.storeType + ' is not correct');
};

