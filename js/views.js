const Views = {
  // ---------- DASHBOARD ----------
  renderDash() {
    const cfg = U.getConfig();
    const txns = ST.getAll('transactions');
    const cats = ST.getAll('categories');
    const sum = EH.calcSum(txns);
    const spending = EH.catSpending(txns, cats);
    const top5 = spending.slice(0, 5);
    const tExp = sum.totalExpense || 1;
    const month = U.thisMonth();
    const mSum = EH.calcSum(txns.filter(t => t.date.startsWith(month)));
    const last7 = U.last7();
    const wSum = EH.calcSum(txns.filter(t => t.date >= last7[0]));
    const streak = U.getStreak();
    const walletCards = ST.getAll('wallet_accounts').slice(0, 2).map(w =>
      `<div class="stat-card" style="cursor:pointer;border-left:3px solid ${w.color}" onclick="App.nav('accounts')">
        <div class="stat-label">${w.icon} ${w.name}</div>
        <div class="stat-value" style="color:${w.balance>=0?'var(--success)':'var(--expense)'}">${U.fmtCurrency(w.balance, cfg.currency)}</div>
      </div>`
    ).join('');

    const activeGoals = ST.getAll('savings_goals').filter(g => g.status === 'active');
    const allActiveInsts = ST.getAll('installments').filter(i => i.status === 'active');
    const instsDue = EH.getInstallmentsDueThisMonth();
    const instDueTotal = instsDue.reduce((s, i) => s + Number(i.monthlyPayment), 0);
    const instRemainingTotal = allActiveInsts.reduce((s, i) => s + i.monthlyPayment * i.remainingMonths, 0);

    return `
    <div class="stats-grid">
      <div class="stat-card income"><div class="stat-label">รายรับรวม</div><div class="stat-value">${U.fmtCurrency(sum.totalIncome, cfg.currency)}</div></div>
      <div class="stat-card expense"><div class="stat-label">รายจ่ายรวม</div><div class="stat-value">${U.fmtCurrency(sum.totalExpense, cfg.currency)}</div></div>
      <div class="stat-card balance"><div class="stat-label">ยอดคงเหลือ</div><div class="stat-value">${U.fmtCurrency(sum.balance, cfg.currency)}</div></div>
      <div class="stat-card income" style="border-left:3px solid var(--income)"><div class="stat-label">รายรับเดือนนี้</div><div class="stat-value">${U.fmtCurrency(mSum.totalIncome, cfg.currency)}</div></div>
      <div class="stat-card expense" style="border-left:3px solid var(--expense)"><div class="stat-label">รายจ่ายเดือนนี้</div><div class="stat-value">${U.fmtCurrency(mSum.totalExpense, cfg.currency)}</div></div>
      <div class="stat-card" style="border-left:3px solid var(--warning)"><div class="stat-label">รายจ่าย 7 วันนี้</div><div class="stat-value" style="color:var(--expense)">${U.fmtCurrency(wSum.totalExpense, cfg.currency)}</div></div>
      <div class="stat-card" style="background:linear-gradient(135deg,var(--accent),#8b5cf6);border:none"><div class="stat-label" style="color:rgba(255,255,255,.8)">🔥 Streak</div><div class="stat-value" style="color:#fff">${streak} วัน</div></div>
      ${walletCards}
    </div>
    <div class="charts-row">
      <div class="card"><div class="card-header"><span class="card-title">🍩 สัดส่วนรายจ่าย</span></div><div class="chart-container"><canvas id="donutChart"></canvas></div><div class="prog-legend">${spending.slice(0,6).map(s => `<div class="prog-legend-item"><span class="ldot" style="background:${s.color}"></span>${s.icon} ${s.name} (${s.percent.toFixed(1)}%)</div>`).join('')}</div></div>
      <div class="card"><div class="card-header"><span class="card-title">📈 แนวโน้ม 14 วัน</span></div><div class="chart-container"><canvas id="lineChart"></canvas></div><div class="prog-legend"><div class="prog-legend-item"><span class="ldot" style="background:#10b981"></span>รายรับ</div><div class="prog-legend-item"><span class="ldot" style="background:#ef4444"></span>รายจ่าย</div></div></div>
    </div>
    ${allActiveInsts.length > 0 ? `<div class="card" style="border-left:4px solid var(--warning)"><div class="card-header"><span class="card-title">💳 แผนผ่อนชำระ</span><button class="btn btn-outline btn-sm" onclick="App.nav('accounts')">จัดการ →</button></div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:${instsDue.length>0?'10px':'0'}"><div style="text-align:center;padding:10px;background:var(--warning-light);border-radius:9px"><div class="btag">ยอดผ่อนเดือนนี้</div><div style="font-weight:700;color:var(--warning);font-size:.9rem">${U.fmtCurrency(instDueTotal, cfg.currency)}</div></div><div style="text-align:center;padding:10px;background:var(--accent-light);border-radius:9px"><div class="btag">แผนที่เปิดอยู่</div><div style="font-weight:700;color:var(--accent);font-size:.9rem">${allActiveInsts.length} แผน</div></div><div style="text-align:center;padding:10px;background:var(--danger-light);border-radius:9px"><div class="btag">ยอดคงค้างรวม</div><div style="font-weight:700;color:var(--expense);font-size:.9rem">${U.fmtCurrency(instRemainingTotal, cfg.currency)}</div></div></div>${instsDue.length>0?`<div style="font-size:.73rem;font-weight:700;color:var(--warning);margin-bottom:5px">⏰ ครบกำหนดเดือนนี้</div>${instsDue.map(i=>{const cc=ST.getById('credit_cards',i.creditCardId);return`<div class="txn-item" style="margin-bottom:3px;cursor:pointer" onclick="App.nav('accounts')"><span style="font-size:.9rem">💳</span><div style="flex:1;min-width:0"><div style="font-size:.76rem;font-weight:600">${i.itemName}</div><div style="font-size:.67rem;color:var(--text-secondary)">${cc?cc.name:'บัตรเครดิต'} • งวดที่ ${i.paidMonths+1}/${i.numberOfMonths}</div></div><span style="font-weight:700;color:var(--warning);font-size:.8rem">${U.fmtCurrency(i.monthlyPayment,cfg.currency)}</span></div>`;}).join('')}`:''}
    </div>` : ''}
    ${activeGoals.length > 0 ? `<div class="card" style="border-left:4px solid var(--success);cursor:pointer" onclick="App.nav('savings')"><div class="card-header"><span class="card-title">🎯 เป้าหมายการออม</span><span class="btn btn-outline btn-sm">ดูทั้งหมด →</span></div>${activeGoals.slice(0,3).map(g => { const pct = g.targetAmount>0?Math.min(100,((g.currentAmount||0)/g.targetAmount)*100):0; return `<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:.8rem;margin-bottom:3px"><span style="font-weight:600">${g.icon||'🎯'} ${g.name}</span><span style="color:var(--success);font-weight:700">${pct.toFixed(0)}%</span></div><div class="inst-progress"><div class="inst-progress-fill" style="width:${pct}%;background:${g.color||'var(--success)'}"></div></div></div>`; }).join('')}</div>` : ''}
    <div class="card"><div class="card-header"><span class="card-title">🏆 หมวดหมู่ที่ใช้จ่ายสูงสุด</span></div>
    ${top5.length === 0 ? '<div class="empty-state"><div class="empty-icon">📭</div>ยังไม่มีรายการ</div>' : `<ul class="top-list">${top5.map((s,i) => `<li><span class="rank">#${i+1}</span><span class="cat-info">${s.icon} ${s.name}</span><span style="font-size:.82rem">${U.fmtCurrency(s.amount, cfg.currency)}</span><span class="bar-bg"><span class="bar-fill" style="width:${s.amount/tExp*100}%;background:${s.color}"></span></span><span style="font-weight:600;font-size:.78rem">${s.percent.toFixed(1)}%</span></li>`).join('')}</ul>`}
    </div>`;
  },
  attachDashCharts() {
    setTimeout(() => {
      Charts.drawDonut('donutChart', EH.catSpending(ST.getAll('transactions'), ST.getAll('categories')));
      Charts.drawLine('lineChart', EH.dailyTrend(ST.getAll('transactions'), 14));
    }, 100);
  },

  // ---------- TRANSACTIONS ----------
  renderTxns() {
    const cfg = U.getConfig();
    const cats = ST.getAll('categories');
    const hp = new URLSearchParams(window.location.hash.replace('#', ''));
    const f = {
      type: hp.get('type') || 'all',
      categoryId: hp.get('cat') || '',
      dateFrom: hp.get('from') || U.daysAgo(30),
      dateTo: hp.get('to') || U.today(),
      search: hp.get('q') || ''
    };
    const txns = EH.getTxns(f);
    const sum = EH.calcSum(txns);
    const grouped = {};
    txns.forEach(t => { if (!grouped[t.date]) grouped[t.date] = []; grouped[t.date].push(t); });
    const view = hp.get('view') || 'timeline';
    const timelineHTML = Object.entries(grouped).map(([date, ts]) => {
      const dSum = EH.calcSum(ts);
      return `<div class="tl-day-group"><div class="tl-day-hdr"><span>${U.fmtDate(date)}</span><span style="color:${dSum.balance>=0?'var(--income)':'var(--expense)'}">${dSum.balance>=0?'+':''}${U.fmtCurrency(dSum.balance, cfg.currency)}</span></div>
        ${ts.map(t => {
          const cat = cats.find(c => c.id === t.categoryId) || { icon: '❓', name: '?', color: '#ccc' };
          return `<div class="swipe-wrap" data-id="${t.id}"><div class="swipe-del-bg">🗑️</div><div class="swipe-content tl-item">
            <div class="tl-ico" style="background:${cat.color}22"><span style="font-size:1.1rem">${cat.icon}</span></div>
            <div class="tl-info"><div class="tl-name">${t.itemName || cat.name}</div><div class="tl-cat">${cat.name}${t.note ? ' • ' + t.note : ''}</div></div>
            <div class="tl-right"><span class="tl-amount" style="color:${t.type==='income'?'var(--income)':'var(--expense)'}">${t.type==='income'?'+':''}${U.fmtCurrency(t.amount, cfg.currency)}</span>
              <div class="tl-act"><button class="btn-ghost" style="padding:2px 3px;font-size:.7rem" data-te="${t.id}">✏️</button><button class="btn-ghost" style="padding:2px 3px;font-size:.7rem;color:var(--danger)" data-td="${t.id}">🗑️</button></div>
            </div>
          </div></div>`;
        }).join('')}
      </div>`;
    }).join('');

    return `<div class="stats-grid" style="grid-template-columns:repeat(3,1fr)"><div class="stat-card income"><div class="stat-label">รายรับ</div><div class="stat-value">${U.fmtCurrency(sum.totalIncome, cfg.currency)}</div></div><div class="stat-card expense"><div class="stat-label">รายจ่าย</div><div class="stat-value">${U.fmtCurrency(sum.totalExpense, cfg.currency)}</div></div><div class="stat-card balance"><div class="stat-label">คงเหลือ</div><div class="stat-value">${U.fmtCurrency(sum.balance, cfg.currency)}</div></div></div>
    <div class="card"><div class="card-header"><span class="card-title">📋 รายการ (${txns.length})</span>
      <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn ${view==='timeline'?'btn-primary':'btn-outline'} btn-sm" data-vt="timeline">📅 Timeline</button><button class="btn ${view==='table'?'btn-primary':'btn-outline'} btn-sm" data-vt="table">📊 ตาราง</button><button class="btn btn-primary btn-sm" id="btnAddT">➕</button><button class="btn btn-outline btn-sm" id="btnExpCSV">📥 CSV</button><button class="btn btn-outline btn-sm" id="btnImpCSV">📤</button><input type="file" id="csvFI" accept=".csv" style="display:none"></div>
    </div>
    <div class="filter-bar"><select id="fType"><option value="all" ${f.type==='all'?'selected':''}>ทั้งหมด</option><option value="income" ${f.type==='income'?'selected':''}>รายรับ</option><option value="expense" ${f.type==='expense'?'selected':''}>รายจ่าย</option></select><select id="fCat"><option value="">ทุกหมวดหมู่</option>${cats.map(c => `<option value="${c.id}" ${f.categoryId===c.id?'selected':''}>${c.icon} ${c.name}</option>`).join('')}</select><input type="date" id="fFrom" value="${f.dateFrom}"><input type="date" id="fTo" value="${f.dateTo}"><input type="text" id="fSearch" placeholder="🔍 ค้นหา..." value="${f.search}"><button class="btn btn-outline btn-sm" id="btnReset">🔄</button></div>
    ${view==='timeline' ? `<div id="tlContainer">${txns.length===0?'<div class="empty-state"><div class="empty-icon">📭</div>ยังไม่มีรายการ</div>':timelineHTML}</div>` : `<div class="table-wrap"><table><thead><tr><th>วันที่</th><th>ประเภท</th><th>หมวดหมู่</th><th>รายการ</th><th>จำนวน</th><th>หมายเหตุ</th><th></th></tr></thead><tbody>${txns.length===0?`<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-secondary)">ยังไม่มีรายการ</td></tr>`:txns.map(t=>{const cat=cats.find(c=>c.id===t.categoryId)||{icon:'❓',name:'?',color:'#ccc'};return`<tr><td style="font-size:.78rem">${U.fmtDate(t.date)}</td><td><span class="badge badge-${t.type}">${t.type==='income'?'รายรับ':'รายจ่าย'}</span></td><td><span class="cdot" style="background:${cat.color}"></span>${cat.icon} ${cat.name}</td><td style="font-size:.8rem">${t.itemName||'-'}</td><td style="font-weight:700;color:${t.type==='income'?'var(--income)':'var(--expense)'}">${U.fmtCurrency(t.amount, cfg.currency)}</td><td style="font-size:.78rem;color:var(--text-secondary)">${t.note||'-'}</td><td><button class="btn-ghost btnE" data-id="${t.id}">✏️</button><button class="btn-ghost btnD" data-id="${t.id}" style="color:var(--danger)">🗑️</button></td></tr>`}).join('')}</tbody></table></div>`}
    </div>`;
  },
  attachTxnEvents() {
    document.getElementById('btnAddT')?.addEventListener('click', () => POS.openModal(null, null, null));
    document.getElementById('btnExpCSV')?.addEventListener('click', () => {
      U.dlBlob(EH.exportCSV(ST.getAll('transactions'), ST.getAll('categories')), `txn_${U.today()}.csv`);
      U.toast('ส่งออก CSV สำเร็จ', 'success');
    });
    document.getElementById('btnImpCSV')?.addEventListener('click', () => document.getElementById('csvFI').click());
    document.getElementById('csvFI')?.addEventListener('change', e => {
      const f = e.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = ev => {
        const added = EH.importCSV(ev.target.result);
        U.toast(`นำเข้า ${added} รายการ`, 'success');
        App.rv('transactions');
      };
      r.readAsText(f);
      e.target.value = '';
    });
    document.getElementById('btnReset')?.addEventListener('click', () => { window.location.hash = ''; App.rv('transactions'); });
    document.querySelectorAll('[data-vt]').forEach(btn => btn.addEventListener('click', () => {
      const hp = new URLSearchParams(window.location.hash.replace('#', ''));
      hp.set('view', btn.dataset.vt);
      window.location.hash = hp.toString();
      App.rv('transactions');
    }));
    ['fType', 'fCat', 'fFrom', 'fTo'].forEach(id => document.getElementById(id)?.addEventListener('change', () => this.applyTxnFilter()));
    document.getElementById('fSearch')?.addEventListener('input', () => this.applyTxnFilter());
    const editFn = (id) => { const t = ST.getById('transactions', id); if (t) POS.openModal(null, null, t); };
    const delFn = async (id) => {
      const ok = await U.confirm('ลบรายการนี้?');
      if (ok) deleteTransaction(id, () => App.rv('transactions'), () => App.rv('transactions'));
    };
    document.querySelectorAll('[data-te]').forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); editFn(btn.dataset.te); }));
    document.querySelectorAll('[data-td]').forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); delFn(btn.dataset.td); }));
    document.querySelectorAll('.btnE').forEach(btn => btn.addEventListener('click', () => editFn(btn.dataset.id)));
    document.querySelectorAll('.btnD').forEach(btn => btn.addEventListener('click', () => delFn(btn.dataset.id)));
    const tl = document.getElementById('tlContainer'); if (tl) initSwipe(tl);
  },
  applyTxnFilter() {
    const p = new URLSearchParams(window.location.hash.replace('#', ''));
    const type = document.getElementById('fType')?.value || 'all';
    if (type !== 'all') p.set('type', type); else p.delete('type');
    const cat = document.getElementById('fCat')?.value || '';
    if (cat) p.set('cat', cat); else p.delete('cat');
    const from = document.getElementById('fFrom')?.value || ''; if (from) p.set('from', from);
    const to = document.getElementById('fTo')?.value || ''; if (to) p.set('to', to);
    const q = document.getElementById('fSearch')?.value || ''; if (q) p.set('q', q); else p.delete('q');
    window.location.hash = p.toString();
    App.rv('transactions');
  },

  // ---------- REPORTS ----------
  renderReports() {
    const cfg = U.getConfig();
    const txns = ST.getAll('transactions');
    const cats = ST.getAll('categories');
    const now = new Date();
    const sel = new URLSearchParams(window.location.hash.replace('#', '')).get('month') ||
      `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const [sy, sm] = sel.split('-').map(Number);
    const mTxns = txns.filter(t => t.date.startsWith(sel));
    const sum = EH.calcSum(mTxns);
    const spending = EH.catSpending(mTxns, cats);
    const prevM = sm === 1 ? `${sy-1}-12` : `${sy}-${String(sm-1).padStart(2,'0')}`;
    const prevS = EH.calcSum(txns.filter(t => t.date.startsWith(prevM)));
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(sy, sm - 1 - i, 1);
      months.push({ label: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` });
    }
    return `<div class="card"><div class="card-header"><span class="card-title">📅 รายงานประจำเดือน</span><div style="display:flex;gap:7px;align-items:center"><input type="month" id="repM" value="${sel}" style="max-width:165px"><button class="btn btn-outline btn-sm" id="btnPrint">🖨️ PDF</button></div></div><div class="stats-grid" style="grid-template-columns:repeat(3,1fr)"><div class="stat-card income"><div class="stat-label">รายรับเดือนนี้</div><div class="stat-value">${U.fmtCurrency(sum.totalIncome, cfg.currency)}</div></div><div class="stat-card expense"><div class="stat-label">รายจ่ายเดือนนี้</div><div class="stat-value">${U.fmtCurrency(sum.totalExpense, cfg.currency)}</div></div><div class="stat-card balance"><div class="stat-label">คงเหลือ</div><div class="stat-value">${U.fmtCurrency(sum.balance, cfg.currency)}</div></div></div><div style="font-size:.78rem;color:var(--text-secondary)">เดือนก่อน: รายรับ ${U.fmtCurrency(prevS.totalIncome, cfg.currency)} | รายจ่าย ${U.fmtCurrency(prevS.totalExpense, cfg.currency)} | คงเหลือ ${U.fmtCurrency(prevS.balance, cfg.currency)}</div></div><div class="charts-row"><div class="card"><div class="card-header"><span class="card-title">📊 รายจ่าย 6 เดือน</span></div><div class="chart-container"><canvas id="barChart"></canvas></div></div><div class="card"><div class="card-header"><span class="card-title">🍩 สัดส่วนรายจ่ายเดือนนี้</span></div><div class="chart-container"><canvas id="repDonut"></canvas></div><div class="prog-legend">${spending.slice(0,6).map(s => `<div class="prog-legend-item"><span class="ldot" style="background:${s.color}"></span>${s.icon} ${s.name} (${s.percent.toFixed(1)}%)</div>`).join('')}</div></div></div><div class="card"><div class="card-header"><span class="card-title">📋 รายการเดือนนี้ (${mTxns.length})</span></div><div class="table-wrap"><table><thead><tr><th>วันที่</th><th>ประเภท</th><th>หมวดหมู่</th><th>รายการ</th><th>จำนวน</th><th>หมายเหตุ</th></tr></thead><tbody>${mTxns.length===0?`<tr><td colspan="6" style="text-align:center;padding:18px;color:var(--text-secondary)">ไม่มีรายการ</td></tr>`:mTxns.sort((a,b)=>new Date(b.date)-new Date(a.date)).map(t=>{const cat=cats.find(c=>c.id===t.categoryId)||{icon:'❓',name:'?',color:'#ccc'};return`<tr><td style="font-size:.78rem">${U.fmtDate(t.date)}</td><td><span class="badge badge-${t.type}">${t.type==='income'?'รายรับ':'รายจ่าย'}</span></td><td><span class="cdot" style="background:${cat.color}"></span>${cat.icon} ${cat.name}</td><td style="font-size:.8rem">${t.itemName||'-'}</td><td style="font-weight:700;color:${t.type==='income'?'var(--income)':'var(--expense)'}">${U.fmtCurrency(t.amount, cfg.currency)}</td><td style="font-size:.78rem;color:var(--text-secondary)">${t.note||'-'}</td></tr>`}).join('')}</tbody></table></div></div>`;
  },
  attachReportCharts() {
    const txns = ST.getAll('transactions');
    const cats = ST.getAll('categories');
    const sel = document.getElementById('repM')?.value || '';
    const [sy, sm] = sel.split('-').map(Number);
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(sy, sm - 1 - i, 1);
      months.push({ label: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` });
    }
    setTimeout(() => {
      Charts.drawBar('barChart', months.map(m => EH.calcSum(txns.filter(t => t.date.startsWith(m.label))).totalExpense), months.map(m => m.label.slice(2)));
      Charts.drawDonut('repDonut', EH.catSpending(txns.filter(t => t.date.startsWith(sel)), cats));
    }, 100);
    document.getElementById('repM')?.addEventListener('change', function() {
      window.location.hash = 'month=' + this.value;
      App.rv('reports');
    });
    document.getElementById('btnPrint')?.addEventListener('click', () => {
      window.print();
      U.toast('เปิด Print Dialog', 'info');
    });
  },

  // ---------- SETTINGS ----------
  renderSettings() {
    const cfg = U.getConfig();
    const cats = ST.getAll('categories');
    const items = ST.getAll('items');
    const accentColors = [
      { id: 'indigo', color: '#6366f1', label: 'Indigo' },
      { id: 'blue', color: '#3b82f6', label: 'Blue' },
      { id: 'green', color: '#10b981', label: 'Green' },
      { id: 'rose', color: '#f43f5e', label: 'Rose' },
      { id: 'orange', color: '#f97316', label: 'Orange' },
      { id: 'purple', color: '#8b5cf6', label: 'Purple' }
    ];
    return `<div class="card"><div class="card-header"><span class="card-title">⚙️ การตั้งค่า</span></div><div class="form-group"><label>ชื่อผู้ใช้</label><input type="text" id="sUN" value="${cfg.userName||'ผู้ใช้'}"></div><div class="form-group"><label>🤖 Anthropic API Key</label><input type="password" id="sApiKey" value="${cfg.apiKey||''}" placeholder="sk-ant-api03-..."><div style="font-size:.72rem;color:var(--text-secondary);margin-top:4px">ใช้สำหรับ AI Insights และ AI Chat · ไม่เปิดเผยข้อมูลออกนอกเครื่อง</div>${!cfg.apiKey?'<div style="font-size:.72rem;color:var(--danger);margin-top:2px">⚠️ ยังไม่ได้ตั้งค่า — ฟีเจอร์ AI จะยังไม่ทำงาน</div>':''}</div><div class="form-group"><label>สกุลเงิน</label><select id="sCur"><option value="THB" ${cfg.currency==='THB'?'selected':''}>บาท (฿)</option><option value="USD" ${cfg.currency==='USD'?'selected':''}>ดอลลาร์ ($)</option><option value="EUR" ${cfg.currency==='EUR'?'selected':''}>ยูโร (€)</option><option value="JPY" ${cfg.currency==='JPY'?'selected':''}>เยน (¥)</option><option value="GBP" ${cfg.currency==='GBP'?'selected':''}>ปอนด์ (£)</option></select></div><div class="form-group"><label>สีธีม (Accent Color)</label><div class="ac-swatches">${accentColors.map(ac=>`<div class="ac-sw ${(cfg.accent||'indigo')===ac.id?'active':''}" style="background:${ac.color}" data-ac="${ac.id}" title="${ac.label}"></div>`).join('')}</div></div><button class="btn btn-primary" id="btnSaveS">💾 บันทึก</button></div><div class="card"><div class="card-header"><span class="card-title">☁️ Cloud Sync</span><span id="syncStatus" class="sync-dot ${CloudSync.isLoggedIn()?'sync-synced':'sync-offline'}" title="${CloudSync.isLoggedIn()?'ซิงค์แล้ว':'ออฟไลน์'}">${CloudSync.isLoggedIn()?'✅':'☁️'}</span></div><p style="font-size:.8rem;color:var(--text-secondary);margin-bottom:12px">ซิงค์ข้อมูลกับ Firebase Firestore — ใช้ได้ทุกอุปกรณ์ iOS, Android, PC</p><div class="form-group"><label>Firebase Config (JSON)</label><textarea id="sFBConfig" rows="5" style="font-size:.72rem;font-family:monospace;resize:vertical" placeholder='&#123;"apiKey":"...","authDomain":"...","projectId":"...","storageBucket":"...","messagingSenderId":"...","appId":"..."&#125;'>${cfg.firebaseConfig||''}</textarea></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><button class="btn btn-primary btn-sm" id="btnSaveFB">💾 บันทึก Config</button>${CloudSync.isLoggedIn()?`<button class="btn btn-outline btn-sm" id="btnForcePush">⬆️ Push</button><button class="btn btn-outline btn-sm" id="btnForcePull">⬇️ Pull</button>`:''}</div><details style="margin-top:4px"><summary style="font-size:.78rem;color:var(--text-secondary);cursor:pointer">📋 วิธีตั้งค่า Firebase (ขยายดู)</summary><ol style="font-size:.74rem;color:var(--text-secondary);padding:8px 0 0 16px;line-height:2.1"><li>ไปที่ <b>console.firebase.google.com</b> → สร้างโปรเจคใหม่</li><li>เพิ่ม Web App (<b>&lt;/&gt;</b>) → คัดลอก <b>firebaseConfig</b> ทั้งก้อน JSON</li><li>เปิด <b>Firestore Database</b> → สร้างฐานข้อมูล → <b>Test Mode</b></li><li>เปิด <b>Authentication</b> → Sign-in method → เปิดใช้ <b>Google</b></li><li>เพิ่ม domain ที่ใช้งาน (localhost หรือ URL) ใน Authorized domains</li><li>วาง config → กด <b>บันทึก Config</b> → กด <b>☁️ Sign in</b> ใน sidebar</li></ol></details></div><div class="card"><div class="card-header"><span class="card-title">📁 หมวดหมู่ & รายการ</span><button class="btn btn-primary btn-sm" id="btnAddCat">➕ หมวดหมู่</button></div><div class="tabs"><div class="tab active" data-st="cats">หมวดหมู่ (${cats.length})</div><div class="tab" data-st="items">รายการ (${items.length})</div></div><div id="st-cats"><div class="table-wrap"><table><thead><tr><th>ไอคอน</th><th>ชื่อ</th><th>ประเภท</th><th>สี</th><th></th></tr></thead><tbody>${cats.map(c=>`<tr><td style="font-size:1.2rem">${c.icon}</td><td>${c.name}</td><td><span class="badge badge-${c.type}">${c.type==='income'?'รายรับ':'รายจ่าย'}</span></td><td><span class="cdot" style="background:${c.color}"></span>${c.color}</td><td>${c.isDefault?'':`<button class="btn-ghost btnEC" data-id="${c.id}">✏️</button><button class="btn-ghost btnDC" data-id="${c.id}" style="color:var(--danger)">🗑️</button>`}</td></tr>`).join('')}</tbody></table></div></div><div id="st-items" style="display:none"><div style="margin-bottom:7px"><button class="btn btn-success btn-sm" id="btnAddItem">➕ รายการ</button></div><div class="table-wrap"><table><thead><tr><th>ไอคอน</th><th>ชื่อ</th><th>หมวดหมู่</th><th>จำนวนเริ่มต้น</th><th></th></tr></thead><tbody>${items.map(i=>{const cat=cats.find(c=>c.id===i.categoryId)||{icon:'❓',name:'?'};return`<tr><td style="font-size:1rem">${i.icon}</td><td>${i.name}</td><td>${cat.icon} ${cat.name}</td><td>${U.fmtCurrency(i.defaultAmount, cfg.currency)}</td><td>${i.isDefault?'':`<button class="btn-ghost btnEI" data-id="${i.id}">✏️</button><button class="btn-ghost btnDI" data-id="${i.id}" style="color:var(--danger)">🗑️</button>`}</td></tr>`}).join('')}</tbody></table></div></div></div><div class="card"><div class="card-header"><span class="card-title">💾 สำรองข้อมูล</span></div><p style="color:var(--text-secondary);margin-bottom:10px;font-size:.84rem">Export ข้อมูลทั้งหมดเป็น JSON เพื่อสำรอง หรือ Import เพื่อกู้คืน</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-outline" id="btnExportJSON">📤 Export JSON</button><label class="btn btn-outline" style="cursor:pointer">📥 Import JSON<input type="file" id="inputImportJSON" accept=".json" style="display:none"></label></div></div><div class="card" style="border:2px solid var(--danger)"><div class="card-header"><span class="card-title" style="color:var(--danger)">⚠️ โซนอันตราย</span></div><p style="color:var(--text-secondary);margin-bottom:9px;font-size:.84rem">รีเซ็ตจะลบข้อมูลทั้งหมด</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-danger" id="btnReset">🗑️ รีเซ็ตทั้งหมด</button><button class="btn btn-outline btn-sm" id="btnResetOB">🎯 แสดง Onboarding ใหม่</button></div></div>`;
  },
  attachSettingsEvents() {
    document.getElementById('btnSaveS')?.addEventListener('click', () => {
      const accent = document.querySelector('.ac-sw.active')?.dataset.ac || 'indigo';
      U.updateConfig({ userName: document.getElementById('sUN').value || 'ผู้ใช้', currency: document.getElementById('sCur').value || 'THB', accent, apiKey: document.getElementById('sApiKey').value.trim() });
      App.updateUI(); App.applyTheme();
      U.toast('บันทึกแล้ว', 'success');
    });
    document.querySelectorAll('.ac-sw').forEach(sw => sw.addEventListener('click', () => {
      document.querySelectorAll('.ac-sw').forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
    }));
    document.getElementById('btnExportJSON')?.addEventListener('click', () => {
      const data = {};
      ['transactions','categories','items','recurring','budgets','wallet_accounts','credit_cards','account_transfers','installments','savings_goals','subscriptions','loan_plans'].forEach(k => { data[k] = ST.getAll(k); });
      data._config = U.getConfig();
      data._exportedAt = new Date().toISOString();
      data._version = '1';
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `expense-backup-${U.today()}.json`; a.click();
      URL.revokeObjectURL(url);
      U.toast('Export สำเร็จ 📤', 'success');
    });
    document.getElementById('inputImportJSON')?.addEventListener('change', async (e) => {
      const file = e.target.files[0]; if (!file) return;
      const ok = await U.confirm('⚠️ Import จะแทนที่ข้อมูลปัจจุบันทั้งหมด ยืนยัน?');
      if (!ok) { e.target.value = ''; return; }
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        ['transactions','categories','items','recurring','budgets','wallet_accounts','credit_cards','account_transfers','installments','savings_goals','subscriptions','loan_plans'].forEach(k => {
          if (Array.isArray(data[k])) localStorage.setItem('exp_' + k, JSON.stringify(data[k]));
        });
        if (data._config) localStorage.setItem('exp_config', JSON.stringify(data._config));
        U.toast('Import สำเร็จ 📥', 'success');
        App.applyTheme(); App.updateUI(); App.rv('settings');
      } catch (err) {
        U.toast('ไฟล์ไม่ถูกต้อง กรุณาใช้ไฟล์ backup เท่านั้น', 'error');
      }
      e.target.value = '';
    });
    document.getElementById('btnReset')?.addEventListener('click', async () => {
      const ok = await U.confirm('⚠️ ลบข้อมูลทั้งหมด?');
      if (ok) { ST.clearAll(); seedData(); seedWalletAccounts(); U.toast('รีเซ็ตแล้ว', 'success'); App.rv('settings'); }
    });
    document.getElementById('btnResetOB')?.addEventListener('click', () => {
      U.updateConfig({ onboarded: false });
      Onboarding.current = 0; Onboarding.show();
      U.toast('Onboarding แสดงแล้ว', 'info');
    });
    document.getElementById('btnAddCat')?.addEventListener('click', () => this.openCatModal());
    document.getElementById('btnAddItem')?.addEventListener('click', () => this.openItemModal());
    document.querySelectorAll('[data-st]').forEach(tab => tab.addEventListener('click', () => {
      document.querySelectorAll('[data-st]').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('st-cats').style.display = tab.dataset.st === 'cats' ? '' : 'none';
      document.getElementById('st-items').style.display = tab.dataset.st === 'items' ? '' : 'none';
    }));
    document.querySelectorAll('.btnEC').forEach(btn => btn.addEventListener('click', () => {
      const c = ST.getById('categories', btn.dataset.id); if (c) this.openCatModal(c);
    }));
    document.querySelectorAll('.btnDC').forEach(btn => btn.addEventListener('click', async () => {
      const ok = await U.confirm('ลบหมวดหมู่นี้?');
      if (ok) { ST.delete('categories', btn.dataset.id); U.toast('ลบแล้ว', 'success'); App.rv('settings'); }
    }));
    document.querySelectorAll('.btnEI').forEach(btn => btn.addEventListener('click', () => {
      const i = ST.getById('items', btn.dataset.id); if (i) this.openItemModal(i);
    }));
    document.querySelectorAll('.btnDI').forEach(btn => btn.addEventListener('click', async () => {
      const ok = await U.confirm('ลบรายการนี้?');
      if (ok) { ST.delete('items', btn.dataset.id); U.toast('ลบแล้ว', 'success'); App.rv('settings'); }
    }));
    document.getElementById('btnSaveFB')?.addEventListener('click', () => {
      const raw = document.getElementById('sFBConfig').value.trim();
      const isValid = raw => {
        try { JSON.parse(raw); return true; } catch {}
        try { const o = Function('"use strict";return (' + raw + ')')(); return !!(o && o.projectId); } catch {}
        return false;
      };
      if (raw && !isValid(raw)) { U.toast('Firebase Config ไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง', 'error'); return; }
      U.updateConfig({ firebaseConfig: raw });
      CloudSync.reinit();
      U.toast('บันทึก Firebase Config แล้ว ✅', 'success');
      setTimeout(() => App.rv('settings'), 500);
    });
    document.getElementById('btnForcePush')?.addEventListener('click', async () => {
      U.toast('กำลัง Push...', 'info');
      await CloudSync.push();
      U.toast('Push สำเร็จ ⬆️', 'success');
    });
    document.getElementById('btnForcePull')?.addEventListener('click', async () => {
      U.toast('กำลัง Pull...', 'info');
      await CloudSync.pull();
      App.updateUI(); App.rv(App.cv);
      U.toast('Pull สำเร็จ ⬇️', 'success');
    });
  },
  openCatModal(edit = null) {
    const isEdit = !!edit;
    const emojis = ['🍔','🚗','🛍️','🎬','💊','📚','🏠','💼','🎁','📌','☕','🎮','✈️','🐶','💻','📱','👕','💄','🏋️','🎵','📋','⛽','💡','📡','🛡️','💰','📊','🏦','💹','🎉','⏰'];
    const o = document.createElement('div'); o.className = 'modal-overlay';
    o.innerHTML = `<div class="modal"><h3>${isEdit?'✏️ แก้ไขหมวดหมู่':'➕ เพิ่มหมวดหมู่'}</h3><div class="form-group"><label>ไอคอน</label><div style="display:flex;flex-wrap:wrap;gap:4px;max-height:95px;overflow-y:auto" id="ep">${emojis.map(e => `<span style="font-size:1.25rem;cursor:pointer;padding:3px;border-radius:5px;border:2px solid ${isEdit && edit.icon===e ? 'var(--accent)' : 'transparent'}" data-e="${e}">${e}</span>`).join('')}</div><input type="hidden" id="cI" value="${isEdit ? edit.icon : '📌'}"></div><div class="form-group"><label>ชื่อ</label><input type="text" id="cN" value="${isEdit?edit.name:''}"></div><div class="form-group"><label>ประเภท</label><select id="cT"><option value="expense" ${!isEdit||edit.type==='expense'?'selected':''}>รายจ่าย</option><option value="income" ${isEdit&&edit.type==='income'?'selected':''}>รายรับ</option></select></div><div class="form-group"><label>สี</label><input type="color" id="cCl" value="${isEdit?edit.color:'#6366f1'}" style="height:34px;padding:3px"></div><div class="modal-actions"><button class="btn btn-outline" id="cc">ยกเลิก</button><button class="btn btn-primary" id="cs">บันทึก</button></div></div>`;
    document.getElementById('modalRoot').appendChild(o);
    o.querySelector('#cc').onclick = () => o.remove();
    o.onclick = e => { if (e.target === o) o.remove(); };
    o.querySelector('#cs').onclick = () => {
      const icon = o.querySelector('#cI').value;
      const name = o.querySelector('#cN').value.trim();
      const type = o.querySelector('#cT').value;
      const color = o.querySelector('#cCl').value;
      if (!name) { U.toast('กรุณากรอกชื่อ', 'error'); return; }
      if (isEdit) ST.update('categories', edit.id, { icon, name, type, color });
      else ST.add('categories', { icon, name, type, color, isDefault: false });
      U.toast(isEdit ? 'อัปเดตแล้ว' : 'เพิ่มแล้ว', 'success');
      o.remove(); App.rv('settings');
    };
    setTimeout(() => o.querySelectorAll('#ep span').forEach(el => el.addEventListener('click', function() {
      o.querySelectorAll('#ep span').forEach(s => s.style.borderColor = 'transparent');
      this.style.borderColor = 'var(--accent)';
      o.querySelector('#cI').value = this.dataset.e;
    })), 70);
  },
  openItemModal(edit = null) {
    const isEdit = !!edit;
    const cats = ST.getAll('categories');
    const emojis = ['🍔','🚗','🛍️','🎬','💊','📚','🏠','💼','🎁','📌','☕','🎮','✈️','💻','📱','👕','💄','🏋️','🎵','📋','⛽','💡','📡','🛡️','💰','📊','🏦','💹','🎉','⏰','🌅','☀️','🌙','🛵','🚖','🚆','🅿️','🚌','👨‍⚕️','🦷','💧','🏡'];
    const o = document.createElement('div'); o.className = 'modal-overlay';
    o.innerHTML = `<div class="modal"><h3>${isEdit?'✏️ แก้ไขรายการ':'➕ เพิ่มรายการ'}</h3><div class="form-group"><label>ไอคอน</label><div style="display:flex;flex-wrap:wrap;gap:4px;max-height:95px;overflow-y:auto" id="iep">${emojis.map(e => `<span style="font-size:1.2rem;cursor:pointer;padding:3px;border-radius:5px;border:2px solid ${isEdit && edit.icon===e ? 'var(--accent)' : 'transparent'}" data-e="${e}">${e}</span>`).join('')}</div><input type="hidden" id="iI" value="${isEdit?edit.icon:'📌'}"></div><div class="form-group"><label>ชื่อรายการ</label><input type="text" id="iN" value="${isEdit?edit.name:''}"></div><div class="form-group"><label>หมวดหมู่</label><select id="iC">${cats.map(c => `<option value="${c.id}" ${isEdit&&edit.categoryId===c.id?'selected':''}>${c.icon} ${c.name}</option>`).join('')}</select></div><div class="form-group"><label>จำนวนเงินเริ่มต้น</label><input type="number" id="iA" value="${isEdit?edit.defaultAmount:''}" placeholder="0.00" min="0" step="0.01"></div><div class="modal-actions"><button class="btn btn-outline" id="ic">ยกเลิก</button><button class="btn btn-primary" id="is">บันทึก</button></div></div>`;
    document.getElementById('modalRoot').appendChild(o);
    o.querySelector('#ic').onclick = () => o.remove();
    o.onclick = e => { if (e.target === o) o.remove(); };
    o.querySelector('#is').onclick = () => {
      const icon = o.querySelector('#iI').value;
      const name = o.querySelector('#iN').value.trim();
      const categoryId = o.querySelector('#iC').value;
      const defaultAmount = parseFloat(o.querySelector('#iA').value) || 0;
      if (!name) { U.toast('กรุณากรอกชื่อ', 'error'); return; }
      if (isEdit) ST.update('items', edit.id, { icon, name, categoryId, defaultAmount });
      else ST.add('items', { icon, name, categoryId, defaultAmount, isDefault: false });
      U.toast(isEdit ? 'อัปเดตแล้ว' : 'เพิ่มแล้ว', 'success');
      o.remove(); App.rv('settings');
    };
    setTimeout(() => o.querySelectorAll('#iep span').forEach(el => el.addEventListener('click', function() {
      o.querySelectorAll('#iep span').forEach(s => s.style.borderColor = 'transparent');
      this.style.borderColor = 'var(--accent)';
      o.querySelector('#iI').value = this.dataset.e;
    })), 70);
  },

  renderTrash() {
    const cfg = U.getConfig();
    const txns = ST.getAllDeleted('transactions');
    const cards = ST.getAllDeleted('credit_cards');
    const wallets = ST.getAllDeleted('wallet_accounts');
    const insts = ST.getAllDeleted('installments');
    const total = txns.length + cards.length + wallets.length;
    const catMap = Object.fromEntries(ST.getAll('categories').map(c => [c.id, c]));
    const txnRows = txns.map(t => {
      const cat = catMap[t.categoryId];
      const daysLeft = Math.max(0, 30 - Math.floor((Date.now() - new Date(t.deletedAt)) / 86400000));
      return `<div class="trash-item" data-tid="${t.id}" data-tc="transactions">
        <div class="trash-icon">${cat?.icon || '📌'}</div>
        <div class="trash-info">
          <div class="trash-name">${t.itemName || cat?.name || 'ไม่ระบุ'}</div>
          <div class="trash-meta">${U.fmtDate(t.date)} · <span class="${t.type==='expense'?'c-expense':'c-income'}">${t.type==='expense'?'-':'+'} ${U.fmtCurrency(t.amount, cfg.currency)}</span></div>
          <div class="trash-exp">ลบเมื่อ ${U.fmtDate(t.deletedAt)} · หมดอายุใน ${daysLeft} วัน</div>
        </div>
        <button class="btn btn-sm btn-outline trash-restore" data-rid="${t.id}" data-rc="transactions">↩ กู้คืน</button>
      </div>`;
    }).join('');
    const ccRows = cards.map(cc => {
      const daysLeft = Math.max(0, 30 - Math.floor((Date.now() - new Date(cc.deletedAt)) / 86400000));
      const linkedInsts = insts.filter(i => i.creditCardId === cc.id);
      return `<div class="trash-item" data-tid="${cc.id}" data-tc="credit_cards">
        <div class="trash-icon">💳</div>
        <div class="trash-info">
          <div class="trash-name">${cc.name}</div>
          <div class="trash-meta">วงเงิน ${U.fmtCurrency(cc.limit||0, cfg.currency)}${linkedInsts.length>0?` · แผนผ่อน ${linkedInsts.length} รายการ`:''}</div>
          <div class="trash-exp">ลบเมื่อ ${U.fmtDate(cc.deletedAt)} · หมดอายุใน ${daysLeft} วัน</div>
        </div>
        <button class="btn btn-sm btn-outline trash-restore" data-rid="${cc.id}" data-rc="credit_cards">↩ กู้คืน</button>
      </div>`;
    }).join('');
    const waRows = wallets.map(w => {
      const daysLeft = Math.max(0, 30 - Math.floor((Date.now() - new Date(w.deletedAt)) / 86400000));
      return `<div class="trash-item" data-tid="${w.id}" data-tc="wallet_accounts">
        <div class="trash-icon">${w.icon||'🏦'}</div>
        <div class="trash-info">
          <div class="trash-name">${w.name}</div>
          <div class="trash-meta">ยอดคงเหลือ ${U.fmtCurrency(w.balance||0, cfg.currency)}</div>
          <div class="trash-exp">ลบเมื่อ ${U.fmtDate(w.deletedAt)} · หมดอายุใน ${daysLeft} วัน</div>
        </div>
        <button class="btn btn-sm btn-outline trash-restore" data-rid="${w.id}" data-rc="wallet_accounts">↩ กู้คืน</button>
      </div>`;
    }).join('');
    document.getElementById('appContent').innerHTML = `
      <div class="page-header"><h2>🗑️ ถังขยะ</h2><p class="page-sub">รายการที่ลบจะถูกลบถาวรภายใน 30 วัน</p></div>
      ${total === 0 ? `<div class="empty-state"><div style="font-size:3rem">🗑️</div><p>ถังขยะว่างเปล่า</p></div>` : `
      <div class="card" style="margin-bottom:10px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:.85rem;color:var(--text-secondary)">${total} รายการในถังขยะ</span>
        <button class="btn btn-sm btn-danger" id="btnPurgeAll">🗑️ ล้างทั้งหมด</button>
      </div>
      ${txns.length>0?`<div class="section-title">รายการธุรกรรม (${txns.length})</div><div class="trash-list">${txnRows}</div>`:''}
      ${cards.length>0?`<div class="section-title">บัตรเครดิต (${cards.length})</div><div class="trash-list">${ccRows}</div>`:''}
      ${wallets.length>0?`<div class="section-title">บัญชีกระเป๋า (${wallets.length})</div><div class="trash-list">${waRows}</div>`:''}
      `}`;
  },

  attachTrashEvents() {
    document.getElementById('btnPurgeAll')?.addEventListener('click', async () => {
      const ok = await U.confirm('⚠️ ลบถาวรทั้งหมด ย้อนคืนไม่ได้ ยืนยัน?');
      if (!ok) return;
      ['transactions','credit_cards','wallet_accounts','installments'].forEach(c => {
        ST.getAllDeleted(c).forEach(i => ST.delete(c, i.id));
      });
      U.toast('ล้างถังขยะแล้ว', 'success');
      App.rv('trash');
    });
    document.querySelectorAll('.trash-restore').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.rid;
        const col = btn.dataset.rc;
        ST.restore(col, id);
        if (col === 'credit_cards') {
          ST.getAllDeleted('installments').filter(i => i.creditCardId === id).forEach(i => ST.restore('installments', i.id));
        }
        if (col === 'transactions') {
          const txn = ST.getById('transactions', id);
          if (txn?.installmentId) ST.restore('installments', txn.installmentId);
        }
        U.toast('กู้คืนแล้ว ✅', 'success');
        App.rv('trash');
      });
    });
  }
};