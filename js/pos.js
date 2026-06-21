// ===== POS (Point of Sale) =====
const POS = {
  type: 'expense',
  cat: null,
  q: '',
  selCat: null,
  _pendingReceiptFile: null,
  _prepareReceiptImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX = 1400;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) { const r = Math.min(MAX/w, MAX/h); w = Math.round(w*r); h = Math.round(h*r); }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        resolve({ b64: dataUrl.split(',')[1], mimeType: 'image/jpeg' });
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('โหลดภาพไม่ได้')); };
      img.src = url;
    });
  },
  _isPinned(itemId) {
    return ((U.getConfig().pinnedItems) || []).includes(itemId);
  },
  _togglePin(itemId) {
    const pinned = (U.getConfig().pinnedItems || []).slice();
    const idx = pinned.indexOf(itemId);
    if (idx >= 0) pinned.splice(idx, 1); else pinned.push(itemId);
    U.updateConfig({ pinnedItems: pinned });
    App.rv('add');
  },
  _buildCatSection() {
    const cats = ST.getAll('categories');
    const displayCats = cats.filter(c => c.type === this.type);
    const selCatObj = this.selCat ? displayCats.find(c => c.id === this.selCat) : null;
    const selGroups = this.selCat ? ST.getAll('item_groups').filter(g => g.categoryId === this.selCat) : [];
    const selGroupsHTML = selGroups.map(g => `<div class="cat-card" data-group="${g.id}" data-group-name="${g.name}" data-group-icon="${g.icon||'📋'}">
      <div class="cat-color-strip" style="background:${selCatObj?.color||'var(--accent)'}"></div>
      <span class="cat-icon">${g.icon||'📋'}</span>
      <span class="cat-name">${g.name}</span>
    </div>`).join('');
    return this.selCat
      ? `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
          <button class="btn btn-outline btn-sm" id="btnBackCat" style="padding:5px 10px;font-size:.78rem">← กลับ</button>
          <span style="font-size:.9rem;font-weight:600">${selCatObj ? selCatObj.icon+' '+selCatObj.name : ''}</span>
        </div>
        <div class="pos-section-label">📋 หมวดรอง</div>
        <div class="pos-grid">
          ${selGroupsHTML}
          <div class="cat-card cat-card-custom" data-cat="custom" data-custom-cat="${this.selCat}">
            <div class="cat-color-strip" style="background:var(--accent)"></div>
            <span class="cat-icon">✏️</span>
            <span class="cat-name">กำหนดเอง</span>
          </div>
        </div>
        <div id="addGroupForm" style="display:none;gap:6px;align-items:center;margin-top:8px">
          <input type="text" id="newGroupName" placeholder="ชื่อหมวดรอง..." style="flex:1;font-size:.84rem">
          <input type="text" id="newGroupIcon" placeholder="🏷" style="width:46px;text-align:center;font-size:1.1rem">
          <button class="btn btn-sm btn-primary" id="btnSaveGroup">บันทึก</button>
          <button class="btn btn-sm btn-outline" id="btnCancelGroup">✕</button>
        </div>
        <button class="btn btn-outline btn-sm" id="btnAddGroup" style="width:100%;font-size:.74rem;margin-top:8px">⊕ เพิ่มหมวดรอง</button>`
      : `<div class="pos-section-label">📁 หมวดหมู่</div>
        <div class="pos-grid">
          ${displayCats.map(cat => {
            const bs = EH.getBudget(cat.id);
            return `<div class="cat-card" data-cat="${cat.id}">
              <div class="cat-color-strip" style="background:${cat.color}"></div>
              <span class="cat-icon">${cat.icon}</span>
              <span class="cat-name">${cat.name}</span>
              ${bs ? `<div class="bbar-wrap" style="margin-top:6px"><div class="bbar-fill ${bs.cls}" style="width:${bs.pct}%"></div></div>` : ''}
            </div>`;
          }).join('')}
          <div class="cat-card cat-card-custom" data-cat="custom">
            <div class="cat-color-strip" style="background:var(--accent)"></div>
            <span class="cat-icon">✏️</span>
            <span class="cat-name">กำหนดเอง</span>
          </div>
        </div>`;
  },
  _updateCatSection() {
    const el = document.getElementById('posCatSection');
    if (!el) { App.rv('add'); return; }
    el.innerHTML = this._buildCatSection();
    this._attachCatEvents();
  },
  _attachCatEvents() {
    document.querySelectorAll('.cat-card').forEach(card =>
      card.addEventListener('click', () => {
        const cid = card.dataset.cat;
        if (cid === 'custom') {
          this.openModal(null, card.dataset.customCat || null, null);
        } else {
          this.selCat = cid;
          this._updateCatSection();
        }
      })
    );
    document.getElementById('btnBackCat')?.addEventListener('click', () => {
      this.selCat = null;
      this._updateCatSection();
    });
    document.querySelectorAll('[data-group]').forEach(card => {
      card.addEventListener('click', () => {
        this.openModal(null, this.selCat, null, { groupId: card.dataset.group, subCatName: card.dataset.groupName, subCatIcon: card.dataset.groupIcon });
      });
    });
    document.getElementById('btnAddGroup')?.addEventListener('click', () => {
      const form = document.getElementById('addGroupForm');
      if (form) { form.style.display = 'flex'; document.getElementById('newGroupName')?.focus(); }
      document.getElementById('btnAddGroup').style.display = 'none';
    });
    document.getElementById('btnCancelGroup')?.addEventListener('click', () => {
      document.getElementById('addGroupForm').style.display = 'none';
      document.getElementById('btnAddGroup').style.display = '';
    });
    document.getElementById('btnSaveGroup')?.addEventListener('click', () => {
      const name = document.getElementById('newGroupName')?.value?.trim();
      const icon = document.getElementById('newGroupIcon')?.value?.trim() || '📋';
      if (!name) return;
      ST.add('item_groups', { name, icon, categoryId: this.selCat });
      this._updateCatSection();
    });
  },
  _seedGroups() {
    if (ST.getAll('item_groups').length > 0) return;
    [
      { categoryId:'cat_food', name:'มื้อเช้า', icon:'🌅' },
      { categoryId:'cat_food', name:'มื้อกลางวัน', icon:'☀️' },
      { categoryId:'cat_food', name:'มื้อเย็น', icon:'🌆' },
      { categoryId:'cat_food', name:'กาแฟ/เครื่องดื่ม', icon:'☕' },
      { categoryId:'cat_food', name:'ของว่าง', icon:'🍿' },
      { categoryId:'cat_food', name:'เดลิเวอรี่', icon:'🛵' },
      { categoryId:'cat_transport', name:'แท็กซี่/Grab', icon:'🚕' },
      { categoryId:'cat_transport', name:'ขนส่งสาธารณะ', icon:'🚇' },
      { categoryId:'cat_transport', name:'น้ำมัน', icon:'⛽' },
      { categoryId:'cat_transport', name:'ที่จอดรถ', icon:'🅿️' },
      { categoryId:'cat_shopping', name:'ซุปเปอร์มาร์เก็ต', icon:'🛒' },
      { categoryId:'cat_shopping', name:'ออนไลน์', icon:'📦' },
      { categoryId:'cat_shopping', name:'เสื้อผ้า', icon:'👔' },
      { categoryId:'cat_health', name:'ยา/วิตามิน', icon:'💊' },
      { categoryId:'cat_health', name:'หมอ/คลินิก', icon:'🏥' },
      { categoryId:'cat_entertain', name:'หนัง/ดนตรี', icon:'🎬' },
      { categoryId:'cat_entertain', name:'กีฬา', icon:'⚽' },
      { categoryId:'cat_bills', name:'ไฟฟ้า/น้ำ', icon:'💡' },
      { categoryId:'cat_bills', name:'อินเทอร์เน็ต/โทรศัพท์', icon:'📡' },
    ].forEach(d => ST.add('item_groups', d));
  },
  render() {
    const cats = ST.getAll('categories');
    const items = ST.getAll('items');
    const txns = ST.getAll('transactions');
    const cfg = U.getConfig();
    const today = U.today();
    const todayTxns = txns.filter(t => t.date === today);
    const sum = EH.calcSum(todayTxns);
    const streak = U.getStreak();
    const last7 = U.last7();
    const weekData = last7.map(d => ({
      date: d,
      expense: txns.filter(t => t.date === d && t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
    }));
    const maxW = Math.max(...weekData.map(w => w.expense), 1);
    const displayCats = cats.filter(c => c.type === this.type);
    const favItems = EH.getFavItems(this.type);

    const pinnedIds = U.getConfig().pinnedItems || [];
    const pinnedObjs = pinnedIds.map(id => ST.getById('items', id)).filter(it => {
      if (!it) return false;
      const cat = ST.getById('categories', it.categoryId);
      return cat && cat.type === this.type;
    });

    const pinnedHTML = pinnedObjs.length > 0 ?
      `<div style="margin-bottom:14px">
        <div class="pos-section-label">📌 ปักหมุด</div>
        <div class="pos-grid">
          ${pinnedObjs.map(it => `<div class="item-card ${this.type==='income'?'iinc':'iexp'}" style="border:2px solid var(--accent)" data-fav-id="${it.id}" data-fav-name="${it.name}" data-fav-amt="${it.defaultAmount}" data-fav-cat="${it.categoryId||''}">
            <button class="pin-btn pinned" data-pin="${it.id}">📌</button>
            <span class="item-icon">${it.icon}</span>
            <span class="item-name">${it.name}</span>
            ${it.defaultAmount > 0 ? `<span class="item-amount-sm">${U.fmtCurrency(it.defaultAmount, cfg.currency)}</span>` : ''}
            <button class="qa-btn" data-qa-fn="${it.id}" data-qa-n="${it.name}" data-qa-a="${it.defaultAmount}" data-qa-c="${it.categoryId||''}">+</button>
          </div>`).join('')}
        </div>
      </div>` : '';

    const _favCard = it => `<div class="item-card fav ${this.type==='income'?'iinc':'iexp'}" data-fav-id="${it.id||''}" data-fav-name="${it.name}" data-fav-amt="${it.defaultAmount}" data-fav-cat="${it.categoryId||''}">
            <span class="fav-star">⭐</span>
            <span class="use-cnt">${it.useCount}x</span>
            ${it.id && !this._isPinned(it.id) ? `<button class="pin-btn" data-pin="${it.id}" title="ปักหมุด">📌</button>` : ''}
            <span class="item-icon">${it.icon}</span>
            <span class="item-name">${it.name}</span>
            ${it.defaultAmount > 0 ? `<span class="item-amount-sm">${U.fmtCurrency(it.defaultAmount, cfg.currency)}</span>` : ''}
            <button class="qa-btn" data-qa-fn="${it.id||''}" data-qa-n="${it.name}" data-qa-a="${it.defaultAmount}" data-qa-c="${it.categoryId||''}">+</button>
          </div>`;
    const favExtra = favItems.slice(3);
    const favHTML = favItems.length > 0 ?
      `<div style="margin-bottom:14px">
        <div class="pos-section-label">⭐ ใช้บ่อย</div>
        <div class="pos-grid">${favItems.slice(0, 3).map(_favCard).join('')}</div>
        ${favExtra.length > 0 ? `<div class="pos-grid" id="favExtraGrid" style="display:none">${favExtra.map(_favCard).join('')}</div><button class="btn btn-outline btn-sm" id="btnFavMore" style="width:100%;margin-top:6px;font-size:.74rem">ดูเพิ่ม (${favExtra.length}) ▾</button>` : ''}
      </div>` : '';

    // Time-based suggestions — prefer what the user actually records at this time of day (#1),
    // fall back to a category-based hint when there isn't enough time history yet.
    let timeLabel = '', timeFavs = [];
    if (this.type === 'expense') {
      const sug = EH.getTimeSuggestions('expense');
      if (sug) { timeLabel = sug.label; timeFavs = sug.items; }
      else {
        const hour = new Date().getHours();
        const timeHints = hour >= 6 && hour < 10 ? { label: '🌅 ช่วงเช้า', cats: ['cat_food','cat_transport'] }
          : hour >= 10 && hour < 14 ? { label: '☀️ ช่วงเที่ยง', cats: ['cat_food'] }
          : hour >= 14 && hour < 17 ? { label: '🌤️ ช่วงบ่าย', cats: ['cat_food','cat_entertain'] }
          : hour >= 17 && hour < 21 ? { label: '🌆 ช่วงเย็น', cats: ['cat_food','cat_transport'] }
          : { label: '🌙 ช่วงค่ำ', cats: ['cat_food','cat_entertain'] };
        timeLabel = timeHints.label;
        timeFavs = favItems.filter(it => timeHints.cats.includes(it.categoryId)).slice(0, 4);
      }
    }
    const _sugCard = it => `<div class="item-card ${this.type==='income'?'iinc':'iexp'}" data-fav-id="${it.id||''}" data-fav-name="${it.name}" data-fav-amt="${it.defaultAmount}" data-fav-cat="${it.categoryId||''}">
        <span class="item-icon">${it.icon}</span><span class="item-name">${it.name}</span>
        ${it.defaultAmount > 0 ? `<span class="item-amount-sm">${U.fmtCurrency(it.defaultAmount, cfg.currency)}</span>` : ''}
        <button class="qa-btn" data-qa-fn="${it.id||''}" data-qa-n="${it.name}" data-qa-a="${it.defaultAmount}" data-qa-c="${it.categoryId||''}">+</button>
      </div>`;
    const sugExtra = timeFavs.slice(3);
    const timeSuggestHTML = timeFavs.length > 0 ? `<div style="margin-bottom:14px">
      <div class="pos-section-label">${timeLabel} แนะนำ</div>
      <div class="pos-grid">${timeFavs.slice(0, 3).map(_sugCard).join('')}</div>
      ${sugExtra.length > 0 ? `<div class="pos-grid" id="sugExtraGrid" style="display:none">${sugExtra.map(_sugCard).join('')}</div><button class="btn btn-outline btn-sm" id="btnSugMore" style="width:100%;margin-top:6px;font-size:.74rem">ดูเพิ่ม (${sugExtra.length}) ▾</button>` : ''}
    </div>` : '';

    // Compact today widget
    const todayWidget = todayTxns.length > 0 ? `<div class="today-widget">
      <div class="tw-totals">
        <div class="tw-total"><span class="tw-amt" style="color:var(--expense)">${U.fmtCurrency(sum.totalExpense, cfg.currency)}</span><span class="tw-lbl">รายจ่าย</span></div>
        <div class="tw-div"></div>
        <div class="tw-total"><span class="tw-amt" style="color:var(--income)">${U.fmtCurrency(sum.totalIncome, cfg.currency)}</span><span class="tw-lbl">รายรับ</span></div>
      </div>
      <div class="tw-quick">${[...todayTxns].reverse().slice(0, 3).map(t => {
        const cat = ST.getById('categories', t.categoryId) || { icon: '❓' };
        return `<button class="tw-item" data-dup="${t.id}" title="ซ้ำ: ${t.itemName||''} ${U.fmtCurrency(t.amount, cfg.currency)}">
          <span style="font-size:1.1rem">${cat.icon}</span>
          <span style="font-size:.6rem;color:var(--text-secondary)">${U.fmtCurrency(t.amount, cfg.currency)}</span>
        </button>`;
      }).join('')}</div>
    </div>` : '';

    const selCatObj = this.selCat ? displayCats.find(c => c.id === this.selCat) : null;
    const selGroups = this.selCat ? ST.getAll('item_groups').filter(g => g.categoryId === this.selCat) : [];
    const selGroupsHTML = selGroups.map(g => `<div class="cat-card" data-group="${g.id}" data-group-name="${g.name}" data-group-icon="${g.icon||'📋'}">
      <div class="cat-color-strip" style="background:${selCatObj?.color||'var(--accent)'}"></div>
      <span class="cat-icon">${g.icon||'📋'}</span>
      <span class="cat-name">${g.name}</span>
    </div>`).join('');
    const catSection = this.selCat
      ? `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
          <button class="btn btn-outline btn-sm" id="btnBackCat" style="padding:5px 10px;font-size:.78rem">← กลับ</button>
          <span style="font-size:.9rem;font-weight:600">${selCatObj ? selCatObj.icon+' '+selCatObj.name : ''}</span>
        </div>
        <div class="pos-section-label">📋 หมวดรอง</div>
        <div class="pos-grid">
          ${selGroupsHTML}
          <div class="cat-card cat-card-custom" data-cat="custom" data-custom-cat="${this.selCat}">
            <div class="cat-color-strip" style="background:var(--accent)"></div>
            <span class="cat-icon">✏️</span>
            <span class="cat-name">กำหนดเอง</span>
          </div>
        </div>
        <div id="addGroupForm" style="display:none;gap:6px;align-items:center;margin-top:8px">
          <input type="text" id="newGroupName" placeholder="ชื่อหมวดรอง..." style="flex:1;font-size:.84rem">
          <input type="text" id="newGroupIcon" placeholder="🏷" style="width:46px;text-align:center;font-size:1.1rem">
          <button class="btn btn-sm btn-primary" id="btnSaveGroup">บันทึก</button>
          <button class="btn btn-sm btn-outline" id="btnCancelGroup">✕</button>
        </div>
        <button class="btn btn-outline btn-sm" id="btnAddGroup" style="width:100%;font-size:.74rem;margin-top:8px">⊕ เพิ่มหมวดรอง</button>`
      : `<div class="pos-section-label">📁 หมวดหมู่</div>
        <div class="pos-grid">
          ${displayCats.map(cat => {
            const bs = EH.getBudget(cat.id);
            return `<div class="cat-card" data-cat="${cat.id}">
              <div class="cat-color-strip" style="background:${cat.color}"></div>
              <span class="cat-icon">${cat.icon}</span>
              <span class="cat-name">${cat.name}</span>
              ${bs ? `<div class="bbar-wrap" style="margin-top:6px"><div class="bbar-fill ${bs.cls}" style="width:${bs.pct}%"></div></div>` : ''}
            </div>`;
          }).join('')}
          <div class="cat-card cat-card-custom" data-cat="custom">
            <div class="cat-color-strip" style="background:var(--accent)"></div>
            <span class="cat-icon">✏️</span>
            <span class="cat-name">กำหนดเอง</span>
          </div>
        </div>`;
    const posContent = pinnedHTML + favHTML + timeSuggestHTML + todayWidget + '<div id="posCatSection">' + catSection + '</div>';

    const todayTxnHtml = todayTxns.length === 0 ?
      '<div style="text-align:center;color:var(--text-secondary);padding:12px;font-size:.8rem">ยังไม่มีรายการวันนี้</div>' :
      `<div style="display:flex;flex-direction:column;gap:3px;max-height:230px;overflow-y:auto" id="todayList">
        ${[...todayTxns].reverse().slice(0,12).map(t => {
          const cat = ST.getById('categories', t.categoryId) || { icon: '❓', color: '#ccc' };
          return `<div class="swipe-wrap" data-id="${t.id}">
            <div class="swipe-del-bg">🗑️</div>
            <div class="swipe-content txn-item">
              <span style="font-size:.92rem">${cat.icon}</span>
              <div style="flex:1;min-width:0">
                <div style="font-size:.74rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${EH.txnLabel(t)}</div>
                <div style="font-size:.62rem;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.time ? '🕐 '+t.time : ''}${(t.note && t.note !== 'undefined') ? (t.time ? ' · ' : '') + t.note : ''}</div>
              </div>
              <span style="font-size:.77rem;font-weight:700;color:${t.type==='income'?'var(--income)':'var(--expense)'};flex-shrink:0">${U.fmtCurrency(t.amount, cfg.currency)}</span>
              ${t.receiptUrl ? `<img src="${t.receiptUrl}" class="receipt-thumb" title="ดูใบเสร็จ" onclick="event.stopPropagation();window.open('${t.receiptUrl}','_blank')">` : ''}
              <button class="btn-ghost" style="padding:2px 3px;font-size:.68rem;color:var(--accent);flex-shrink:0" data-dup="${t.id}" title="ซ้ำรายการ">🔁</button>
              <button class="btn-ghost" style="padding:2px 3px;font-size:.68rem;flex-shrink:0" data-et="${t.id}" title="แก้ไข">✏️</button>
            </div>
          </div>`;
        }).join('')}
      </div>`;

    return `<div style="display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap">
      <div style="flex:1;min-width:270px">
        <div class="pos-section">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:11px;flex-wrap:wrap;gap:7px">
            <span style="font-size:.95rem;font-weight:700">${!this.cat ? (this.type==='expense'?'💸 บันทึกรายจ่าย':'💚 บันทึกรายรับ') : ''}</span>
            <div class="type-toggle">
              <button class="type-btn ${this.type==='expense'?'ae':''}" data-type="expense">รายจ่าย</button>
              <button class="type-btn ${this.type==='income'?'ai':''}" data-type="income">รายรับ</button>
            </div>
          </div>
          ${posContent}
          <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);display:flex;align-items:center;gap:8px">
            <label class="btn btn-outline btn-sm" style="cursor:pointer;font-size:.76rem" title="สแกนใบเสร็จด้วย AI">📷 สแกนใบเสร็จ<input type="file" id="receiptInput" accept="image/*" capture="environment" style="display:none"></label>
            <span id="receiptStatus" style="font-size:.72rem;color:var(--text-secondary)"></span>
          </div>
        </div>
      </div>
      <div class="pos-right-col">
        <div class="streak-widget">
          <span style="font-size:1.8rem">🔥</span>
          <div style="flex:1">
            <div style="display:flex;align-items:baseline;gap:5px"><span class="streak-count">${streak}</span><span class="streak-label">วันติดต่อกัน</span></div>
            <div class="streak-days">${last7.map(d => {
              const has = ST.getAll('transactions').some(t => t.date === d);
              const isT = d === today;
              return `<div class="sday ${isT?'today':has?'done':'miss'}">${U.getDayLabel(d)}</div>`;
            }).join('')}</div>
          </div>
        </div>
        <div class="card" style="margin-bottom:11px">
          <div class="card-header" style="margin-bottom:8px"><span class="card-title">📅 วันนี้</span><span style="font-size:.7rem;color:var(--text-secondary)">${U.fmtDateShort(today)}</span></div>
          <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:9px">
            <div style="display:flex;justify-content:space-between"><span style="font-size:.77rem;color:var(--text-secondary)">รายรับ</span><span style="font-weight:700;color:var(--income);font-size:.84rem">${U.fmtCurrency(sum.totalIncome, cfg.currency)}</span></div>
            <div style="display:flex;justify-content:space-between"><span style="font-size:.77rem;color:var(--text-secondary)">รายจ่าย</span><span style="font-weight:700;color:var(--expense);font-size:.84rem">${U.fmtCurrency(sum.totalExpense, cfg.currency)}</span></div>
            <div style="border-top:1px solid var(--border);padding-top:5px;display:flex;justify-content:space-between"><span style="font-size:.8rem;font-weight:600">คงเหลือ</span><span style="font-weight:700;color:${sum.balance>=0?'var(--income)':'var(--expense)'};font-size:.84rem">${U.fmtCurrency(sum.balance, cfg.currency)}</span></div>
          </div>
          <div style="font-size:.67rem;font-weight:600;color:var(--text-secondary);text-transform:uppercase;margin-bottom:4px">7 วันที่ผ่านมา</div>
          <div class="week-bars">${weekData.map(w => {
            const h = Math.round(w.expense / maxW * 100);
            return `<div class="wb-wrap"><div class="wb-bg"><div class="wb-fill ${w.date===today?'bover':'bok'}" style="height:${h}%"></div></div><div class="wb-lbl">${U.getDayLabel(w.date)}</div></div>`;
          }).join('')}</div>
        </div>
        <div class="card"><div class="card-title" style="margin-bottom:8px">🕐 ล่าสุดวันนี้</div>${todayTxnHtml}</div>
      </div>
    </div>`;
  },
  attachEvents() {
    document.querySelectorAll('.type-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        this.type = btn.dataset.type; this.cat = null; this.q = ''; this.selCat = null; App.rv('add');
      })
    );
    this._attachCatEvents();
    // Quick-account chip selection (just toggle the active chip, no full re-render)
    document.querySelectorAll('[data-qacc]').forEach(btn => btn.addEventListener('click', () => {
      this._setActiveAcc(btn.dataset.qacc);
      document.querySelectorAll('[data-qacc]').forEach(b => b.classList.toggle('active', b === btn));
    }));
    document.querySelectorAll('[data-pin]').forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation();
      this._togglePin(btn.dataset.pin);
    }));
    document.getElementById('btnFavMore')?.addEventListener('click', () => {
      const grid = document.getElementById('favExtraGrid');
      const btn = document.getElementById('btnFavMore');
      if (!grid) return;
      const open = grid.style.display === 'none';
      grid.style.display = open ? '' : 'none';
      if (btn) btn.textContent = open ? 'ซ่อน ▴' : `ดูเพิ่ม (${grid.children.length}) ▾`;
    });
    document.getElementById('btnSugMore')?.addEventListener('click', () => {
      const grid = document.getElementById('sugExtraGrid');
      const btn = document.getElementById('btnSugMore');
      if (!grid) return;
      const open = grid.style.display === 'none';
      grid.style.display = open ? '' : 'none';
      if (btn) btn.textContent = open ? 'ซ่อน ▴' : `ดูเพิ่ม (${grid.children.length}) ▾`;
    });
    document.querySelectorAll('.item-card.fav, .item-card[data-fav-id]').forEach(card => card.addEventListener('click', e => {
      if (e.target.closest('.qa-btn') || e.target.closest('.pin-btn')) return;
      const iid = card.dataset.favId;
      const item = iid ? ST.getById('items', iid) : null;
      const catId = (item ? item.categoryId : null) || card.dataset.favCat || null;
      this.openModal(item, catId, null);
    }));
    document.querySelectorAll('[data-qa-fn],[data-qa-n]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const iid = btn.dataset.qaFn; const name = btn.dataset.qaN; const amt = Number(btn.dataset.qaA) || 0; const cat = btn.dataset.qaC || '';
        const item = iid ? ST.getById('items', iid) : null;
        const label = item ? `${item.icon} ${item.name} ${U.fmtCurrency(item.defaultAmount)}` : `${name} ${U.fmtCurrency(amt)}`;
        const save = (acc) => {
          const _now = new Date().toTimeString().slice(0,5);
          if (item) {
            const tx = ST.add('transactions', { type: this.type, amount: item.defaultAmount, categoryId: item.categoryId, itemId: item.id, itemName: item.name, date: U.today(), time: _now, note: '', accountId: acc });
            window.__flashTxnId = tx.id;
            this._applyAcctDelta(acc, this.type, item.defaultAmount, false);
            if (acc) this._rememberItemAcc(item.id, acc);
            this.flash(`${item.icon} ${item.name} ${U.fmtCurrency(item.defaultAmount)}`);
          } else if (name) {
            const tx = ST.add('transactions', { type: this.type, amount: amt, categoryId: cat, itemName: name, date: U.today(), time: _now, note: '', accountId: acc });
            window.__flashTxnId = tx.id;
            this._applyAcctDelta(acc, this.type, amt, false);
            this.flash(`${name} ${U.fmtCurrency(amt)}`);
          }
          App.rv('add');
        };
        // Quick-add: let the user pick which account to pay from (fast popup of the
        // accounts configured in settings). Only for expenses with ≥1 quick account.
        const suggested = (item && item.accountId) || (item && this._itemAcc(item.id)) || this._activeAcc();
        if (this.type === 'expense' && this._quickAccs().length > 0) {
          this._quickAccPicker(label, suggested, save);
        } else {
          save(suggested);
        }
      });
    });
    document.querySelectorAll('[data-dup]').forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation();
      const t = ST.getById('transactions', btn.dataset.dup);
      if (!t) return;
      const { id, receiptUrl, installmentId, ...rest } = t;
      ST.add('transactions', { ...rest, date: U.today() });
      U.toast(`🔁 ซ้ำ: ${t.itemName || 'รายการ'} ✅`, 'success');
      App.rv('add');
    }));
    document.querySelectorAll('[data-et]').forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation();
      const txn = ST.getById('transactions', btn.dataset.et);
      if (txn) this.openModal(null, null, txn);
    }));
    document.querySelectorAll('[data-dt]').forEach(btn => btn.addEventListener('click', async e => {
      e.stopPropagation();
      const ok = await U.confirm('ลบรายการนี้?');
      if (ok) deleteTransaction(btn.dataset.dt, () => App.rv('add'), () => App.rv('add'));
    }));
    const tl = document.getElementById('todayList'); if (tl) initSwipe(tl);
    // Tap row to edit (skip taps on buttons or real swipes)
    document.querySelectorAll('#todayList .swipe-content').forEach(row => row.addEventListener('click', e => {
      if (e.target.closest('button,a,img')) return;
      if (row._suppressClick) { row._suppressClick = false; return; }
      const id = row.closest('.swipe-wrap')?.dataset.id;
      const txn = id ? ST.getById('transactions', id) : null;
      if (txn) this.openModal(null, null, txn);
    }));
    if (window.__flashTxnId) {
      const fr = document.querySelector(`#todayList .swipe-wrap[data-id="${window.__flashTxnId}"] .swipe-content`);
      if (fr) { fr.classList.add('row-flash'); fr.scrollIntoView({ block: 'nearest' }); }
      window.__flashTxnId = null;
    }
    document.getElementById('receiptInput')?.addEventListener('change', async (e) => {
      const file = e.target.files[0]; if (!file) return;
      const status = document.getElementById('receiptStatus');
      if (!AI._key()) { U.toast(AI._provider()==='gemini' ? 'กรุณาตั้งค่า Gemini API Key ก่อน' : 'กรุณาตั้งค่า Anthropic API Key ก่อน', 'error'); return; }
      if (status) { status.textContent = '🔄 กำลังวิเคราะห์...'; status.style.color = 'var(--accent)'; }
      try {
        const { b64, mimeType } = await POS._prepareReceiptImage(file);
        const expCats = ST.getAll('categories').filter(c => c.type === 'expense');
        const catList = expCats.map(c => `${c.id}:${c.name}`).join(', ');
        const text = await AI.vision(
          `จากรูปใบเสร็จหรือสลิปนี้ ตอบเป็น JSON เท่านั้น ไม่มีข้อความอื่น:\n{"amount":<ยอดรวม>,"name":"<ชื่อร้าน/รายการ>","date":"<YYYY-MM-DD หรือ null>","categoryId":"<id ที่เหมาะสม หรือ null>"}\nหมวดหมู่: ${catList}`,
          b64, mimeType, { maxTokens: 400 }
        );
        const match = text.match(/\{[\s\S]*?\}/);
        if (!match) throw new Error('parse');
        const data = JSON.parse(match[0]);
        if (status) { status.textContent = ''; status.style.color = ''; }
        this._pendingReceiptFile = file;
        e.target.value = '';
        this.openModal(null, data.categoryId || null, null, { amount: data.amount, name: data.name, date: data.date });
      } catch {
        if (status) { status.textContent = '⚠️ วิเคราะห์ไม่ได้ ลองใหม่'; status.style.color = 'var(--danger)'; }
        e.target.value = '';
      }
    });
  },
  flash(text) {
    const el = document.createElement('div'); el.className = 'qa-flash'; el.textContent = '✅ ' + text;
    document.body.appendChild(el); setTimeout(() => el.remove(), 2100);
  },
  // ── Quick account (บัญชีลัด) helpers ──
  _allAccs() {
    const wallets = ST.getAll('wallet_accounts').map(w => ({ id: w.id, icon: w.icon || '🏦', name: w.name, fav: !!w.fav }));
    const cards = ST.getAll('credit_cards').map(c => ({ id: c.id, icon: '💳', name: c.name, fav: !!c.fav }));
    return [...wallets, ...cards];
  },
  // Quick-access accounts for the quick-add/mini-numpad flows — starred on the accounts
  // page (☆/⭐), unlimited count. Falls back to all accounts for new users with none starred.
  _quickAccs() {
    const all = this._allAccs();
    const favs = all.filter(a => a.fav);
    return favs.length ? favs : all;
  },
  _activeAcc() {
    const id = localStorage.getItem('exp_activeAcc') || '';
    return id && this._allAccs().some(a => a.id === id) ? id : '';
  },
  _setActiveAcc(id) { localStorage.setItem('exp_activeAcc', id || ''); },
  // Remember which account an item was last paid from (#8)
  _itemAcc(itemId) { return itemId ? (U.getConfig().itemAccounts || {})[itemId] || '' : ''; },
  _rememberItemAcc(itemId, accId) {
    if (!itemId || !accId) return;
    const m = { ...(U.getConfig().itemAccounts || {}) }; m[itemId] = accId;
    U.updateConfig({ itemAccounts: m });
  },
  // Apply (or reverse) a transaction's effect on an account balance
  _applyAcctDelta(accountId, type, amount, reverse) {
    if (!accountId || !amount) return;
    const sign = reverse ? -1 : 1;
    const w = ST.getById('wallet_accounts', accountId);
    const cc = ST.getById('credit_cards', accountId);
    if (w) { const delta = (type === 'income' ? amount : -amount) * sign; ST.update('wallet_accounts', accountId, { balance: (w.balance || 0) + delta }); }
    else if (cc && type === 'expense') { ST.update('credit_cards', accountId, { used: Math.max(0, (cc.used || 0) + amount * sign) }); }
  },
  // Fast account picker shown when quick-adding (#) — choose which account to pay from,
  // using the accounts configured in settings. `suggested` is pre-highlighted.
  _quickAccPicker(label, suggested, onPick) {
    const accs = this._quickAccs();
    if (accs.length === 0) { onPick(this._activeAcc()); return; }
    const cfg = U.getConfig();
    const balOf = id => {
      const w = ST.getById('wallet_accounts', id); if (w) return U.fmtCurrency(w.balance || 0, cfg.currency);
      const cc = ST.getById('credit_cards', id); if (cc) return 'เครดิตเหลือ ' + U.fmtCurrency(Math.max(0, (cc.limit || 0) - (cc.used || 0)), cfg.currency);
      return '';
    };
    const o = document.createElement('div'); o.className = 'qap-overlay';
    o.innerHTML = `<div class="qap-sheet">
      <div class="qap-head">💸 ${label}<div class="qap-sub">ตัดจากบัญชีไหน?</div></div>
      ${accs.map(a => `<button class="qap-acc ${suggested === a.id ? 'sug' : ''}" data-acc="${a.id}"><span class="qap-acc-name">${a.icon} ${a.name}</span><span class="qap-bal">${balOf(a.id)}</span></button>`).join('')}
      <button class="qap-acc qap-none ${!suggested ? 'sug' : ''}" data-acc="">ไม่ระบุบัญชี</button>
      <button class="qap-cancel" id="qapCancel">ยกเลิก</button>
    </div>`;
    document.getElementById('modalRoot').appendChild(o);
    const close = () => o.remove();
    o.addEventListener('click', e => { if (e.target === o) close(); });
    o.querySelector('#qapCancel').onclick = close;
    o.querySelectorAll('.qap-acc').forEach(b => b.addEventListener('click', () => {
      this._setActiveAcc(b.dataset.acc); // remember choice as the new active default
      close();
      onPick(b.dataset.acc);
    }));
  },
  // Save-time account picker (#26): shown only when Save is pressed with no account chosen.
  // Tabs by account category (wallet/cash vs credit card) + a live search box.
  _fullAccPicker(onPick, type = 'expense') {
    const wallets = ST.getAll('wallet_accounts');
    const cards = type === 'expense' ? ST.getAll('credit_cards') : [];
    const cfg = U.getConfig();
    const isMobile = window.innerWidth <= 640;
    const hasBoth = wallets.length > 0 && cards.length > 0;
    const _row = (a, isCC) => {
      const bal = isCC ? `เครดิตเหลือ ${U.fmtCurrency(Math.max(0, (a.limit || 0) - (a.used || 0)), cfg.currency)}` : U.fmtCurrency(a.balance || 0, cfg.currency);
      return `<button type="button" class="facc-row" data-accid="${a.id}" data-name="${(a.name || '').toLowerCase()}"><span class="facc-ico">${isCC ? '💳' : (a.icon || '🏦')}</span><span class="facc-info"><span class="facc-name">${a.name}</span><span class="facc-bal">${bal}</span></span></button>`;
    };
    const walletsHTML = wallets.map(w => _row(w, false)).join('') || '<div class="facc-empty">ยังไม่มีบัญชี</div>';
    const cardsHTML = cards.map(c => _row(c, true)).join('') || '<div class="facc-empty">ยังไม่มีบัตรเครดิต</div>';
    const o = document.createElement('div'); o.className = isMobile ? 'bs-overlay' : 'modal-overlay';
    o.style.zIndex = 6000;
    o.innerHTML = `<div class="${isMobile ? 'bs-sheet' : 'modal'}" style="display:flex;flex-direction:column;max-height:85vh;overflow:hidden">
      <h3 style="flex:0 0 auto;margin:0 0 10px">💳 ตัดเงินจากบัญชีไหน?</h3>
      <input type="text" id="faccSearch" placeholder="🔍 ค้นหาบัญชี/บัตร..." style="flex:0 0 auto;margin-bottom:10px">
      ${hasBoth ? `<div class="facc-tabs" id="faccTabs" style="flex:0 0 auto"><button type="button" class="facc-tab active" data-fcat="wallets">🏦 บัญชี/เงินสด</button><button type="button" class="facc-tab" data-fcat="cards">💳 บัตรเครดิต</button></div>` : ''}
      <div style="flex:1;overflow-y:auto;min-height:0">
        <div id="faccWallets" class="facc-list">${walletsHTML}</div>
        <div id="faccCards" class="facc-list" style="${hasBoth ? 'display:none' : ''}">${cardsHTML}</div>
      </div>
      <div class="modal-actions" style="flex:0 0 auto"><button class="btn btn-outline" id="faccSkip">ไม่ระบุบัญชี</button><button class="btn btn-outline" id="faccCancel">ยกเลิก</button></div>
    </div>`;
    document.getElementById('modalRoot').appendChild(o);
    const close = () => o.remove();
    o.addEventListener('click', e => { if (e.target === o) close(); });
    o.querySelector('#faccCancel').onclick = close;
    o.querySelector('#faccSkip').onclick = () => { close(); onPick(''); };
    o.querySelectorAll('[data-accid]').forEach(btn => btn.addEventListener('click', () => { close(); onPick(btn.dataset.accid); }));
    const tabs = o.querySelectorAll('.facc-tab');
    const wp = o.querySelector('#faccWallets'); const cp = o.querySelector('#faccCards');
    tabs.forEach(tab => tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const isCards = tab.dataset.fcat === 'cards';
      wp.style.display = isCards ? 'none' : '';
      cp.style.display = isCards ? '' : 'none';
    }));
    const search = o.querySelector('#faccSearch');
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      const filtering = !!q;
      o.querySelectorAll('.facc-row').forEach(row => { row.style.display = !filtering || row.dataset.name.includes(q) ? '' : 'none'; });
      const tabsEl = o.querySelector('#faccTabs');
      if (filtering) {
        if (tabsEl) tabsEl.style.display = 'none';
        wp.style.display = ''; cp.style.display = '';
      } else if (tabsEl) {
        tabsEl.style.display = '';
        const isCards = o.querySelector('.facc-tab.active')?.dataset.fcat === 'cards';
        wp.style.display = isCards ? 'none' : ''; cp.style.display = isCards ? '' : 'none';
      }
    });
    setTimeout(() => search.focus(), 80);
  },
  _accBarHTML() {
    const accs = this._quickAccs();
    if (accs.length === 0) return '';
    const active = this._activeAcc();
    return `<div class="qacc-bar">
      <span class="qacc-lbl">ตัดจาก</span>
      ${accs.map(a => `<button class="qacc-chip ${active === a.id ? 'active' : ''}" data-qacc="${a.id}" title="${a.name}">${a.icon} ${a.name}</button>`).join('')}
      <button class="qacc-chip qacc-none ${!active ? 'active' : ''}" data-qacc="" title="ไม่ตัดบัญชี">ไม่ระบุ</button>
    </div>`;
  },
  // Frequently-used subcategory chips (#5) — pick groups under categories of the current type,
  // Subcategory chips shown inside the record modal, for the chosen main category (#3).
  // Ranked by how often a transaction was named after them. activeName highlights one.
  _modalSubcatsHTML(categoryId, activeId) {
    if (!categoryId) return '';
    const groups = ST.getAll('item_groups').filter(g => g.categoryId === categoryId);
    if (groups.length === 0) return '';
    const cat = ST.getById('categories', categoryId) || {};
    const color = cat.color || '#6366f1';
    const txns = ST.getAll('transactions');
    // Count by groupId (current schema) plus legacy txns that stored the subcat name into itemName.
    const cnt = {}; groups.forEach(g => { cnt[g.id] = txns.filter(t => t.groupId === g.id || (!t.groupId && t.itemName === g.name)).length; });
    const sorted = groups.slice().sort((a, b) => (cnt[b.id] || 0) - (cnt[a.id] || 0));
    return sorted.map(g => `<button type="button" class="subcat-chip ${activeId === g.id ? 'active' : ''}" data-sc-id="${g.id}" data-sc-name="${g.name.replace(/"/g, '&quot;')}" data-sc-icon="${g.icon || '📋'}" style="--sc-color:${color}"><span class="sc-ico">${g.icon || '📋'}</span><span class="sc-name">${g.name}</span></button>`).join('');
  },
  openModal(item, catId, editTxn, prefill = null) {
    const cats = ST.getAll('categories'); const cfg = U.getConfig();
    const isEdit = !!editTxn;
    const defCat = catId || (isEdit ? editTxn.categoryId : (this.type === 'expense' ? 'cat_food' : 'cat_salary'));
    // When the category is known from context (tapped item / subcategory / custom-with-category / edit),
    // the name-based auto-categorizer must NOT override it — e.g. item "อาหารหมา" under "ค่าเลี้ยงสัตว์"
    // was being forced back to "อาหาร". Locked also once the user picks a category manually.
    let catLocked = !!catId || isEdit;
    // Default account: when editing keep its own; otherwise prefer the item's remembered
    // account (#8), then the active quick account (#10).
    const defAcc = isEdit ? (editTxn.accountId || '') : ((item && item.accountId) || this._itemAcc(item && item.id) || this._activeAcc() || '');
    const defAmt = prefill?.amount || (item ? item.defaultAmount : (isEdit ? editTxn.amount : ''));
    // Subcategory name is shown as a placeholder hint, never written into the name field —
    // doing so used to make a subcategory indistinguishable from an unrelated item/favorite
    // sharing the same text. The actual link is defGroupId below.
    const defName = prefill?.name || (item ? item.name : (isEdit ? editTxn.itemName : ''));
    const defGroupId = prefill?.groupId || (isEdit ? (editTxn.groupId || '') : '');
    const defPlaceholder = prefill?.subCatName || 'เช่น ข้าวผัด, น้ำมัน...';
    const catQuickItems = !isEdit && defCat ? ST.getAll('items').filter(i => i.categoryId === defCat).slice(0, 10) : [];
    const t0 = isEdit ? editTxn.type : this.type;
    const presets = EH.getRecentAmounts(t0);
    const chipMap = {
      'cat_food': ['ร้านอาหาร', 'ห้าง', 'เดลิเวอรี่', 'ออนไลน์'],
      'cat_transport': ['ไปทำงาน', 'กลับบ้าน', 'ธุระ', 'ท่องเที่ยว'],
      'cat_shopping': ['ห้าง', 'ออนไลน์', 'ตลาด'],
      'cat_bills': ['รายเดือน', 'รายปี'],
      'cat_entertain': ['กับเพื่อน', 'กับครอบครัว']
    };
    const chips = chipMap[defCat] || ['ส่วนตัว', 'งาน', 'ครอบครัว'];
    let numVal = String(defAmt || '');
    const isMobile = window.innerWidth <= 640;
    const o = document.createElement('div'); o.className = isMobile ? 'bs-overlay' : 'modal-overlay';
    const _buildModalActions = () => `<div class="modal-actions" style="flex:0 0 auto;padding:12px 16px 14px;margin-top:0;border-top:1px solid var(--border)">${isEdit ? `<button class="btn btn-outline" id="mRecur" title="ตั้งเป็นรายการประจำ" style="margin-right:auto">🔄 ตั้งประจำ</button>` : ''}<button class="btn btn-outline" id="mCan">ยกเลิก</button><button class="btn ${t0==='expense'?'btn-expense':'btn-income'}" id="mSave">💾 บันทึก</button></div>`;
    const modalTitle = isEdit ? '✏️ แก้ไขรายการ' : item ? `${item.icon} ${item.name}` : prefill?.subCatName ? `${prefill.subCatIcon||'📋'} ${prefill.subCatName}` : '➕ เพิ่มรายการ';
    const buildModalHTML = () => isMobile
      ? `<div class="bs-sheet" style="display:flex;flex-direction:column;max-height:93vh;overflow:hidden"><div class="bs-handle" id="bsHandle"></div><h3 style="font-size:1rem;font-weight:600;margin:0 0 10px;flex:0 0 auto">${modalTitle}</h3><div style="flex:1;overflow-y:auto;overflow-x:hidden;min-height:0;padding:2px 0">${_buildModalBody()}</div>${_buildModalActions()}</div>`
      : `<div class="modal" style="display:flex;flex-direction:column;max-height:90vh"><h3 style="flex:0 0 auto">${modalTitle}</h3><div style="flex:1;overflow-y:auto;min-height:0">${_buildModalBody()}</div>${_buildModalActions()}</div>`;
    const _buildModalBody = () => `
      <div class="form-group"><label>ประเภท</label><div class="type-toggle"><button class="type-btn ${t0==='expense'?'ae':''}" data-mt="expense">รายจ่าย</button><button class="type-btn ${t0==='income'?'ai':''}" data-mt="income">รายรับ</button></div><input type="hidden" id="mT" value="${t0}"></div>
      <div class="form-group" id="mAccGrp"><label id="mAccLbl">บัญชี</label><div class="acc-select-grid" id="mAccSelect"><span style="font-size:.74rem;color:var(--text-secondary)">กำลังโหลด...</span></div><input type="hidden" id="mAccId" value="${defAcc}"></div>
      <div class="form-group"><label>จำนวนเงิน</label><div style="display:flex;gap:6px;align-items:center"><div class="amt-display focused" id="npDisp" style="flex:1">${U.fmtCurrency(Number(numVal)||0, cfg.currency)}</div><button class="btn-ghost" id="voiceBtn" title="พูดจำนวนเงิน" style="font-size:1.05rem;padding:6px 9px;border:1px solid var(--border);flex-shrink:0">🎤</button><button class="btn-ghost" id="splitBtn" title="แบ่งบิล" style="font-size:.75rem;padding:6px 8px;border:1px solid var(--border);flex-shrink:0;white-space:nowrap">÷ แบ่ง</button></div><div id="splitRow" style="display:none;flex-wrap:wrap;gap:6px;align-items:center;margin-top:6px;padding:8px;background:var(--bg-input);border-radius:8px"><span style="font-size:.78rem">แบ่ง</span><input type="number" id="splitN" value="2" min="2" max="20" style="width:55px;border:1px solid var(--border);border-radius:6px;padding:4px 6px;font-size:.85rem;background:var(--bg-card);color:var(--text)"><span style="font-size:.78rem">คน คนละ</span><span id="splitResult" style="font-weight:700;color:var(--accent);font-size:.88rem">-</span><button class="btn btn-sm btn-outline" id="splitApply" style="font-size:.74rem;padding:3px 10px">ใช้</button></div><div class="presets" id="mPresets">${presets.map(a => `<button class="preset-btn" data-pv="${a}">${U.fmtCurrency(a, cfg.currency)}</button>`).join('')}</div><div class="numpad">${['1','2','3','4','5','6','7','8','9'].map(n => `<button class="np" data-n="${n}">${n}</button>`).join('')}<button class="np np-del" data-n="del">⌫</button><button class="np" data-n="0">0</button><button class="np" data-n=".">.</button></div></div>
      <div class="form-group"><label>หมวดหมู่</label><select id="mC">${cats.map(c => `<option value="${c.id}" ${defCat===c.id?'selected':''}>${c.icon} ${c.name}</option>`).join('')}</select></div>
      <div class="form-group" id="mSubcatGrp" style="${this._modalSubcatsHTML(defCat, defGroupId) ? '' : 'display:none'}"><label style="font-size:.74rem;color:var(--text-secondary)">🏷 หมวดย่อย <span style="font-weight:400">· แตะเพื่อเลือก</span></label><div class="modal-subcats" id="mSubcats">${this._modalSubcatsHTML(defCat, defGroupId)}</div></div>
      ${catQuickItems.length > 0 ? `<div class="form-group"><label style="font-size:.74rem;color:var(--text-secondary)">รายการที่บันทึกไว้</label><div class="nchips" id="qiChips">${catQuickItems.map(it => `<button type="button" class="nchip qi-chip" data-qi-name="${it.name}" data-qi-amt="${it.defaultAmount||0}">${it.icon} ${it.name}</button>`).join('')}</div></div>` : ''}
      <div class="form-group"><label>ชื่อรายการ</label><input type="text" id="mN" value="${defName}" placeholder="${defPlaceholder}"><input type="hidden" id="mGroupId" value="${defGroupId}"></div>
      <div class="form-group" id="instToggleGrp" style="display:none"><label class="inst-toggle-row"><input type="checkbox" id="mInstToggle"><span>💳 ผ่อนชำระผ่านบัตรเครดิต</span></label></div>
      <div id="instFields" style="display:none"><div class="form-row"><div class="form-group"><label>จำนวนงวด</label><select id="mInstMonths"><option value="3">3 งวด</option><option value="6">6 งวด</option><option value="10" selected>10 งวด</option><option value="12">12 งวด</option><option value="24">24 งวด</option></select></div><div class="form-group"><label>ดอกเบี้ย %/ปี</label><input type="number" id="mInstRate" value="0" min="0" max="100" step="0.1" placeholder="0"></div></div><div class="form-group"><label>วันเริ่มผ่อน</label><input type="date" id="mInstStart" value="${isEdit?editTxn.date||U.today():U.today()}"></div><div id="instCalcBox" class="inst-summary" style="display:none"></div></div>
      <div class="form-group"><label>วันที่</label><input type="date" id="mD" value="${isEdit?editTxn.date:(prefill?.date||U.today())}"><div class="dshorts"><button class="dshort ${!isEdit?'active':''}" data-ds="today">วันนี้</button><button class="dshort" data-ds="yesterday">เมื่อวาน</button><button class="dshort" data-ds="2d">2 วันก่อน</button><button class="dshort" data-ds="3d">3 วันก่อน</button></div></div>
      <div class="form-group" id="mOutgoingGrp" style="${t0 !== 'expense' ? 'display:none' : ''}"><div style="display:flex;flex-direction:column;gap:6px"><label class="inst-toggle-row"><input type="checkbox" id="mReimburse" ${isEdit && editTxn && editTxn.reimbursable ? 'checked' : ''}><span>🔄 รอเบิกคืน <span style="font-size:.72rem;color:var(--text-secondary)">(จ่ายแทน เบิกทีหลัง)</span></span></label><label class="inst-toggle-row"><input type="checkbox" id="mLent" ${isEdit && editTxn && editTxn.lent ? 'checked' : ''}><span>🤝 ให้ยืม <span style="font-size:.72rem;color:var(--text-secondary)">(รอรับเงินคืน)</span></span></label><div id="mLentToGrp" style="${isEdit && editTxn && editTxn.lent ? '' : 'display:none'}"><input type="text" id="mLentTo" placeholder="ชื่อคนที่ยืม..." value="${isEdit && editTxn && editTxn.lentTo ? editTxn.lentTo : ''}" style="margin-top:5px"></div></div></div>
      <div class="form-group"><label>หมายเหตุ</label><textarea id="mNote" placeholder="หมายเหตุ...">${isEdit ? (editTxn.note && editTxn.note !== 'undefined' ? editTxn.note : '') : ''}</textarea><div class="nchips">${chips.map(ch => `<button class="nchip" data-ch="${ch}">${ch}</button>`).join('')}</div></div>
    `;
    o.innerHTML = buildModalHTML();
    document.getElementById('modalRoot').appendChild(o);
    const refreshDisp = () => {
      const el = o.querySelector('#npDisp'); if (el) el.textContent = U.fmtCurrency(Number(numVal) || 0, cfg.currency);
    };
    o.querySelectorAll('[data-mt]').forEach(btn => btn.addEventListener('click', () => {
      const t = btn.dataset.mt; o.querySelector('#mT').value = t;
      o.querySelectorAll('[data-mt]').forEach(b => {
        b.className = `type-btn ${b.dataset.mt===t?(t==='expense'?'ae':'ai'):''}`;
      });
      o.querySelector('#mSave').className = `btn ${t==='expense'?'btn-expense':'btn-income'}`;
      o.querySelector('#mAccLbl').textContent = t === 'income' ? 'บัญชีรับเงิน' : 'จ่ายจากบัญชี';
      attachAccSelEvents(o, t, checkInstVis);
      const outGrp = o.querySelector('#mOutgoingGrp');
      if (outGrp) outGrp.style.display = t === 'expense' ? '' : 'none';
      if (t === 'income') {
        const grp = o.querySelector('#instToggleGrp'); if (grp) grp.style.display = 'none';
        const tog = o.querySelector('#mInstToggle'); if (tog) tog.checked = false;
        const flds = o.querySelector('#instFields'); if (flds) flds.style.display = 'none';
        const reimb = o.querySelector('#mReimburse'); if (reimb) reimb.checked = false;
        const mLentCb = o.querySelector('#mLent'); if (mLentCb) mLentCb.checked = false;
        const mLentToGrp = o.querySelector('#mLentToGrp'); if (mLentToGrp) mLentToGrp.style.display = 'none';
      }
    }));
    setTimeout(() => {
      const lbl = o.querySelector('#mAccLbl'); if (lbl) lbl.textContent = t0 === 'income' ? 'บัญชีรับเงิน' : 'จ่ายจากบัญชี';
      attachAccSelEvents(o, t0, checkInstVis);
    }, 80);
    const checkInstVis = () => {
      const accId = o.querySelector('#mAccId')?.value;
      const type = o.querySelector('#mT')?.value;
      const isCC = accId ? !!ST.getById('credit_cards', accId) : false;
      const grp = o.querySelector('#instToggleGrp');
      if (!grp) return;
      const show = type === 'expense' && isCC;
      grp.style.display = show ? '' : 'none';
      if (!show) {
        const tog = o.querySelector('#mInstToggle'); if (tog) tog.checked = false;
        const flds = o.querySelector('#instFields'); if (flds) flds.style.display = 'none';
      }
    };
    const updateInstCalc = () => {
      const amt = parseFloat(numVal) || 0;
      const months = parseInt(o.querySelector('#mInstMonths')?.value) || 1;
      const rate = parseFloat(o.querySelector('#mInstRate')?.value) || 0;
      const monthly = EH.calcMonthlyPayment(amt, months, rate);
      const totalPayable = Math.round(monthly * months * 100) / 100;
      const totalInterest = Math.round((totalPayable - amt) * 100) / 100;
      const box = o.querySelector('#instCalcBox');
      if (!box) return;
      box.style.display = '';
      box.innerHTML = `<div style="display:flex;gap:10px;flex-wrap:wrap">
        <div style="flex:1;min-width:70px"><div class="btag">งวดละ</div><div style="font-weight:800;color:var(--accent);font-size:.94rem">${U.fmtCurrency(monthly, cfg.currency)}</div></div>
        <div style="flex:1;min-width:70px"><div class="btag">รวมทั้งหมด</div><div style="font-weight:700">${U.fmtCurrency(totalPayable, cfg.currency)}</div></div>
        ${totalInterest > 0 ? `<div style="flex:1;min-width:70px"><div class="btag">ดอกเบี้ยรวม</div><div style="font-weight:700;color:var(--expense)">${U.fmtCurrency(totalInterest, cfg.currency)}</div></div>` : `<div style="flex:1;min-width:70px"><div class="btag">ดอกเบี้ย</div><div style="font-weight:700;color:var(--success)">0% ✅</div></div>`}
      </div>`;
    };
    setTimeout(() => {
      const instToggle = o.querySelector('#mInstToggle');
      if (instToggle) instToggle.addEventListener('change', () => {
        const flds = o.querySelector('#instFields');
        if (flds) flds.style.display = instToggle.checked ? '' : 'none';
        if (instToggle.checked) updateInstCalc();
      });
      ['mInstMonths','mInstRate'].forEach(id => {
        o.querySelector(`#${id}`)?.addEventListener('change', () => { if (o.querySelector('#mInstToggle')?.checked) updateInstCalc(); });
      });
    }, 100);
    o.querySelectorAll('.np').forEach(btn => btn.addEventListener('click', () => {
      const n = btn.dataset.n;
      if (n === 'del') numVal = numVal.slice(0, -1);
      else if (n === '.' && !numVal.includes('.')) numVal += '.';
      else if (n !== '.' && numVal.length < 10) numVal += n;
      refreshDisp();
      o.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('sel'));
      if (o.querySelector('#mInstToggle')?.checked) setTimeout(() => { const f = o.querySelector('#mInstMonths'); if(f) f.dispatchEvent(new Event('change')); }, 0);
    }));
    o.querySelectorAll('.preset-btn').forEach(btn => btn.addEventListener('click', () => {
      numVal = btn.dataset.pv; refreshDisp();
      o.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('sel'));
      btn.classList.add('sel');
      if (o.querySelector('#mInstToggle')?.checked) setTimeout(() => { const f = o.querySelector('#mInstMonths'); if(f) f.dispatchEvent(new Event('change')); }, 0);
    }));
    o.querySelectorAll('[data-ds]').forEach(btn => btn.addEventListener('click', () => {
      const map = { today: U.today(), yesterday: U.yesterday(), '2d': U.daysAgo(2), '3d': U.daysAgo(3) };
      o.querySelector('#mD').value = map[btn.dataset.ds] || U.today();
      o.querySelectorAll('[data-ds]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    }));
    o.querySelectorAll('.qi-chip').forEach(chip => chip.addEventListener('click', () => {
      const name = chip.dataset.qiName; const amt = Number(chip.dataset.qiAmt);
      const nameEl = o.querySelector('#mN'); if (nameEl) nameEl.value = name;
      if (amt > 0) { numVal = String(amt); refreshDisp(); }
      o.querySelectorAll('.qi-chip').forEach(c => c.classList.toggle('active', c === chip));
    }));
    o.querySelectorAll('.nchip').forEach(ch => ch.addEventListener('click', () => {
      const el = o.querySelector('#mNote');
      el.value = el.value ? (el.value + ', ' + ch.dataset.ch) : ch.dataset.ch;
    }));
    o.querySelector('#mLent')?.addEventListener('change', () => {
      const grp = o.querySelector('#mLentToGrp');
      if (grp) grp.style.display = o.querySelector('#mLent')?.checked ? '' : 'none';
    });
    // Voice input — number extraction immediately, then AI parses full sentence if key available
    o.querySelector('#voiceBtn')?.addEventListener('click', () => {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) { U.toast('เบราว์เซอร์ไม่รองรับ Voice Input', 'error'); return; }
      const btn = o.querySelector('#voiceBtn');
      const rec = new SR(); rec.lang = 'th-TH'; rec.interimResults = false; rec.maxAlternatives = 1;
      btn.textContent = '🔴'; btn.style.color = 'var(--danger)';
      try { rec.start(); } catch { btn.textContent = '🎤'; btn.style.color = ''; return; }
      rec.onresult = async e => {
        const text = e.results[0][0].transcript;
        const num = text.replace(/,/g,'').match(/\d+\.?\d*/);
        if (num) { numVal = num[0]; refreshDisp(); }
        btn.textContent = '🎤'; btn.style.color = '';
        if (AI._key() && text.trim()) {
          btn.textContent = '🤖'; btn.style.color = 'var(--accent)';
          try {
            const cats = ST.getAll('categories');
            const catList = cats.map(c => `${c.id}:${c.name}`).join(', ');
            const today = U.today();
            const aiText = await AI.call(
              `คำพูด: "${text}"\nสกัดข้อมูลรายการเป็น JSON เท่านั้น:\n{"amount":0,"name":"","categoryId":"","date":"${today}"}\nหมวดหมู่: ${catList}\nวันนี้คือ ${today} (ถ้าไม่ระบุวันให้ใช้วันนี้)`,
              { maxTokens: 120 }
            );
            const m = aiText.match(/\{[\s\S]*?\}/);
            if (m) {
              const d = JSON.parse(m[0]);
              if (d.amount > 0) { numVal = String(d.amount); refreshDisp(); }
              if (d.name) { const el = o.querySelector('#mN'); if (el) el.value = d.name; }
              if (d.categoryId) { const el = o.querySelector('#mC'); if (el) el.value = d.categoryId; }
              if (d.date && d.date !== 'null' && d.date !== today) { const el = o.querySelector('#mD'); if (el) el.value = d.date; }
              U.toast(`🎤 AI: ${text}`, 'success');
            } else { U.toast(`🎤 ${text}`, 'info'); }
          } catch { U.toast(`🎤 ${text}`, 'info'); }
          btn.textContent = '🎤'; btn.style.color = '';
        } else if (num) { U.toast('🎤 ' + text, 'info'); }
      };
      rec.onerror = () => { btn.textContent = '🎤'; btn.style.color = ''; };
      rec.onend = () => { if (btn.textContent === '🔴') { btn.textContent = '🎤'; btn.style.color = ''; } };
    });
    // Split bill
    const _updateSplit = () => {
      const n = parseInt(o.querySelector('#splitN')?.value) || 2;
      const total = parseFloat(numVal) || 0;
      const r = o.querySelector('#splitResult'); if (r) r.textContent = total > 0 ? U.fmtCurrency(Math.ceil(total / n), cfg.currency) : '-';
    };
    o.querySelector('#splitBtn')?.addEventListener('click', () => {
      const sr = o.querySelector('#splitRow'); if (!sr) return;
      sr.style.display = sr.style.display === 'none' ? 'flex' : 'none';
      if (sr.style.display !== 'none') _updateSplit();
    });
    o.querySelector('#splitN')?.addEventListener('input', _updateSplit);
    o.querySelector('#splitApply')?.addEventListener('click', () => {
      const n = parseInt(o.querySelector('#splitN')?.value) || 2;
      const total = parseFloat(numVal) || 0;
      if (total > 0 && n > 1) { numVal = String(Math.ceil(total / n)); refreshDisp(); }
      const sr = o.querySelector('#splitRow'); if (sr) sr.style.display = 'none';
    });
    // Auto-categorize when item name typed
    const _CAT_RULES = [
      { id:'cat_food', words:['ข้าว','กาแฟ','ชา','อาหาร','ส้มตำ','ก๋วย','ชานม','หมู','ไก่','เนื้อ','ปลา','ผัด','ต้ม','แกง','ขนม','เค้ก','นม','โลตัส','บิ๊กซี','เซเว่น','7-eleven','7eleven','แมค','kfc','pizza','burger','sushi','ramen','ลาเต้','คาปู','สตาร์บัค','เดลิเวอรี','grab food','foodpanda'] },
      { id:'cat_transport', words:['น้ำมัน','ปั๊ม','แท็กซี่','grab','bolt','รถไฟ','bts','mrt','เรือ','จอดรถ','parking','ค่าทาง','tollway'] },
      { id:'cat_shopping', words:['เสื้อ','กางเกง','รองเท้า','กระเป๋า','lazada','shopee','amazon','ซื้อของ','เครื่องสำอาง','ของขวัญ'] },
      { id:'cat_bills', words:['ค่าไฟ','ค่าน้ำ','อินเตอร์เน็ต','เน็ต','โทรศัพท์','มือถือ','ค่าเช่า','ค่าบ้าน','ประกัน','ค่าส่ง','ค่าธรรมเนียม'] },
      { id:'cat_health', words:['หมอ','ยา','โรงพยาบาล','คลินิก','วิตามิน','สุขภาพ','ฟัน','ตา'] },
      { id:'cat_entertain', words:['ภาพยนตร์','หนัง','netflix','spotify','เกม','concert','ท่องเที่ยว','โรงแรม','สปา','บันเทิง','ดนตรี'] },
    ];
    o.querySelector('#mN')?.addEventListener('blur', async () => {
      if (catLocked) return; // respect category chosen from context or manually
      const name = (o.querySelector('#mN')?.value || '').toLowerCase();
      const sel = o.querySelector('#mC');
      if (!name || !sel) return;
      const allCatsLocal = ST.getAll('categories');
      let matched = false;
      for (const rule of _CAT_RULES) {
        if (rule.words.some(w => name.includes(w))) {
          const match = allCatsLocal.find(c => c.id === rule.id);
          if (match && sel.value !== match.id) { sel.value = match.id; U.toast(`💡 หมวด: ${match.icon} ${match.name}`, 'info'); }
          matched = true; break;
        }
      }
      if (!matched && AI._key() && name.length >= 2) {
        try {
          const expCats = allCatsLocal.filter(c => c.type === 'expense');
          const catList = expCats.map(c => `${c.id}:${c.icon}${c.name}`).join(', ');
          const result = await AI.call(`รายการ: "${name}"\nหมวดหมู่: ${catList}\nตอบ id หมวดหมู่ที่เหมาะสมที่สุดเพียงอย่างเดียว`, { maxTokens: 25 });
          const catId = result.trim().replace(/[^a-z0-9_]/g, '');
          const match = expCats.find(c => c.id === catId);
          if (match && sel.value !== match.id) { sel.value = match.id; U.toast(`🤖 AI หมวด: ${match.icon} ${match.name}`, 'info'); }
        } catch {}
      }
    });
    // Subcategory chips inside the modal (#3): refresh when the category changes,
    // tap to link the subcategory via #mGroupId (shown only as a placeholder hint —
    // never written into the name field, so it can't collide with item/favorite names).
    const _refreshSubcats = () => {
      const grp = o.querySelector('#mSubcatGrp'); const box = o.querySelector('#mSubcats');
      if (!grp || !box) return;
      const active = o.querySelector('#mGroupId')?.value || '';
      const html = this._modalSubcatsHTML(o.querySelector('#mC')?.value, active);
      box.innerHTML = html;
      grp.style.display = html ? '' : 'none';
    };
    o.querySelector('#mSubcats')?.addEventListener('click', e => {
      const chip = e.target.closest('.subcat-chip'); if (!chip) return;
      const groupIdEl = o.querySelector('#mGroupId');
      const nameEl = o.querySelector('#mN');
      const wasActive = groupIdEl && groupIdEl.value === chip.dataset.scId;
      if (groupIdEl) groupIdEl.value = wasActive ? '' : chip.dataset.scId;
      if (nameEl) nameEl.placeholder = wasActive ? 'เช่น ข้าวผัด, น้ำมัน...' : chip.dataset.scName;
      catLocked = true;
      o.querySelectorAll('#mSubcats .subcat-chip').forEach(c => c.classList.toggle('active', !wasActive && c === chip));
    });
    // Category pre-fill amount from history
    o.querySelector('#mC')?.addEventListener('change', () => {
      catLocked = true; // user chose a category — stop auto-categorize from overriding
      const groupIdEl = o.querySelector('#mGroupId'); if (groupIdEl) groupIdEl.value = '';
      const nameEl = o.querySelector('#mN'); if (nameEl) nameEl.placeholder = 'เช่น ข้าวผัด, น้ำมัน...';
      _refreshSubcats();
      if (parseFloat(numVal) > 0) return;
      const catId = o.querySelector('#mC').value;
      const catTxns = ST.getAll('transactions').filter(t => t.categoryId === catId && Number(t.amount) > 0);
      if (!catTxns.length) return;
      const freq = {};
      catTxns.forEach(t => { const a = String(t.amount); freq[a] = (freq[a] || 0) + 1; });
      const topAmt = Object.entries(freq).sort((a,b) => b[1] - a[1])[0]?.[0];
      if (topAmt) { numVal = topAmt; refreshDisp(); U.toast('💡 แนะนำจากประวัติ', 'info'); }
    });
    o.querySelector('#mCan').onclick = () => o.remove();
    o.onclick = e => { if (e.target === o) o.remove(); };
    o.querySelector('#bsHandle')?.addEventListener('click', () => o.remove());
    o.querySelector('#mRecur')?.addEventListener('click', () => {
      if (!isEdit || typeof RV === 'undefined') return;
      o.remove();
      App.rv('recurring');
      setTimeout(() => RV.openModal({ name: editTxn.itemName || '', type: editTxn.type, amount: editTxn.amount, categoryId: editTxn.categoryId, dayOfMonth: new Date(editTxn.date).getDate() }), 200);
    });
    o.querySelector('#mSave').onclick = () => {
      const type = o.querySelector('#mT').value;
      const amount = parseFloat(numVal);
      const categoryId = o.querySelector('#mC').value;
      const itemName = o.querySelector('#mN').value.trim();
      const groupId = o.querySelector('#mGroupId')?.value || '';
      const date = o.querySelector('#mD').value;
      const note = (o.querySelector('#mNote')?.value || '').trim().replace(/^undefined$/i, '');
      const rawAccountId = o.querySelector('#mAccId')?.value || '';
      if (!amount || amount <= 0) { U.toast('กรุณากรอกจำนวนเงิน', 'error'); return; }
      if (!date) { U.toast('กรุณาเลือกวันที่', 'error'); return; }
      // No account chosen yet — ask which account/card to deduct from (or receive into) before saving (#26).
      if (!rawAccountId) {
        this._fullAccPicker(picked => { o.querySelector('#mAccId').value = picked; doSave(picked); }, type);
        return;
      }
      doSave(rawAccountId);
    };
    const doSave = (accountId) => {
      const type = o.querySelector('#mT').value;
      const amount = parseFloat(numVal);
      const categoryId = o.querySelector('#mC').value;
      const itemName = o.querySelector('#mN').value.trim();
      const groupId = o.querySelector('#mGroupId')?.value || '';
      const date = o.querySelector('#mD').value;
      const note = (o.querySelector('#mNote')?.value || '').trim().replace(/^undefined$/i, '');
      if (isEdit) {
        if (editTxn.accountId) {
          const oldAcc = ST.getById('wallet_accounts', editTxn.accountId);
          const oldCC = ST.getById('credit_cards', editTxn.accountId);
          if (oldAcc) {
            const rev = editTxn.type === 'income' ? -Number(editTxn.amount) : Number(editTxn.amount);
            ST.update('wallet_accounts', editTxn.accountId, { balance: (oldAcc.balance || 0) + rev });
          }
          if (oldCC && editTxn.type === 'expense') {
            ST.update('credit_cards', editTxn.accountId, { used: Math.max(0, (oldCC.used || 0) - Number(editTxn.amount)) });
          }
        }
        const reimbEdit = type === 'expense' && !!(o.querySelector('#mReimburse')?.checked);
        const lentEdit = type === 'expense' && !!(o.querySelector('#mLent')?.checked);
        const lentToEdit = lentEdit ? (o.querySelector('#mLentTo')?.value || '') : '';
        ST.update('transactions', editTxn.id, { type, amount, categoryId, itemName, groupId, date, note, accountId, reimbursable: reimbEdit, reimburseStatus: reimbEdit ? (editTxn.reimburseStatus || 'pending') : '', lent: lentEdit, lentStatus: lentEdit ? (editTxn.lentStatus || 'pending') : '', lentTo: lentToEdit });
        window.__flashTxnId = editTxn.id;
      } else {
        const isInstCC = type === 'expense' && accountId ? !!ST.getById('credit_cards', accountId) : false;
        const instEnabled = isInstCC && !!(o.querySelector('#mInstToggle')?.checked);
        const instMonths = parseInt(o.querySelector('#mInstMonths')?.value) || 0;
        const instRate = parseFloat(o.querySelector('#mInstRate')?.value) || 0;
        const instStart = o.querySelector('#mInstStart')?.value || date;
        const reimbursable = type === 'expense' && !!(o.querySelector('#mReimburse')?.checked);
        const lent = type === 'expense' && !!(o.querySelector('#mLent')?.checked);
        const lentTo = lent ? (o.querySelector('#mLentTo')?.value || '') : '';
        const newTxn = ST.add('transactions', { type, amount, categoryId, itemId: item ? item.id : '', itemName, groupId, date, time: new Date().toTimeString().slice(0,5), note, accountId, installment: instEnabled, reimbursable, reimburseStatus: reimbursable ? 'pending' : '', lent, lentStatus: lent ? 'pending' : '', lentTo });
        window.__flashTxnId = newTxn.id;
        // Upload pending receipt image to Firebase Storage
        const pendingFile = POS._pendingReceiptFile;
        POS._pendingReceiptFile = null;
        if (pendingFile && typeof CloudSync !== 'undefined' && CloudSync.isLoggedIn()) {
          U.toast('📤 กำลังอัปโหลดใบเสร็จ...', 'info');
          CloudSync.uploadReceipt(pendingFile, newTxn.id).then(url => {
            if (url) { ST.update('transactions', newTxn.id, { receiptUrl: url }); App.rv('add'); }
          });
        } else {
          POS._pendingReceiptFile = null;
        }
        if (instEnabled && instMonths > 0) {
          const monthly = EH.calcMonthlyPayment(amount, instMonths, instRate);
          const instRec = ST.add('installments', {
            transactionId: newTxn.id, creditCardId: accountId,
            itemName: itemName || (item ? item.name : 'รายการ'),
            totalAmount: amount, numberOfMonths: instMonths, interestRate: instRate,
            monthlyPayment: monthly, paidMonths: 0, remainingMonths: instMonths,
            startDate: instStart, nextDueDate: EH.calcInstNextDue(instStart, 0),
            status: 'active', note
          });
          ST.update('transactions', newTxn.id, { installmentId: instRec.id });
        }
      }
      if (accountId) {
        const acc = ST.getById('wallet_accounts', accountId);
        const cc = ST.getById('credit_cards', accountId);
        if (acc) {
          const delta = type === 'income' ? amount : -amount;
          ST.update('wallet_accounts', accountId, { balance: (acc.balance || 0) + delta });
        } else if (cc && type === 'expense') {
          ST.update('credit_cards', accountId, { used: (cc.used || 0) + amount });
        }
      }
      if (item && item.id && accountId) POS._rememberItemAcc(item.id, accountId);
      U.toast(isEdit ? 'อัปเดตแล้ว ✅' : 'บันทึกแล้ว ✅', 'success');
      o.remove();
      App.rv(App.cv === 'transactions' ? 'transactions' : 'add');
    };
  }
};