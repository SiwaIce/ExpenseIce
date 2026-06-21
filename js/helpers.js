const EH = {
  getTxns(f = {}) {
    let t = ST.getAll('transactions');
    if (f.type && f.type !== 'all') t = t.filter(x => x.type === f.type);
    if (f.categoryId) t = t.filter(x => x.categoryId === f.categoryId);
    if (f.dateFrom) t = t.filter(x => x.date >= f.dateFrom);
    if (f.dateTo) t = t.filter(x => x.date <= f.dateTo);
    if (f.search) {
      const q = f.search.toLowerCase();
      t = t.filter(x => (x.note || '').toLowerCase().includes(q) || (x.itemName || '').toLowerCase().includes(q));
    }
    if (f.amountMin !== '' && f.amountMin != null) t = t.filter(x => Number(x.amount) >= Number(f.amountMin));
    if (f.amountMax !== '' && f.amountMax != null) t = t.filter(x => Number(x.amount) <= Number(f.amountMax));
    if (f.accountId) t = t.filter(x => x.accountId === f.accountId);
    if (f.hasReceipt) t = t.filter(x => !!x.receiptUrl);
    return t.sort((a, b) => new Date(b.date) - new Date(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''));
  },
  calcSum(t) {
    let inc = 0, exp = 0;
    t.forEach(x => { if (x.type === 'income') inc += Number(x.amount); else exp += Number(x.amount); });
    return { totalIncome: inc, totalExpense: exp, balance: inc - exp, count: t.length };
  },
  catSpending(txns, cats) {
    const map = {};
    txns.filter(t => t.type === 'expense').forEach(t => {
      map[t.categoryId] = (map[t.categoryId] || 0) + Number(t.amount);
    });
    const total = Object.values(map).reduce((s, v) => s + v, 0);
    return Object.entries(map).map(([cid, amount]) => {
      const cat = cats.find(c => c.id === cid) || { name: 'ไม่ระบุ', icon: '❓', color: '#ccc' };
      return { categoryId: cid, ...cat, amount, percent: total > 0 ? amount / total * 100 : 0 };
    }).sort((a, b) => b.amount - a.amount);
  },
  dailyTrend(txns, days = 14) {
    const map = {};
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const k = U._ld(d);
      map[k] = { date: k, income: 0, expense: 0 };
    }
    txns.forEach(t => {
      if (map[t.date]) {
        if (t.type === 'income') map[t.date].income += Number(t.amount);
        else map[t.date].expense += Number(t.amount);
      }
    });
    return Object.values(map);
  },
  // Group key for frequency stats: real saved item > subcategory (groupId) > free-typed name.
  // Keeping these distinct stops a subcategory's name from being indistinguishable from an
  // unrelated favorite/item that happens to share the same text.
  _freqKey(t) {
    if (t.itemId) return t.itemId;
    if (t.groupId) return 'g:' + t.groupId;
    if (t.itemName) return 'n:' + t.itemName;
    return '';
  },
  _freqKeyToItem(k, lastTxn) {
    if (k.startsWith('g:')) {
      const g = ST.getById('item_groups', k.slice(2));
      if (!g) return null;
      const cat = g.categoryId ? (ST.getById('categories', g.categoryId) || {}) : {};
      return { name: g.name, icon: g.icon || cat.icon || '📋', defaultAmount: lastTxn.amount || 0, categoryId: g.categoryId || lastTxn.categoryId || '', accountId: lastTxn.accountId || '' };
    }
    if (k.startsWith('n:')) {
      const cat = lastTxn.categoryId ? (ST.getById('categories', lastTxn.categoryId) || {}) : {};
      return { name: k.slice(2), icon: cat.icon || '📝', defaultAmount: lastTxn.amount || 0, categoryId: lastTxn.categoryId || '', accountId: lastTxn.accountId || '' };
    }
    return ST.getById('items', k);
  },
  getFavItems(type) {
    const txns = ST.getAll('transactions').filter(t => t.type === type);
    const freq = {};
    txns.forEach(t => {
      const k = this._freqKey(t);
      if (k) {
        if (!freq[k]) freq[k] = { count: 0, last: t };
        freq[k].count++;
        freq[k].last = t;
      }
    });
    return Object.entries(freq)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8)
      .map(([k, v]) => {
        const item = this._freqKeyToItem(k, v.last);
        return item ? { ...item, useCount: v.count } : null;
      }).filter(Boolean);
  },
  // Resolve the display label for a transaction: typed name > subcategory > category.
  txnLabel(t) {
    if (t.itemName) return t.itemName;
    if (t.groupId) { const g = ST.getById('item_groups', t.groupId); if (g) return g.name; }
    const cat = ST.getById('categories', t.categoryId);
    return cat ? cat.name : 'รายการ';
  },
  // Suggest items based on what the user actually records in the CURRENT part of the day,
  // using each transaction's saved time (HH:MM). Returns null when there isn't enough
  // time data, so the caller can fall back to the old category-based hint.
  _timeBuckets: [
    { lo: 5, hi: 10, label: '🌅 ช่วงเช้า' },
    { lo: 10, hi: 14, label: '☀️ ช่วงเที่ยง' },
    { lo: 14, hi: 17, label: '🌤️ ช่วงบ่าย' },
    { lo: 17, hi: 21, label: '🌆 ช่วงเย็น' },
    { lo: 21, hi: 29, label: '🌙 ช่วงค่ำ' }
  ],
  _inBucket(h, b) { return b.hi <= 24 ? (h >= b.lo && h < b.hi) : (h >= b.lo || h < b.hi - 24); },
  getTimeSuggestions(type) {
    const txns = ST.getAll('transactions').filter(t => t.type === type && t.time);
    if (txns.length < 3) return null;
    const hour = new Date().getHours();
    const cur = this._timeBuckets.find(b => this._inBucket(hour, b)) || this._timeBuckets[0];
    const freq = {};
    txns.forEach(t => {
      const h = parseInt((t.time || '').split(':')[0]);
      if (isNaN(h) || !this._inBucket(h, cur)) return;
      const k = this._freqKey(t);
      if (!k) return;
      if (!freq[k]) freq[k] = { count: 0, last: t };
      freq[k].count++; freq[k].last = t;
    });
    const ranked = Object.entries(freq).sort((a, b) => b[1].count - a[1].count);
    if (ranked.length === 0) return null;
    const items = ranked.slice(0, 6).map(([k, v]) => {
      const item = this._freqKeyToItem(k, v.last);
      return item ? { ...item, useCount: v.count } : null;
    }).filter(Boolean);
    return items.length ? { label: cur.label, items } : null;
  },
  getBudget(catId) {
    const b = ST.getAll('budgets').find(x => x.categoryId === catId);
    if (!b) return null;
    const month = U.thisMonth();
    const txns = ST.getAll('transactions').filter(t => t.categoryId === catId && t.type === 'expense' && t.date.startsWith(month));
    const spent = txns.reduce((s, t) => s + Number(t.amount), 0);
    const pct = b.amount > 0 ? Math.min(spent / b.amount * 100, 100) : 0;
    return { budget: b.amount, spent, remaining: b.amount - spent, pct, over: spent > b.amount, cls: pct < 70 ? 'bok' : pct < 90 ? 'bwarn' : 'bover' };
  },
  getRecentAmounts(type) {
    const txns = ST.getAll('transactions').filter(t => t.type === type);
    const freq = {};
    txns.forEach(t => { const k = String(Math.round(Number(t.amount))); freq[k] = (freq[k] || 0) + 1; });
    const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => Number(k));
    const def = type === 'expense' ? [50, 80, 100, 200, 500] : [1000, 5000, 10000, 30000, 50000];
    return [...new Set([...top, ...def])].slice(0, 6);
  },
  exportCSV(txns, cats) {
    const r = ['id,type,amount,category,itemName,date,note'];
    txns.forEach(t => {
      const cat = cats.find(c => c.id === t.categoryId);
      r.push(`${t.id},${t.type},${t.amount},"${cat ? cat.name : '?'}","${t.itemName || ''}",${t.date},"${(t.note || '').replace(/"/g, '""')}"`);
    });
    return r.join('\n');
  },
  importCSV(txt) {
    const rows = U.parseCSV(txt);
    const cats = ST.getAll('categories');
    const existing = ST.getAll('transactions');
    let added = 0;
    rows.forEach(r => {
      if (!r.type || !r.amount || !r.date) return;
      const cat = cats.find(c => c.name === r.category) || cats.find(c => c.id === 'cat_other_e');
      const dup = existing.find(e => e.date === r.date && e.amount === Number(r.amount) && (e.note || '') === (r.note || ''));
      if (!dup) {
        ST.add('transactions', {
          type: r.type === 'income' ? 'income' : 'expense',
          amount: Number(r.amount),
          categoryId: cat ? cat.id : 'cat_other_e',
          itemName: r.itemName || '',
          date: r.date,
          note: r.note || ''
        });
        added++;
      }
    });
    return added;
  },
  getForecast() {
    const recs = ST.getAll('recurring');
    const txns = ST.getAll('transactions');
    const month = U.thisMonth();
    const mTxns = txns.filter(t => t.date.startsWith(month));
    const mSum = this.calcSum(mTxns);
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysPassed = now.getDate();
    const dailyRate = daysPassed > 0 ? mSum.totalExpense / daysPassed : 0;
    const projectedExpense = Math.round(dailyRate * daysInMonth);
    const recIncome = recs.filter(r => r.type === 'income').reduce((s, r) => s + Number(r.amount), 0);
    const recExpense = recs.filter(r => r.type === 'expense').reduce((s, r) => s + Number(r.amount), 0);
    const instMonthly = this.getInstallmentsDueThisMonth().reduce((s, i) => s + Number(i.monthlyPayment), 0);
    return { projectedExpense, recIncome, recExpense: recExpense + instMonthly, instMonthly, daysPassed, daysInMonth, currentExpense: mSum.totalExpense, currentIncome: mSum.totalIncome };
  },
  calcMonthlyPayment(total, months, annualRate) {
    if (!months || months <= 0) return total;
    if (!annualRate || annualRate <= 0) return Math.round((total / months) * 100) / 100;
    const r = annualRate / 100 / 12;
    const pmt = total * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1);
    return Math.round(pmt * 100) / 100;
  },
  calcInstNextDue(startDate, paidMonths) {
    const d = new Date(startDate + 'T00:00:00');
    d.setMonth(d.getMonth() + paidMonths + 1);
    return d.toISOString().split('T')[0];
  },
  getInstallmentsDueThisMonth() {
    const month = U.thisMonth();
    return ST.getAll('installments').filter(i => i.status === 'active' && i.nextDueDate && i.nextDueDate.startsWith(month));
  },
  getInsightData() {
    const txns = ST.getAll('transactions');
    const cats = ST.getAll('categories');
    const month = U.thisMonth();
    const prevM = month.slice(0, 4) + '-' + String((parseInt(month.slice(5)) - 1) || 12).padStart(2, '0');
    const mTxns = txns.filter(t => t.date.startsWith(month) && t.type === 'expense');
    const prevTxns = txns.filter(t => t.date.startsWith(prevM) && t.type === 'expense');
    const spending = this.catSpending(mTxns, cats);
    const prevSpending = this.catSpending(prevTxns, cats);
    const dayOfWeek = txns.reduce((acc, t) => {
      const d = new Date(t.date).getDay();
      if (t.type === 'expense') {
        if (!acc[d]) acc[d] = { total: 0, count: 0 };
        acc[d].total += Number(t.amount);
        acc[d].count++;
      }
      return acc;
    }, {});
    const busiest = Object.entries(dayOfWeek).sort((a, b) => b[1].total - a[1].total)[0];
    const dayNames = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัส', 'วันศุกร์', 'วันเสาร์'];
    return { spending, prevSpending, busiest: busiest ? { day: dayNames[busiest[0]], ...busiest[1] } : null };
  }
};

const Charts = {
  drawDonut(id, data) {
    const c = document.getElementById(id); if (!c) return;
    const ctx = c.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const size = Math.min(c.parentElement.clientWidth, 290);
    c.width = size * dpr; c.height = size * dpr;
    c.style.width = size + 'px'; c.style.height = size + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cx = size / 2, cy = size / 2, r = size * .35, ir = size * .2;
    let angle = -Math.PI / 2;
    const total = data.reduce((s, d) => s + d.amount, 0);
    if (!total) {
      ctx.fillStyle = '#e5e7eb'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-card').trim() || '#fff';
      ctx.beginPath(); ctx.arc(cx, cy, ir, 0, Math.PI * 2); ctx.fill();
      return;
    }
    data.forEach(d => {
      const sl = (d.amount / total) * Math.PI * 2;
      ctx.fillStyle = d.color; ctx.beginPath(); ctx.arc(cx, cy, r, angle, angle + sl);
      ctx.arc(cx, cy, ir, angle + sl, angle, true); ctx.closePath(); ctx.fill();
      angle += sl;
    });
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-card').trim() || '#fff';
    ctx.beginPath(); ctx.arc(cx, cy, ir, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#000';
    ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(U.fmtCurrency(total), cx, cy - 1);
    ctx.font = '10px sans-serif'; ctx.fillText('รายจ่ายรวม', cx, cy + 12);
  },
  drawLine(id, data) {
    const c = document.getElementById(id); if (!c) return;
    const ctx = c.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = Math.min(c.parentElement.clientWidth, 620);
    const h = 220;
    c.width = w * dpr; c.height = h * dpr;
    c.style.width = w + 'px'; c.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const pad = { top: 16, right: 16, bottom: 32, left: 44 };
    const cw = w - pad.left - pad.right;
    const ch = h - pad.top - pad.bottom;
    const maxVal = Math.max(...data.map(d => Math.max(d.income, d.expense)), 1);
    const drawL = (key, color) => {
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.beginPath();
      data.forEach((d, i) => {
        const x = pad.left + (cw / (data.length - 1 || 1)) * i;
        const y = pad.top + ch - (d[key] / maxVal) * ch;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
      data.forEach((d, i) => {
        const x = pad.left + (cw / (data.length - 1 || 1)) * i;
        const y = pad.top + ch - (d[key] / maxVal) * ch;
        ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
      });
    };
    ctx.fillStyle = '#f9fafb'; ctx.fillRect(pad.left, pad.top, cw, ch);
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + ch - (ch * i / 4);
      ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + cw, y); ctx.stroke();
      ctx.fillStyle = '#999'; ctx.font = '9px sans-serif'; ctx.textAlign = 'right'; ctx.fillText(Math.round(maxVal * i / 4), pad.left - 3, y + 3);
    }
    drawL('income', '#10b981'); drawL('expense', '#ef4444');
    const skip = Math.max(1, Math.floor(data.length / 7));
    data.forEach((d, i) => {
      if (i % skip === 0 || i === data.length - 1) {
        const x = pad.left + (cw / (data.length - 1 || 1)) * i;
        ctx.fillStyle = '#999'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(d.date.slice(5), x, pad.top + ch + 11);
      }
    });
    const lx = pad.left + cw - 105;
    ctx.fillStyle = '#10b981'; ctx.fillRect(lx, pad.top + 2, 9, 9);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#000';
    ctx.font = '10px sans-serif'; ctx.textAlign = 'left'; ctx.fillText('รายรับ', lx + 12, pad.top + 10);
    ctx.fillStyle = '#ef4444'; ctx.fillRect(lx + 54, pad.top + 2, 9, 9);
    ctx.fillText('รายจ่าย', lx + 66, pad.top + 10);
  },
  drawBar(id, data, labels) {
    const c = document.getElementById(id); if (!c) return;
    const ctx = c.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = Math.min(c.parentElement.clientWidth, 560);
    const h = 240;
    c.width = w * dpr; c.height = h * dpr;
    c.style.width = w + 'px'; c.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const pad = { top: 16, right: 12, bottom: 42, left: 42 };
    const cw = w - pad.left - pad.right;
    const ch = h - pad.top - pad.bottom;
    const maxVal = Math.max(...data, 1);
    const barW = Math.min(34, cw / data.length * .56);
    const gap = cw / data.length;
    ctx.fillStyle = '#e5e7eb'; ctx.fillRect(pad.left, pad.top, cw, ch);
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + ch - (ch * i / 4);
      ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + cw, y); ctx.stroke();
      ctx.fillStyle = '#999'; ctx.font = '9px sans-serif'; ctx.textAlign = 'right'; ctx.fillText(Math.round(maxVal * i / 4), pad.left - 3, y + 3);
    }
    data.forEach((val, i) => {
      const barH = (val / maxVal) * ch;
      const x = pad.left + gap * i + (gap - barW) / 2;
      const y = pad.top + ch - barH;
      const grad = ctx.createLinearGradient(x, y, x, pad.top + ch);
      grad.addColorStop(0, '#6366f1'); grad.addColorStop(1, '#a5b4fc');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, [4, 4, 0, 0]);
      ctx.fill();
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#000';
      ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(labels[i] || '', x + barW / 2, pad.top + ch + 13);
      if (val > 0) ctx.fillText(U.fmtCurrency(val), x + barW / 2, y - 4);
    });
  }
};

// ===== AI PROVIDER HELPER =====
const AI = {
  _provider() { return U.getConfig().aiProvider || 'claude'; },
  _key() {
    const cfg = U.getConfig();
    return this._provider() === 'gemini' ? (cfg.geminiApiKey || '') : (cfg.apiKey || '');
  },
  _noKeyMsg() {
    const p = this._provider();
    return p === 'gemini'
      ? '⚠️ กรุณาตั้งค่า Gemini API Key ก่อน\nไปที่ ⚙️ ตั้งค่า แล้วกรอก Gemini API Key (รับฟรีที่ aistudio.google.com)'
      : '⚠️ กรุณาตั้งค่า Anthropic API Key ก่อน\nไปที่ ⚙️ ตั้งค่า แล้วกรอก API Key ของคุณ';
  },
  // Text call (for insights, structured responses)
  async call(prompt, { maxTokens = 1000, systemPrompt = null } = {}) {
    const key = this._key();
    if (!key) throw new Error('NO_KEY');
    if (this._provider() === 'gemini') {
      return this._gemini([{ role: 'user', parts: [{ text: prompt }] }], { key, maxTokens, systemPrompt });
    }
    const body = { model: 'claude-sonnet-4-6', max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] };
    if (systemPrompt) body.system = systemPrompt;
    return this._claude(body, key);
  },
  // Chat with history (for chatbot)
  async chat(systemPrompt, history, { maxTokens = 1500 } = {}) {
    const key = this._key();
    if (!key) throw new Error('NO_KEY');
    if (this._provider() === 'gemini') {
      const contents = history.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
      return this._gemini(contents, { key, maxTokens, systemPrompt });
    }
    return this._claude({ model: 'claude-sonnet-4-6', max_tokens: maxTokens, system: systemPrompt, messages: history }, key);
  },
  // Vision call (for receipt scanner)
  async vision(textPrompt, b64, mimeType, { maxTokens = 2000 } = {}) {
    const key = this._key();
    if (!key) throw new Error('NO_KEY');
    if (this._provider() === 'gemini') {
      const contents = [{ role: 'user', parts: [{ inline_data: { mime_type: mimeType, data: b64 } }, { text: textPrompt }] }];
      return this._gemini(contents, { key, maxTokens });
    }
    return this._claude({
      model: 'claude-haiku-4-5-20251001', max_tokens: maxTokens,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: b64 } },
        { type: 'text', text: textPrompt }
      ]}]
    }, key);
  },
  async _claude(body, key) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-calls': 'true' },
      body: JSON.stringify(body)
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error.message);
    return json.content?.[0]?.text || '';
  },
  async _gemini(contents, { key, maxTokens, systemPrompt } = {}) {
    const body = { contents, generationConfig: { maxOutputTokens: maxTokens } };
    if (systemPrompt) body.system_instruction = { parts: [{ text: systemPrompt }] };
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error.message);
    return json.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }
};

function buildAccSelHTML(type, selectedId = '') {
  const wallets = ST.getAll('wallet_accounts');
  const cards = ST.getAll('credit_cards');
  const cfg = U.getConfig();
  const hasCards = type === 'expense' && cards.length > 0;
  const hasBoth = wallets.length > 0 && hasCards;

  let walletsHTML = '';
  wallets.forEach(w => {
    const active = selectedId === w.id ? 'active' : '';
    const bal = U.fmtCurrency(w.balance || 0, cfg.currency);
    walletsHTML += `<button type="button" class="acc-sel-btn ${active}" data-accid="${w.id}" style="border-left:3px solid ${w.color}">${w.icon} ${w.name} <span style="font-size:.65rem;opacity:.7">(${bal})</span></button>`;
  });

  let cardsHTML = '';
  if (hasCards) {
    cards.forEach(cc => {
      const avail = Math.max(0, (cc.limit || 0) - (cc.used || 0));
      const active = selectedId === cc.id ? 'active' : '';
      cardsHTML += `<button type="button" class="acc-sel-btn cc-btn ${active}" data-accid="${cc.id}" data-ccid="${cc.id}">💳 ${cc.name} <span style="font-size:.65rem;opacity:.7">(เครดิตเหลือ ${U.fmtCurrency(avail)})</span></button>`;
    });
  }

  if (!walletsHTML && !cardsHTML) return '<span style="font-size:.74rem;color:var(--text-secondary)">ยังไม่มีบัญชี — <a href="#" id="goAddAcc" style="color:var(--accent)">เพิ่มบัญชีก่อน</a></span>';
  if (!hasBoth) return walletsHTML + cardsHTML;

  const isCardSel = !!(selectedId && cards.some(c => c.id === selectedId));
  return `<div style="width:100%;flex-basis:100%">
    <div style="display:flex;gap:0;margin-bottom:8px;border-bottom:1px solid var(--border)">
      <button type="button" class="acc-sel-tab${!isCardSel ? ' active' : ''}" data-acctab="wallets" style="flex:1;padding:6px 0;font-size:.78rem;font-weight:600;background:none;border:none;cursor:pointer;border-bottom:2px solid ${!isCardSel ? 'var(--accent)' : 'transparent'};color:${!isCardSel ? 'var(--accent)' : 'var(--text-secondary)'}">🏦 กระเป๋า/เงินสด</button>
      <button type="button" class="acc-sel-tab${isCardSel ? ' active' : ''}" data-acctab="cards" style="flex:1;padding:6px 0;font-size:.78rem;font-weight:600;background:none;border:none;cursor:pointer;border-bottom:2px solid ${isCardSel ? 'var(--accent)' : 'transparent'};color:${isCardSel ? 'var(--accent)' : 'var(--text-secondary)'}">💳 บัตรเครดิต</button>
    </div>
    <div id="accWalletPanel" style="display:flex;gap:6px;flex-wrap:wrap${isCardSel ? ';display:none' : ''}">${walletsHTML}</div>
    <div id="accCardPanel" style="display:flex;gap:6px;flex-wrap:wrap${!isCardSel ? ';display:none' : ''}">${cardsHTML}</div>
  </div>`;
}

function attachAccSelEvents(modal, type, onChange) {
  const container = modal.querySelector('#mAccSelect');
  if (!container) return;
  container.innerHTML = buildAccSelHTML(type, modal.querySelector('#mAccId')?.value || '');
  container.querySelectorAll('.acc-sel-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      container.querySelectorAll('.acc-sel-tab').forEach(t => {
        t.style.borderBottomColor = 'transparent';
        t.style.color = 'var(--text-secondary)';
        t.classList.remove('active');
      });
      tab.style.borderBottomColor = 'var(--accent)';
      tab.style.color = 'var(--accent)';
      tab.classList.add('active');
      const isCards = tab.dataset.acctab === 'cards';
      const wp = container.querySelector('#accWalletPanel');
      const cp = container.querySelector('#accCardPanel');
      if (wp) wp.style.display = isCards ? 'none' : 'flex';
      if (cp) cp.style.display = isCards ? 'flex' : 'none';
    });
  });
  container.querySelectorAll('[data-accid]').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('[data-accid]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      modal.querySelector('#mAccId').value = btn.dataset.accid;
      if (onChange) onChange();
    });
  });
  const goAdd = container.querySelector('#goAddAcc');
  if (goAdd) goAdd.addEventListener('click', e => { e.preventDefault(); App.nav('accounts'); });
}

function deleteTransaction(id, afterDelete, afterUndo) {
  const txn = ST.getById('transactions', id);
  if (!txn) return;
  if (txn.installmentId) {
    const inst = ST.getById('installments', txn.installmentId);
    if (inst) {
      ST.softDelete('installments', inst.id);
      const cc = ST.getById('credit_cards', txn.accountId);
      if (cc && txn.type === 'expense') ST.update('credit_cards', txn.accountId, { used: Math.max(0, (cc.used || 0) - Number(txn.amount)) });
    }
  }
  ST.softDelete('transactions', id);
  U.toast('ลบแล้ว 🗑️', 'success', () => {
    ST.restore('transactions', id);
    if (txn.installmentId) {
      ST.restore('installments', txn.installmentId);
      const cc = ST.getById('credit_cards', txn.accountId);
      if (cc && txn.type === 'expense') ST.update('credit_cards', txn.accountId, { used: (cc.used || 0) + Number(txn.amount) });
    }
    if (afterUndo) afterUndo();
  });
  if (afterDelete) afterDelete();
}

function initSwipe(container, onDelete) {
  const items = container.querySelectorAll('.swipe-wrap');
  items.forEach(wrap => {
    const content = wrap.querySelector('.swipe-content'); if (!content) return;
    const bg = wrap.querySelector('.swipe-del-bg');
    let startX = 0, startY = 0, dx = 0, swiping = false, dirLocked = false;
    const reset = () => {
      content.style.transition = 'transform .2s';
      content.style.transform = 'translateX(0)';
      if (bg) bg.style.opacity = '0';
    };
    const onStart = e => {
      startX = e.touches ? e.touches[0].clientX : e.clientX;
      startY = e.touches ? e.touches[0].clientY : e.clientY;
      swiping = true; dirLocked = false; dx = 0; content._suppressClick = false;
    };
    const onMove = e => {
      if (!swiping) return;
      const x = e.touches ? e.touches[0].clientX : e.clientX;
      const y = e.touches ? e.touches[0].clientY : e.clientY;
      const ddx = x - startX, ddy = y - startY;
      // Direction lock: if vertical movement wins first, cancel swipe
      if (!dirLocked) {
        if (Math.abs(ddy) > Math.abs(ddx) && Math.abs(ddy) > 6) { swiping = false; reset(); return; }
        if (Math.abs(ddx) > 6) { dirLocked = true; content._suppressClick = true; }
        else return;
      }
      dx = Math.min(0, Math.max(-90, ddx));
      content.style.transition = 'none';
      content.style.transform = `translateX(${dx}px)`;
      if (bg) bg.style.opacity = String(Math.min(1, Math.abs(dx) / 70));
    };
    const onEnd = () => {
      if (!swiping) return;
      swiping = false;
      if (dx < -70) {
        content.style.transition = 'transform .2s';
        content.style.transform = 'translateX(-80px)';
        if (bg) bg.style.opacity = '1';
        const id = wrap.dataset.id;
        setTimeout(() => {
          deleteTransaction(id, () => App.rv(App.cv), () => App.rv(App.cv));
        }, 300);
      } else {
        reset();
      }
    };
    wrap.addEventListener('touchstart', onStart, { passive: true });
    wrap.addEventListener('touchmove', onMove, { passive: true });
    wrap.addEventListener('touchend', onEnd);
  });
}