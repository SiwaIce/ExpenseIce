// ===== ACCOUNTS & CREDIT CARDS =====
const AccountsView = {
  render() {
    const wallets = ST.getAll('wallet_accounts');
    const cards = ST.getAll('credit_cards');
    const txns = ST.getAll('transactions');
    const cfg = U.getConfig();
    const totalWallet = wallets.reduce((s, w) => s + Number(w.balance), 0);
    const totalDebt = cards.reduce((s, c) => s + Number(c.used || 0), 0);
    const walletHTML = wallets.length === 0 ?
      '<div class="empty-state"><div class="empty-icon">🏦</div>เพิ่มบัญชีแรกของคุณ</div>' :
      `<div class="acc-grid">${wallets.map(w => {
        const inc = txns.filter(t => t.accountId === w.id && t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
        const exp = txns.filter(t => t.accountId === w.id && t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
        const wtypeLabel = { cash: 'เงินสด', bank: 'ธนาคาร', digital: 'กระเป๋าเงิน', saving: 'ออมทรัพย์' }[w.wtype] || w.wtype;
        return `<div class="acc-card"><div class="acc-type-bar" style="background:${w.color}"></div><span class="acc-icon">${w.icon}</span><div class="acc-name">${w.name}</div><div class="acc-balance ${w.balance>=0?'pos':'neg'}">${U.fmtCurrency(w.balance, cfg.currency)}</div><div class="acc-subtext">${wtypeLabel}${inc>0||exp>0?` • รับ ${U.fmtCurrency(inc, cfg.currency)} จ่าย ${U.fmtCurrency(exp, cfg.currency)}`:'ยังไม่มีรายการ'}</div><div style="display:flex;gap:3px;margin-top:8px;justify-content:flex-end"><button class="btn btn-outline btn-sm" data-watr="${w.id}">↔️ โอน</button><button class="btn-ghost btn-sm" data-waed="${w.id}">✏️</button><button class="btn-ghost btn-sm" style="color:var(--danger)" data-wadl="${w.id}">🗑️</button></div></div>`;
      }).join('')}</div>`;

    const allInsts = ST.getAll('installments');
    const ccHTML = cards.length === 0 ?
      '<div class="empty-state"><div class="empty-icon">💳</div>เพิ่มบัตรเครดิตแรก</div>' :
      cards.map(cc => {
        const used = Number(cc.used) || 0;
        const limit = Number(cc.limit) || 1;
        const pct = Math.min(used / limit * 100, 100);
        const avail = limit - used;
        const cls = pct < 70 ? 'bok' : pct < 90 ? 'bwarn' : 'bover';
        const activeInsts = allInsts.filter(i => i.creditCardId === cc.id && i.status === 'active');
        return `<div class="cc-card ${cc.network || 'other'}"><div class="cc-chip"></div><div class="cc-number">•••• •••• •••• ${cc.lastFour || '0000'}</div><div class="cc-name-row"><span class="cc-bank">${cc.name}</span><span class="cc-network">${(cc.network || '').toUpperCase()}</span></div><div class="cc-limit-bar"><div class="cc-limit-fill ${cls}" style="width:${pct}%"></div></div><div class="cc-stats"><span>ใช้ไป ${U.fmtCurrency(used, cfg.currency)}</span><span>วงเงิน ${U.fmtCurrency(limit, cfg.currency)}</span></div><div style="display:flex;gap:5px;margin-top:9px;flex-wrap:wrap"><button class="btn btn-sm" style="background:rgba(255,255,255,.2);color:#fff;border:1px solid rgba(255,255,255,.3)" data-ccpay="${cc.id}">💰 จ่ายหนี้</button>${activeInsts.length > 0 ? `<button class="btn btn-sm" style="background:rgba(255,200,0,.25);color:#fff;border:1px solid rgba(255,200,0,.4)" data-ccplan="${cc.id}">📋 ${activeInsts.length} แผนผ่อน</button>` : ''}<span style="flex:1"></span><button class="btn-ghost btn-sm" style="color:rgba(255,255,255,.7)" data-cced="${cc.id}">✏️</button><button class="btn-ghost btn-sm" style="color:rgba(255,255,255,.5)" data-ccdl="${cc.id}">🗑️</button></div></div>`;
      }).join('');

    const transfers = ST.getAll('account_transfers').sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
    const trHTML = transfers.length === 0 ?
      '<div style="color:var(--text-secondary);font-size:.8rem;padding:8px 0">ยังไม่มีประวัติการโอน</div>' :
      `<div class="table-wrap"><table><thead><tr><th>วันที่</th><th>จาก</th><th>ถึง</th><th>จำนวน</th><th>หมายเหตุ</th></tr></thead><tbody>${transfers.map(t => {
        const from = wallets.find(w => w.id === t.fromId) || cards.find(c => c.id === t.fromId) || { name: '?', icon: '❓' };
        const to = wallets.find(w => w.id === t.toId) || cards.find(c => c.id === t.toId) || { name: '?', icon: '❓' };
        return `<tr><td style="font-size:.76rem">${U.fmtDate(t.date)}</td><td>${from.icon} ${from.name}</td><td>${to.icon} ${to.name}</td><td style="font-weight:700;color:var(--accent)">${U.fmtCurrency(t.amount, cfg.currency)}</td><td style="font-size:.76rem;color:var(--text-secondary)">${t.note || '-'}</td></tr>`;
      }).join('')}</tbody></table></div>`;

    return `<div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:14px">
      <div class="stat-card income"><div class="stat-label">ยอดเงินสด+บัญชีรวม</div><div class="stat-value">${U.fmtCurrency(totalWallet, cfg.currency)}</div></div>
      <div class="stat-card expense"><div class="stat-label">ยอดหนี้บัตรเครดิต</div><div class="stat-value">${U.fmtCurrency(totalDebt, cfg.currency)}</div></div>
      <div class="stat-card balance"><div class="stat-label">ทรัพย์สินสุทธิ</div><div class="stat-value">${U.fmtCurrency(totalWallet - totalDebt, cfg.currency)}</div></div>
    </div>
    <div class="card"><div class="card-header"><span class="card-title">🏧 บัญชีของฉัน</span><button class="btn btn-primary btn-sm" id="btnAddWA">➕ เพิ่มบัญชี</button></div>${walletHTML}</div>
    <div class="card"><div class="card-header"><span class="card-title">💳 บัตรเครดิต</span><button class="btn btn-primary btn-sm" id="btnAddCC">➕ เพิ่มบัตร</button></div>${ccHTML}</div>
    <div class="card"><div class="card-header"><span class="card-title">↔️ ประวัติการโอน</span></div>${trHTML}</div>`;
  },

  attachEvents() {
    document.getElementById('btnAddWA')?.addEventListener('click', () => this.openWalletModal());
    document.getElementById('btnAddCC')?.addEventListener('click', () => this.openCCModal());
    document.querySelectorAll('[data-waed]').forEach(btn => btn.addEventListener('click', () => {
      const w = ST.getById('wallet_accounts', btn.dataset.waed); if (w) this.openWalletModal(w);
    }));
    document.querySelectorAll('[data-wadl]').forEach(btn => btn.addEventListener('click', async () => {
      const ok = await U.confirm('ลบบัญชีนี้?\n(กู้คืนได้ใน 30 วันจากถังขยะ)');
      if (ok) { ST.softDelete('wallet_accounts', btn.dataset.wadl); U.toast('ลบแล้ว 🗑️', 'success'); App.rv('accounts'); }
    }));
    document.querySelectorAll('[data-watr]').forEach(btn => btn.addEventListener('click', () => this.openTransferModal(btn.dataset.watr)));
    document.querySelectorAll('[data-cced]').forEach(btn => btn.addEventListener('click', () => {
      const cc = ST.getById('credit_cards', btn.dataset.cced); if (cc) this.openCCModal(cc);
    }));
    document.querySelectorAll('[data-ccdl]').forEach(btn => btn.addEventListener('click', async () => {
      const ccId = btn.dataset.ccdl;
      const activeInsts = ST.getAll('installments').filter(i => i.creditCardId === ccId);
      const msg = activeInsts.length > 0
        ? `⚠️ บัตรนี้มีแผนผ่อนอยู่ ${activeInsts.length} แผน\nการลบจะลบแผนผ่อนทั้งหมดด้วย\n(กู้คืนได้ใน 30 วันจากถังขยะ)`
        : 'ลบบัตรนี้?\n(กู้คืนได้ใน 30 วันจากถังขยะ)';
      const ok = await U.confirm(msg);
      if (ok) {
        activeInsts.forEach(i => ST.softDelete('installments', i.id));
        ST.softDelete('credit_cards', ccId);
        U.toast('ลบแล้ว 🗑️', 'success');
        App.rv('accounts');
      }
    }));
    document.querySelectorAll('[data-ccpay]').forEach(btn => btn.addEventListener('click', () => this.openCCPayModal(btn.dataset.ccpay)));
    document.querySelectorAll('[data-ccplan]').forEach(btn => btn.addEventListener('click', () => this.openInstallmentPlansModal(btn.dataset.ccplan)));
  },

  openWalletModal(edit = null) {
    const isEdit = !!edit;
    const typeOpts = [{ v: 'cash', l: '💵 เงินสด' }, { v: 'bank', l: '🏦 บัญชีธนาคาร' }, { v: 'saving', l: '💰 บัญชีออมทรัพย์' }, { v: 'digital', l: '📱 กระเป๋าเงินดิจิทัล' }, { v: 'other', l: '📌 อื่นๆ' }];
    const icons = ['💵', '🏦', '💰', '📱', '💳', '🏧', '💎', '🐖', '📊', '🌐', '⚡', '🎯'];
    const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f97316', '#ef4444', '#06b6d4', '#f59e0b', '#ec4899'];
    const o = document.createElement('div'); o.className = 'modal-overlay';
    o.innerHTML = `<div class="modal"><h3>${isEdit ? '✏️ แก้ไขบัญชี' : '➕ เพิ่มบัญชี'}</h3>
      <div class="form-group"><label>ประเภทบัญชี</label><select id="waType">${typeOpts.map(t => `<option value="${t.v}" ${isEdit && edit.wtype === t.v ? 'selected' : ''}>${t.l}</option>`).join('')}</select></div>
      <div class="form-group"><label>ไอคอน</label><div style="display:flex;flex-wrap:wrap;gap:4px" id="waIconPick">${icons.map(ic => `<span style="font-size:1.3rem;cursor:pointer;padding:3px;border-radius:5px;border:2px solid ${isEdit && edit.icon === ic ? 'var(--accent)' : 'transparent'}" data-ic="${ic}">${ic}</span>`).join('')}</div><input type="hidden" id="waIcon" value="${isEdit ? edit.icon : '💵'}"></div>
      <div class="form-group"><label>ชื่อบัญชี</label><input type="text" id="waName" value="${isEdit ? edit.name : ''}" placeholder="เช่น SCB ออมทรัพย์, เงินสด"></div>
      <div class="form-group"><label>สี</label><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">${colors.map(c => `<span style="width:22px;height:22px;border-radius:50%;background:${c};cursor:pointer;border:2px solid ${isEdit && edit.color === c ? 'var(--text)' : 'transparent'}" data-clr="${c}"></span>`).join('')}</div><input type="hidden" id="waColor" value="${isEdit ? edit.color : '#10b981'}"></div>
      <div class="form-group"><label>ยอดเงิน${isEdit ? 'ปัจจุบัน' : 'เริ่มต้น'}</label><input type="number" id="waBalance" value="${isEdit ? edit.balance : 0}" step="0.01"></div>
      <div class="modal-actions"><button class="btn btn-outline" id="waCan">ยกเลิก</button><button class="btn btn-primary" id="waOk">บันทึก</button></div>
    </div>`;
    document.getElementById('modalRoot').appendChild(o);
    setTimeout(() => {
      o.querySelectorAll('#waIconPick span').forEach(el => el.addEventListener('click', function() {
        o.querySelectorAll('#waIconPick span').forEach(s => s.style.borderColor = 'transparent');
        this.style.borderColor = 'var(--accent)'; o.querySelector('#waIcon').value = this.dataset.ic;
      }));
      o.querySelectorAll('[data-clr]').forEach(el => el.addEventListener('click', function() {
        o.querySelectorAll('[data-clr]').forEach(s => s.style.borderColor = 'transparent');
        this.style.borderColor = 'var(--text)'; o.querySelector('#waColor').value = this.dataset.clr;
      }));
    }, 50);
    o.querySelector('#waCan').onclick = () => o.remove();
    o.onclick = e => { if (e.target === o) o.remove(); };
    o.querySelector('#waOk').onclick = () => {
      const wtype = o.querySelector('#waType').value;
      const icon = o.querySelector('#waIcon').value;
      const name = o.querySelector('#waName').value.trim();
      const color = o.querySelector('#waColor').value;
      const balance = parseFloat(o.querySelector('#waBalance').value) || 0;
      if (!name) { U.toast('กรุณากรอกชื่อบัญชี', 'error'); return; }
      if (isEdit) ST.update('wallet_accounts', edit.id, { wtype, icon, name, color, balance });
      else ST.add('wallet_accounts', { wtype, icon, name, color, balance });
      U.toast(isEdit ? 'อัปเดตแล้ว' : 'เพิ่มบัญชีแล้ว', 'success');
      o.remove(); App.rv('accounts');
    };
  },

  openCCModal(edit = null) {
    const isEdit = !!edit;
    const networks = ['visa', 'mastercard', 'amex', 'other'];
    const o = document.createElement('div'); o.className = 'modal-overlay';
    o.innerHTML = `<div class="modal"><h3>${isEdit ? '✏️ แก้ไขบัตร' : '💳 เพิ่มบัตรเครดิต'}</h3>
      <div class="form-group"><label>ชื่อบัตร/ธนาคาร</label><input type="text" id="ccName" value="${isEdit ? edit.name : ''}" placeholder="เช่น SCB Visa, KBank Mastercard"></div>
      <div class="form-group"><label>เครือข่ายบัตร</label><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">${networks.map(n => `<button class="btn btn-outline btn-sm ccNetBtn" data-net="${n}" style="${isEdit && edit.network === n ? 'background:var(--accent);color:#fff;border-color:var(--accent)' : ''}">${n.toUpperCase()}</button>`).join('')}</div><input type="hidden" id="ccNet" value="${isEdit ? edit.network || 'other' : 'other'}"></div>
      <div class="form-group"><label>4 หลักสุดท้าย</label><input type="text" id="ccLast" value="${isEdit ? edit.lastFour || '' : ''}" maxlength="4" placeholder="0000" inputmode="numeric"></div>
      <div class="form-group"><label>วงเงินรวม (Credit Limit)</label><input type="number" id="ccLimit" value="${isEdit ? edit.limit || 0 : 0}" step="100" min="0"></div>
      <div class="form-group"><label>ยอดหนี้ปัจจุบัน</label><input type="number" id="ccUsed" value="${isEdit ? edit.used || 0 : 0}" step="0.01" min="0"></div>
      <div class="form-group"><label>วันครบกำหนดชำระ (วันที่ในเดือน)</label><input type="number" id="ccDue" value="${isEdit ? edit.dueDay || 25 : 25}" min="1" max="31"></div>
      <div class="modal-actions"><button class="btn btn-outline" id="ccCan">ยกเลิก</button><button class="btn btn-primary" id="ccOk">บันทึก</button></div>
    </div>`;
    document.getElementById('modalRoot').appendChild(o);
    o.querySelectorAll('.ccNetBtn').forEach(btn => btn.addEventListener('click', () => {
      o.querySelectorAll('.ccNetBtn').forEach(b => { b.style.background = ''; b.style.color = ''; b.style.borderColor = ''; });
      btn.style.background = 'var(--accent)'; btn.style.color = '#fff'; btn.style.borderColor = 'var(--accent)';
      o.querySelector('#ccNet').value = btn.dataset.net;
    }));
    o.querySelector('#ccCan').onclick = () => o.remove();
    o.onclick = e => { if (e.target === o) o.remove(); };
    o.querySelector('#ccOk').onclick = () => {
      const name = o.querySelector('#ccName').value.trim();
      const network = o.querySelector('#ccNet').value;
      const lastFour = o.querySelector('#ccLast').value.trim() || '0000';
      const limit = parseFloat(o.querySelector('#ccLimit').value) || 0;
      const used = parseFloat(o.querySelector('#ccUsed').value) || 0;
      const dueDay = parseInt(o.querySelector('#ccDue').value) || 25;
      if (!name) { U.toast('กรุณากรอกชื่อบัตร', 'error'); return; }
      if (isEdit) ST.update('credit_cards', edit.id, { name, network, lastFour, limit, used, dueDay });
      else ST.add('credit_cards', { name, network, lastFour, limit, used, dueDay });
      U.toast(isEdit ? 'อัปเดตแล้ว' : 'เพิ่มบัตรแล้ว', 'success');
      o.remove(); App.rv('accounts');
    };
  },

  openTransferModal(fromId = null) {
    const wallets = ST.getAll('wallet_accounts');
    const cards = ST.getAll('credit_cards');
    const allAccounts = [...wallets.map(w => ({ ...w, atype: 'wallet' })), ...cards.map(c => ({ ...c, atype: 'card', balance: -(c.used || 0) }))];
    const cfg = U.getConfig();
    const o = document.createElement('div'); o.className = 'modal-overlay';
    o.innerHTML = `<div class="modal"><h3>↔️ โอนเงินระหว่างบัญชี</h3>
      <div class="form-group"><label>จากบัญชี</label><select id="trFrom">${allAccounts.map(a => `<option value="${a.id}" ${fromId === a.id ? 'selected' : ''}>${a.icon} ${a.name} (${U.fmtCurrency(a.balance, cfg.currency)})</option>`).join('')}</select></div>
      <div class="transfer-arrow">↓</div>
      <div class="form-group"><label>ไปยังบัญชี</label><select id="trTo">${allAccounts.map(a => `<option value="${a.id}">${a.icon} ${a.name} (${U.fmtCurrency(a.balance, cfg.currency)})</option>`).join('')}</select></div>
      <div class="form-group" style="margin-top:4px"><label>จำนวนเงิน</label><input type="number" id="trAmt" placeholder="0.00" step="0.01" min="0"></div>
      <div class="form-group"><label>หมายเหตุ</label><input type="text" id="trNote" placeholder="เช่น โอนเงินจ่ายบิล"></div>
      <div class="form-group"><label>วันที่</label><input type="date" id="trDate" value="${U.today()}"></div>
      <div class="modal-actions"><button class="btn btn-outline" id="trCan">ยกเลิก</button><button class="btn btn-primary" id="trOk">โอน</button></div>
    </div>`;
    document.getElementById('modalRoot').appendChild(o);
    o.querySelector('#trCan').onclick = () => o.remove();
    o.onclick = e => { if (e.target === o) o.remove(); };
    o.querySelector('#trOk').onclick = () => {
      const fId = o.querySelector('#trFrom').value;
      const tId = o.querySelector('#trTo').value;
      const amount = parseFloat(o.querySelector('#trAmt').value) || 0;
      const note = o.querySelector('#trNote').value;
      const date = o.querySelector('#trDate').value;
      if (fId === tId) { U.toast('เลือกบัญชีที่แตกต่างกัน', 'error'); return; }
      if (!amount || amount <= 0) { U.toast('กรุณากรอกจำนวนเงิน', 'error'); return; }
      const fromWallet = ST.getById('wallet_accounts', fId);
      const fromCC = ST.getById('credit_cards', fId);
      const toWallet = ST.getById('wallet_accounts', tId);
      const toCC = ST.getById('credit_cards', tId);
      if (fromWallet) ST.update('wallet_accounts', fId, { balance: (fromWallet.balance || 0) - amount });
      else if (fromCC) ST.update('credit_cards', fId, { used: (fromCC.used || 0) + amount });
      if (toWallet) ST.update('wallet_accounts', tId, { balance: (toWallet.balance || 0) + amount });
      else if (toCC) { const newUsed = Math.max(0, (toCC.used || 0) - amount); ST.update('credit_cards', tId, { used: newUsed }); }
      ST.add('account_transfers', { fromId: fId, toId: tId, amount, note, date });
      U.toast(`โอน ${U.fmtCurrency(amount, cfg.currency)} สำเร็จ`, 'success');
      o.remove();
      App.rv('accounts');
    };
  },

  openInstallmentPlansModal(ccId) {
    const cc = ST.getById('credit_cards', ccId); if (!cc) return;
    const insts = ST.getAll('installments').filter(i => i.creditCardId === ccId).sort((a, b) => (a.status === 'active' ? -1 : 1));
    const cfg = U.getConfig();
    const o = document.createElement('div'); o.className = 'modal-overlay';
    const instHTML = insts.length === 0
      ? '<div class="empty-state"><div class="empty-icon">📋</div>ยังไม่มีแผนผ่อน</div>'
      : insts.map(inst => {
          const paidPct = inst.numberOfMonths > 0 ? (inst.paidMonths / inst.numberOfMonths) * 100 : 100;
          const isActive = inst.status === 'active';
          const remaining = inst.monthlyPayment * inst.remainingMonths;
          return `<div class="inst-plan-item ${isActive ? '' : 'completed'}">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:5px">
              <div style="min-width:0"><div style="font-weight:600;font-size:.88rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${inst.itemName}</div>
                <div style="font-size:.7rem;color:var(--text-secondary)">${U.fmtCurrency(inst.totalAmount, cfg.currency)} • ${inst.interestRate > 0 ? inst.interestRate + '%/ปี' : '0% ✅'}</div></div>
              <span class="badge" style="${isActive ? 'background:var(--warning-light);color:var(--warning)' : 'background:var(--success-light);color:var(--success)'}">
                ${isActive ? `เหลือ ${inst.remainingMonths} งวด` : '✅ ชำระครบแล้ว'}</span>
            </div>
            <div class="inst-progress"><div class="inst-progress-fill" style="width:${paidPct}%"></div></div>
            <div style="display:flex;justify-content:space-between;font-size:.73rem;color:var(--text-secondary);margin-bottom:${isActive ? '8px' : '0'}">
              <span>จ่ายแล้ว ${inst.paidMonths}/${inst.numberOfMonths} งวด • งวดละ ${U.fmtCurrency(inst.monthlyPayment, cfg.currency)}</span>
              <span>${isActive ? `คงเหลือ ${U.fmtCurrency(remaining, cfg.currency)}` : ''}</span>
            </div>
            ${isActive ? `<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:5px">
              <span style="font-size:.73rem;color:var(--warning)">📅 กำหนดชำระ: ${U.fmtDate(inst.nextDueDate)}</span>
              <button class="btn btn-success btn-sm" data-payinst="${inst.id}">💳 จ่ายงวดที่ ${inst.paidMonths + 1}</button>
            </div>` : ''}
          </div>`;
        }).join('');
    o.innerHTML = `<div class="modal" style="max-width:520px"><h3>📋 แผนผ่อนชำระ — ${cc.name}</h3>${instHTML}<div class="modal-actions"><button class="btn btn-outline" id="instClose">ปิด</button></div></div>`;
    document.getElementById('modalRoot').appendChild(o);
    o.querySelector('#instClose').onclick = () => o.remove();
    o.onclick = e => { if (e.target === o) o.remove(); };
    o.querySelectorAll('[data-payinst]').forEach(btn => btn.addEventListener('click', () => { o.remove(); this.openPayInstallmentModal(btn.dataset.payinst); }));
  },

  openPayInstallmentModal(instId) {
    const inst = ST.getById('installments', instId); if (!inst) return;
    const cc = ST.getById('credit_cards', inst.creditCardId);
    const wallets = ST.getAll('wallet_accounts');
    const cfg = U.getConfig();
    const installmentNum = inst.paidMonths + 1;
    const o = document.createElement('div'); o.className = 'modal-overlay';
    o.innerHTML = `<div class="modal" style="max-width:400px">
      <h3>💳 จ่ายงวดที่ ${installmentNum}/${inst.numberOfMonths}</h3>
      <div style="background:var(--accent-light);border-radius:10px;padding:11px 13px;margin-bottom:13px">
        <div style="font-size:.76rem;color:var(--text-secondary);margin-bottom:2px">${inst.itemName}</div>
        <div style="font-size:1.4rem;font-weight:800;color:var(--accent)">${U.fmtCurrency(inst.monthlyPayment, cfg.currency)}</div>
        <div style="font-size:.72rem;color:var(--text-secondary);margin-top:2px">📅 กำหนดชำระ: ${U.fmtDate(inst.nextDueDate)} • เหลือ ${inst.remainingMonths} งวด</div>
      </div>
      <div class="form-group"><label>จ่ายจากบัญชี</label><select id="piFrom">${wallets.map(w => `<option value="${w.id}">${w.icon} ${w.name} (${U.fmtCurrency(w.balance, cfg.currency)})</option>`).join('')}</select></div>
      <div class="form-group"><label>จำนวนที่จ่าย</label><input type="number" id="piAmt" value="${inst.monthlyPayment}" step="0.01" min="0"></div>
      <div class="form-group"><label>วันที่จ่าย</label><input type="date" id="piDate" value="${U.today()}"></div>
      <div class="modal-actions"><button class="btn btn-outline" id="piCan">ยกเลิก</button><button class="btn btn-success" id="piOk">✅ จ่ายงวดนี้</button></div>
    </div>`;
    document.getElementById('modalRoot').appendChild(o);
    o.querySelector('#piCan').onclick = () => o.remove();
    o.onclick = e => { if (e.target === o) o.remove(); };
    o.querySelector('#piOk').onclick = () => {
      const fromId = o.querySelector('#piFrom').value;
      const amount = parseFloat(o.querySelector('#piAmt').value) || 0;
      const date = o.querySelector('#piDate').value;
      if (!amount || amount <= 0) { U.toast('กรุณากรอกจำนวน', 'error'); return; }
      const wallet = ST.getById('wallet_accounts', fromId);
      if (wallet && wallet.balance < amount) {
        if (!confirm(`ยอดเงินไม่พอ (มี ${U.fmtCurrency(wallet.balance, cfg.currency)}) ต้องการดำเนินการต่อไหม?`)) return;
      }
      if (wallet) ST.update('wallet_accounts', fromId, { balance: (wallet.balance || 0) - amount });
      if (cc) ST.update('credit_cards', cc.id, { used: Math.max(0, (cc.used || 0) - amount) });
      const newPaid = inst.paidMonths + 1;
      const newRemaining = inst.remainingMonths - 1;
      const newStatus = newRemaining <= 0 ? 'completed' : 'active';
      ST.update('installments', instId, {
        paidMonths: newPaid, remainingMonths: newRemaining, status: newStatus,
        nextDueDate: newRemaining > 0 ? EH.calcInstNextDue(inst.startDate, newPaid) : null
      });
      const txnName = `จ่ายค่างวด ${inst.itemName} งวดที่ ${installmentNum}/${inst.numberOfMonths}`;
      ST.add('transactions', { type: 'expense', amount, categoryId: 'cat_bills', itemName: txnName, date, note: `ผ่อน ${cc ? cc.name : 'บัตรเครดิต'}`, accountId: fromId, installmentId: instId });
      ST.add('account_transfers', { fromId, toId: inst.creditCardId, amount, note: txnName, date });
      U.toast(newStatus === 'completed' ? `🎉 ผ่อนครบแล้ว! ${inst.itemName}` : `จ่ายงวดที่ ${installmentNum} สำเร็จ เหลือ ${newRemaining} งวด`, 'success');
      o.remove(); App.rv('accounts');
    };
  },

  openCCPayModal(ccId) {
    const cc = ST.getById('credit_cards', ccId); if (!cc) return;
    const wallets = ST.getAll('wallet_accounts');
    const cfg = U.getConfig();
    const o = document.createElement('div'); o.className = 'modal-overlay';
    o.innerHTML = `<div class="modal" style="max-width:380px"><h3>💰 จ่ายหนี้บัตร ${cc.icon || '💳'} ${cc.name}</h3>
      <div style="background:var(--danger-light);border-radius:9px;padding:10px 12px;margin-bottom:12px"><div style="font-size:.78rem;color:var(--text-secondary)">ยอดหนี้ปัจจุบัน</div><div style="font-size:1.4rem;font-weight:800;color:var(--expense)">${U.fmtCurrency(cc.used || 0, cfg.currency)}</div></div>
      <div class="form-group"><label>จ่ายจากบัญชี</label><select id="cpFrom">${wallets.map(w => `<option value="${w.id}">${w.icon} ${w.name} (${U.fmtCurrency(w.balance, cfg.currency)})</option>`).join('')}</select></div>
      <div class="form-group"><label>จำนวนที่จ่าย</label><input type="number" id="cpAmt" value="${cc.used || 0}" step="0.01" min="0" placeholder="0.00"></div>
      <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px"><button class="preset-btn" data-cpv="${cc.used}">จ่ายทั้งหมด ${U.fmtCurrency(cc.used || 0, cfg.currency)}</button><button class="preset-btn" data-cpv="${Math.round((cc.used || 0) * 0.1)}">ขั้นต่ำ 10%</button></div>
      <div class="form-group"><label>วันที่จ่าย</label><input type="date" id="cpDate" value="${U.today()}"></div>
      <div class="modal-actions"><button class="btn btn-outline" id="cpCan">ยกเลิก</button><button class="btn btn-success" id="cpOk">✅ จ่ายหนี้</button></div>
    </div>`;
    document.getElementById('modalRoot').appendChild(o);
    o.querySelectorAll('[data-cpv]').forEach(btn => btn.addEventListener('click', () => { o.querySelector('#cpAmt').value = btn.dataset.cpv; }));
    o.querySelector('#cpCan').onclick = () => o.remove();
    o.onclick = e => { if (e.target === o) o.remove(); };
    o.querySelector('#cpOk').onclick = () => {
      const fromId = o.querySelector('#cpFrom').value;
      const amount = parseFloat(o.querySelector('#cpAmt').value) || 0;
      const date = o.querySelector('#cpDate').value;
      if (!amount || amount <= 0) { U.toast('กรุณากรอกจำนวน', 'error'); return; }
      const wallet = ST.getById('wallet_accounts', fromId);
      if (wallet && wallet.balance < amount) {
        const cont = confirm(`ยอดเงินในบัญชีไม่พอ (มี ${U.fmtCurrency(wallet.balance, U.getConfig().currency)}) ต้องการดำเนินการต่อไหม?`);
        if (!cont) return;
      }
      if (wallet) ST.update('wallet_accounts', fromId, { balance: (wallet.balance || 0) - amount });
      const newUsed = Math.max(0, (cc.used || 0) - amount);
      ST.update('credit_cards', ccId, { used: newUsed });
      ST.add('account_transfers', { fromId, toId: ccId, amount, note: `จ่ายหนี้บัตร ${cc.name}`, date });
      ST.add('transactions', { type: 'expense', amount, categoryId: 'cat_bills', itemName: `จ่ายหนี้บัตร ${cc.name}`, date, note: 'ชำระบัตรเครดิต', accountId: fromId });
      U.toast(`จ่ายหนี้ ${U.fmtCurrency(amount, U.getConfig().currency)} สำเร็จ credit เหลือ ${U.fmtCurrency((cc.limit || 0) - newUsed, U.getConfig().currency)}`, 'success');
      o.remove(); App.rv('accounts');
    };
  }
};