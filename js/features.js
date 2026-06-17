// ===== INSIGHTS =====
const InsightsView = {
  render() {
    return `<div class="ai-tabs"><button class="ai-tab active" data-ait="insights">💡 AI วิเคราะห์</button><button class="ai-tab" data-ait="chat">🤖 แชท</button></div>
    <div id="aitInsights"><div class="card"><div class="card-header"><span class="card-title">🤖 AI Insights — วิเคราะห์การใช้จ่าย</span><button class="btn btn-primary btn-sm" id="btnRefreshInsights">🔄 วิเคราะห์ใหม่</button></div><div id="insightsContainer"><div class="ins-loading"><div class="ins-dot"></div><div class="ins-dot"></div><div class="ins-dot"></div><span>กำลังวิเคราะห์ข้อมูล...</span></div></div></div><div class="card"><div class="card-header"><span class="card-title">📅 คาดการณ์สิ้นเดือน</span></div><div id="forecastContainer"></div></div></div>
    <div id="aitChat" style="display:none"></div>`;
  },
  attachEvents() {
    this.loadInsights();
    this.loadForecast();
    document.getElementById('btnRefreshInsights')?.addEventListener('click', () => {
      document.getElementById('insightsContainer').innerHTML = '<div class="ins-loading"><div class="ins-dot"></div><div class="ins-dot"></div><div class="ins-dot"></div><span>กำลังวิเคราะห์ใหม่...</span></div>';
      this.loadInsights();
    });
    document.querySelectorAll('[data-ait]').forEach(tab => tab.addEventListener('click', () => {
      document.querySelectorAll('[data-ait]').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const isChat = tab.dataset.ait === 'chat';
      document.getElementById('aitInsights').style.display = isChat ? 'none' : '';
      const chatEl = document.getElementById('aitChat');
      chatEl.style.display = isChat ? '' : 'none';
      if (isChat && !chatEl.innerHTML.trim()) {
        chatEl.innerHTML = ChatView.render();
        setTimeout(() => ChatView.attachEvents(), 50);
      }
    }));
  },
  async loadInsights() {
    const container = document.getElementById('insightsContainer'); if (!container) return;
    const data = EH.getInsightData();
    const cfg = U.getConfig();
    const txns = ST.getAll('transactions');
    if (txns.length < 3) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><p>บันทึกรายการอย่างน้อย 3 รายการเพื่อรับ insights</p></div>'; return;
    }
    const prompt = `วิเคราะห์ข้อมูลการใช้จ่ายของผู้ใช้และให้ insight เป็นภาษาไทย กระชับ เข้าใจง่าย:

ข้อมูลเดือนนี้ (${data.month}):
- หมวดหมู่ที่ใช้มากสุด: ${data.spending.slice(0,3).map(s => `${s.name} ${U.fmtCurrency(s.amount, cfg.currency)} (${s.percent.toFixed(0)}%)`).join(', ')}
- วันที่ใช้จ่ายมากสุด: ${data.busiest ? `${data.busiest.day} เฉลี่ย ${U.fmtCurrency(data.busiest.total / data.busiest.count, cfg.currency)}/ครั้ง` : 'ไม่มีข้อมูล'}
- เดือนที่แล้ว top 3: ${data.prevSpending.slice(0,3).map(s => `${s.name} ${U.fmtCurrency(s.amount, cfg.currency)}`).join(', ')}
- จำนวนรายการทั้งหมด: ${txns.length}

สร้าง JSON array ของ insights โดยตอบเป็น JSON เท่านั้น ไม่มีข้อความอื่น format:
[{"icon":"emoji","text":"insight เป็นภาษาไทย ไม่เกิน 2 บรรทัด"},...]

สร้าง 4-5 insights ที่มีประโยชน์ เช่น เปรียบเทียบเดือนก่อน, วันที่ใช้จ่ายเยอะ, คำแนะนำประหยัด, pattern ที่น่าสนใจ`;

    const apiKey = U.getConfig().apiKey || '';
    if (!apiKey) {
      container.innerHTML = '<div class="insight-card"><div class="insight-icon">🔑</div><div class="insight-text">กรุณาตั้งค่า Anthropic API Key ก่อน<br><small>ไปที่ ⚙️ ตั้งค่า แล้วกรอก API Key</small></div></div>';
      return;
    }
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-calls': 'true' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] })
      });
      const json = await res.json();
      const text = json.content?.[0]?.text || '[]';
      let insights = [];
      try { const clean = text.replace(/```json|```/g, '').trim(); insights = JSON.parse(clean); }
      catch (e) { insights = [{ icon: '💡', text: 'ไม่สามารถวิเคราะห์ได้ในขณะนี้ กรุณาลองใหม่' }]; }
      if (!container) return;
      if (!insights.length) { container.innerHTML = '<div class="empty-state"><div class="empty-icon">🤖</div>ไม่มีข้อมูลเพียงพอ</div>'; return; }
      container.innerHTML = insights.map(ins => `<div class="insight-card"><div class="insight-icon">${ins.icon || '💡'}</div><div class="insight-text">${ins.text}</div></div>`).join('');
    } catch (err) {
      if (container) container.innerHTML = '<div class="insight-card"><div class="insight-icon">⚠️</div><div class="insight-text">ไม่สามารถเชื่อมต่อ AI ได้ กรุณาลองใหม่</div></div>';
    }
  },
  loadForecast() {
    const container = document.getElementById('forecastContainer'); if (!container) return;
    const fc = EH.getForecast();
    const cfg = U.getConfig();
    const pct = fc.projectedExpense > 0 ? Math.min(fc.currentExpense / fc.projectedExpense * 100, 100) : 0;
    const cls = pct < 70 ? 'bok' : pct < 90 ? 'bwarn' : 'bover';
    container.innerHTML = `<div style="display:flex;flex-direction:column;gap:10px">
      <div><div style="display:flex;justify-content:space-between;margin-bottom:3px"><span style="font-size:.82rem;font-weight:600">รายจ่ายตอนนี้</span><span style="font-weight:700;color:var(--expense)">${U.fmtCurrency(fc.currentExpense, cfg.currency)}</span></div><div class="fc-bar"><div class="fc-fill ${cls}" style="width:${pct}%"></div></div><div style="display:flex;justify-content:space-between;margin-top:2px"><span class="btag">วันที่ ${fc.daysPassed}/${fc.daysInMonth}</span><span class="btag">คาดว่าสิ้นเดือน: <b style="color:var(--expense)">${U.fmtCurrency(fc.projectedExpense, cfg.currency)}</b></span></div></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
        <div style="text-align:center;padding:10px;background:var(--bg-input);border-radius:9px"><div class="btag">รายจ่ายประจำ/เดือน</div><div style="font-weight:700;color:var(--expense);font-size:.92rem">${U.fmtCurrency(fc.recExpense, cfg.currency)}</div></div>
        <div style="text-align:center;padding:10px;background:var(--bg-input);border-radius:9px"><div class="btag">รายรับประจำ/เดือน</div><div style="font-weight:700;color:var(--income);font-size:.92rem">${U.fmtCurrency(fc.recIncome, cfg.currency)}</div></div>
        <div style="text-align:center;padding:10px;background:var(--bg-input);border-radius:9px"><div class="btag">คาดการณ์เหลือ</div><div style="font-weight:700;color:${fc.recIncome-fc.projectedExpense>=0?'var(--income)':'var(--expense)'};font-size:.92rem">${U.fmtCurrency(fc.recIncome-fc.projectedExpense, cfg.currency)}</div></div>
      </div>
    </div>`;
  }
};

// ===== RECURRING =====
const RV = {
  render() {
    const recs = ST.getAll('recurring');
    const cats = ST.getAll('categories');
    const cfg = U.getConfig();
    const month = U.thisMonth();
    const txns = ST.getAll('transactions').filter(t => t.date.startsWith(month));
    const tExp = recs.filter(r => r.type === 'expense').reduce((s, r) => s + Number(r.amount), 0);
    const tInc = recs.filter(r => r.type === 'income').reduce((s, r) => s + Number(r.amount), 0);
    return `<div class="card"><div class="card-header"><span class="card-title">🔁 รายการประจำเดือน</span><button class="btn btn-primary btn-sm" id="btnAddRec">➕ เพิ่ม</button></div>
    ${recs.length === 0 ? `<div class="empty-state"><div class="empty-icon">🔁</div><p>ยังไม่มีรายการประจำ</p><p style="font-size:.8rem;margin-top:5px">เพิ่มรายการที่เกิดซ้ำทุกเดือน เช่น ค่าเช่า ค่าโทรศัพท์</p></div>` : `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:9px;margin-bottom:14px">${recs.map(rec => {
      const cat = cats.find(c => c.id === rec.categoryId) || { icon: '❓', name: '?' };
      const paid = txns.some(t => t.categoryId === rec.categoryId && Math.abs(Number(t.amount) - Number(rec.amount)) < 1 && t.type === rec.type);
      return `<div class="rec-item"><span style="font-size:1.45rem;margin-right:5px">${cat.icon}</span><div style="flex:1;min-width:0"><div style="font-weight:600;font-size:.86rem">${rec.name}</div><div style="font-size:.7rem;color:var(--text-secondary)">${cat.name} • วันที่ ${rec.dayOfMonth}</div><span class="rec-badge ${paid ? 'rb-paid' : 'rb-unpaid'}">${paid ? '✅ จ่ายแล้ว' : '⏳ ยังไม่ได้จ่าย'}</span></div><div style="text-align:right;flex-shrink:0"><div style="font-weight:700;font-size:.88rem;color:${rec.type==='income'?'var(--income)':'var(--expense)'}">${U.fmtCurrency(rec.amount, cfg.currency)}</div><div style="display:flex;gap:3px;margin-top:3px;justify-content:flex-end">${!paid ? `<button class="btn btn-success btn-sm" data-rp="${rec.id}">จ่าย</button>` : ''}<button class="btn-ghost btn-sm" data-re="${rec.id}">✏️</button><button class="btn-ghost btn-sm" style="color:var(--danger)" data-rd="${rec.id}">🗑️</button></div></div></div>`;
    }).join('')}</div>`}
    <div style="padding-top:10px;border-top:1px solid var(--border);display:flex;gap:16px;flex-wrap:wrap"><div><div class="btag">รายจ่ายประจำรวม</div><div style="font-weight:700;color:var(--expense);font-size:.9rem">${U.fmtCurrency(tExp, cfg.currency)}/เดือน</div></div><div><div class="btag">รายรับประจำรวม</div><div style="font-weight:700;color:var(--income);font-size:.9rem">${U.fmtCurrency(tInc, cfg.currency)}/เดือน</div></div><div><div class="btag">สุทธิต่อเดือน</div><div style="font-weight:700;color:${tInc-tExp>=0?'var(--income)':'var(--expense)'};font-size:.9rem">${U.fmtCurrency(tInc-tExp, cfg.currency)}/เดือน</div></div></div></div>`;
  },
  attachEvents() {
    document.getElementById('btnAddRec')?.addEventListener('click', () => this.openModal());
    document.querySelectorAll('[data-rp]').forEach(btn => btn.addEventListener('click', () => {
      const rec = ST.getById('recurring', btn.dataset.rp);
      if (rec) {
        ST.add('transactions', { type: rec.type, amount: rec.amount, categoryId: rec.categoryId, itemName: rec.name, date: U.today(), note: 'รายการประจำ' });
        U.toast(`บันทึกแล้ว: ${rec.name}`, 'success');
        App.rv('recurring');
      }
    }));
    document.querySelectorAll('[data-re]').forEach(btn => btn.addEventListener('click', () => {
      const rec = ST.getById('recurring', btn.dataset.re); if (rec) this.openModal(rec);
    }));
    document.querySelectorAll('[data-rd]').forEach(btn => btn.addEventListener('click', async () => {
      const ok = await U.confirm('ลบรายการประจำนี้?');
      if (ok) { ST.delete('recurring', btn.dataset.rd); U.toast('ลบแล้ว', 'success'); App.rv('recurring'); }
    }));
  },
  openModal(edit = null) {
    const isEdit = !!edit;
    const cats = ST.getAll('categories');
    const o = document.createElement('div'); o.className = 'modal-overlay';
    o.innerHTML = `<div class="modal"><h3>${isEdit ? '✏️ แก้ไขรายการประจำ' : '➕ เพิ่มรายการประจำ'}</h3><div class="form-group"><label>ชื่อรายการ</label><input type="text" id="rN" value="${isEdit ? edit.name : ''}" placeholder="เช่น ค่าเช่าบ้าน"></div><div class="form-group"><label>ประเภท</label><select id="rT"><option value="expense" ${!isEdit || edit.type === 'expense' ? 'selected' : ''}>รายจ่าย</option><option value="income" ${isEdit && edit.type === 'income' ? 'selected' : ''}>รายรับ</option></select></div><div class="form-group"><label>จำนวนเงิน</label><input type="number" id="rA" value="${isEdit ? edit.amount : ''}" placeholder="0.00" step="0.01" min="0"></div><div class="form-group"><label>หมวดหมู่</label><select id="rC">${cats.map(c => `<option value="${c.id}" ${isEdit && edit.categoryId === c.id ? 'selected' : ''}>${c.icon} ${c.name}</option>`).join('')}</select></div><div class="form-group"><label>วันตัดรายการ (วันที่ในเดือน)</label><input type="number" id="rD" min="1" max="31" value="${isEdit ? edit.dayOfMonth : 1}"></div><div class="modal-actions"><button class="btn btn-outline" id="rc">ยกเลิก</button><button class="btn btn-primary" id="rs">บันทึก</button></div></div>`;
    document.getElementById('modalRoot').appendChild(o);
    o.querySelector('#rc').onclick = () => o.remove();
    o.onclick = e => { if (e.target === o) o.remove(); };
    o.querySelector('#rs').onclick = () => {
      const name = o.querySelector('#rN').value.trim();
      const type = o.querySelector('#rT').value;
      const amount = parseFloat(o.querySelector('#rA').value);
      const categoryId = o.querySelector('#rC').value;
      const dayOfMonth = parseInt(o.querySelector('#rD').value) || 1;
      if (!name || !amount || amount <= 0) { U.toast('กรุณากรอกข้อมูลให้ครบ', 'error'); return; }
      if (isEdit) ST.update('recurring', edit.id, { name, type, amount, categoryId, dayOfMonth });
      else ST.add('recurring', { name, type, amount, categoryId, dayOfMonth });
      U.toast(isEdit ? 'อัปเดตแล้ว' : 'เพิ่มแล้ว', 'success');
      o.remove(); App.rv('recurring');
    };
  }
};

// ===== BUDGET =====
const BV = {
  render() {
    const budgets = ST.getAll('budgets');
    const cats = ST.getAll('categories').filter(c => c.type === 'expense');
    const cfg = U.getConfig();
    const month = U.thisMonth();
    const txns = ST.getAll('transactions').filter(t => t.date.startsWith(month) && t.type === 'expense');
    return `<div class="card"><div class="card-header"><span class="card-title">🎯 งบประมาณรายเดือน — ${month}</span><button class="btn btn-primary btn-sm" id="btnAddB">➕ ตั้งงบ</button></div>${cats.map(cat => {
      const b = budgets.find(x => x.categoryId === cat.id);
      const spent = txns.filter(t => t.categoryId === cat.id).reduce((s, t) => s + Number(t.amount), 0);
      const pct = b && b.amount > 0 ? Math.min(spent / b.amount * 100, 100) : 0;
      const cls = pct < 70 ? 'bok' : pct < 90 ? 'bwarn' : 'bover';
      return `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)"><span style="font-size:1.35rem;width:26px;text-align:center">${cat.icon}</span><div style="flex:1;min-width:0"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px"><span style="font-weight:600;font-size:.84rem">${cat.name}</span><div style="display:flex;align-items:center;gap:6px"><span style="font-size:.78rem;color:var(--expense);font-weight:600">${U.fmtCurrency(spent, cfg.currency)}</span>${b ? `<span style="font-size:.72rem;color:var(--text-secondary)">/ ${U.fmtCurrency(b.amount, cfg.currency)}</span>` : ''}<button class="btn-ghost" style="padding:2px 5px;font-size:.7rem" data-be="${cat.id}">${b ? '✏️' : '+ ตั้ง'}</button></div></div>${b ? `<div class="bbar-wrap"><div class="bbar-fill ${cls}" style="width:${pct}%"></div></div><div style="display:flex;justify-content:space-between;margin-top:1px"><span class="btag">${pct.toFixed(0)}% ใช้ไป</span><span class="btag" style="color:${b.amount - spent < 0 ? 'var(--danger)' : 'inherit'}">${b.amount - spent >= 0 ? `เหลือ ${U.fmtCurrency(b.amount - spent, cfg.currency)}` : `เกิน ${U.fmtCurrency(spent - b.amount, cfg.currency)}`}</span></div>` : '<div class="btag">ยังไม่ได้ตั้งงบประมาณ</div>'}</div></div>`;
    }).join('')}</div>`;
  },
  attachEvents() {
    document.getElementById('btnAddB')?.addEventListener('click', () => this.openModal());
    document.querySelectorAll('[data-be]').forEach(btn => btn.addEventListener('click', () => {
      const ex = ST.getAll('budgets').find(b => b.categoryId === btn.dataset.be);
      this.openModal(btn.dataset.be, ex);
    }));
  },
  openModal(catId = null, existing = null) {
    const cats = ST.getAll('categories').filter(c => c.type === 'expense');
    const cfg = U.getConfig();
    const o = document.createElement('div'); o.className = 'modal-overlay';
    o.innerHTML = `<div class="modal" style="max-width:350px"><h3>${existing ? '✏️ แก้ไขงบประมาณ' : '🎯 ตั้งงบประมาณ'}</h3><div class="form-group"><label>หมวดหมู่</label><select id="bC">${cats.map(c => `<option value="${c.id}" ${catId === c.id ? 'selected' : ''}>${c.icon} ${c.name}</option>`).join('')}</select></div><div class="form-group"><label>งบประมาณต่อเดือน (${cfg.currency})</label><input type="number" id="bA" value="${existing ? existing.amount : ''}" placeholder="0.00" step="100" min="0"></div><div class="modal-actions"><button class="btn btn-outline" id="bc">ยกเลิก</button><button class="btn btn-primary" id="bs">บันทึก</button></div></div>`;
    document.getElementById('modalRoot').appendChild(o);
    o.querySelector('#bc').onclick = () => o.remove();
    o.onclick = e => { if (e.target === o) o.remove(); };
    o.querySelector('#bs').onclick = () => {
      const categoryId = o.querySelector('#bC').value;
      const amount = parseFloat(o.querySelector('#bA').value);
      if (!amount || amount <= 0) { U.toast('กรุณากรอกงบประมาณ', 'error'); return; }
      const ex = ST.getAll('budgets').find(b => b.categoryId === categoryId);
      if (ex) ST.update('budgets', ex.id, { amount });
      else ST.add('budgets', { categoryId, amount });
      U.toast('บันทึกแล้ว', 'success');
      o.remove(); App.rv('budget');
    };
    setTimeout(() => o.querySelector('#bA')?.focus(), 70);
  }
};

// ===== NET WORTH =====
const NWView = {
  render() {
    const accs = ST.getAll('accounts');
    const wallets = ST.getAll('wallet_accounts');
    const cards = ST.getAll('credit_cards');
    const cfg = U.getConfig();
    const loanPlans = ST.getAll('loan_plans').filter(p => p.status !== 'completed');
    const assets = [...accs.filter(a => a.atype === 'asset'), ...wallets.map(w => ({ ...w, atype: 'asset', amount: w.balance, name: w.name }))];
    const debts = [
      ...accs.filter(a => a.atype === 'debt'),
      ...cards.map(c => ({ ...c, atype: 'debt', amount: c.used || 0, name: c.name, icon: '💳', category: 'บัตรเครดิต' })),
      ...loanPlans.map(p => ({ id: p.id, atype: 'debt', amount: Math.max(0, (p.numberOfMonths - p.paidMonths)) * Number(p.monthlyPayment || 0), name: p.name, icon: p.loanType==='car'?'🚗':p.loanType==='home'?'🏠':'💳', category: p.lender || 'แผนผ่อนชำระ', _readonly: true }))
    ];
    const totalAsset = assets.reduce((s, a) => s + Math.max(0, Number(a.amount)), 0);
    const totalDebt = debts.reduce((s, a) => s + Number(a.amount), 0);
    const nw = totalAsset - totalDebt;
    const maxV = Math.max(totalAsset, totalDebt, 1);
    return `<div class="card"><div class="card-header"><span class="card-title">🏦 Net Worth — ความมั่งคั่งสุทธิ</span><button class="btn btn-primary btn-sm" id="btnAddAcc">➕ เพิ่มบัญชี</button></div>
    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:14px"><div style="flex:1;min-width:120px;text-align:center;padding:12px;background:var(--success-light);border-radius:10px"><div class="btag">ทรัพย์สิน</div><div style="font-weight:700;color:var(--success);font-size:1.1rem">${U.fmtCurrency(totalAsset, cfg.currency)}</div></div><div style="flex:1;min-width:120px;text-align:center;padding:12px;background:var(--danger-light);border-radius:10px"><div class="btag">หนี้สิน</div><div style="font-weight:700;color:var(--expense);font-size:1.1rem">${U.fmtCurrency(totalDebt, cfg.currency)}</div></div><div style="flex:1;min-width:120px;text-align:center;padding:12px;background:${nw>=0?'var(--accent-light)':'var(--danger-light)'};border-radius:10px"><div class="btag">Net Worth</div><div style="font-weight:700;color:${nw>=0?'var(--accent)':'var(--expense)'};font-size:1.1rem">${U.fmtCurrency(nw, cfg.currency)}</div></div></div>
    <div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;font-size:.74rem;color:var(--text-secondary);margin-bottom:4px"><span>ทรัพย์สิน ${((totalAsset/Math.max(totalAsset+totalDebt,1))*100).toFixed(0)}%</span><span>หนี้สิน ${((totalDebt/Math.max(totalAsset+totalDebt,1))*100).toFixed(0)}%</span></div><div style="height:12px;border-radius:6px;overflow:hidden;display:flex"><div style="background:var(--success);width:${totalAsset/(totalAsset+totalDebt||1)*100}%;transition:width .4s"></div><div style="background:var(--expense);flex:1"></div></div></div>
    <div class="tabs"><div class="tab active" data-nt="assets">ทรัพย์สิน (${assets.length})</div><div class="tab" data-nt="debts">หนี้สิน (${debts.length})</div></div>
    <div id="nt-assets">${assets.length===0?'<div class="empty-state"><div class="empty-icon">🏦</div>เพิ่มบัญชี/ทรัพย์สิน</div>':assets.map(a => `<div class="nw-item"><span style="font-size:1.2rem">${a.icon||'💰'}</span><div style="flex:1;margin:0 8px"><div style="font-weight:600;font-size:.86rem">${a.name}</div><div class="btag">${a.category||'ทรัพย์สิน'}</div></div><div style="text-align:right"><div style="font-weight:700;color:var(--success);font-size:.9rem">${U.fmtCurrency(a.amount, cfg.currency)}</div><div style="display:flex;gap:3px;justify-content:flex-end"><button class="btn-ghost btn-sm" data-aed="${a.id}">✏️</button><button class="btn-ghost btn-sm" style="color:var(--danger)" data-add="${a.id}">🗑️</button></div></div></div>`).join('')}</div>
    <div id="nt-debts" style="display:none">${debts.length===0?'<div class="empty-state"><div class="empty-icon">📄</div>เพิ่มหนี้สิน</div>':debts.map(a => `<div class="nw-item"><span style="font-size:1.2rem">${a.icon||'💳'}</span><div style="flex:1;margin:0 8px"><div style="font-weight:600;font-size:.86rem">${a.name}</div><div class="btag">${a.category||'หนี้สิน'}${a._readonly?' · แผนผ่อนชำระ':''}</div></div><div style="text-align:right"><div style="font-weight:700;color:var(--expense);font-size:.9rem">${U.fmtCurrency(a.amount, cfg.currency)}</div>${!a._readonly?`<div style="display:flex;gap:3px;justify-content:flex-end"><button class="btn-ghost btn-sm" data-aed="${a.id}">✏️</button><button class="btn-ghost btn-sm" style="color:var(--danger)" data-add="${a.id}">🗑️</button></div>`:'<div style="font-size:.68rem;color:var(--text-secondary)">จัดการที่ แผนผ่อนชำระ</div>'}</div></div>`).join('')}</div>
    </div>`;
  },
  attachEvents() {
    document.getElementById('btnAddAcc')?.addEventListener('click', () => this.openModal());
    document.querySelectorAll('[data-nt]').forEach(tab => tab.addEventListener('click', () => {
      document.querySelectorAll('[data-nt]').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('nt-assets').style.display = tab.dataset.nt === 'assets' ? '' : 'none';
      document.getElementById('nt-debts').style.display = tab.dataset.nt === 'debts' ? '' : 'none';
    }));
    document.querySelectorAll('[data-aed]').forEach(btn => btn.addEventListener('click', () => {
      const a = ST.getById('accounts', btn.dataset.aed); if (a) this.openModal(a);
    }));
    document.querySelectorAll('[data-add]').forEach(btn => btn.addEventListener('click', async () => {
      const ok = await U.confirm('ลบรายการนี้?');
      if (ok) { ST.delete('accounts', btn.dataset.add); U.toast('ลบแล้ว', 'success'); App.rv('networth'); }
    }));
  },
  openModal(edit = null) {
    const isEdit = !!edit;
    const icons = ['💰','🏦','🏠','🚗','📈','💎','💳','📋','🏢','💵','🏅','📱'];
    const o = document.createElement('div'); o.className = 'modal-overlay';
    o.innerHTML = `<div class="modal"><h3>${isEdit ? '✏️ แก้ไข' : '➕ เพิ่มบัญชี/ทรัพย์สิน'}</h3><div class="form-group"><label>ประเภท</label><select id="aT"><option value="asset" ${!isEdit || edit.atype === 'asset' ? 'selected' : ''}>ทรัพย์สิน</option><option value="debt" ${isEdit && edit.atype === 'debt' ? 'selected' : ''}>หนี้สิน</option></select></div><div class="form-group"><label>ไอคอน</label><div style="display:flex;flex-wrap:wrap;gap:5px" id="aip">${icons.map(ic => `<span style="font-size:1.4rem;cursor:pointer;padding:3px;border-radius:5px;border:2px solid ${isEdit && edit.icon === ic ? 'var(--accent)' : 'transparent'}" data-ic="${ic}">${ic}</span>`).join('')}</div><input type="hidden" id="aI" value="${isEdit ? edit.icon : '💰'}"></div><div class="form-group"><label>ชื่อ</label><input type="text" id="aN" value="${isEdit ? edit.name : ''}" placeholder="เช่น บัญชีออมทรัพย์ SCB"></div><div class="form-group"><label>หมวดหมู่</label><input type="text" id="aC" value="${isEdit ? edit.category || '' : ''}" placeholder="เช่น บัญชีธนาคาร, กองทุน, อสังหา"></div><div class="form-group"><label>มูลค่าปัจจุบัน</label><input type="number" id="aA" value="${isEdit ? edit.amount : ''}" placeholder="0.00" step="1" min="0"></div><div class="modal-actions"><button class="btn btn-outline" id="ac">ยกเลิก</button><button class="btn btn-primary" id="as">บันทึก</button></div></div>`;
    document.getElementById('modalRoot').appendChild(o);
    o.querySelector('#ac').onclick = () => o.remove();
    o.onclick = e => { if (e.target === o) o.remove(); };
    o.querySelector('#as').onclick = () => {
      const atype = o.querySelector('#aT').value;
      const icon = o.querySelector('#aI').value;
      const name = o.querySelector('#aN').value.trim();
      const category = o.querySelector('#aC').value.trim();
      const amount = parseFloat(o.querySelector('#aA').value) || 0;
      if (!name) { U.toast('กรุณากรอกชื่อ', 'error'); return; }
      if (isEdit) ST.update('accounts', edit.id, { atype, icon, name, category, amount });
      else ST.add('accounts', { atype, icon, name, category, amount });
      U.toast(isEdit ? 'อัปเดตแล้ว' : 'เพิ่มแล้ว', 'success');
      o.remove(); App.rv('networth');
    };
    setTimeout(() => o.querySelectorAll('#aip span').forEach(el => el.addEventListener('click', function() {
      o.querySelectorAll('#aip span').forEach(s => s.style.borderColor = 'transparent');
      this.style.borderColor = 'var(--accent)'; o.querySelector('#aI').value = this.dataset.ic;
    })), 70);
  }
};

// ===== ONBOARDING =====
const Onboarding = {
  steps: [
    { icon: '💰', title: 'ยินดีต้อนรับ!', desc: 'Expense Tracker ช่วยติดตามรายรับ-รายจ่ายของคุณ ด้วย UI แบบ POS ที่ใช้งานง่าย' },
    { icon: '➕', title: 'บันทึกรายการ', desc: 'กดที่ card หมวดหมู่ → เลือกรายการ → กด + เพื่อ Quick Add หรือกดตรงๆ เพื่อใส่รายละเอียด' },
    { icon: '🎯', title: 'ตั้งงบประมาณ', desc: 'ตั้ง budget ต่อหมวดหมู่ แอปจะแสดง progress bar และแจ้งเตือนเมื่อใกล้เต็ม' },
    { icon: '🤖', title: 'AI Insights', desc: 'วิเคราะห์ pattern การใช้จ่ายของคุณด้วย AI พร้อมคาดการณ์ค่าใช้จ่ายสิ้นเดือน' }
  ],
  current: 0,
  show() {
    if (U.getConfig().onboarded) return;
    const o = document.createElement('div'); o.className = 'ob-overlay'; o.id = 'obOverlay'; document.body.appendChild(o);
    this.render();
  },
  render() {
    const o = document.getElementById('obOverlay'); if (!o) return;
    const s = this.steps[this.current];
    o.innerHTML = `<div class="ob-card"><div style="font-size:2.8rem;margin-bottom:8px">${s.icon}</div><h2 style="font-size:1.1rem;font-weight:700;margin-bottom:8px">${s.title}</h2><p style="font-size:.86rem;color:var(--text-secondary);line-height:1.6">${s.desc}</p><div class="ob-dots">${this.steps.map((_, i) => `<div class="ob-dot ${i === this.current ? 'active' : ''}"></div>`).join('')}</div><div style="display:flex;gap:8px;justify-content:center;margin-top:16px">${this.current > 0 ? `<button class="btn btn-outline btn-sm" id="obPrev">← ก่อนหน้า</button>` : ''}<button class="btn btn-primary btn-sm" id="obNext">${this.current === this.steps.length - 1 ? 'เริ่มใช้งาน →' : 'ถัดไป →'}</button></div></div>`;
    document.getElementById('obNext')?.addEventListener('click', () => {
      if (this.current < this.steps.length - 1) { this.current++; this.render(); }
      else { o.remove(); U.updateConfig({ onboarded: true }); }
    });
    document.getElementById('obPrev')?.addEventListener('click', () => {
      if (this.current > 0) { this.current--; this.render(); }
    });
  }
};