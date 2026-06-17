// ===== SAVINGS GOALS =====
const SavingsView = {
  _colors: ['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#ec4899','#8b5cf6','#06b6d4'],
  _icons: ['🎯','🏠','🚗','✈️','💍','📱','🎓','🏖️','💪','🐶','💻','🎮','🛒','💰','🏆','🌱'],

  render() {
    const cfg = U.getConfig();
    const goals = ST.getAll('savings_goals');
    const active = goals.filter(g => g.status !== 'completed');
    const totalSaved = active.reduce((s, g) => s + (g.currentAmount || 0), 0);
    const totalTarget = active.reduce((s, g) => s + (g.targetAmount || 0), 0);
    const overallPct = totalTarget > 0 ? Math.min(100, (totalSaved / totalTarget) * 100) : 0;

    const goalCards = goals.map(g => {
      const pct = g.targetAmount > 0 ? Math.min(100, ((g.currentAmount || 0) / g.targetAmount) * 100) : 0;
      const days = this._daysRemaining(g.targetDate);
      const suggested = this._calcSuggested(g);
      const statusLabel = { active: 'กำลังออม', completed: 'ครบแล้ว ✅', paused: 'หยุดพัก' }[g.status] || 'กำลังออม';
      const statusCls = { active: 'gb-active', completed: 'gb-completed', paused: 'gb-paused' }[g.status] || 'gb-active';
      return `<div class="goal-card" style="border-left-color:${g.color || '#6366f1'}">
        <div class="goal-header">
          <span class="goal-icon">${g.icon || '🎯'}</span>
          <div style="flex:1;min-width:0">
            <div class="goal-name">${g.name}</div>
            <span class="goal-badge ${statusCls}">${statusLabel}</span>
          </div>
          <div class="goal-actions">
            ${g.status !== 'completed' ? `<button class="btn btn-sm btn-primary" data-ga="${g.id}">+ เพิ่มเงิน</button>` : ''}
            <button class="btn btn-sm btn-outline" data-ge="${g.id}">✏️</button>
            <button class="btn btn-sm btn-outline" data-gd="${g.id}">🗑️</button>
          </div>
        </div>
        <div class="goal-progress">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:.78rem">
            <span style="font-weight:700;color:var(--accent)">${U.fmtCurrency(g.currentAmount || 0, cfg.currency)}</span>
            <span style="color:var(--text-secondary)">${pct.toFixed(1)}% จาก ${U.fmtCurrency(g.targetAmount, cfg.currency)}</span>
          </div>
          <div class="inst-progress"><div class="inst-progress-fill" style="width:${pct}%;background:${g.color || 'var(--accent)'}"></div></div>
        </div>
        <div class="goal-meta">
          ${days !== null ? `<span>⏰ ${days > 0 ? `เหลือ ${days} วัน` : 'หมดเวลาแล้ว'}</span>` : '<span></span>'}
          ${suggested > 0 && g.status === 'active' ? `<span>📅 ควรออม ${U.fmtCurrency(suggested, cfg.currency)}/เดือน</span>` : '<span></span>'}
          ${g.notes ? `<span style="color:var(--text-secondary);font-size:.74rem">${g.notes}</span>` : '<span></span>'}
        </div>
      </div>`;
    }).join('');

    return `<div style="padding-bottom:20px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h2 style="margin:0;font-size:1.1rem">🎯 เป้าหมายการออม</h2>
        <button class="btn btn-primary btn-sm" id="btnAddGoal">+ เพิ่มเป้าหมาย</button>
      </div>
      ${active.length > 0 ? `<div class="card" style="margin-bottom:16px;padding:14px 16px">
        <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:10px">
          <div><div class="btag">ออมแล้วรวม</div><div style="font-weight:800;font-size:1.1rem;color:var(--success)">${U.fmtCurrency(totalSaved, cfg.currency)}</div></div>
          <div><div class="btag">เป้าหมายรวม</div><div style="font-weight:700;font-size:1rem">${U.fmtCurrency(totalTarget, cfg.currency)}</div></div>
          <div><div class="btag">ภาพรวม</div><div style="font-weight:700;font-size:1rem">${overallPct.toFixed(1)}%</div></div>
        </div>
        <div class="inst-progress"><div class="inst-progress-fill" style="width:${overallPct}%"></div></div>
      </div>` : ''}
      ${goals.length === 0 ? `<div class="empty-state"><div style="font-size:3rem">🎯</div><p>ยังไม่มีเป้าหมาย<br><small>เริ่มออมเงินด้วยการตั้งเป้าหมายแรก</small></p></div>` : `<div class="goal-list">${goalCards}</div>`}
    </div>`;
  },

  attachEvents() {
    document.getElementById('btnAddGoal')?.addEventListener('click', () => this.openModal());
    document.querySelectorAll('[data-ge]').forEach(btn => {
      btn.addEventListener('click', () => {
        const g = ST.getById('savings_goals', btn.dataset.ge); if (g) this.openModal(g);
      });
    });
    document.querySelectorAll('[data-gd]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await U.confirm('ลบเป้าหมายนี้?');
        if (ok) { ST.delete('savings_goals', btn.dataset.gd); U.toast('ลบแล้ว', 'success'); App.rv('savings'); }
      });
    });
    document.querySelectorAll('[data-ga]').forEach(btn => {
      btn.addEventListener('click', () => this.openAddMoneyModal(btn.dataset.ga));
    });
  },

  openModal(edit = null) {
    const isEdit = !!edit;
    const cfg = U.getConfig();
    const o = document.createElement('div'); o.className = 'modal-overlay';
    const selColor = edit?.color || this._colors[0];
    const selIcon = edit?.icon || '🎯';
    o.innerHTML = `<div class="modal"><h3>${isEdit ? '✏️ แก้ไขเป้าหมาย' : '🎯 เพิ่มเป้าหมายการออม'}</h3>
      <div class="form-group"><label>ชื่อเป้าหมาย</label><input type="text" id="gName" value="${isEdit ? edit.name : ''}" placeholder="เช่น ดาวน์รถ, เที่ยวญี่ปุ่น"></div>
      <div class="form-group"><label>ไอคอน</label><div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:6px" id="gIconPick">${this._icons.map(ic => `<span style="font-size:1.3rem;cursor:pointer;padding:3px 5px;border-radius:6px;border:2px solid ${selIcon===ic?'var(--accent)':'transparent'}" data-gic="${ic}">${ic}</span>`).join('')}</div><input type="hidden" id="gIcon" value="${selIcon}"></div>
      <div class="form-group"><label>สี</label><div style="display:flex;gap:6px;flex-wrap:wrap">${this._colors.map(c => `<div style="width:24px;height:24px;border-radius:50%;background:${c};cursor:pointer;border:3px solid ${selColor===c?'var(--text)':'transparent'};box-sizing:border-box" data-gc="${c}"></div>`).join('')}</div><input type="hidden" id="gColor" value="${selColor}"></div>
      <div class="form-row"><div class="form-group"><label>ยอดเป้าหมาย (${cfg.currency})</label><input type="number" id="gTarget" value="${isEdit ? edit.targetAmount : ''}" placeholder="100000" min="0"></div><div class="form-group"><label>ออมแล้ว</label><input type="number" id="gCurrent" value="${isEdit ? edit.currentAmount || 0 : 0}" min="0"></div></div>
      <div class="form-group"><label>วันที่ต้องการ (ไม่บังคับ)</label><input type="date" id="gDate" value="${isEdit ? edit.targetDate || '' : ''}"></div>
      <div class="form-group"><label>บัญชีที่ผูก (ไม่บังคับ)</label><div class="acc-select-grid" id="gAccSel"><span style="font-size:.74rem;color:var(--text-secondary)">กำลังโหลด...</span></div><input type="hidden" id="gAccId" value="${isEdit ? edit.accountId || '' : ''}"></div>
      <div class="form-group"><label>สถานะ</label><select id="gStatus"><option value="active" ${!isEdit||edit.status==='active'?'selected':''}>กำลังออม</option><option value="paused" ${isEdit&&edit.status==='paused'?'selected':''}>หยุดพัก</option><option value="completed" ${isEdit&&edit.status==='completed'?'selected':''}>ครบแล้ว</option></select></div>
      <div class="form-group"><label>หมายเหตุ</label><textarea id="gNotes" placeholder="รายละเอียดเพิ่มเติม...">${isEdit ? edit.notes || '' : ''}</textarea></div>
      <div class="modal-actions"><button class="btn btn-outline" id="gCan">ยกเลิก</button><button class="btn btn-primary" id="gSave">💾 บันทึก</button></div>
    </div>`;
    document.getElementById('modalRoot').appendChild(o);
    setTimeout(() => {
      attachAccSelEvents(o.querySelector('#gAccSel') ? { querySelector: (s) => s === '#mAccSelect' ? o.querySelector('#gAccSel') : o.querySelector(s) } : o, 'expense');
      // Manual account selection for goals modal
      const accCont = o.querySelector('#gAccSel');
      const wallets = ST.getAll('wallet_accounts');
      const selId = isEdit ? edit.accountId || '' : '';
      accCont.innerHTML = wallets.map(w => `<button type="button" class="acc-sel-btn${selId===w.id?' active':''}" data-wacc="${w.id}" style="border-left:3px solid ${w.color}">${w.icon} ${w.name}</button>`).join('') || '<span style="font-size:.74rem;color:var(--text-secondary)">ยังไม่มีบัญชี</span>';
      accCont.querySelectorAll('[data-wacc]').forEach(btn => btn.addEventListener('click', () => {
        accCont.querySelectorAll('[data-wacc]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        o.querySelector('#gAccId').value = btn.dataset.wacc;
      }));
    }, 50);
    o.querySelectorAll('[data-gic]').forEach(sp => sp.addEventListener('click', () => {
      o.querySelectorAll('[data-gic]').forEach(s => s.style.borderColor = 'transparent');
      sp.style.borderColor = 'var(--accent)'; o.querySelector('#gIcon').value = sp.dataset.gic;
    }));
    o.querySelectorAll('[data-gc]').forEach(sw => sw.addEventListener('click', () => {
      o.querySelectorAll('[data-gc]').forEach(s => s.style.borderColor = 'transparent');
      sw.style.borderColor = 'var(--text)'; o.querySelector('#gColor').value = sw.dataset.gc;
    }));
    o.querySelector('#gCan').onclick = () => o.remove();
    o.onclick = e => { if (e.target === o) o.remove(); };
    o.querySelector('#gSave').onclick = () => {
      const name = o.querySelector('#gName').value.trim();
      const targetAmount = parseFloat(o.querySelector('#gTarget').value) || 0;
      if (!name) { U.toast('กรุณากรอกชื่อเป้าหมาย', 'error'); return; }
      if (targetAmount <= 0) { U.toast('กรุณากรอกยอดเป้าหมาย', 'error'); return; }
      const data = {
        name, icon: o.querySelector('#gIcon').value, color: o.querySelector('#gColor').value,
        targetAmount, currentAmount: parseFloat(o.querySelector('#gCurrent').value) || 0,
        targetDate: o.querySelector('#gDate').value || null, accountId: o.querySelector('#gAccId').value || null,
        status: o.querySelector('#gStatus').value, notes: o.querySelector('#gNotes').value.trim()
      };
      if (isEdit) ST.update('savings_goals', edit.id, data);
      else ST.add('savings_goals', data);
      U.toast(isEdit ? 'อัปเดตแล้ว ✅' : 'เพิ่มเป้าหมายแล้ว 🎯', 'success');
      o.remove(); App.rv('savings');
    };
  },

  openAddMoneyModal(goalId) {
    const goal = ST.getById('savings_goals', goalId); if (!goal) return;
    const cfg = U.getConfig();
    const wallet = goal.accountId ? ST.getById('wallet_accounts', goal.accountId) : null;
    const remaining = goal.targetAmount - (goal.currentAmount || 0);
    const o = document.createElement('div'); o.className = 'modal-overlay';
    o.innerHTML = `<div class="modal" style="max-width:360px">
      <h3>💰 เพิ่มเงินออม</h3>
      <div style="background:var(--bg-input);border-radius:10px;padding:12px;margin-bottom:14px">
        <div style="font-weight:700">${goal.icon} ${goal.name}</div>
        <div style="font-size:.82rem;color:var(--text-secondary);margin-top:3px">ออมแล้ว ${U.fmtCurrency(goal.currentAmount||0,cfg.currency)} / ${U.fmtCurrency(goal.targetAmount,cfg.currency)}</div>
        <div style="font-size:.8rem;color:var(--accent)">ยังขาดอีก ${U.fmtCurrency(remaining,cfg.currency)}</div>
      </div>
      <div class="form-group"><label>จำนวนเงินที่ออม (${cfg.currency})</label><input type="number" id="gaAmt" placeholder="0" min="1" autofocus></div>
      ${wallet ? `<div style="font-size:.8rem;color:var(--text-secondary);margin-bottom:10px">💳 ตัดจาก: ${wallet.icon} ${wallet.name} (คงเหลือ ${U.fmtCurrency(wallet.balance||0,cfg.currency)})</div>` : ''}
      <div class="form-group"><label>หมายเหตุ</label><input type="text" id="gaNotes" placeholder="โอนเงิน, เงินเดือน..."></div>
      <div class="modal-actions"><button class="btn btn-outline" id="gaCan">ยกเลิก</button><button class="btn btn-primary" id="gaSave">+ เพิ่มเงิน</button></div>
    </div>`;
    document.getElementById('modalRoot').appendChild(o);
    setTimeout(() => o.querySelector('#gaAmt')?.focus(), 100);
    o.querySelector('#gaCan').onclick = () => o.remove();
    o.onclick = e => { if (e.target === o) o.remove(); };
    o.querySelector('#gaSave').onclick = () => {
      const amt = parseFloat(o.querySelector('#gaAmt').value) || 0;
      if (amt <= 0) { U.toast('กรุณากรอกจำนวนเงิน', 'error'); return; }
      const newCurrent = (goal.currentAmount || 0) + amt;
      const updates = { currentAmount: newCurrent };
      if (newCurrent >= goal.targetAmount) updates.status = 'completed';
      ST.update('savings_goals', goalId, updates);
      if (wallet) ST.update('wallet_accounts', wallet.id, { balance: (wallet.balance || 0) - amt });
      const noteText = o.querySelector('#gaNotes').value.trim();
      ST.add('transactions', { type: 'expense', amount: amt, categoryId: 'cat_other_e', itemName: `ออมเงิน: ${goal.name}`, date: U.today(), note: noteText || 'ออมเงินเข้าเป้าหมาย', accountId: wallet?.id || '' });
      o.remove();
      if (newCurrent >= goal.targetAmount) this.showCelebration(goal);
      else { U.toast(`เพิ่มเงินออม ${U.fmtCurrency(amt, cfg.currency)} ✅`, 'success'); App.rv('savings'); }
    };
  },

  showCelebration(goal) {
    const o = document.createElement('div');
    o.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;animation:fadeIn .3s';
    o.innerHTML = `<div style="background:var(--bg-card);border-radius:20px;padding:32px;text-align:center;max-width:300px;animation:slideUp .4s">
      <div style="font-size:3.5rem">🎉</div>
      <div style="font-size:1.4rem;font-weight:800;margin:10px 0">สำเร็จแล้ว!</div>
      <div style="font-size:1.1rem">${goal.icon} ${goal.name}</div>
      <div style="color:var(--success);font-weight:700;margin-top:8px">ออมครบเป้าหมายแล้ว!</div>
      <button class="btn btn-primary" style="margin-top:18px;width:100%" onclick="this.closest('div[style]').remove();App.rv('savings')">ยอดเยี่ยม! 🏆</button>
    </div>`;
    document.body.appendChild(o);
    setTimeout(() => { if (o.parentNode) { o.remove(); App.rv('savings'); } }, 6000);
  },

  _calcSuggested(goal) {
    if (!goal.targetDate || goal.status !== 'active') return 0;
    const remaining = goal.targetAmount - (goal.currentAmount || 0);
    if (remaining <= 0) return 0;
    const months = Math.max(1, Math.ceil(this._daysRemaining(goal.targetDate) / 30));
    return Math.ceil(remaining / months);
  },

  _daysRemaining(targetDate) {
    if (!targetDate) return null;
    return Math.ceil((new Date(targetDate) - new Date()) / 86400000);
  }
};
