// ===== POS (Point of Sale) =====
const POS = {
  type: 'expense',
  cat: null,
  q: '',
  _pendingReceiptFile: null,
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

    const favHTML = favItems.length > 0 ?
      `<div style="margin-bottom:14px">
        <div class="pos-section-label">⭐ ใช้บ่อย</div>
        <div class="pos-grid">
          ${favItems.map(it => `<div class="item-card fav ${this.type==='income'?'iinc':'iexp'}" data-fav-id="${it.id||''}" data-fav-name="${it.name}" data-fav-amt="${it.defaultAmount}" data-fav-cat="${it.categoryId||''}">
            <span class="fav-star">⭐</span>
            <span class="use-cnt">${it.useCount}x</span>
            <span class="item-icon">${it.icon}</span>
            <span class="item-name">${it.name}</span>
            <button class="qa-btn" data-qa-fn="${it.id||''}" data-qa-n="${it.name}" data-qa-a="${it.defaultAmount}" data-qa-c="${it.categoryId||''}">+</button>
          </div>`).join('')}
        </div>
      </div>` : '';

    const posContent = pinnedHTML + favHTML +
      `<div class="pos-section-label">📁 หมวดหมู่</div>
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

    const todayTxnHtml = todayTxns.length === 0 ?
      '<div style="text-align:center;color:var(--text-secondary);padding:12px;font-size:.8rem">ยังไม่มีรายการวันนี้</div>' :
      `<div style="display:flex;flex-direction:column;gap:3px;max-height:230px;overflow-y:auto" id="todayList">
        ${todayTxns.slice(0,12).map(t => {
          const cat = ST.getById('categories', t.categoryId) || { icon: '❓', color: '#ccc' };
          return `<div class="swipe-wrap" data-id="${t.id}">
            <div class="swipe-del-bg">🗑️</div>
            <div class="swipe-content txn-item">
              <span style="font-size:.92rem">${cat.icon}</span>
              <div style="flex:1;min-width:0">
                <div style="font-size:.74rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.itemName || cat.name || 'รายการ'}</div>
                ${t.note ? `<div style="font-size:.64rem;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.note}</div>` : ''}
              </div>
              <span style="font-size:.77rem;font-weight:700;color:${t.type==='income'?'var(--income)':'var(--expense)'};flex-shrink:0">${U.fmtCurrency(t.amount, cfg.currency)}</span>
              ${t.receiptUrl ? `<img src="${t.receiptUrl}" class="receipt-thumb" title="ดูใบเสร็จ" onclick="event.stopPropagation();window.open('${t.receiptUrl}','_blank')">` : ''}
              <button class="btn-ghost" style="padding:2px 3px;font-size:.68rem;flex-shrink:0" data-et="${t.id}">✏️</button>
              <button class="btn-ghost" style="padding:2px 3px;font-size:.68rem;color:var(--danger);flex-shrink:0" data-dt="${t.id}">🗑️</button>
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
        this.type = btn.dataset.type; this.cat = null; this.q = ''; App.rv('add');
      })
    );
    document.querySelectorAll('.cat-card').forEach(card =>
      card.addEventListener('click', () => {
        const cid = card.dataset.cat;
        this.openModal(null, cid === 'custom' ? null : cid, null);
      })
    );
    document.querySelectorAll('[data-pin]').forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation();
      this._togglePin(btn.dataset.pin);
    }));
    document.querySelectorAll('.item-card.fav, .item-card[data-fav-id]').forEach(card => card.addEventListener('click', e => {
      if (e.target.closest('.qa-btn') || e.target.closest('.pin-btn')) return;
      const iid = card.dataset.favId;
      const item = iid ? ST.getById('items', iid) : null;
      this.openModal(item, item ? item.categoryId : null, null);
    }));
    document.querySelectorAll('[data-qa-fn],[data-qa-n]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const iid = btn.dataset.qaFn; const name = btn.dataset.qaN; const amt = Number(btn.dataset.qaA) || 0; const cat = btn.dataset.qaC || '';
        const item = iid ? ST.getById('items', iid) : null;
        if (item) {
          ST.add('transactions', { type: this.type, amount: item.defaultAmount, categoryId: item.categoryId, itemId: item.id, itemName: item.name, date: U.today(), note: '' });
          this.flash(`${item.icon} ${item.name} ${U.fmtCurrency(item.defaultAmount)}`);
        } else if (name) {
          ST.add('transactions', { type: this.type, amount: amt, categoryId: cat, itemName: name, date: U.today(), note: '' });
          this.flash(`${name} ${U.fmtCurrency(amt)}`);
        }
        App.rv('add');
      });
    });
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
    document.getElementById('receiptInput')?.addEventListener('change', async (e) => {
      const file = e.target.files[0]; if (!file) return;
      const status = document.getElementById('receiptStatus');
      if (!AI._key()) { U.toast(AI._provider()==='gemini' ? 'กรุณาตั้งค่า Gemini API Key ก่อน' : 'กรุณาตั้งค่า Anthropic API Key ก่อน', 'error'); return; }
      if (status) status.textContent = '🔄 กำลังวิเคราะห์...';
      try {
        const b64 = await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.readAsDataURL(file); });
        const text = await AI.vision('จากรูปใบเสร็จนี้ ตอบเป็น JSON เท่านั้น ไม่มีข้อความอื่น: {"amount": <ตัวเลขยอดรวม>, "name": "<ชื่อร้าน/รายการ>", "date": "<YYYY-MM-DD หรือ null>"}', b64, file.type, { maxTokens: 256 });
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) throw new Error('parse');
        const data = JSON.parse(match[0]);
        if (status) status.textContent = '';
        this._pendingReceiptFile = file;
        e.target.value = '';
        this.openModal(null, null, null, { amount: data.amount, name: data.name, date: data.date });
      } catch {
        if (status) status.textContent = '⚠️ วิเคราะห์ไม่ได้ ลองใหม่';
        e.target.value = '';
      }
    });
  },
  flash(text) {
    const el = document.createElement('div'); el.className = 'qa-flash'; el.textContent = '✅ ' + text;
    document.body.appendChild(el); setTimeout(() => el.remove(), 2100);
  },
  openModal(item, catId, editTxn, prefill = null) {
    const cats = ST.getAll('categories'); const cfg = U.getConfig();
    const isEdit = !!editTxn;
    const defCat = catId || (isEdit ? editTxn.categoryId : (this.type === 'expense' ? 'cat_food' : 'cat_salary'));
    const defAmt = prefill?.amount || (item ? item.defaultAmount : (isEdit ? editTxn.amount : ''));
    const defName = prefill?.name || (item ? item.name : (isEdit ? editTxn.itemName : ''));
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
    const buildModalHTML = () => isMobile
      ? `<div class="bs-sheet"><div class="bs-handle" id="bsHandle"></div><h3 style="font-size:1rem;font-weight:600;margin-bottom:14px">${isEdit ? '✏️ แก้ไขรายการ' : item ? `${item.icon} ${item.name}` : '➕ เพิ่มรายการ'}</h3>${_buildModalBody()}</div>`
      : `<div class="modal"><h3>${isEdit ? '✏️ แก้ไขรายการ' : item ? `${item.icon} ${item.name}` : '➕ เพิ่มรายการ'}</h3>${_buildModalBody()}</div>`;
    const _buildModalBody = () => `
      <div class="form-group"><label>ประเภท</label><div class="type-toggle"><button class="type-btn ${t0==='expense'?'ae':''}" data-mt="expense">รายจ่าย</button><button class="type-btn ${t0==='income'?'ai':''}" data-mt="income">รายรับ</button></div><input type="hidden" id="mT" value="${t0}"></div>
      <div class="form-group"><label>จำนวนเงิน</label><div class="amt-display focused" id="npDisp">${U.fmtCurrency(Number(numVal)||0, cfg.currency)}</div><div class="presets" id="mPresets">${presets.map(a => `<button class="preset-btn" data-pv="${a}">${U.fmtCurrency(a, cfg.currency)}</button>`).join('')}</div><div class="numpad">${['7','8','9','4','5','6','1','2','3'].map(n => `<button class="np" data-n="${n}">${n}</button>`).join('')}<button class="np np-del" data-n="del">⌫</button><button class="np" data-n="0">0</button><button class="np" data-n=".">.</button></div></div>
      <div class="form-group"><label>หมวดหมู่</label><select id="mC">${cats.map(c => `<option value="${c.id}" ${defCat===c.id?'selected':''}>${c.icon} ${c.name}</option>`).join('')}</select></div>
      ${catQuickItems.length > 0 ? `<div class="form-group"><label style="font-size:.74rem;color:var(--text-secondary)">รายการที่บันทึกไว้</label><div class="nchips" id="qiChips">${catQuickItems.map(it => `<button type="button" class="nchip qi-chip" data-qi-name="${it.name}" data-qi-amt="${it.defaultAmount||0}">${it.icon} ${it.name}</button>`).join('')}</div></div>` : ''}
      <div class="form-group"><label>ชื่อรายการ</label><input type="text" id="mN" value="${defName}" placeholder="เช่น ข้าวผัด, น้ำมัน..."></div>
      <div class="form-group" id="mAccGrp"><label id="mAccLbl">บัญชี</label><div class="acc-select-grid" id="mAccSelect"><span style="font-size:.74rem;color:var(--text-secondary)">กำลังโหลด...</span></div><input type="hidden" id="mAccId" value="${isEdit?editTxn.accountId||'':''}"></div>
      <div class="form-group" id="instToggleGrp" style="display:none"><label class="inst-toggle-row"><input type="checkbox" id="mInstToggle"><span>💳 ผ่อนชำระผ่านบัตรเครดิต</span></label></div>
      <div id="instFields" style="display:none"><div class="form-row"><div class="form-group"><label>จำนวนงวด</label><select id="mInstMonths"><option value="3">3 งวด</option><option value="6">6 งวด</option><option value="10" selected>10 งวด</option><option value="12">12 งวด</option><option value="24">24 งวด</option></select></div><div class="form-group"><label>ดอกเบี้ย %/ปี</label><input type="number" id="mInstRate" value="0" min="0" max="100" step="0.1" placeholder="0"></div></div><div class="form-group"><label>วันเริ่มผ่อน</label><input type="date" id="mInstStart" value="${isEdit?editTxn.date||U.today():U.today()}"></div><div id="instCalcBox" class="inst-summary" style="display:none"></div></div>
      <div class="form-group"><label>วันที่</label><input type="date" id="mD" value="${isEdit?editTxn.date:(prefill?.date||U.today())}"><div class="dshorts"><button class="dshort ${!isEdit?'active':''}" data-ds="today">วันนี้</button><button class="dshort" data-ds="yesterday">เมื่อวาน</button><button class="dshort" data-ds="2d">2 วันก่อน</button><button class="dshort" data-ds="3d">3 วันก่อน</button></div></div>
      <div class="form-group"><label>หมายเหตุ</label><textarea id="mNote" placeholder="หมายเหตุ...">${isEdit?editTxn.note||'':''}</textarea><div class="nchips">${chips.map(ch => `<button class="nchip" data-ch="${ch}">${ch}</button>`).join('')}</div></div>
      <div class="modal-actions"><button class="btn btn-outline" id="mCan">ยกเลิก</button><button class="btn ${t0==='expense'?'btn-expense':'btn-income'}" id="mSave">💾 บันทึก</button></div>
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
      if (t === 'income') {
        const grp = o.querySelector('#instToggleGrp'); if (grp) grp.style.display = 'none';
        const tog = o.querySelector('#mInstToggle'); if (tog) tog.checked = false;
        const flds = o.querySelector('#instFields'); if (flds) flds.style.display = 'none';
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
    o.querySelector('#mCan').onclick = () => o.remove();
    o.onclick = e => { if (e.target === o) o.remove(); };
    o.querySelector('#bsHandle')?.addEventListener('click', () => o.remove());
    o.querySelector('#mSave').onclick = () => {
      const type = o.querySelector('#mT').value;
      const amount = parseFloat(numVal);
      const categoryId = o.querySelector('#mC').value;
      const itemName = o.querySelector('#mN').value.trim();
      const date = o.querySelector('#mD').value;
      const note = o.querySelector('#mNote').value;
      const accountId = o.querySelector('#mAccId')?.value || '';
      if (!amount || amount <= 0) { U.toast('กรุณากรอกจำนวนเงิน', 'error'); return; }
      if (!date) { U.toast('กรุณาเลือกวันที่', 'error'); return; }
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
        ST.update('transactions', editTxn.id, { type, amount, categoryId, itemName, date, note, accountId });
      } else {
        const isInstCC = type === 'expense' && accountId ? !!ST.getById('credit_cards', accountId) : false;
        const instEnabled = isInstCC && !!(o.querySelector('#mInstToggle')?.checked);
        const instMonths = parseInt(o.querySelector('#mInstMonths')?.value) || 0;
        const instRate = parseFloat(o.querySelector('#mInstRate')?.value) || 0;
        const instStart = o.querySelector('#mInstStart')?.value || date;
        const newTxn = ST.add('transactions', { type, amount, categoryId, itemId: item ? item.id : '', itemName, date, note, accountId, installment: instEnabled });
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
      U.toast(isEdit ? 'อัปเดตแล้ว ✅' : 'บันทึกแล้ว ✅', 'success');
      o.remove();
      App.rv('add');
    };
  }
};