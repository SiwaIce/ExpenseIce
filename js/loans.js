// ===== LOAN / INSTALLMENT PLANS =====
const LoansView = {
  _types: {
    car:      { label: 'รถยนต์',      icon: '🚗', color: '#378ADD' },
    home:     { label: 'บ้าน/คอนโด', icon: '🏠', color: '#1D9E75' },
    personal: { label: 'ส่วนบุคคล',   icon: '💳', color: '#BA7517' },
    other:    { label: 'อื่นๆ',        icon: '📦', color: '#888780' }
  },

  _nextDue(plan) {
    const now = new Date();
    let due = new Date(now.getFullYear(), now.getMonth(), plan.dayOfMonth || 25);
    if (due <= now) due.setMonth(due.getMonth() + 1);
    return due.toISOString().split('T')[0];
  },

  _isDueSoon(plan) {
    const diff = new Date(this._nextDue(plan)) - new Date();
    return diff >= 0 && diff < 7 * 86400000;
  },

  render() {
    const cfg = U.getConfig();
    const plans = ST.getAll('loan_plans');
    const active = plans.filter(p => p.status !== 'completed');
    const totalMonthly = active.reduce((s, p) => s + Number(p.monthlyPayment || 0), 0);
    const totalRemaining = active.reduce((s, p) => s + Math.max(0, (p.numberOfMonths - p.paidMonths)) * Number(p.monthlyPayment || 0), 0);

    const cards = plans.map(p => {
      const t = this._types[p.loanType] || this._types.other;
      const paid = Number(p.paidMonths) || 0;
      const total = Number(p.numberOfMonths) || 1;
      const remaining = Math.max(0, total - paid);
      const pct = Math.min(paid / total * 100, 100).toFixed(0);
      const isCompleted = p.status === 'completed' || paid >= total;
      const isDueSoon = !isCompleted && this._isDueSoon(p);
      const nextDue = isCompleted ? null : this._nextDue(p);

      return `<div class="loan-card${isCompleted ? ' loan-done' : ''}" style="border-left-color:${t.color}">
        <div class="loan-header">
          <div class="loan-icon" style="background:${t.color}22;color:${t.color}">${t.icon}</div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</div>
            <div style="font-size:.72rem;color:var(--text-secondary)">${t.label}${p.lender ? ' • ' + p.lender : ''}</div>
          </div>
          ${isCompleted ? '<span class="loan-badge done">✅ ผ่อนครบแล้ว</span>' : ''}
        </div>
        <div style="margin:10px 0 6px">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <span style="font-size:.72rem;color:var(--text-secondary)">จ่ายแล้ว ${paid} / ${total} งวด</span>
            <span style="font-size:.72rem;font-weight:700;color:${t.color}">${pct}%</span>
          </div>
          <div class="loan-pbar-wrap"><div class="loan-pbar-fill" style="width:${pct}%;background:${t.color}"></div></div>
        </div>
        <div class="loan-meta">
          <div><div class="loan-meta-lbl">งวดละ</div><div class="loan-meta-val">${U.fmtCurrency(p.monthlyPayment, cfg.currency)}</div></div>
          <div><div class="loan-meta-lbl">เหลือ</div><div class="loan-meta-val">${remaining} งวด</div></div>
          <div><div class="loan-meta-lbl">ยอดคงเหลือ</div><div class="loan-meta-val">${U.fmtCurrency(remaining * Number(p.monthlyPayment || 0), cfg.currency)}</div></div>
          <div><div class="loan-meta-lbl">ตัดวันที่</div><div class="loan-meta-val">${p.dayOfMonth || 25} ทุกเดือน</div></div>
        </div>
        ${!isCompleted ? `<div style="margin-bottom:10px">
          <span class="loan-badge ${isDueSoon ? 'warn' : 'ok'}">${isDueSoon ? '⚠️ ถึงกำหนด' : '📅 รอบถัดไป'} ${U.fmtDate(nextDue)}</span>
        </div>` : '<div style="margin-bottom:10px"></div>'}
        <div style="display:flex;gap:6px">
          <button class="btn btn-outline btn-sm" data-le="${p.id}">✏️</button>
          <button class="btn btn-outline btn-sm" style="color:var(--danger)" data-ld="${p.id}">🗑️</button>
          ${!isCompleted ? `<button class="btn btn-primary btn-sm" style="flex:1" data-lp="${p.id}">💳 จ่ายงวดที่ ${paid + 1}</button>` : '<span style="flex:1"></span>'}
        </div>
      </div>`;
    }).join('');

    return `<div style="padding-bottom:20px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h2 style="margin:0;font-size:1.1rem">🏦 แผนผ่อนชำระ</h2>
        <button class="btn btn-primary btn-sm" id="btnAddLoan">+ เพิ่มแผนผ่อน</button>
      </div>
      ${active.length > 0 ? `<div class="card" style="margin-bottom:16px">
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center">
          <div><div class="btag">จ่ายต่อเดือนรวม</div><div style="font-weight:800;color:var(--expense);font-size:1rem;overflow-wrap:anywhere">${U.fmtCurrency(totalMonthly, cfg.currency)}</div></div>
          <div><div class="btag">แผนที่ยังค้าง</div><div style="font-weight:700;font-size:.9rem">${active.length} แผน</div></div>
          <div><div class="btag">ยอดคงเหลือรวม</div><div style="font-weight:700;font-size:.9rem;overflow-wrap:anywhere">${U.fmtCurrency(totalRemaining, cfg.currency)}</div></div>
        </div>
      </div>` : ''}
      ${plans.length === 0
        ? `<div class="empty-state"><div style="font-size:3rem">🏦</div><p>ยังไม่มีแผนผ่อนชำระ<br><small>เพิ่มค่างวดรถ ผ่อนบ้าน สินเชื่อส่วนบุคคล ฯลฯ</small></p></div>`
        : `<div class="loans-grid">${cards}</div>`}
    </div>`;
  },

  attachEvents() {
    document.getElementById('btnAddLoan')?.addEventListener('click', () => this.openModal());
    document.querySelectorAll('[data-le]').forEach(btn => btn.addEventListener('click', () => {
      const p = ST.getById('loan_plans', btn.dataset.le); if (p) this.openModal(p);
    }));
    document.querySelectorAll('[data-ld]').forEach(btn => btn.addEventListener('click', async () => {
      const ok = await U.confirm('ลบแผนผ่อนนี้?');
      if (ok) { ST.delete('loan_plans', btn.dataset.ld); U.toast('ลบแล้ว', 'success'); App.rv('loans'); }
    }));
    document.querySelectorAll('[data-lp]').forEach(btn => btn.addEventListener('click', () => this.payNow(btn.dataset.lp)));
  },

  openModal(edit = null) {
    const isEdit = !!edit;
    const cfg = U.getConfig();
    const wallets = ST.getAll('wallet_accounts');
    const o = document.createElement('div'); o.className = 'modal-overlay';
    o.innerHTML = `<div class="modal">
      <h3>${isEdit ? '✏️ แก้ไขแผนผ่อน' : '🏦 เพิ่มแผนผ่อนชำระ'}</h3>
      <div class="form-group"><label>ชื่อแผน</label>
        <input type="text" id="lName" value="${isEdit ? edit.name : ''}" placeholder="เช่น ผ่อนรถ Toyota Yaris, ผ่อนบ้านหมู่บ้านพฤกษา"></div>
      <div class="form-row">
        <div class="form-group"><label>ประเภท</label><select id="lType">
          <option value="car"      ${!isEdit||edit.loanType==='car'?'selected':''}>🚗 รถยนต์</option>
          <option value="home"     ${isEdit&&edit.loanType==='home'?'selected':''}>🏠 บ้าน/คอนโด</option>
          <option value="personal" ${isEdit&&edit.loanType==='personal'?'selected':''}>💳 ส่วนบุคคล</option>
          <option value="other"    ${isEdit&&edit.loanType==='other'?'selected':''}>📦 อื่นๆ</option>
        </select></div>
        <div class="form-group"><label>สถาบันการเงิน</label>
          <input type="text" id="lLender" value="${isEdit ? edit.lender||'' : ''}" placeholder="SCB, KBank, Toyota Leasing..."></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>งวดทั้งหมด (เดือน)</label>
          <input type="number" id="lTotal" value="${isEdit ? edit.numberOfMonths : ''}" placeholder="60" min="1"></div>
        <div class="form-group"><label>งวดละ (${cfg.currency})</label>
          <input type="number" id="lMonthly" value="${isEdit ? edit.monthlyPayment : ''}" placeholder="8,500" min="0" step="0.01"></div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label style="color:var(--accent);font-weight:600">จ่ายไปแล้วกี่งวด <span style="font-size:.68rem;font-weight:400;color:var(--text-secondary)">(สำหรับแผนที่มีอยู่แล้ว)</span></label>
          <input type="number" id="lPaid" value="${isEdit ? edit.paidMonths : '0'}" placeholder="0" min="0">
        </div>
        <div class="form-group"><label>ตัดวันที่ (ของเดือน)</label>
          <input type="number" id="lDay" value="${isEdit ? edit.dayOfMonth : '25'}" min="1" max="31"></div>
      </div>
      <div id="lPreview" class="loan-preview">กรอกข้อมูลเพื่อดูตัวอย่าง</div>
      <div class="form-group"><label>บัญชีที่ตัดเงิน</label><select id="lWallet">
        <option value="">-- ไม่ระบุ --</option>
        ${wallets.map(w => `<option value="${w.id}" ${isEdit&&edit.walletAccountId===w.id?'selected':''}>${w.icon} ${w.name}</option>`).join('')}
      </select></div>
      <div class="form-group"><label>หมายเหตุ</label>
        <input type="text" id="lNotes" value="${isEdit ? edit.notes||'' : ''}" placeholder="ข้อมูลเพิ่มเติม..."></div>
      <div class="modal-actions">
        <button class="btn btn-outline" id="lCan">ยกเลิก</button>
        <button class="btn btn-primary" id="lSave">💾 บันทึก</button>
      </div>
    </div>`;
    document.getElementById('modalRoot').appendChild(o);

    const updatePreview = () => {
      const total = parseInt(o.querySelector('#lTotal').value) || 0;
      const paid = parseInt(o.querySelector('#lPaid').value) || 0;
      const monthly = parseFloat(o.querySelector('#lMonthly').value) || 0;
      const remaining = Math.max(0, total - paid);
      const pct = total > 0 ? Math.min(paid / total * 100, 100).toFixed(0) : 0;
      const prev = o.querySelector('#lPreview');
      if (total > 0 && monthly > 0) {
        prev.innerHTML = `<div style="display:flex;justify-content:space-between;margin-bottom:5px;font-size:.78rem">
          <span>จ่ายแล้ว ${paid}/${total} งวด</span><span style="font-weight:700;color:var(--accent)">${pct}%</span>
          </div>
          <div style="height:6px;background:var(--border);border-radius:3px;margin-bottom:6px;overflow:hidden">
            <div style="height:100%;background:var(--accent);border-radius:3px;width:${pct}%"></div>
          </div>
          <span style="font-size:.76rem">เหลืออีก ${remaining} งวด · ยอดคงเหลือ ${U.fmtCurrency(remaining * monthly, cfg.currency)}</span>`;
      } else {
        prev.textContent = 'กรอกข้อมูลเพื่อดูตัวอย่าง';
      }
    };

    ['#lTotal','#lPaid','#lMonthly'].forEach(sel => o.querySelector(sel).addEventListener('input', updatePreview));
    if (isEdit) updatePreview();

    o.querySelector('#lCan').onclick = () => o.remove();
    o.onclick = e => { if (e.target === o) o.remove(); };
    o.querySelector('#lSave').onclick = () => {
      const name = o.querySelector('#lName').value.trim();
      const monthlyPayment = parseFloat(o.querySelector('#lMonthly').value);
      const numberOfMonths = parseInt(o.querySelector('#lTotal').value);
      const paidMonths = parseInt(o.querySelector('#lPaid').value) || 0;
      if (!name) { U.toast('กรุณากรอกชื่อแผน', 'error'); return; }
      if (!monthlyPayment || monthlyPayment <= 0) { U.toast('กรุณากรอกจำนวนเงินงวด', 'error'); return; }
      if (!numberOfMonths || numberOfMonths < 1) { U.toast('กรุณากรอกจำนวนงวดทั้งหมด', 'error'); return; }
      if (paidMonths > numberOfMonths) { U.toast('งวดที่จ่ายแล้วมากกว่างวดทั้งหมด', 'error'); return; }
      const data = {
        name,
        loanType: o.querySelector('#lType').value,
        lender: o.querySelector('#lLender').value.trim(),
        monthlyPayment, numberOfMonths, paidMonths,
        dayOfMonth: parseInt(o.querySelector('#lDay').value) || 25,
        walletAccountId: o.querySelector('#lWallet').value || null,
        notes: o.querySelector('#lNotes').value.trim(),
        status: paidMonths >= numberOfMonths ? 'completed' : 'active'
      };
      if (isEdit) ST.update('loan_plans', edit.id, data);
      else ST.add('loan_plans', data);
      U.toast(isEdit ? 'อัปเดตแล้ว ✅' : 'เพิ่มแผนผ่อนแล้ว 🏦', 'success');
      o.remove(); App.rv('loans');
    };
  },

  payNow(planId) {
    const plan = ST.getById('loan_plans', planId); if (!plan) return;
    const cfg = U.getConfig();
    const paid = Number(plan.paidMonths) || 0;
    const total = Number(plan.numberOfMonths) || 1;
    const installmentNum = paid + 1;
    const o = document.createElement('div'); o.className = 'modal-overlay';
    o.innerHTML = `<div class="modal" style="max-width:320px">
      <h3>💳 จ่ายงวดที่ ${installmentNum}/${total}</h3>
      <div style="text-align:center;padding:12px 0 16px">
        <div style="font-size:.78rem;color:var(--text-secondary);margin-bottom:4px">${plan.name}</div>
        <div style="font-size:1.4rem;font-weight:800;color:var(--accent)">${U.fmtCurrency(plan.monthlyPayment, cfg.currency)}</div>
        <div style="font-size:.72rem;color:var(--text-secondary);margin-top:4px">เหลืออีก ${total - paid - 1} งวด หลังจากนี้</div>
      </div>
      <div class="form-group"><label>วันที่จ่าย</label><input type="date" id="lpDate" value="${U.today()}"></div>
      <div class="form-group"><label>จำนวนที่จ่าย (${cfg.currency})</label><input type="number" id="lpAmt" value="${plan.monthlyPayment}" step="0.01" min="0"></div>
      <div class="modal-actions">
        <button class="btn btn-outline" id="lpCan">ยกเลิก</button>
        <button class="btn btn-primary" id="lpOk">✅ บันทึกการจ่าย</button>
      </div>
    </div>`;
    document.getElementById('modalRoot').appendChild(o);
    o.querySelector('#lpCan').onclick = () => o.remove();
    o.onclick = e => { if (e.target === o) o.remove(); };
    o.querySelector('#lpOk').onclick = () => {
      const amount = parseFloat(o.querySelector('#lpAmt').value) || plan.monthlyPayment;
      const date = o.querySelector('#lpDate').value || U.today();
      const newPaid = paid + 1;
      const isCompleted = newPaid >= total;
      ST.update('loan_plans', planId, { paidMonths: newPaid, status: isCompleted ? 'completed' : 'active' });
      ST.add('transactions', {
        type: 'expense', amount, categoryId: 'cat_bills',
        itemName: `จ่ายค่างวด ${plan.name} งวดที่ ${installmentNum}/${total}`,
        date, note: plan.lender || 'แผนผ่อนชำระ',
        accountId: plan.walletAccountId || ''
      });
      if (plan.walletAccountId) {
        const w = ST.getById('wallet_accounts', plan.walletAccountId);
        if (w) ST.update('wallet_accounts', w.id, { balance: (w.balance || 0) - amount });
      }
      o.remove();
      U.toast(isCompleted ? `🎉 ผ่อนครบแล้ว! ${plan.name}` : `บันทึกงวดที่ ${installmentNum} สำเร็จ ✅`, 'success');
      App.rv('loans');
    };
  }
};
