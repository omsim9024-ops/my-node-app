const controlPool = require('./db-control');
const { getRequestDbPool } = require('./db-context');

function getActivePool() {
    return getRequestDbPool() || controlPool;
}

const dbProxy = new Proxy({}, {
    get(_target, prop) {
        if (prop === 'controlPool') return controlPool;
        if (prop === 'getActivePool') return getActivePool;

        const activePool = getActivePool();
        const value = activePool[prop];
        return typeof value === 'function' ? value.bind(activePool) : value;
    }
});

module.exports = dbProxy;