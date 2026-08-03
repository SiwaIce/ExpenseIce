// ===== SUBSCRIPTION TRACKER =====
const SubsView = {
  _colors: ['#6366f1','#10b981','#ef4444','#f59e0b','#3b82f6','#ec4899','#8b5cf6','#06b6d4','#64748b'],

  _monthlyCost(sub) {
    const c = sub.cost || 0;
    if (sub.billingCycle === 'annual') return c / 12;
    if (sub.billingCycle === 'weekly') return c * 52 / 12;
    return c;
  },

  _isDueThisWeek(sub) {
    if (!sub.nextBillingDate || sub.active === false) return false;
    const diff = new Date(sub.nextBillingDate) - new Date();
    return diff >= 0 && diff < 7 * 86400000;
  },

  _advanceDate(dateStr, cycle) {
    const d = new Date(dateStr);
    if (cycle === 'monthly') d.setMonth(d.getMonth() + 1);
    else if (cycle === 'annual') d.setFullYear(d.getFullYear() + 1);
    else if (cycle === 'weekly') d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  },

  render() {
    const cfg = U.getConfig();
    const subs = ST.getAll('subscriptions');
    const active = subs.filter(s => s.active !== false);
    const totalMonthly = active.reduce((sum, s) => sum + this._monthlyCost(s), 0);
    const totalAnnual = totalMonthly * 12;
    const dueThisWeek = active.filter(s => this._isDueThisWeek(s));
    const cycleLabel = { monthly: 'รายเดือน', annual: 'รายปี', weekly: 'รายสัปดาห์' };

    const cards = subs.map(sub => {
      const monthly = this._monthlyCost(sub);
      const isDue = this._isDueThisWeek(sub);
      const inactive = sub.active === false;
      return `<div class="subs-card${inactive ? ' subs-inactive' : ''}" style="border-left-color:${sub.color || '#6366f1'}">
        <div style="display:flex;align-items:flex-start;gap:10px">
          <div style="font-size:1.6rem;width:36px;text-align:center;flex-shrink:0">${sub.icon || '📱'}</div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:2px">
              <span style="font-weight:700;font-size:.9rem">${sub.name}</span>
              <span class="subs-cycle-badge">${cycleLabel[sub.billingCycle] || 'รายเดือน'}</span>
              ${isDue ? '<span class="subs-due-badge">⚠️ ใกล้ถึงรอบชำระ</span>' : ''}
            </div>
            <div style="font-size:.82rem;color:var(--text-secondary)">
              ${U.fmtCurrency(sub.cost||0, cfg.currency)}/${sub.billingCycle==='annual'?'ปี':sub.billingCycle==='weekly'?'สัปดาห์':'เดือน'}
              ${sub.billingCycle !== 'monthly' ? ` · ≈${U.fmtCurrency(monthly, cfg.currency)}/เดือน` : ''}
            </div>
            ${sub.nextBillingDate ? `<div style="font-size:.76rem;color:var(--text-secondary);margin-top:2px">🗓 รอบถัดไป ${U.fmtDate(sub.nextBillingDate)}</div>` : ''}
          </div>
        </div>
        <div class="subs-actions">
          ${!inactive ? `<button class="btn btn-sm btn-primary" data-sp="${sub.id}">💳 จ่ายแล้ว</button>` : ''}
          <button class="btn btn-sm btn-outline" data-st="${sub.id}" title="${inactive?'เปิดใช้':'ปิดชั่วคราว'}">${inactive?'▶ เปิด':'⏸ หยุด'}</button>
          <button class="btn btn-sm btn-outline" data-se="${sub.id}">✏️</button>
          <button class="btn btn-sm btn-outline" data-sd="${sub.id}">🗑️</button>
        </div>
      </div>`;
    }).join('');

    return `<div style="padding-bottom:20px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h2 style="margin:0;font-size:1.1rem">📱 ตัวติดตามสมาชิก</h2>
        <button class="btn btn-primary btn-sm" id="btnAddSub">+ เพิ่มสมาชิก</button>
      </div>
      ${active.length > 0 ? `<div class="card" style="margin-bottom:16px">
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center">
          <div><div class="btag">ค่ารายเดือน</div><div style="font-weight:800;color:var(--expense);font-size:1rem">${U.fmtCurrency(totalMonthly, cfg.currency)}</div></div>
          <div><div class="btag">ค่ารายปี</div><div style="font-weight:700;font-size:.9rem">${U.fmtCurrency(totalAnnual, cfg.currency)}</div></div>
          <div><div class="btag">จำนวนสมาชิก</div><div style="font-weight:700;font-size:.9rem">${active.length} รายการ</div></div>
        </div>
        ${dueThisWeek.length > 0 ? `<div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border);font-size:.8rem;color:var(--warning)">⚠️ ครบกำหนด 7 วันนี้: ${dueThisWeek.map(s=>s.name).join(', ')}</div>` : ''}
      </div>` : ''}
      ${subs.length === 0 ? `<div class="empty-state"><div style="font-size:3rem">📱</div><p>ยังไม่มีรายการสมาชิก<br><small>เพิ่ม Netflix, Spotify, iCloud และอื่นๆ</small></p></div>` : `<div class="subs-grid">${cards}</div>`}
    </div>`;
  },

  attachEvents() {
    document.getElementById('btnAddSub')?.addEventListener('click', () => this.openModal());
    document.querySelectorAll('[data-se]').forEach(btn => btn.addEventListener('click', () => {
      const s = ST.getById('subscriptions', btn.dataset.se); if (s) this.openModal(s);
    }));
    document.querySelectorAll('[data-sd]').forEach(btn => btn.addEventListener('click', async () => {
      const ok = await U.confirm('ลบรายการสมาชิกนี้?');
      if (ok) { ST.delete('subscriptions', btn.dataset.sd); U.toast('ลบแล้ว', 'success'); App.rv('subscriptions'); }
    }));
    document.querySelectorAll('[data-sp]').forEach(btn => btn.addEventListener('click', () => this.payNow(btn.dataset.sp)));
    document.querySelectorAll('[data-st]').forEach(btn => btn.addEventListener('click', () => {
      const s = ST.getById('subscriptions', btn.dataset.st); if (!s) return;
      ST.update('subscriptions', s.id, { active: s.active === false ? true : false });
      App.rv('subscriptions');
    }));
  },

  openModal(edit = null) {
    const isEdit = !!edit;
    const cfg = U.getConfig();
    const cats = ST.getAll('categories').filter(c => c.type === 'expense');
    const wallets = ST.getAll('wallet_accounts');
    const selColor = edit?.color || this._colors[0];
    const o = document.createElement('div'); o.className = 'modal-overlay';
    o.innerHTML = `<div class="modal"><h3>${isEdit ? '✏️ แก้ไขสมาชิก' : '📱 เพิ่มสมาชิก'}</h3>
      <div class="form-row">
        <div class="form-group" style="flex:0 0 64px"><label>ไอคอน</label><input type="text" id="sIcon" value="${isEdit ? edit.icon||'📱' : '📱'}" style="font-size:1.3rem;text-align:center;padding:6px" maxlength="2"></div>
        <div class="form-group" style="flex:1"><label>ชื่อสมาชิก</label><input type="text" id="sName" value="${isEdit ? edit.name : ''}" placeholder="Netflix, Spotify..."></div>
      </div>
      <div class="form-group"><label>สี</label><div style="display:flex;gap:6px;flex-wrap:wrap">${this._colors.map(c => `<div style="width:22px;height:22px;border-radius:50%;background:${c};cursor:pointer;border:3px solid ${selColor===c?'var(--text)':'transparent'};box-sizing:border-box" data-sc="${c}"></div>`).join('')}</div><input type="hidden" id="sColor" value="${selColor}"></div>
      <div class="form-row">
        <div class="form-group"><label>ค่าบริการ (${cfg.currency})</label><input type="number" id="sCost" value="${isEdit ? edit.cost||'' : ''}" placeholder="219" min="0" step="0.01"></div>
        <div class="form-group"><label>รอบชำระ</label><select id="sCycle"><option value="monthly" ${!isEdit||edit.billingCycle==='monthly'?'selected':''}>รายเดือน</option><option value="annual" ${isEdit&&edit.billingCycle==='annual'?'selected':''}>รายปี</option><option value="weekly" ${isEdit&&edit.billingCycle==='weekly'?'selected':''}>รายสัปดาห์</option></select></div>
      </div>
      <div class="form-group"><label>วันที่ชำระรอบถัดไป</label><input type="date" id="sNext" value="${isEdit ? edit.nextBillingDate||'' : ''}"></div>
      <div class="form-group"><label>หมวดหมู่</label><select id="sCat">${cats.map(c => `<option value="${c.id}" ${isEdit&&edit.categoryId===c.id?'selected':''}>${c.icon} ${c.name}</option>`).join('')}</select></div>
      <div class="form-group"><label>บัญชีที่ตัด</label><select id="sAccId"><option value="">-- ไม่ระบุ --</option>${wallets.map(w => `<option value="${w.id}" ${isEdit&&edit.accountId===w.id?'selected':''}>${w.icon} ${w.name}</option>`).join('')}</select></div>
      <div class="form-group"><label>หมายเหตุ</label><input type="text" id="sNotes" value="${isEdit ? edit.notes||'' : ''}" placeholder="Plan, จำนวนบัญชี..."></div>
      <div class="modal-actions"><button class="btn btn-outline" id="sCan">ยกเลิก</button><button class="btn btn-primary" id="sSave">💾 บันทึก</button></div>
    </div>`;
    document.getElementById('modalRoot').appendChild(o);
    o.querySelectorAll('[data-sc]').forEach(sw => sw.addEventListener('click', () => {
      o.querySelectorAll('[data-sc]').forEach(s => s.style.borderColor = 'transparent');
      sw.style.borderColor = 'var(--text)'; o.querySelector('#sColor').value = sw.dataset.sc;
    }));
    o.querySelector('#sCan').onclick = () => o.remove();
    o.onclick = e => { if (e.target === o) o.remove(); };
    o.querySelector('#sSave').onclick = () => {
      const name = o.querySelector('#sName').value.trim();
      const cost = parseFloat(o.querySelector('#sCost').value) || 0;
      if (!name) { U.toast('กรุณากรอกชื่อ', 'error'); return; }
      if (cost <= 0) { U.toast('กรุณากรอกค่าบริการ', 'error'); return; }
      const data = {
        name, icon: o.querySelector('#sIcon').value.trim() || '📱',
        color: o.querySelector('#sColor').value, cost,
        billingCycle: o.querySelector('#sCycle').value,
        nextBillingDate: o.querySelector('#sNext').value || null,
        categoryId: o.querySelector('#sCat').value,
        accountId: o.querySelector('#sAccId').value || null,
        notes: o.querySelector('#sNotes').value.trim(),
        active: isEdit ? (edit.active !== false) : true
      };
      if (isEdit) ST.update('subscriptions', edit.id, data);
      else ST.add('subscriptions', data);
      U.toast(isEdit ? 'อัปเดตแล้ว ✅' : 'เพิ่มสมาชิกแล้ว 📱', 'success');
      o.remove(); App.rv('subscriptions');
    };
  },

  payNow(subId) {
    const sub = ST.getById('subscriptions', subId); if (!sub) return;
    const cfg = U.getConfig();
    ST.add('transactions', {
      type: 'expense', amount: sub.cost || 0,
      categoryId: sub.categoryId || 'cat_bills',
      itemName: sub.name, date: U.today(),
      note: `ค่าสมาชิก ${sub.billingCycle === 'monthly' ? 'รายเดือน' : sub.billingCycle === 'annual' ? 'รายปี' : 'รายสัปดาห์'}`,
      accountId: sub.accountId || ''
    });
    if (sub.accountId) {
      const w = ST.getById('wallet_accounts', sub.accountId);
      if (w) ST.update('wallet_accounts', w.id, { balance: (w.balance || 0) - (sub.cost || 0) });
    }
    if (sub.nextBillingDate) {
      ST.update('subscriptions', subId, { nextBillingDate: this._advanceDate(sub.nextBillingDate, sub.billingCycle || 'monthly') });
    }
    U.toast(`จ่าย ${sub.name} ${U.fmtCurrency(sub.cost||0, cfg.currency)} แล้ว ✅`, 'success');
    App.rv('subscriptions');
  }
};
