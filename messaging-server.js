const WebSocket = require('ws');
const pool = require('./db');

const PORT = parseInt(process.env.MESSAGING_PORT || process.env.PORT || '3012', 10);
const MESSAGE_RETENTION_DAYS = Math.max(1, parseInt(process.env.MESSAGING_RETENTION_DAYS || '180', 10));
const PRUNE_INTERVAL_MINUTES = Math.max(5, parseInt(process.env.MESSAGING_PRUNE_INTERVAL_MINUTES || '60', 10));

const clients = new Map(); // userId => ws
const userMeta = new Map(); // userId => {name,role}

async function ensureMessagingStorage(){
  await pool.query(`
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

async function saveMessageToDb(message){
  await pool.query(
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

async function pruneOldMessages(){
  try {
    const cutoffTs = Date.now() - (MESSAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const [result] = await pool.query(
      'DELETE FROM chat_messages WHERE sent_at < ?',
      [cutoffTs]
    );
    const deleted = Number(result?.affectedRows || 0);
    if (deleted > 0) {
      console.log(`[MessagingRetention] Deleted ${deleted} messages older than ${MESSAGE_RETENTION_DAYS} day(s).`);
    }
  } catch (err) {
    console.error('[MessagingRetention] Failed to prune old messages:', err && err.message ? err.message : err);
  }
}

function scheduleRetentionPrune(){
  const intervalMs = PRUNE_INTERVAL_MINUTES * 60 * 1000;
  const timer = setInterval(() => {
    pruneOldMessages().catch(() => {});
  }, intervalMs);
  if (typeof timer.unref === 'function') timer.unref();
}

async function buildConversationsForUser(userId){
  const uid = String(userId || '');
  if(!uid) return [];

  const [rows] = await pool.query(
    `SELECT sender_id, sender_name, recipient_id, recipient_name, message_text, sent_at
     FROM chat_messages
     WHERE sender_id = ? OR recipient_id = ?
     ORDER BY sent_at ASC, id ASC`,
    [uid, uid]
  );

  const grouped = {};
  (rows || []).forEach((row) => {
    const from = String(row.sender_id || '');
    const to = String(row.recipient_id || '');
    if(!from || !to) return;
    const peer = from === uid ? to : from;
    if(!peer) return;

    grouped[peer] = grouped[peer] || { peerId: peer, name: null, msgs: [], lastTs: 0, unread: 0 };
    const mapped = {
      from,
      fromName: row.sender_name || userMeta.get(from)?.name || from,
      to,
      toName: row.recipient_name || userMeta.get(to)?.name || to,
      text: String(row.message_text || ''),
      ts: Number(row.sent_at || Date.now())
    };
    grouped[peer].msgs.push(mapped);
    grouped[peer].lastTs = Math.max(grouped[peer].lastTs || 0, mapped.ts || 0);
    grouped[peer].name = grouped[peer].name || mapped.fromName || mapped.toName || userMeta.get(peer)?.name || peer;
  });

  return Object.values(grouped)
    .map(c => {
      c.msgs.sort((a,b)=> Number(a.ts||0) - Number(b.ts||0));
      c.lastMessage = c.msgs.length ? String(c.msgs[c.msgs.length - 1].text || '') : '';
      return c;
    })
    .sort((a,b)=> Number(b.lastTs||0) - Number(a.lastTs||0));
}

function broadcastPresence(userId, online){
  const msg = JSON.stringify({type:'presence', userId, online});
  for(const [id, ws] of clients.entries()){
    if(ws.readyState===WebSocket.OPEN) ws.send(msg);
  }
}

function startServer(port){
  try{
    const http = require('http');
    const server = http.createServer((req, res) => {
      // Friendly info page for normal browser requests to the WS port
      if (req.url === '/favicon.ico') {
        res.writeHead(204);
        return res.end();
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<html><head><title>Messaging Server</title></head><body style="font-family:system-ui,Segoe UI,Arial;margin:40px;color:#222;background:#fafafa;"><h2>Messaging WebSocket Server</h2><p>This port is used for WebSocket connections only.</p><p>Web client should connect to <code>ws://${'localhost'}:${port}</code>.</p><p>If you meant to open the main app, visit <a href="http://localhost:3001">http://localhost:3001</a> (app server).</p></body></html>`);
    });

    const wss = new WebSocket.Server({ server });

    server.listen(port);

    wss.on('connection', function connection(ws){
      let myId = null;
      ws.on('message', async function incoming(raw){
        try{ const data = JSON.parse(raw);
          if(data.type==='auth' && data.user){
            myId = String(data.user.id);
            clients.set(myId, ws);
            userMeta.set(myId, {name: data.user.name, role:data.user.role});
            console.log('auth', myId);
            const convs = await buildConversationsForUser(myId);
            try{ ws.send(JSON.stringify({type:'init', conversations: convs})); }catch(e){/*ignore*/}
            broadcastPresence(myId, true);
            return;
          }
          if(data.type==='message'){
            const to = String(data.to);
            const from = String(data.fromId || myId);
            const text = data.text;
            if(!to || !from || !String(text || '').trim()) return;
            const ts = Number(data.ts || Date.now());
            const msgBody = {
              from,
              fromName: data.fromName || (userMeta.get(from)||{}).name,
              to,
              toName: (userMeta.get(to)||{}).name,
              text,
              ts
            };
            const msg = {type:'message', message: msgBody};
            console.log(`Message: from=${from} to=${to}`);
            try {
              await saveMessageToDb(msgBody);
            } catch (dbErr) {
              console.error('Failed to persist message to DB:', dbErr && dbErr.message ? dbErr.message : dbErr);
            }
            // send to recipient if connected
            const rec = clients.get(to);
            if(rec && rec.readyState===WebSocket.OPEN){ 
              console.log(`Sending message to recipient ${to}`);
              rec.send(JSON.stringify(msg)); 
            } else {
              console.log(`Recipient ${to} not connected, message stored for delivery`);
            }
            // echo to sender (supports multi-tab/device consistency)
            const snd = clients.get(from);
            if(snd && snd.readyState===WebSocket.OPEN){
              try{ snd.send(JSON.stringify(msg)); }catch(e){}
            }
          }
        }catch(e){ console.error('bad message', e); }
      });
      ws.on('close', ()=>{ if(myId){ clients.delete(myId); userMeta.delete(myId); broadcastPresence(myId, false); } });
    });

    server.on('listening', ()=>{
      console.log(`Messaging server running on ws://localhost:${port}`);
    });

    wss.on('error', err => {
      console.error('WebSocket server error:', err.message || err);
      if(err && err.code === 'EADDRINUSE'){
        console.error(`Port ${port} already in use. Stop the existing process or set MESSAGING_PORT to a different port.`);
        console.error('To find and kill the process on Windows (PowerShell):');
        console.error('  netstat -ano | findstr :' + port);
        console.error('  taskkill /PID <pid> /F');
      }
      process.exit(1);
    });

    return wss;
  }catch(err){
    console.error('Failed to start messaging server:', err && err.message ? err.message : err);
    if(err && err.code === 'EADDRINUSE'){
      console.error(`Port ${port} already in use. Set MESSAGING_PORT to an available port.`);
    }
    process.exit(1);
  }
}

async function bootstrap(){
  try {
    await ensureMessagingStorage();
    await pruneOldMessages();
    scheduleRetentionPrune();
    console.log(`[MessagingRetention] Active (keep ${MESSAGE_RETENTION_DAYS} days, prune every ${PRUNE_INTERVAL_MINUTES} minutes).`);
  } catch (err) {
    console.error('Failed to initialize messaging storage:', err && err.message ? err.message : err);
    process.exit(1);
  }
  startServer(PORT);
}

bootstrap();

