const controlPool = require('../db-control');
const { setRequestDbPool } = require('../db-context');
const { getTenantDataPool } = require('../services/tenant-db-manager');
const { hasExplicitTenantHint } = require('./tenant-context');

function normalizeIsolationMode(mode) {
    const value = String(mode || '').trim().toLowerCase();
    return value === 'database-per-tenant' ? 'database-per-tenant' : 'row-level-tenant-id';
}

function normalizeProvisioningStatus(status) {
    return String(status || '').trim().toLowerCase();
}

async function tenantDataRoutingMiddleware(req, res, next) {
    try {
        const tenant = req.tenant || null;
        if (!tenant || !tenant.id) {
            if (hasExplicitTenantHint(req)) {
                return res.status(400).json({
                    error: 'Invalid or unknown school tenant context.'
                });
            }
            setRequestDbPool(controlPool);
            return next();
        }

        const isolationMode = normalizeIsolationMode(tenant.isolationMode);
        if (isolationMode !== 'database-per-tenant') {
            setRequestDbPool(controlPool);
            return next();
        }

        const status = normalizeProvisioningStatus(tenant.provisioningStatus);
        if (status !== 'provisioned') {
            return res.status(503).json({
                error: 'Tenant database is still provisioning. Please retry in a moment.'
            });
        }

        const tenantPool = await getTenantDataPool(tenant);
        if (!tenantPool) {
            setRequestDbPool(controlPool);
            return next();
        }

        req.dbPool = tenantPool;
        setRequestDbPool(tenantPool);
        return next();
    } catch (err) {
        return res.status(503).json({
            error: `Tenant database routing failed: ${String(err.message || err)}`
        });
    }
}

module.exports = {
    tenantDataRoutingMiddleware
};



