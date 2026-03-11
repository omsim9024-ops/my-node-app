const { AsyncLocalStorage } = require('async_hooks');

const dbContextStorage = new AsyncLocalStorage();

function dbContextMiddleware(_req, _res, next) {
    dbContextStorage.run({ pool: null }, () => next());
}

function setRequestDbPool(pool) {
    const store = dbContextStorage.getStore();
    if (!store) return;
    store.pool = pool || null;
}

function getRequestDbPool() {
    const store = dbContextStorage.getStore();
    return store && store.pool ? store.pool : null;
}

module.exports = {
    dbContextMiddleware,
    setRequestDbPool,
    getRequestDbPool
};


