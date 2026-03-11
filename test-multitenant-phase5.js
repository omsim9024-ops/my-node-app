const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

function nowToken() {
    return `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

async function request(path, options = {}) {
    const url = `${BASE_URL}${path}`;
    const response = await fetch(url, options);
    let payload = null;
    try {
        payload = await response.json();
    } catch (_err) {
        payload = null;
    }
    return { response, payload, url };
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

async function ensureServerReachable() {
    const { response, payload, url } = await request('/api/health');
    assert(response.ok, `Health check failed: ${url} -> HTTP ${response.status}`);
    assert(payload && payload.status, 'Health check response did not include expected payload');
}

async function createTenant({ code, name }) {
    const { response, payload } = await request('/api/system-health/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name, status: 'active' })
    });

    assert(response.status === 201 || response.status === 409, `Create tenant ${code} failed: HTTP ${response.status}`);

    if (response.status === 409) {
        return null;
    }

    assert(payload && payload.success, `Create tenant ${code} returned no success payload`);
    return payload;
}

async function loadTenants() {
    const { response, payload } = await request('/api/system-health/tenants');
    assert(response.ok, `List tenants failed: HTTP ${response.status}`);
    assert(payload && payload.success, 'List tenants missing success flag');
    assert(Array.isArray(payload.tenants), 'List tenants missing tenants array');
    return payload;
}

async function switchTenant(tenantId) {
    const { response, payload } = await request(`/api/system-health/tenants/${tenantId}/switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
    });
    assert(response.ok, `Switch tenant ${tenantId} failed: HTTP ${response.status}`);
    assert(payload && payload.success, `Switch tenant ${tenantId} missing success payload`);
}

async function createStudent({ tenantCode, studentId, firstName, lastName, email }) {
    const { response, payload } = await request('/api/students', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Tenant-Code': tenantCode
        },
        body: JSON.stringify({
            student_id: studentId,
            first_name: firstName,
            last_name: lastName,
            grade_level: '11',
            email,
            phone: null,
            class_id: null
        })
    });

    assert(response.status === 201, `Create student for tenant ${tenantCode} failed: HTTP ${response.status} ${JSON.stringify(payload)}`);
}

async function listStudents(tenantCode) {
    const { response, payload } = await request('/api/students', {
        headers: {
            'X-Tenant-Code': tenantCode
        }
    });

    assert(response.ok, `List students for ${tenantCode} failed: HTTP ${response.status}`);
    assert(Array.isArray(payload), `List students for ${tenantCode} returned invalid payload`);
    return payload;
}

async function main() {
    const token = nowToken();
    const tenantCodeA = `tenant-a-${token}`;
    const tenantCodeB = `tenant-b-${token}`;
    const tenantNameA = `Tenant A ${token}`;
    const tenantNameB = `Tenant B ${token}`;

    const studentA = {
        tenantCode: tenantCodeA,
        studentId: `STU-A-${token}`,
        firstName: 'TenantA',
        lastName: 'Student',
        email: `tenant.a.${token}@gmail.com`
    };

    const studentB = {
        tenantCode: tenantCodeB,
        studentId: `STU-B-${token}`,
        firstName: 'TenantB',
        lastName: 'Student',
        email: `tenant.b.${token}@gmail.com`
    };

    console.log('[Phase5] Checking server availability...');
    await ensureServerReachable();

    console.log('[Phase5] Creating tenants...');
    await createTenant({ code: tenantCodeA, name: tenantNameA });
    await createTenant({ code: tenantCodeB, name: tenantNameB });

    console.log('[Phase5] Validating tenant list + summary endpoints...');
    const tenantsPayload = await loadTenants();
    const tenantA = tenantsPayload.tenants.find((tenant) => String(tenant.code).toLowerCase() === tenantCodeA);
    const tenantB = tenantsPayload.tenants.find((tenant) => String(tenant.code).toLowerCase() === tenantCodeB);

    assert(tenantA, 'Tenant A not found in tenant list');
    assert(tenantB, 'Tenant B not found in tenant list');

    const summaryResponse = await request('/api/system-health/tenants/summary');
    assert(summaryResponse.response.ok, `Tenant summary endpoint failed: HTTP ${summaryResponse.response.status}`);
    assert(summaryResponse.payload && summaryResponse.payload.success, 'Tenant summary payload missing success');

    console.log('[Phase5] Switching current tenant...');
    await switchTenant(tenantA.id);

    console.log('[Phase5] Creating tenant-scoped students...');
    await createStudent(studentA);
    await createStudent(studentB);

    console.log('[Phase5] Verifying cross-tenant isolation on /api/students...');
    const studentsA = await listStudents(tenantCodeA);
    const studentsB = await listStudents(tenantCodeB);

    const idsA = new Set(studentsA.map((row) => String(row.student_id || '')));
    const idsB = new Set(studentsB.map((row) => String(row.student_id || '')));

    assert(idsA.has(studentA.studentId), 'Tenant A student missing from Tenant A list');
    assert(!idsA.has(studentB.studentId), 'Tenant B student leaked into Tenant A list');
    assert(idsB.has(studentB.studentId), 'Tenant B student missing from Tenant B list');
    assert(!idsB.has(studentA.studentId), 'Tenant A student leaked into Tenant B list');

    console.log('[Phase5] PASS: Tenant endpoints and student isolation are working.');
}

main().catch((err) => {
    console.error('[Phase5] FAIL:', err.message);
    process.exit(1);
});

