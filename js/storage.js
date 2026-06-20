// ===== STORAGE & UTILS =====
const ST = {
  _p: 'exp_',
  _raw(c) {
    try { return JSON.parse(localStorage.getItem(this._p + c)) || []; }
    catch (e) { return []; }
  },
  getAll(c) { return this._raw(c).filter(i => !i.deletedAt); },
  getAllDeleted(c) { return this._raw(c).filter(i => !!i.deletedAt); },
  getById(c, id) { return this.getAll(c).find(i => i.id === id) || null; },
  add(c, item) {
    const a = this._raw(c);
    item.id = item.id || this._id(c);
    item.createdAt = item.createdAt || new Date().toISOString();
    item.updatedAt = new Date().toISOString();
    item._updatedAt = Date.now();
    a.push(item);
    this._save(c, a);
    return item;
  },
  update(c, id, u) {
    const a = this._raw(c);
    const i = a.findIndex(x => x.id === id);
    if (i < 0) return null;
    a[i] = { ...a[i], ...u, updatedAt: new Date().toISOString(), _updatedAt: Date.now() };
    this._save(c, a);
    return a[i];
  },
  delete(c, id) {
    this._save(c, this._raw(c).filter(x => x.id !== id));
    return true;
  },
  softDelete(c, id) {
    const a = this._raw(c);
    const i = a.findIndex(x => x.id === id);
    if (i < 0) return false;
    a[i].deletedAt = new Date().toISOString();
    a[i].updatedAt = new Date().toISOString();
    this._save(c, a);
    return true;
  },
  restore(c, id) {
    const a = this._raw(c);
    const i = a.findIndex(x => x.id === id);
    if (i < 0) return false;
    delete a[i].deletedAt;
    a[i].updatedAt = new Date().toISOString();
    this._save(c, a);
    return true;
  },
  purgeExpired(days = 30) {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
    ['transactions','credit_cards','wallet_accounts','installments','savings_goals','subscriptions','loan_plans'].forEach(c => {
      const raw = this._raw(c);
      const kept = raw.filter(i => !i.deletedAt || new Date(i.deletedAt) > cutoff);
      if (kept.length !== raw.length) localStorage.setItem(this._p + c, JSON.stringify(kept));
    });
  },
  _save(c, a) {
    localStorage.setItem(this._p + c, JSON.stringify(a));
    window.dispatchEvent(new CustomEvent('sc', { detail: { c } }));
  },
  _id(c) {
    const p = {
      installments: 'inst_', transactions: 'txn_', categories: 'cat_', items: 'itm_',
      recurring: 'rec_', budgets: 'bud_', accounts: 'acc_',
      credit_cards: 'cc_', wallet_accounts: 'wa_', account_transfers: 'at_',
      savings_goals: 'sg_', subscriptions: 'subs_', loan_plans: 'lp_',
      item_groups: 'ig_'
    };
    return (p[c] || 'cfg_') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  },
  clearAll() {
    ['transactions','categories','config','items','item_groups','recurring','budgets','accounts','credit_cards','wallet_accounts','account_transfers','installments','savings_goals','subscriptions','loan_plans']
    .forEach(c => localStorage.removeItem(this._p + c));
  }
};

const U = {
  fmtCurrency(a, cur = 'THB') {
    const s = { THB: '฿', USD: '$', EUR: '€', JPY: '¥', GBP: '£' };
    const n = Number(a);
    if (isNaN(n)) return (s[cur] || cur) + '0.00';
    return (s[cur] || cur) + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  },
  fmtCompact(a, cur = 'THB') {
    const s = { THB: '฿', USD: '$', EUR: '€', JPY: '¥', GBP: '£' };
    const n = Number(a);
    if (isNaN(n)) return (s[cur] || cur) + '0';
    const sign = n < 0 ? '-' : '';
    const abs = Math.abs(n);
    if (abs >= 1000000) return sign + (s[cur] || cur) + (abs / 1000000).toFixed(abs >= 10000000 ? 0 : 1).replace(/\.0$/, '') + 'M';
    if (abs >= 100000) return sign + (s[cur] || cur) + (abs / 1000).toFixed(0) + 'k';
    return this.fmtCurrency(n, cur);
  },
  fmtDate(iso) {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('th-TH', { year:'numeric', month:'short', day:'numeric' });
  },
  fmtDateShort(iso) {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('th-TH', { month:'short', day:'numeric' });
  },
  _ld(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; },
  today() { return this._ld(new Date()); },
  yesterday() { const d = new Date(); d.setDate(d.getDate()-1); return this._ld(d); },
  daysAgo(n) { const d = new Date(); d.setDate(d.getDate()-n); return this._ld(d); },
  thisMonth() {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
  },
  getDayLabel(iso) {
    return ['อา','จ','อ','พ','พฤ','ศ','ส'][new Date(iso).getDay()];
  },
  last7() {
    const a = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      a.push(d.toISOString().split('T')[0]);
    }
    return a;
  },
  getStreak() {
    const dates = new Set(ST.getAll('transactions').map(t => t.date));
    let s = 0, d = new Date(dates.has(this.today()) ? this.today() : this.yesterday());
    while (true) {
      const k = d.toISOString().split('T')[0];
      if (!dates.has(k)) break;
      s++; d.setDate(d.getDate() - 1);
    }
    return s;
  },
  toast(msg, type = 'info', undoFn = null) {
    const c = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = `toast toast-${undoFn ? 'undo' : type}`;
    if (undoFn) {
      const span = document.createElement('span'); span.textContent = msg; el.appendChild(span);
      const btn = document.createElement('button'); btn.className = 'toast-undo-btn'; btn.textContent = 'Undo';
      let used = false;
      btn.onclick = () => { if (!used) { used = true; undoFn(); el.remove(); } };
      el.appendChild(btn);
    } else {
      el.textContent = msg;
    }
    c.appendChild(el);
    const t1 = setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, 2800);
    const t2 = setTimeout(() => el.remove(), 3200);
    return el;
  },
  confirm(msg) {
    return new Promise(r => {
      const o = document.createElement('div'); o.className = 'modal-overlay';
      o.innerHTML = `<div class="modal" style="max-width:340px;text-align:center"><p style="margin-bottom:12px;font-size:.9rem">${msg}</p><div class="modal-actions" style="justify-content:center"><button class="btn btn-outline" id="cc">ยกเลิก</button><button class="btn btn-danger" id="co">ยืนยัน</button></div></div>`;
      document.getElementById('modalRoot').appendChild(o);
      o.querySelector('#cc').onclick = () => { o.remove(); r(false); };
      o.querySelector('#co').onclick = () => { o.remove(); r(true); };
      o.onclick = e => { if (e.target === o) { o.remove(); r(false); } };
    });
  },
  getConfig() {
    const c = ST.getAll('config');
    if (!c.length) {
      const d = { id: 'cfg_main', currency: 'THB', theme: 'light', accent: 'indigo', userName: 'ผู้ใช้', onboarded: false, apiKey: '', geminiApiKey: '', aiProvider: 'claude', firebaseConfig: '', pinnedItems: [] };
      ST.add('config', d);
      return d;
    }
    return c[0];
  },
  updateConfig(u) {
    return ST.update('config', this.getConfig().id, u);
  },
  dlBlob(data, fn) {
    const b = new Blob([data], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(b);
    const a = document.createElement('a'); a.href = url; a.download = fn; a.click();
    URL.revokeObjectURL(url);
  },
  parseCSV(text) {
    const l = text.trim().split('\n');
    if (l.length < 2) return [];
    const h = l[0].split(',').map(x => x.trim().replace(/^"|"$/g, ''));
    return l.slice(1).map(row => {
      const v = row.split(',').map(x => x.trim().replace(/^"|"$/g, ''));
      const r = {}; h.forEach((k, j) => r[k] = v[j] || '');
      return r;
    });
  }
};

function seedData() {
  if (ST.getAll('categories').length > 0) return;
  [
    { id: 'cat_food', name: 'อาหาร', icon: '🍔', color: '#f97316', type: 'expense', isDefault: true },
    { id: 'cat_transport', name: 'เดินทาง', icon: '🚗', color: '#3b82f6', type: 'expense', isDefault: true },
    { id: 'cat_bills', name: 'ค่าใช้จ่ายประจำ', icon: '📋', color: '#64748b', type: 'expense', isDefault: true },
    { id: 'cat_shopping', name: 'ช้อปปิ้ง', icon: '🛍️', color: '#ec4899', type: 'expense', isDefault: true },
    { id: 'cat_entertain', name: 'บันเทิง', icon: '🎬', color: '#8b5cf6', type: 'expense', isDefault: true },
    { id: 'cat_health', name: 'สุขภาพ', icon: '💊', color: '#14b8a6', type: 'expense', isDefault: true },
    { id: 'cat_salary', name: 'เงินเดือน', icon: '💼', color: '#10b981', type: 'income', isDefault: true },
    { id: 'cat_bonus', name: 'โบนัส/พิเศษ', icon: '🎁', color: '#22c55e', type: 'income', isDefault: true },
    { id: 'cat_invest', name: 'การลงทุน', icon: '📈', color: '#06b6d4', type: 'income', isDefault: true },
    { id: 'cat_other_e', name: 'อื่นๆ', icon: '📌', color: '#9ca3af', type: 'expense', isDefault: true },
    { id: 'cat_other_i', name: 'อื่นๆ (รายรับ)', icon: '📌', color: '#9ca3af', type: 'income', isDefault: true }
  ].forEach(c => ST.add('categories', { ...c, createdAt: new Date().toISOString() }));

  [
    { id: 'i_f1', categoryId: 'cat_food', name: 'มื้อเช้า', icon: '🌅', defaultAmount: 50 },
    { id: 'i_f2', categoryId: 'cat_food', name: 'มื้อกลางวัน', icon: '☀️', defaultAmount: 80 },
    { id: 'i_f3', categoryId: 'cat_food', name: 'มื้อเย็น', icon: '🌙', defaultAmount: 100 },
    { id: 'i_f4', categoryId: 'cat_food', name: 'กาแฟ/เครื่องดื่ม', icon: '☕', defaultAmount: 60 },
    { id: 'i_f5', categoryId: 'cat_food', name: 'ของว่าง', icon: '🍿', defaultAmount: 40 },
    { id: 'i_f6', categoryId: 'cat_food', name: 'เดลิเวอรี่', icon: '🛵', defaultAmount: 150 },
    { id: 'i_t1', categoryId: 'cat_transport', name: 'แกร็บ/แท็กซี่', icon: '🚖', defaultAmount: 120 },
    { id: 'i_t2', categoryId: 'cat_transport', name: 'รถไฟฟ้า/BTS', icon: '🚆', defaultAmount: 45 },
    { id: 'i_t3', categoryId: 'cat_transport', name: 'น้ำมัน', icon: '⛽', defaultAmount: 500 },
    { id: 'i_t4', categoryId: 'cat_transport', name: 'ที่จอดรถ', icon: '🅿️', defaultAmount: 60 },
    { id: 'i_t5', categoryId: 'cat_transport', name: 'รถเมล์', icon: '🚌', defaultAmount: 15 },
    { id: 'i_b1', categoryId: 'cat_bills', name: 'ค่างวดรถ', icon: '🚗', defaultAmount: 8000 },
    { id: 'i_b2', categoryId: 'cat_bills', name: 'ค่าเช่า/ผ่อนบ้าน', icon: '🏠', defaultAmount: 12000 },
    { id: 'i_b3', categoryId: 'cat_bills', name: 'ค่าไฟ', icon: '💡', defaultAmount: 800 },
    { id: 'i_b4', categoryId: 'cat_bills', name: 'ค่าน้ำ', icon: '💧', defaultAmount: 200 },
    { id: 'i_b5', categoryId: 'cat_bills', name: 'อินเทอร์เน็ต', icon: '📡', defaultAmount: 700 },
    { id: 'i_b6', categoryId: 'cat_bills', name: 'มือถือ', icon: '📱', defaultAmount: 500 },
    { id: 'i_b7', categoryId: 'cat_bills', name: 'Netflix/Streaming', icon: '📺', defaultAmount: 219 },
    { id: 'i_b8', categoryId: 'cat_bills', name: 'ประกัน', icon: '🛡️', defaultAmount: 2000 },
    { id: 'i_s1', categoryId: 'cat_shopping', name: 'เสื้อผ้า', icon: '👕', defaultAmount: 500 },
    { id: 'i_s2', categoryId: 'cat_shopping', name: 'ของใช้ในบ้าน', icon: '🏡', defaultAmount: 300 },
    { id: 'i_s3', categoryId: 'cat_shopping', name: 'เครื่องสำอาง', icon: '💄', defaultAmount: 400 },
    { id: 'i_s4', categoryId: 'cat_shopping', name: 'อิเล็กทรอนิกส์', icon: '💻', defaultAmount: 2000 },
    { id: 'i_e1', categoryId: 'cat_entertain', name: 'ดูหนัง', icon: '🎬', defaultAmount: 200 },
    { id: 'i_e2', categoryId: 'cat_entertain', name: 'เกม', icon: '🎮', defaultAmount: 500 },
    { id: 'i_e3', categoryId: 'cat_entertain', name: 'ท่องเที่ยว', icon: '✈️', defaultAmount: 3000 },
    { id: 'i_e4', categoryId: 'cat_entertain', name: 'ออกกำลังกาย', icon: '🏋️', defaultAmount: 800 },
    { id: 'i_h1', categoryId: 'cat_health', name: 'ยา/อาหารเสริม', icon: '💊', defaultAmount: 300 },
    { id: 'i_h2', categoryId: 'cat_health', name: 'พบแพทย์', icon: '👨‍⚕️', defaultAmount: 500 },
    { id: 'i_h3', categoryId: 'cat_health', name: 'ทันตกรรม', icon: '🦷', defaultAmount: 1500 },
    { id: 'i_sl1', categoryId: 'cat_salary', name: 'เงินเดือน', icon: '💰', defaultAmount: 30000 },
    { id: 'i_sl2', categoryId: 'cat_salary', name: 'โอที', icon: '⏰', defaultAmount: 2000 },
    { id: 'i_bn1', categoryId: 'cat_bonus', name: 'โบนัส', icon: '🎉', defaultAmount: 30000 },
    { id: 'i_bn2', categoryId: 'cat_bonus', name: 'ค่าคอมมิชชัน', icon: '💹', defaultAmount: 5000 },
    { id: 'i_iv1', categoryId: 'cat_invest', name: 'เงินปันผล', icon: '📊', defaultAmount: 5000 },
    { id: 'i_iv2', categoryId: 'cat_invest', name: 'ดอกเบี้ย', icon: '🏦', defaultAmount: 500 }
  ].forEach(i => ST.add('items', { ...i, isDefault: true, createdAt: new Date().toISOString() }));
}

function seedWalletAccounts() {
  if (ST.getAll('wallet_accounts').length > 0) return;
  [
    { id: 'wa_cash', name: 'เงินสด', icon: '💵', color: '#10b981', wtype: 'cash', balance: 0, isDefault: true },
    { id: 'wa_bank1', name: 'บัญชีธนาคาร', icon: '🏦', color: '#3b82f6', wtype: 'bank', balance: 0, isDefault: true },
    { id: 'wa_promptpay', name: 'พร้อมเพย์', icon: '📱', color: '#8b5cf6', wtype: 'digital', balance: 0, isDefault: true }
  ].forEach(a => ST.add('wallet_accounts', { ...a, createdAt: new Date().toISOString() }));
}