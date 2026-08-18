/**
 * hotel-review/server/server.js
 * 零依赖聚合后端（Node 内置 http，无需 npm install）
 * 数据落盘到 ./data/reviews.jsonl（每行一条 JSON，单文件备份）
 *
 * 接口：
 *   POST /api/review   客人提交评价（开放，无需令牌）
 *   GET  /api/reviews  后台拉取全量（需管理员令牌）
 *   GET  /api/stats    后台统计（需管理员令牌）
 *   GET  /             健康检查
 *
 * 环境变量：
 *   PORT        监听端口，默认 3000
 *   ADMIN_TOKEN 后台读取令牌（必填，GET 接口鉴权用）
 *   DATA_DIR    数据目录，默认 ./data
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = parseInt(process.env.PORT || '3000', 10);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'reviews.jsonl');

// ── 初始化数据目录/文件 ──────────────────────────────
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '');

// ── 工具 ────────────────────────────────────────────
function sendJSON(res, status, obj, extraHeaders = {}) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,X-Admin-Token',
    ...extraHeaders,
  });
  res.end(body);
}

function readAll() {
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  const out = [];
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(JSON.parse(t)); } catch (e) { /* 跳过损坏行 */ }
  }
  return out;
}

function append(review) {
  fs.appendFileSync(DATA_FILE, JSON.stringify(review) + '\n');
}

function checkToken(req) {
  if (!ADMIN_TOKEN) return false; // 未配置令牌则拒绝读取
  const header = (req.headers['x-admin-token'] || '').trim();
  const urlTok = new URL(req.url, 'http://x').searchParams.get('token') || '';
  return header === ADMIN_TOKEN || urlTok === ADMIN_TOKEN;
}

function getTokenFromReq(req) {
  return (req.headers['x-admin-token'] || '').trim()
    || new URL(req.url, 'http://x').searchParams.get('token') || '';
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > 1e6) { reject(new Error('payload too large')); req.destroy(); return; }
      data += chunk;
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

// ── 路由 ────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const pathname = url.pathname;

  // CORS 预检
  if (req.method === 'OPTIONS') {
    sendJSON(res, 204, {});
    return;
  }

  // 健康检查
  if (req.method === 'GET' && pathname === '/') {
    sendJSON(res, 200, { ok: true, service: 'hotel-review-sync', time: new Date().toISOString() });
    return;
  }

  // 客人提交（开放）
  if (req.method === 'POST' && pathname === '/api/review') {
    try {
      const body = await readBody(req);
      let r;
      try { r = JSON.parse(body); } catch (e) { return sendJSON(res, 400, { ok: false, error: '无效的 JSON' }); }

      const type = r.type === 'positive' || r.type === 'negative' ? r.type : null;
      if (!type) return sendJSON(res, 400, { ok: false, error: 'type 必须为 positive 或 negative' });

      const review = {
        id: r.id || Date.now(),
        type,
        reasons: Array.isArray(r.reasons) ? r.reasons.map(String) : [],
        room: String(r.room || '').trim().toUpperCase(),
        staffUsername: String(r.staffUsername || '').trim(),
        staffName: String(r.staffName || '').trim(),
        createdAt: r.createdAt || new Date().toISOString(),
        serverAt: new Date().toISOString(),
      };
      append(review);
      return sendJSON(res, 200, { ok: true, id: review.id });
    } catch (e) {
      return sendJSON(res, 500, { ok: false, error: e.message });
    }
  }

  // 后台拉全量（需令牌）
  if (req.method === 'GET' && pathname === '/api/reviews') {
    if (!checkToken(req)) return sendJSON(res, 401, { ok: false, error: '未授权' });
    return sendJSON(res, 200, { ok: true, reviews: readAll() });
  }

  // 后台统计（需令牌）
  if (req.method === 'GET' && pathname === '/api/stats') {
    if (!checkToken(req)) return sendJSON(res, 401, { ok: false, error: '未授权' });
    const reviews = readAll();
    const stats = {
      total: reviews.length,
      positive: reviews.filter(r => r.type === 'positive').length,
      negative: reviews.filter(r => r.type === 'negative').length,
      byRoom: {},
      byStaff: {},
      reasons: {},
    };
    for (const r of reviews) {
      if (r.room) stats.byRoom[r.room] = (stats.byRoom[r.room] || 0) + 1;
      const sk = r.staffUsername || '未记录';
      stats.byStaff[sk] = (stats.byStaff[sk] || 0) + 1;
      for (const reason of (r.reasons || [])) stats.reasons[reason] = (stats.reasons[reason] || 0) + 1;
    }
    return sendJSON(res, 200, { ok: true, stats });
  }

  return sendJSON(res, 404, { ok: false, error: 'not found' });
});

server.listen(PORT, () => {
  console.log(`[hotel-review-sync] listening on :${PORT}`);
  if (!ADMIN_TOKEN) console.warn('[warn] ADMIN_TOKEN 未设置，GET /api/reviews 与 /api/stats 将被拒绝');
});
