const { AsyncLocalStorage } = require("node:async_hooks");

const storage = new AsyncLocalStorage();

function runWithRequestContext(context, callback) {
  return storage.run(context, callback);
}

function getRequestContext() {
  return storage.getStore() || {};
}

module.exports = {
  runWithRequestContext,
  getRequestContext
};
