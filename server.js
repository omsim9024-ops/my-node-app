const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { WebSocketServer, WebSocket } = require('ws');
require('dotenv').config();
const pool = require('./db');

const initializeDatabase = require('./init-db');
const teachersRouter = require('./routes/teachers');
const studentsRouter = require('./routes/students');
const classesRouter = require('./routes/classes');
const gradesRouter = require('./routes/grades');
const enrollmentsRouter = require('./routes/enrollments');
const authRouter = require('./routes/auth');
const adminAuthRouter = require('./routes/admin-auth');
const schoolYearsRouter = require('./routes/school-years');
const sectionsRouter = require('./routes/sections');
const notificationsRouter = require('./routes/notifications');
const adviserAuthRouter = require('./routes/adviser-auth');
const adviserDashboardRouter = require('./routes/adviser-dashboard');
const teacherAuthRouter = require('./routes/teacher-auth');
const registrationCodesRouter = require('./routes/registration-codes');
const electivesRouter = require('./routes/electives');
const guidanceRouter = require('./routes/guidance');
const auditRouter = require('./routes/audit');
const systemHealthRouter = require('./routes/system-health');
const backupsRouter = require('./routes/backups');
const messagingPreferencesRouter = require('./routes/messaging-preferences');
const messagingGroupsRouter = require('./routes/messaging-groups');
const { tenantContextMiddleware, resolveTenantForRequest, hasExplicitTenantHint } = require('./middleware/tenant-context');
const { dbContextMiddleware } = require('./db-context');
const { tenantDataRoutingMiddleware } = require('./middleware/tenant-db-routing');
const { getTenantDataPool } = require('./services/tenant-db-manager');
const { recordAuditLog, parseAdminIdFromBearerToken } = require('./routes/audit');

const app = express();

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

function validateRequiredEnvironment() {
    const jwtSecret = String(process.env.JWT_SECRET || '').trim();
    if (!jwtSecret) {
        console.error('[Startup] Missing required environment variable: JWT_SECRET');
        console.error('[Startup] Set JWT_SECRET in .env before starting the server.');
        process.exit(1);
    }
}

validateRequiredEnvironment();

const ALLOWED_ORIGINS = String(process.env.ALLOWED_ORIGINS || process.env.FRONTEND_ORIGIN || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

// Middleware
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        // If no allowed origins are configured, allow all origins (useful for quick deploys).
        // In production, you should explicitly set ALLOWED_ORIGINS to a comma-separated list.
        if (ALLOWED_ORIGINS.length === 0) {
            if (IS_PRODUCTION) {
                console.warn('[CORS] No ALLOWED_ORIGINS configured; allowing all origins.');
            }
            return callback(null, true);
        }
        if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
        return callback(new Error('CORS origin denied'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'Authorization', 'X-Tenant-Id', 'X-Tenant-Code']
}));
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (IS_PRODUCTION) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
});
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(dbContextMiddleware);
app.use(tenantContextMiddleware);

// Audit logging middleware: captures all API interactions for traceability
function sanitizeBodyForAudit(body) {
    if (!body || typeof body !== 'object') return body;
    const redacted = {};
    const sensitiveKeys = new Set(['password', 'password_confirmation', 'pwd', 'token', 'authToken', 'adminAuthToken', 'otp', 'otpCode', 'secret']);
    Object.keys(body).forEach((key) => {
        try {
            if (sensitiveKeys.has(key.toLowerCase())) {
                redacted[key] = '<redacted>';
            } else {
                const val = body[key];
                if (typeof val === 'object' && val !== null) {
                    redacted[key] = sanitizeBodyForAudit(val);
                } else {
                    redacted[key] = val;
                }
            }
        } catch (_err) {
            redacted[key] = '<error>'; // fail safe
        }
    });
    return redacted;
}

function auditLoggerMiddleware(req, res, next) {
    const startTime = Date.now();

    res.on('finish', () => {
        try {
            if (!req.originalUrl || !req.originalUrl.startsWith('/api/')) return;
            // Avoid recursive logging of the audit endpoint itself
            if (req.originalUrl.startsWith('/api/audit')) return;

            const tenantId = Number(req.tenantId || req.tenant?.id || 0) || null;
            const adminId = (req.authAdmin && req.authAdmin.id) ? Number(req.authAdmin.id) : parseAdminIdFromBearerToken(req);
            const role = req.authAdmin ? String(req.authAdmin.role || '') : null;

            const action = `${req.method} ${req.path}`;
            const status = res.statusCode || 0;
            const durationMs = Date.now() - startTime;
            const ip = String(req.headers['x-forwarded-for'] || req.ip || req.connection?.remoteAddress || '').split(',')[0].trim();

            const details = {
                resource: req.path,
                status,
                durationMs,
                query: req.query || {},
                params: req.params || {},
                body: sanitizeBodyForAudit(req.body || {}),
                userAgent: String(req.headers['user-agent'] || ''),
            };

            recordAuditLog({
                tenantId,
                adminId: adminId || null,
                userRole: role || null,
                action,
                details,
                ip: ip || null
            });
        } catch (err) {
            console.error('[AuditLogger] failed to record audit log', err);
        }
    });

    next();
}

app.use(auditLoggerMiddleware);

function requireExplicitTenantContext(req, res, next) {
    if (!hasExplicitTenantHint(req)) {
        return res.status(400).json({
            error: 'School tenant context is required. Include school/tenant in the request.'
        });
    }

    if (!req.tenant || !req.tenant.id) {
        return res.status(400).json({
            error: 'Invalid or unknown school tenant context.'
        });
    }

    return next();
}

// Simple request logger for debugging
app.use((req, res, next) => {
    console.log(new Date().toISOString(), req.method, req.originalUrl);
    next();
});

// Persistent request logging to file for tailing/diagnostics
const fs = require('fs');
const path = require('path');
const requestsLog = path.join(__dirname, 'server-requests.log');

app.use((req, res, next) => {
    try {
        const line = `${new Date().toISOString()} ${req.method} ${req.originalUrl} - ${req.ip}\n`;
        fs.appendFile(requestsLog, line, (err) => { if (err) console.error('Failed to write request log', err); });
    } catch (err) {
        console.error('Request log middleware error', err);
    }
    next();
});

// Serve static files (HTML, CSS, JS)
app.use(express.static(__dirname));

// Initialize database on startup (must complete before backup scheduler starts)
async function start() {
    try {
        await initializeDatabase();
    } catch (err) {
        console.error('Critical: database initialization failed:', err);
        process.exit(1);
        return;
    }

    // Initialize backup scheduler after schema is ready.
    if (typeof backupsRouter.initializeBackupScheduler === 'function') {
        backupsRouter.initializeBackupScheduler().catch((err) => {
            console.error('Failed to initialize backup scheduler:', err);
        });
    }

    // Only start accepting HTTP requests once DB schema is ready.
    startServerOnPort(PORT);
}

// API Routes
app.use('/api/teachers', requireExplicitTenantContext, tenantDataRoutingMiddleware, teachersRouter);

start();
app.use('/api/students', requireExplicitTenantContext, tenantDataRoutingMiddleware, studentsRouter);
app.use('/api/classes', requireExplicitTenantContext, tenantDataRoutingMiddleware, classesRouter);
app.use('/api/grades', requireExplicitTenantContext, tenantDataRoutingMiddleware, gradesRouter);
app.use('/api/enrollments', requireExplicitTenantContext, tenantDataRoutingMiddleware, enrollmentsRouter);
app.use('/api/auth', requireExplicitTenantContext, tenantDataRoutingMiddleware, authRouter);
app.use('/api/admin', adminAuthRouter);
app.use('/api/school-years', requireExplicitTenantContext, tenantDataRoutingMiddleware, schoolYearsRouter);
app.use('/api/sections', requireExplicitTenantContext, tenantDataRoutingMiddleware, sectionsRouter);
app.use('/api/electives', requireExplicitTenantContext, tenantDataRoutingMiddleware, electivesRouter);
app.use('/api/notifications', requireExplicitTenantContext, tenantDataRoutingMiddleware, notificationsRouter);
app.use('/api/adviser-auth', requireExplicitTenantContext, tenantDataRoutingMiddleware, adviserAuthRouter);
app.use('/api/adviser-dashboard', requireExplicitTenantContext, tenantDataRoutingMiddleware, adviserDashboardRouter);
app.use('/api/teacher-auth', requireExplicitTenantContext, tenantDataRoutingMiddleware, teacherAuthRouter);
app.use('/api/registration-codes', requireExplicitTenantContext, tenantDataRoutingMiddleware, registrationCodesRouter);
app.use('/api/guidance', requireExplicitTenantContext, tenantDataRoutingMiddleware, guidanceRouter);
// Audit route should work without forcing an explicit tenant hint (fall back to default tenant)
app.use('/api/audit', tenantDataRoutingMiddleware, auditRouter);
app.use('/api/system-health', systemHealthRouter);
app.use('/api/backups', requireExplicitTenantContext, tenantDataRoutingMiddleware, backupsRouter);
app.use('/api/messaging-preferences', requireExplicitTenantContext, tenantDataRoutingMiddleware, messagingPreferencesRouter);
app.use('/api/messaging/groups', requireExplicitTenantContext, tenantDataRoutingMiddleware, messagingGroupsRouter);

if (typeof backupsRouter.initializeBackupScheduler === 'function') {
    backupsRouter.initializeBackupScheduler().catch((err) => {
        console.error('Failed to initialize backup scheduler:', err);
    });
}

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'Server is running' });
});

// Catch 404 and serve index.html for client-side routing
app.get('*', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Bind to 0.0.0.0 so the server accepts connections from other hosts on the LAN
// If the configured port is already in use, attempt a small range of fallback ports
let server = null;
let messagingWss = null;
let messagingRealtimeStarted = false;
let messagingPruneTimer = null;

const messagingClients = new Map(); // tenantScopedUserId => ws
const messagingUserMeta = new Map(); // tenantScopedUserId => {name, role, tenantId, tenantCode}
const messagingPreparedTenants = new Set();
const MESSAGE_RETENTION_DAYS = Math.max(1, parseInt(process.env.MESSAGING_RETENTION_DAYS || '180', 10));
const PRUNE_INTERVAL_MINUTES = Math.max(5, parseInt(process.env.MESSAGING_PRUNE_INTERVAL_MINUTES || '60', 10));

function tenantScopedUserKey(tenantId, userId) {
    return `${String(tenantId || '')}:${String(userId || '')}`;
}

async function ensureChatMessagesTable(dbPool) {
    await dbPool.query(`
        CREATE TABLE IF NOT EXISTS chat_messages (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            sender_id VARCHAR(100) NOT NULL,
            sender_name VARCHAR(255) NULL,
            recipient_id VARCHAR(100) NOT NULL,
            recipient_name VARCHAR(255) NULL,
            message_text TEXT NOT NULL,
            sent_at BIGINT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_chat_messages_sender (sender_id),
            INDEX idx_chat_messages_recipient (recipient_id),
            INDEX idx_chat_messages_sent_at (sent_at)
        )
    `);
}

async function ensureChatGroupTables(dbPool) {
    await dbPool.query(`
        CREATE TABLE IF NOT EXISTS chat_groups (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            creator_id VARCHAR(100) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    await dbPool.query(`
        CREATE TABLE IF NOT EXISTS chat_group_members (
            group_id BIGINT NOT NULL,
            user_id VARCHAR(100) NOT NULL,
            PRIMARY KEY(group_id, user_id)
        )
    `);
}

async function saveChatMessage(dbPool, message) {
    await dbPool.query(
        `INSERT INTO chat_messages
            (sender_id, sender_name, recipient_id, recipient_name, message_text, sent_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
            String(message.from || ''),
            message.fromName || null,
            String(message.to || ''),
            message.toName || null,
            String(message.text || ''),
            Number(message.ts || Date.now())
        ]
    );
}

async function buildChatConversationsForUser(dbPool, userId) {
    const uid = String(userId || '');
    if (!uid) return [];

    // Include direct messages and any group messages where the user is a member
    const [rows] = await dbPool.query(
        `SELECT m.sender_id, m.sender_name, m.recipient_id, m.recipient_name, m.message_text, m.sent_at
         FROM chat_messages m
         WHERE m.sender_id = ?
            OR m.recipient_id = ?
            OR (m.recipient_id LIKE 'group:%' AND m.recipient_id IN (
                  SELECT CONCAT('group:', group_id) FROM chat_group_members WHERE user_id = ?
               ))
         ORDER BY m.sent_at ASC, m.id ASC`,
        [uid, uid, uid]
    );

    const grouped = {};
    (rows || []).forEach((row) => {
        const from = String(row.sender_id || '');
        const to = String(row.recipient_id || '');
        if (!from || !to) return;

        // For group messages we want to fold all entries under the group id rather than the individual sender.
        let peer;
        if (to.startsWith('group:')) {
            peer = to;
        } else {
            peer = from === uid ? to : from;
        }
        if (!peer) return;

        grouped[peer] = grouped[peer] || { peerId: peer, name: null, msgs: [], lastTs: 0, unread: 0 };
        const mapped = {
            from,
            fromName: row.sender_name || messagingUserMeta.get(from)?.name || from,
            to,
            toName: row.recipient_name || messagingUserMeta.get(to)?.name || to,
            text: String(row.message_text || ''),
            ts: Number(row.sent_at || Date.now())
        };
        grouped[peer].msgs.push(mapped);
        grouped[peer].lastTs = Math.max(grouped[peer].lastTs || 0, mapped.ts || 0);
        if (String(peer).startsWith('group:')) {
            // use the group name (stored in toName) when available
            grouped[peer].name = grouped[peer].name || mapped.toName || peer;
        } else {
            grouped[peer].name = grouped[peer].name || mapped.fromName || mapped.toName || messagingUserMeta.get(peer)?.name || peer;
        }
    });

    return Object.values(grouped)
        .map((conversation) => {
            conversation.msgs.sort((a, b) => Number(a.ts || 0) - Number(b.ts || 0));
            conversation.lastMessage = conversation.msgs.length
                ? String(conversation.msgs[conversation.msgs.length - 1].text || '')
                : '';
            return conversation;
        })
        .sort((a, b) => Number(b.lastTs || 0) - Number(a.lastTs || 0));
}

function broadcastChatPresence(tenantId, userId, online) {
    const payload = JSON.stringify({ type: 'presence', userId, online });
    for (const [scopedUserId, ws] of messagingClients.entries()) {
        if (!String(scopedUserId).startsWith(`${String(tenantId)}:`)) continue;
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(payload);
        }
    }
}

async function pruneOldChatMessages(dbPool) {
    try {
        const cutoffTs = Date.now() - (MESSAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
        const [result] = await dbPool.query('DELETE FROM chat_messages WHERE sent_at < ?', [cutoffTs]);
        const deleted = Number(result?.affectedRows || 0);
        if (deleted > 0) {
            console.log(`[MessagingRetention] Deleted ${deleted} messages older than ${MESSAGE_RETENTION_DAYS} day(s).`);
        }
    } catch (err) {
        console.error('[MessagingRetention] Failed to prune old messages:', err && err.message ? err.message : err);
    }
}

function scheduleChatPrune() {
    if (messagingPruneTimer) return;
    const intervalMs = PRUNE_INTERVAL_MINUTES * 60 * 1000;
    messagingPruneTimer = setInterval(() => {
        for (const meta of messagingUserMeta.values()) {
            if (!meta || !meta.pool) continue;
            pruneOldChatMessages(meta.pool).catch(() => {});
        }
    }, intervalMs);
    if (typeof messagingPruneTimer.unref === 'function') messagingPruneTimer.unref();
}

async function resolveTenantMessagingContext(authData, upgradeReq) {
    const tenantCodeFromData = String(
        authData?.tenantCode
        || authData?.user?.tenantCode
        || authData?.school
        || authData?.user?.school
        || ''
    ).trim().toLowerCase();

    const query = {};
    try {
        const parsedUrl = new URL(String(upgradeReq?.url || '/ws/messaging'), 'http://localhost');
        query.school = parsedUrl.searchParams.get('school') || undefined;
        query.tenantCode = parsedUrl.searchParams.get('tenantCode') || undefined;
    } catch (_err) {}

    const reqLike = {
        headers: {
            'x-tenant-code': tenantCodeFromData || undefined,
            host: upgradeReq?.headers?.host
        },
        query,
        body: {
            school: tenantCodeFromData || undefined,
            tenantCode: tenantCodeFromData || undefined
        }
    };

    const tenant = await resolveTenantForRequest(reqLike, {
        allowDefault: false,
        requireActive: true,
        fallbackToDefaultOnExplicitHint: false
    });

    if (!tenant || !tenant.id) {
        throw new Error('Messaging tenant context is required');
    }

    const tenantPool = await getTenantDataPool(tenant);
    if (!tenantPool) {
        throw new Error('Messaging requires a provisioned tenant database');
    }

    return {
        tenantId: Number(tenant.id),
        tenantCode: String(tenant.code || tenantCodeFromData || '').trim().toLowerCase(),
        pool: tenantPool
    };
}

async function initializeRealtimeMessaging(httpServer) {
    if (messagingRealtimeStarted) return;
    scheduleChatPrune();

    messagingWss = new WebSocketServer({ noServer: true });

    httpServer.on('upgrade', (req, socket, head) => {
        try {
            const requestUrl = req.url || '';
            if (!requestUrl.startsWith('/ws/messaging')) {
                socket.destroy();
                return;
            }

            messagingWss.handleUpgrade(req, socket, head, (ws) => {
                messagingWss.emit('connection', ws, req);
            });
        } catch (_err) {
            socket.destroy();
        }
    });

    messagingWss.on('connection', (ws, req) => {
        let myId = null;
        let myTenantId = null;
        let myTenantCode = null;
        let myTenantPool = null;
        let myScopedId = null;

        ws.on('message', async (raw) => {
            try {
                const data = JSON.parse(raw);

                if (data.type === 'auth' && data.user) {
                    const tenantContext = await resolveTenantMessagingContext(data, req);
                    myId = String(data.user.id || '');
                    if (!myId) return;
                    myTenantId = Number(tenantContext.tenantId || 0);
                    myTenantCode = String(tenantContext.tenantCode || '').trim().toLowerCase();
                    myTenantPool = tenantContext.pool;
                    myScopedId = tenantScopedUserKey(myTenantId, myId);

                    messagingClients.set(myScopedId, ws);
                    messagingUserMeta.set(myScopedId, {
                        name: data.user.name,
                        role: data.user.role,
                        tenantId: myTenantId,
                        tenantCode: myTenantCode,
                        pool: myTenantPool
                    });
                    console.log('[MessagingWS] auth', myScopedId);

                    if (!messagingPreparedTenants.has(String(myTenantId))) {
                        await ensureChatMessagesTable(myTenantPool);
                        await ensureChatGroupTables(myTenantPool);
                        await pruneOldChatMessages(myTenantPool);
                        messagingPreparedTenants.add(String(myTenantId));
                    }

                    const conversations = await buildChatConversationsForUser(myTenantPool, myId);
                    try {
                        ws.send(JSON.stringify({ type: 'init', conversations }));
                    } catch (_e) {}
                    broadcastChatPresence(myTenantId, myId, true);
                    return;
                }

                if (data.type === 'group_message') {
                    // messages sent to a group; broadcast to each member
                    if (!myId || !myTenantId || !myTenantPool) return;
                    const groupId = Number(data.groupId || 0);
                    const text = String(data.text || '').trim();
                    const from = String(data.fromId || myId || '');
                    if (!groupId || !text || !from) return;

                    // lookup group name and members
                    const [[groupRow]] = await myTenantPool.query('SELECT name FROM chat_groups WHERE id = ?', [groupId]);
                    const grpName = (groupRow && groupRow.name) ? groupRow.name : (`Group ${groupId}`);
                    const [memberRows] = await myTenantPool.query('SELECT user_id FROM chat_group_members WHERE group_id = ?', [groupId]);
                    const memberIds = (memberRows||[]).map(r=>String(r.user_id));
                    if(!memberIds.includes(from)){
                        // sender not a member - ignore
                        return;
                    }

                    const ts = Number(data.ts || Date.now());
                    const messageBody = {
                        from,
                        fromName: data.fromName || messagingUserMeta.get(tenantScopedUserKey(myTenantId, from))?.name,
                        to: `${'group:'}${groupId}`,
                        toName: grpName,
                        text,
                        ts
                    };

                    try {
                        await saveChatMessage(myTenantPool, messageBody);
                    } catch (dbErr) {
                        console.error('[MessagingWS] Failed to persist group message:', dbErr && dbErr.message ? dbErr.message : dbErr);
                    }

                    const payload = JSON.stringify({ type: 'message', message: messageBody, groupId });
                    // send to every member of the group
                    for(const member of memberIds){
                        const scoped = tenantScopedUserKey(myTenantId, member);
                        const w = messagingClients.get(scoped);
                        if(w && w.readyState === WebSocket.OPEN){
                            w.send(payload);
                        }
                    }
                    // also echo to sender if not already sent
                    const fromScoped = tenantScopedUserKey(myTenantId, from);
                    if(!memberIds.includes(from)){
                        const snd = messagingClients.get(fromScoped);
                        if(snd && snd.readyState === WebSocket.OPEN){ snd.send(payload); }
                    }
                    return;
                }
                if (data.type === 'message') {
                    if (!myId || !myTenantId || !myTenantPool) return;
                    const to = String(data.to || '');
                    const from = String(data.fromId || myId || '');
                    const text = String(data.text || '').trim();
                    if (!to || !from || !text) return;

                    const ts = Number(data.ts || Date.now());
                    const messageBody = {
                        from,
                        fromName: data.fromName || messagingUserMeta.get(tenantScopedUserKey(myTenantId, from))?.name,
                        to,
                        toName: messagingUserMeta.get(tenantScopedUserKey(myTenantId, to))?.name,
                        text,
                        ts
                    };

                    try {
                        await saveChatMessage(myTenantPool, messageBody);
                    } catch (dbErr) {
                        console.error('[MessagingWS] Failed to persist message:', dbErr && dbErr.message ? dbErr.message : dbErr);
                    }

                    const payload = JSON.stringify({ type: 'message', message: messageBody });
                    const toScoped = tenantScopedUserKey(myTenantId, to);
                    const fromScoped = tenantScopedUserKey(myTenantId, from);

                    const rec = messagingClients.get(toScoped);
                    if (rec && rec.readyState === WebSocket.OPEN) {
                        rec.send(payload);
                    }

                    const snd = messagingClients.get(fromScoped);
                    if (snd && snd.readyState === WebSocket.OPEN) {
                        snd.send(payload);
                    }
                }
            } catch (err) {
                console.error('[MessagingWS] bad message', err && err.message ? err.message : err);
            }
        });

        ws.on('close', () => {
            if (myScopedId) {
                messagingClients.delete(myScopedId);
                messagingUserMeta.delete(myScopedId);
                if (myTenantId && myId) {
                    broadcastChatPresence(myTenantId, myId, false);
                }
            }
        });
    });

    messagingRealtimeStarted = true;
    console.log(`[MessagingWS] Active at ws(s)://<host>/ws/messaging (retention ${MESSAGE_RETENTION_DAYS} days, prune every ${PRUNE_INTERVAL_MINUTES} minutes)`);
}

function startServerOnPort(startPort, maxAttempts = 5) {
    let attempt = 0;
    let port = Number(startPort) || 3000;

    const tryListen = () => {
        attempt++;
        const s = app.listen(port, '0.0.0.0');

        s.on('listening', () => {
            server = s;
            initializeRealtimeMessaging(server).catch((err) => {
                console.error('Failed to initialize realtime messaging:', err && err.message ? err.message : err);
                process.exit(1);
            });
            const os = require('os');
            const addr = server.address();
            const ifaces = os.networkInterfaces();
            let lanAddress = null;
            Object.keys(ifaces).some((name) => {
                return ifaces[name].some((iface) => {
                    if (iface.family === 'IPv4' && !iface.internal) {
                        lanAddress = iface.address;
                        return true;
                    }
                    return false;
                });
            });

            const hostInfo = addr && addr.address ? addr.address : '0.0.0.0';
            const portInfo = addr && addr.port ? addr.port : port;

            console.log('\n╔══════════════════════════════════════════════════════════╗');
            console.log('║  Compostela National High School SMS Server Running     ║');
            console.log(`║  Bound Address: ${hostInfo.padEnd(31)}║`);
            console.log(`║  Port: ${String(portInfo).padEnd(43)}║`);
            console.log(`║  Environment: ${String(process.env.NODE_ENV || 'development').padEnd(34)}║`);
            console.log('║                                                          ║');
            console.log(`║  Local Frontend: http://localhost:${portInfo}                          ║`);
            if (lanAddress) {
                console.log(`║  LAN Frontend:   http://${lanAddress}:${portInfo}                     ║`);
                console.log(`║  LAN API:        http://${lanAddress}:${portInfo}/api                ║`);
            } else {
                console.log('║  LAN Frontend:   (no non-internal IPv4 address detected)          ║');
            }
            console.log('╚══════════════════════════════════════════════════════════╝\n');
        });

        s.on('error', (err) => {
            if (err && err.code === 'EADDRINUSE') {
                console.warn(`Port ${port} is already in use.`);
                if (attempt < maxAttempts) {
                    port++;
                    console.log(`Attempting to bind to port ${port} (attempt ${attempt + 1}/${maxAttempts})`);
                    // small delay before retrying
                    setTimeout(tryListen, 200);
                    return;
                }
                console.error(`Failed to bind server after ${attempt} attempts. Last tried port: ${port}`);
                console.error('Please stop the process using the port or set a different SERVER_PORT in your environment.');
                process.exit(1);
            } else {
                console.error('Server error during startup:', err);
                process.exit(1);
            }
        });
    };

    tryListen();
}

const PORT = process.env.PORT || process.env.SERVER_PORT || 3000;

// Use the startup helper that can retry on EADDRINUSE if the port is already in use.
startServerOnPort(PORT);

// expose messaging internals for other modules (e.g. group notifications)
module.exports = {
    app,
    messagingClients,
    tenantScopedUserKey,
    messagingUserMeta
};

