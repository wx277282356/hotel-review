/**
 * hotel-review/js/db.js
 * 本地数据库 - 使用 localStorage 模拟持久化存储
 * 捷信达 PMS 接口预留框架已注释标注
 */

const DB = {
  // ─────────────────────────────────────────
  //  Keys
  // ─────────────────────────────────────────
  KEYS: {
    REVIEWS: 'hr_reviews',
    USERS: 'hr_users',
    SETTINGS: 'hr_settings',
    NEG_REASONS: 'hr_neg_reasons',
    LOGO: 'hr_logo',
  },

  // ─────────────────────────────────────────
  //  初始化
  // ─────────────────────────────────────────
  init() {
    if (!localStorage.getItem(this.KEYS.USERS)) {
      const defaultUsers = [
        { id: 1, username: 'admin', password: 'admin123', role: 'manager', name: '店总', nameEn: 'Manager' },
        { id: 2, username: 'staff', password: 'staff123', role: 'staff', name: '前台', nameEn: 'Front Desk' },
      ];
      localStorage.setItem(this.KEYS.USERS, JSON.stringify(defaultUsers));
    }

    if (!localStorage.getItem(this.KEYS.NEG_REASONS)) {
      const defaultReasons = [
        { id: 1, label: '服务差', labelEn: 'Poor Service', active: true },
        { id: 2, label: '卫生差', labelEn: 'Poor Hygiene', active: true },
        { id: 3, label: '态度差', labelEn: 'Poor Attitude', active: true },
        { id: 4, label: '等待太久', labelEn: 'Long Wait', active: true },
        { id: 5, label: '响应不及时', labelEn: 'Slow Response', active: true },
        { id: 6, label: '设施老旧', labelEn: 'Old Facilities', active: true },
        { id: 7, label: '空调/热水问题', labelEn: 'AC / Hot Water Issue', active: true },
        { id: 8, label: '网络差', labelEn: 'Poor Wi-Fi', active: true },
      ];
      localStorage.setItem(this.KEYS.NEG_REASONS, JSON.stringify(defaultReasons));
    }

    if (!localStorage.getItem(this.KEYS.SETTINGS)) {
      const defaultSettings = {
        hotelName: '城市酒店',
        hotelNameEn: 'City Hotel',
        voicePrompt: '尊敬的客人，感谢您的入住，退房时请为我们的服务点个评！',
        voicePromptEn: 'Dear guest, thank you for staying. Please rate our service upon check-out!',
        positiveMsg: '感谢您的好评，期待再次为您服务！',
        positiveMsgEn: 'Thank you for your positive feedback! We look forward to serving you again.',
        negativeMsg: '非常抱歉给您带来不便，我们会认真改进！',
        negativeMsgEn: 'We sincerely apologize for the inconvenience. We will improve immediately.',
        autoReturn: 4,       // 提交后自动返回秒数
        lang: 'zh',          // zh | en | both
        pmsEnabled: false,   // 捷信达PMS接口开关（预留）
        pmsEndpoint: '',     // PMS API 地址（预留）
        pmsToken: '',        // PMS API Token（预留）
        // ── 数据聚合后端（跨设备汇总）──
        syncEnabled: false,  // 是否启用后端同步
        syncEndpoint: '',    // 后端地址，如 https://review.xxx.com
        syncToken: '',       // 管理员令牌（与服务器端 ADMIN_TOKEN 一致）
      };
      localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(defaultSettings));
    }

    if (!localStorage.getItem(this.KEYS.REVIEWS)) {
      localStorage.setItem(this.KEYS.REVIEWS, JSON.stringify([]));
    }
  },

  // ─────────────────────────────────────────
  //  Reviews CRUD
  // ─────────────────────────────────────────
  getReviews() {
    return JSON.parse(localStorage.getItem(this.KEYS.REVIEWS) || '[]');
  },

  addReview(review) {
    const reviews = this.getReviews();
    review.id = Date.now();
    review.createdAt = new Date().toISOString();
    reviews.unshift(review);
    localStorage.setItem(this.KEYS.REVIEWS, JSON.stringify(reviews));

    // ── 异步同步到聚合后端（断网时本地兜底，联网后由后台补拉）──
    this.pushToBackend(review);

    // ── 捷信达 PMS 接口预留 ──────────────────────────────
    // this._syncToPMS(review);
    // ────────────────────────────────────────────────────

    return review;
  },

  deleteReview(id) {
    // 出于数据安全要求：评价记录禁止任何人删除（无论前台还是后台）
    console.warn('评价记录删除已被禁用：系统不允许删除任何评价');
    return false;
  },

  // ─────────────────────────────────────────
  //  查询 / 统计
  // ─────────────────────────────────────────
  queryReviews({ startDate, endDate, type, reason, staff, room } = {}) {
    let reviews = this.getReviews();

    if (startDate) {
      const s = new Date(startDate);
      s.setHours(0, 0, 0, 0);
      reviews = reviews.filter(r => new Date(r.createdAt) >= s);
    }
    if (endDate) {
      const e = new Date(endDate);
      e.setHours(23, 59, 59, 999);
      reviews = reviews.filter(r => new Date(r.createdAt) <= e);
    }
    if (type === 'positive' || type === 'negative') {
      reviews = reviews.filter(r => r.type === type);
    }
    if (reason) {
      reviews = reviews.filter(r => r.reasons && r.reasons.includes(reason));
    }
    if (staff) {
      reviews = reviews.filter(r => r.staffUsername === staff);
    }
    if (room) {
      reviews = reviews.filter(r => String(r.room || '').toUpperCase() === String(room).toUpperCase());
    }

    return reviews;
  },

  statsBy(period, startDate, endDate) {
    const reviews = this.queryReviews({ startDate, endDate });
    const map = {};

    reviews.forEach(r => {
      const d = new Date(r.createdAt);
      let key;
      if (period === 'day') {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      } else if (period === 'week') {
        const startOfWeek = new Date(d);
        startOfWeek.setDate(d.getDate() - d.getDay());
        key = `${startOfWeek.getFullYear()}-W${String(getWeekNumber(d)).padStart(2, '0')}`;
      } else {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      }
      if (!map[key]) map[key] = { positive: 0, negative: 0, total: 0 };
      map[key][r.type]++;
      map[key].total++;
    });

    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, data]) => ({ period, ...data }));
  },

  negReasonStats(startDate, endDate) {
    const reviews = this.queryReviews({ startDate, endDate, type: 'negative' });
    const map = {};
    reviews.forEach(r => {
      (r.reasons || []).forEach(reason => {
        map[reason] = (map[reason] || 0) + 1;
      });
    });
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .map(([reason, count]) => ({ reason, count }));
  },

  // 按工号统计（汇总各员工好评/差评数量）
  statsByStaff(startDate, endDate) {
    const reviews = this.queryReviews({ startDate, endDate });
    const map = {};
    reviews.forEach(r => {
      const key = r.staffUsername || '未记录';
      const name = r.staffName || '未知';
      if (!map[key]) map[key] = { staffUsername: key, staffName: name, positive: 0, negative: 0, total: 0 };
      map[key][r.type]++;
      map[key].total++;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  },

  // 按房间统计（汇总各房间好评/差评数量，差评优先排序）
  statsByRoom(startDate, endDate) {
    const reviews = this.queryReviews({ startDate, endDate });
    const map = {};
    reviews.forEach(r => {
      const key = r.room || '未记录';
      if (!map[key]) map[key] = { room: key, positive: 0, negative: 0, total: 0 };
      map[key][r.type]++;
      map[key].total++;
    });
    return Object.values(map)
      .sort((a, b) => b.negative - a.negative || b.total - a.total);
  },

  // ─────────────────────────────────────────
  //  Users
  // ─────────────────────────────────────────
  getUsers() {
    return JSON.parse(localStorage.getItem(this.KEYS.USERS) || '[]');
  },

  login(username, password) {
    const users = this.getUsers();
    return users.find(u => u.username === username && u.password === password) || null;
  },

  saveUsers(users) {
    localStorage.setItem(this.KEYS.USERS, JSON.stringify(users));
  },

  addUser(user) {
    const users = this.getUsers();
    user.id = Date.now();
    users.push(user);
    this.saveUsers(users);
    return user;
  },

  updateUser(id, data) {
    const users = this.getUsers();
    const idx = users.findIndex(u => u.id === id);
    if (idx >= 0) { users[idx] = { ...users[idx], ...data }; this.saveUsers(users); }
  },

  deleteUser(id) {
    this.saveUsers(this.getUsers().filter(u => u.id !== id));
  },

  // ─────────────────────────────────────────
  //  Settings
  // ─────────────────────────────────────────
  getSettings() {
    return JSON.parse(localStorage.getItem(this.KEYS.SETTINGS) || '{}');
  },

  saveSettings(data) {
    const current = this.getSettings();
    localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify({ ...current, ...data }));
  },

  // ─────────────────────────────────────────
  //  Neg Reasons
  // ─────────────────────────────────────────
  getReasons() {
    return JSON.parse(localStorage.getItem(this.KEYS.NEG_REASONS) || '[]');
  },

  saveReasons(reasons) {
    localStorage.setItem(this.KEYS.NEG_REASONS, JSON.stringify(reasons));
  },

  addReason(label, labelEn) {
    const reasons = this.getReasons();
    const newItem = { id: Date.now(), label, labelEn, active: true };
    reasons.push(newItem);
    this.saveReasons(reasons);
    return newItem;
  },

  updateReason(id, data) {
    const reasons = this.getReasons();
    const idx = reasons.findIndex(r => r.id === id);
    if (idx >= 0) { reasons[idx] = { ...reasons[idx], ...data }; this.saveReasons(reasons); }
  },

  deleteReason(id) {
    this.saveReasons(this.getReasons().filter(r => r.id !== id));
  },

  // ─────────────────────────────────────────
  //  Logo
  // ─────────────────────────────────────────
  getLogo() {
    return localStorage.getItem(this.KEYS.LOGO) || null;
  },

  saveLogo(base64) {
    localStorage.setItem(this.KEYS.LOGO, base64);
  },

  // ─────────────────────────────────────────
  //  数据聚合后端（跨设备汇总）
  // ─────────────────────────────────────────
  getSyncConfig() {
    const s = this.getSettings();
    return {
      enabled: !!s.syncEnabled,
      endpoint: (s.syncEndpoint || '').trim().replace(/\/+$/, ''),
      token: (s.syncToken || '').trim(),
    };
  },

  // 客人提交后异步推送（best-effort，失败不影响本地）
  pushToBackend(review) {
    const cfg = this.getSyncConfig();
    if (!cfg.enabled || !cfg.endpoint) return;
    const payload = {
      id: review.id,
      type: review.type,
      reasons: review.reasons || [],
      room: review.room || '',
      staffUsername: review.staffUsername || '',
      staffName: review.staffName || '',
      createdAt: review.createdAt,
    };
    fetch(cfg.endpoint + '/api/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => { /* 联网后由 syncPull 补传 */ });
  },

  // 后台拉全量汇总：以 id 并集合并本地与后端，并把本地独有补传
  async syncPull() {
    const cfg = this.getSyncConfig();
    if (!cfg.enabled || !cfg.endpoint) return false;
    try {
      const res = await fetch(cfg.endpoint + '/api/reviews', {
        headers: { 'X-Admin-Token': cfg.token },
      });
      if (!res.ok) return false;
      const data = await res.json();
      const remote = data.reviews || [];

      const map = {};
      for (const r of this.getReviews()) map[r.id] = r;
      for (const r of remote) if (!map[r.id]) map[r.id] = r;

      const merged = Object.values(map);
      localStorage.setItem(this.KEYS.REVIEWS, JSON.stringify(merged));

      // 本地有、远程没有的（曾离线提交）→ 补传
      const localOnly = merged.filter(r => !remote.some(x => x.id === r.id));
      for (const r of localOnly) this.pushToBackend(r);

      return true;
    } catch (e) {
      return false;
    }
  },

  // ─────────────────────────────────────────
  //  捷信达 PMS 接口预留（TODO）
  // ─────────────────────────────────────────
  // async _syncToPMS(review) {
  //   const settings = this.getSettings();
  //   if (!settings.pmsEnabled || !settings.pmsEndpoint) return;
  //   try {
  //     await fetch(settings.pmsEndpoint + '/api/guest-feedback', {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json',
  //         'Authorization': 'Bearer ' + settings.pmsToken,
  //       },
  //       body: JSON.stringify({
  //         guestRoomNo: review.roomNo || '',
  //         feedbackType: review.type,       // "positive" | "negative"
  //         feedbackReasons: review.reasons, // array of reason labels
  //         feedbackTime: review.createdAt,
  //         source: 'hotel-review-kiosk',
  //       }),
  //     });
  //   } catch (e) {
  //     console.warn('[PMS Sync] Failed:', e.message);
  //   }
  // },
};

// 工具函数
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

DB.init();
