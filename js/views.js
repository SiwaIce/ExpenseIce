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
    // Spending forecast: average of last 3 months
    const forecastData = (() => {
      const now = new Date(); const results = [];
      for (let i = 1; i <= 3; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const m = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        const exp = txns.filter(t => t.date.startsWith(m) && t.type === 'expense').reduce((s,t) => s + Number(t.amount), 0);
        if (exp > 0) results.push(exp);
      }
      if (!results.length) return null;
      const avg = results.reduce((s,v) => s+v, 0) / results.length;
      const daysInMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
      const daysDone = now.getDate();
      const projected = Math.round((avg / daysInMonth) * daysInMonth);
      const soFar = mSum.totalExpense;
      const remaining = Math.max(0, projected - soFar);
      const pct = Math.min(100, Math.round(soFar / projected * 100));
      return { avg: Math.round(avg), projected, soFar, remaining, pct, daysDone, daysInMonth };
    })();
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
    ${forecastData ? `<div class="card" style="border-left:4px solid var(--accent)"><div class="card-header"><span class="card-title">🔮 คาดการณ์รายจ่ายเดือนนี้</span><span style="font-size:.72rem;color:var(--text-secondary)">อ้างอิงจาก 3 เดือนที่ผ่านมา</span></div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px"><div style="text-align:center;padding:9px;background:var(--bg-input);border-radius:9px"><div class="btag">ใช้ไปแล้ว</div><div style="font-weight:700;color:var(--expense);font-size:.88rem">${U.fmtCurrency(forecastData.soFar, cfg.currency)}</div></div><div style="text-align:center;padding:9px;background:var(--accent-light);border-radius:9px"><div class="btag">ประมาณการทั้งเดือน</div><div style="font-weight:700;color:var(--accent);font-size:.88rem">${U.fmtCurrency(forecastData.projected, cfg.currency)}</div></div><div style="text-align:center;padding:9px;background:${forecastData.pct>90?'var(--danger-light)':'var(--success-light)'};border-radius:9px"><div class="btag">คาดว่าเหลือ</div><div style="font-weight:700;color:${forecastData.pct>90?'var(--danger)':'var(--success)'};font-size:.88rem">${U.fmtCurrency(forecastData.remaining, cfg.currency)}</div></div></div><div style="margin-bottom:4px"><div style="display:flex;justify-content:space-between;font-size:.72rem;color:var(--text-secondary);margin-bottom:3px"><span>วันที่ ${forecastData.daysDone}/${forecastData.daysInMonth}</span><span>${forecastData.pct}% ของประมาณการ</span></div><div style="background:var(--border);border-radius:4px;height:8px"><div style="height:8px;border-radius:4px;background:${forecastData.pct>90?'var(--danger)':forecastData.pct>70?'var(--warning)':'var(--accent)'};width:${forecastData.pct}%;transition:width .5s"></div></div></div></div>` : ''}
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
    const wallets = ST.getAll('wallet_accounts');
    const creditCards = ST.getAll('credit_cards');
    const allAccounts = [...wallets.map(w => ({ id: w.id, label: `${w.icon} ${w.name}` })), ...creditCards.map(c => ({ id: c.id, label: `💳 ${c.name}` }))];
    const advOpen = localStorage.getItem('exp_advFilter') === '1';
    const f = {
      type: hp.get('type') || 'all',
      categoryId: hp.get('cat') || '',
      dateFrom: hp.get('from') || U.daysAgo(30),
      dateTo: hp.get('to') || U.today(),
      search: hp.get('q') || '',
      amountMin: hp.get('amin') || '',
      amountMax: hp.get('amax') || '',
      accountId: hp.get('acc') || '',
      hasReceipt: hp.get('rcpt') === '1'
    };
    const hasAdv = !!(f.amountMin || f.amountMax || f.accountId || f.hasReceipt);
    const totalActiveFilters = [f.type !== 'all', !!f.categoryId, !!f.search, !!f.amountMin, !!f.amountMax, !!f.accountId, f.hasReceipt].filter(Boolean).length;
    const filterOpen = localStorage.getItem('exp_txnFilter') === '1' || totalActiveFilters > 0 || advOpen;
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
            <div class="tl-info"><div class="tl-name">${t.itemName || cat.name}</div><div class="tl-cat">${cat.name}${(t.note && t.note !== 'undefined') ? ' • ' + t.note : ''}</div></div>
            <div class="tl-right">
              ${t.receiptUrl ? `<img src="${t.receiptUrl}" class="receipt-thumb" title="ดูใบเสร็จ" onclick="event.stopPropagation();window.open('${t.receiptUrl}','_blank')">` : ''}
              <span class="tl-amount" style="color:${t.type==='income'?'var(--income)':'var(--expense)'}">${t.type==='income'?'+':''}${U.fmtCurrency(t.amount, cfg.currency)}</span>
              <div class="tl-act"><button class="btn-ghost" data-te="${t.id}" title="แก้ไข">✏️</button><button class="btn-ghost" data-td="${t.id}" title="ลบ">🗑️</button><button class="btn-ghost" data-tr="${t.id}" title="ตั้งเป็นรายการประจำ">🔄</button></div>
            </div>
          </div></div>`;
        }).join('')}
      </div>`;
    }).join('');

    const activeCat = f.categoryId ? cats.find(c => c.id === f.categoryId) : null;
    const _fchip = t => `<span style="padding:1px 7px;background:var(--accent-light);border-radius:20px;font-size:.71rem;color:var(--accent);font-weight:600">${t}</span>`;
    const filterChipsHTML = [
      f.type !== 'all' ? _fchip(f.type === 'income' ? '💚 รายรับ' : '🔴 รายจ่าย') : '',
      activeCat ? _fchip(`${activeCat.icon} ${activeCat.name}`) : '',
      f.search ? _fchip(`🔍 ${f.search}`) : ''
    ].filter(Boolean).join('');

    return `<div class="stats-grid" style="grid-template-columns:repeat(3,1fr)"><div class="stat-card income"><div class="stat-label">รายรับ</div><div class="stat-value">${U.fmtCurrency(sum.totalIncome, cfg.currency)}</div></div><div class="stat-card expense"><div class="stat-label">รายจ่าย</div><div class="stat-value">${U.fmtCurrency(sum.totalExpense, cfg.currency)}</div></div><div class="stat-card balance"><div class="stat-label">คงเหลือ</div><div class="stat-value">${U.fmtCurrency(sum.balance, cfg.currency)}</div></div></div>
    <div class="card"><div class="card-header"><span class="card-title">📋 รายการ (${txns.length})</span>
      <div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center"><button class="btn ${view==='timeline'?'btn-primary':'btn-outline'} btn-sm" data-vt="timeline" title="ไทม์ไลน์">📅</button><button class="btn ${view==='table'?'btn-primary':'btn-outline'} btn-sm" data-vt="table" title="ตาราง">📊</button><button class="btn btn-primary btn-sm" id="btnAddT">➕ เพิ่ม</button><button class="btn btn-outline btn-sm" id="btnStmtScan" title="นำเข้า Statement">📄</button><button class="btn btn-outline btn-sm" id="btnSlipScan" title="สแกนสลิป">📲</button><button class="btn btn-outline btn-sm" id="btnExpCSV" title="Export CSV">📥</button><button class="btn btn-outline btn-sm" id="btnImpCSV" title="Import CSV">📤</button><input type="file" id="csvFI" accept=".csv" style="display:none"></div>
    </div>
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px">
      <div style="flex:1;display:flex;gap:3px;flex-wrap:wrap;align-items:center;min-width:0;overflow:hidden">${filterChipsHTML}<span style="font-size:.71rem;color:var(--text-secondary);white-space:nowrap">${f.dateFrom.slice(5).replace('-','/')} – ${f.dateTo.slice(5).replace('-','/')}</span></div>
      <button class="btn btn-sm ${filterOpen||totalActiveFilters>0?'btn-primary':'btn-outline'}" id="btnToggleFilter" style="flex-shrink:0;white-space:nowrap">🔍${totalActiveFilters>0?` (${totalActiveFilters})`:''} ${filterOpen?'▴':'▾'}</button>
      <button class="btn btn-outline btn-sm" id="btnReset" style="flex-shrink:0" title="ล้างตัวกรอง">🔄</button>
    </div>
    <div id="filterPanel" style="display:${filterOpen?'':'none'}">
    <div class="filter-bar">
      <select id="fType"><option value="all" ${f.type==='all'?'selected':''}>ทั้งหมด</option><option value="income" ${f.type==='income'?'selected':''}>รายรับ</option><option value="expense" ${f.type==='expense'?'selected':''}>รายจ่าย</option></select>
      <select id="fCat"><option value="">ทุกหมวดหมู่</option>${cats.map(c => `<option value="${c.id}" ${f.categoryId===c.id?'selected':''}>${c.icon} ${c.name}</option>`).join('')}</select>
      <input type="date" id="fFrom" value="${f.dateFrom}">
      <input type="date" id="fTo" value="${f.dateTo}">
      <input type="text" id="fSearch" placeholder="🔍 ชื่อ / หมายเหตุ..." value="${f.search}" style="min-width:130px">
      <button class="btn btn-sm ${(advOpen||hasAdv)?'btn-primary':'btn-outline'}" id="btnAdvFilter" title="ตัวกรองขั้นสูง" style="flex:0 0 auto">⚙️${hasAdv?' ✦':''}</button>
    </div>
    <div id="advFilterPanel" style="display:${advOpen||hasAdv?'flex':'none'};flex-wrap:wrap;gap:7px;padding:10px 12px;background:var(--bg-input);border-radius:10px;margin-bottom:10px;border:1px solid var(--border)">
      <div style="width:100%;font-size:.72rem;font-weight:700;color:var(--text-secondary);margin-bottom:2px">⚙️ ตัวกรองขั้นสูง</div>
      <select id="fAcc" style="flex:1;min-width:130px"><option value="">ทุกบัญชี</option>${allAccounts.map(a=>`<option value="${a.id}" ${f.accountId===a.id?'selected':''}>${a.label}</option>`).join('')}</select>
      <input type="number" id="fAmtMin" placeholder="จำนวนต่ำสุด" value="${f.amountMin}" min="0" style="flex:1;min-width:110px">
      <input type="number" id="fAmtMax" placeholder="จำนวนสูงสุด" value="${f.amountMax}" min="0" style="flex:1;min-width:110px">
      <label style="display:flex;align-items:center;gap:6px;font-size:.82rem;cursor:pointer;flex:0 0 auto;white-space:nowrap"><input type="checkbox" id="fHasReceipt" ${f.hasReceipt?'checked':''}> มีใบเสร็จเท่านั้น</label>
    </div>
    </div>
    ${view==='timeline' ? `<div id="tlContainer">${txns.length===0?'<div class="empty-state"><div class="empty-icon">📭</div>ยังไม่มีรายการ</div>':timelineHTML}</div>` : `<div class="table-wrap"><table><thead><tr><th>วันที่</th><th>ประเภท</th><th>หมวดหมู่</th><th>รายการ</th><th>จำนวน</th><th>หมายเหตุ</th><th></th></tr></thead><tbody>${txns.length===0?`<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-secondary)">ยังไม่มีรายการ</td></tr>`:txns.map(t=>{const cat=cats.find(c=>c.id===t.categoryId)||{icon:'❓',name:'?',color:'#ccc'};return`<tr><td style="font-size:.78rem">${U.fmtDate(t.date)}</td><td><span class="badge badge-${t.type}">${t.type==='income'?'รายรับ':'รายจ่าย'}</span></td><td><span class="cdot" style="background:${cat.color}"></span>${cat.icon} ${cat.name}</td><td style="font-size:.8rem">${t.itemName||'-'}</td><td style="font-weight:700;color:${t.type==='income'?'var(--income)':'var(--expense)'}">${U.fmtCurrency(t.amount, cfg.currency)}</td><td style="font-size:.78rem;color:var(--text-secondary)">${(t.note && t.note !== 'undefined') ? t.note : '-'}</td><td style="display:flex;gap:4px;padding:6px 10px"><button class="btn-ghost btnE" data-id="${t.id}" title="แก้ไข">✏️</button><button class="btn-ghost btnD" data-id="${t.id}" title="ลบ">🗑️</button></td></tr>`}).join('')}</tbody></table></div>`}
    </div>`;
  },
  attachTxnEvents() {
    document.getElementById('btnAddT')?.addEventListener('click', () => POS.openModal(null, null, null));
    document.getElementById('btnStmtScan')?.addEventListener('click', () => this.openStatementScanner());
    document.getElementById('btnSlipScan')?.addEventListener('click', () => this.openSlipScanner());
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
    document.getElementById('btnToggleFilter')?.addEventListener('click', () => {
      const panel = document.getElementById('filterPanel');
      if (!panel) return;
      const open = panel.style.display === 'none';
      panel.style.display = open ? '' : 'none';
      localStorage.setItem('exp_txnFilter', open ? '1' : '');
      const btn = document.getElementById('btnToggleFilter');
      if (btn) btn.className = `btn btn-sm ${open ? 'btn-primary' : 'btn-outline'}`;
    });
    document.querySelectorAll('[data-vt]').forEach(btn => btn.addEventListener('click', () => {
      const hp = new URLSearchParams(window.location.hash.replace('#', ''));
      hp.set('view', btn.dataset.vt);
      window.location.hash = hp.toString();
      App.rv('transactions');
    }));
    document.getElementById('btnAdvFilter')?.addEventListener('click', () => {
      const panel = document.getElementById('advFilterPanel');
      const open = panel.style.display === 'none';
      panel.style.display = open ? 'flex' : 'none';
      localStorage.setItem('exp_advFilter', open ? '1' : '');
      const btn = document.getElementById('btnAdvFilter');
      if (btn) { btn.className = `btn btn-sm ${open ? 'btn-primary' : 'btn-outline'}`; }
    });
    ['fType', 'fCat', 'fFrom', 'fTo', 'fAcc'].forEach(id => document.getElementById(id)?.addEventListener('change', () => this.applyTxnFilter()));
    ['fAmtMin', 'fAmtMax'].forEach(id => document.getElementById(id)?.addEventListener('input', () => this.applyTxnFilter()));
    document.getElementById('fSearch')?.addEventListener('input', () => this.applyTxnFilter());
    document.getElementById('fHasReceipt')?.addEventListener('change', () => this.applyTxnFilter());
    const editFn = (id) => { const t = ST.getById('transactions', id); if (t) POS.openModal(null, null, t); };
    const delFn = async (id) => {
      const ok = await U.confirm('ลบรายการนี้?');
      if (ok) deleteTransaction(id, () => App.rv('transactions'), () => App.rv('transactions'));
    };
    document.querySelectorAll('[data-te]').forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); editFn(btn.dataset.te); }));
    document.querySelectorAll('[data-td]').forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); delFn(btn.dataset.td); }));
    document.querySelectorAll('[data-tr]').forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation();
      const t = ST.getById('transactions', btn.dataset.tr);
      if (t && typeof RV !== 'undefined') {
        App.rv('recurring');
        setTimeout(() => RV.openModal({ name: t.itemName || '', type: t.type, amount: t.amount, categoryId: t.categoryId, dayOfMonth: new Date(t.date).getDate() }), 200);
      }
    }));
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
    const amin = document.getElementById('fAmtMin')?.value || ''; if (amin) p.set('amin', amin); else p.delete('amin');
    const amax = document.getElementById('fAmtMax')?.value || ''; if (amax) p.set('amax', amax); else p.delete('amax');
    const acc = document.getElementById('fAcc')?.value || ''; if (acc) p.set('acc', acc); else p.delete('acc');
    const rcpt = document.getElementById('fHasReceipt')?.checked; if (rcpt) p.set('rcpt', '1'); else p.delete('rcpt');
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
    return `<div class="card"><div class="card-header"><span class="card-title">📅 รายงานประจำเดือน</span><div style="display:flex;gap:7px;align-items:center"><input type="month" id="repM" value="${sel}" style="max-width:165px"><button class="btn btn-outline btn-sm" id="btnPrint">🖨️ PDF</button></div></div><div class="stats-grid" style="grid-template-columns:repeat(3,1fr)"><div class="stat-card income"><div class="stat-label">รายรับเดือนนี้</div><div class="stat-value">${U.fmtCurrency(sum.totalIncome, cfg.currency)}</div></div><div class="stat-card expense"><div class="stat-label">รายจ่ายเดือนนี้</div><div class="stat-value">${U.fmtCurrency(sum.totalExpense, cfg.currency)}</div></div><div class="stat-card balance"><div class="stat-label">คงเหลือ</div><div class="stat-value">${U.fmtCurrency(sum.balance, cfg.currency)}</div></div></div><div style="font-size:.78rem;color:var(--text-secondary)">เดือนก่อน: รายรับ ${U.fmtCurrency(prevS.totalIncome, cfg.currency)} | รายจ่าย ${U.fmtCurrency(prevS.totalExpense, cfg.currency)} | คงเหลือ ${U.fmtCurrency(prevS.balance, cfg.currency)}</div></div><div class="charts-row"><div class="card"><div class="card-header"><span class="card-title">📊 รายจ่าย 6 เดือน</span></div><div class="chart-container"><canvas id="barChart"></canvas></div></div><div class="card"><div class="card-header"><span class="card-title">🍩 สัดส่วนรายจ่ายเดือนนี้</span></div><div class="chart-container"><canvas id="repDonut"></canvas></div><div class="prog-legend">${spending.slice(0,6).map(s => `<div class="prog-legend-item"><span class="ldot" style="background:${s.color}"></span>${s.icon} ${s.name} (${s.percent.toFixed(1)}%)</div>`).join('')}</div></div></div><div class="card"><div class="card-header"><span class="card-title">📋 รายการเดือนนี้ (${mTxns.length})</span></div><div class="table-wrap"><table><thead><tr><th>วันที่</th><th>ประเภท</th><th>หมวดหมู่</th><th>รายการ</th><th>จำนวน</th><th>หมายเหตุ</th></tr></thead><tbody>${mTxns.length===0?`<tr><td colspan="6" style="text-align:center;padding:18px;color:var(--text-secondary)">ไม่มีรายการ</td></tr>`:mTxns.sort((a,b)=>new Date(b.date)-new Date(a.date)).map(t=>{const cat=cats.find(c=>c.id===t.categoryId)||{icon:'❓',name:'?',color:'#ccc'};return`<tr><td style="font-size:.78rem">${U.fmtDate(t.date)}</td><td><span class="badge badge-${t.type}">${t.type==='income'?'รายรับ':'รายจ่าย'}</span></td><td><span class="cdot" style="background:${cat.color}"></span>${cat.icon} ${cat.name}</td><td style="font-size:.8rem">${t.itemName||'-'}</td><td style="font-weight:700;color:${t.type==='income'?'var(--income)':'var(--expense)'}">${U.fmtCurrency(t.amount, cfg.currency)}</td><td style="font-size:.78rem;color:var(--text-secondary)">${(t.note && t.note !== 'undefined') ? t.note : '-'}</td></tr>`}).join('')}</tbody></table></div></div>`;
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

  // ---------- BANK STATEMENT SCANNER ----------
  openStatementScanner() {
    const cfg = U.getConfig();
    const cats = ST.getAll('categories');
    let pendingTxns = [];
    const o = document.createElement('div'); o.className = 'modal-overlay';
    o.innerHTML = `<div class="modal" style="max-width:560px">
      <h3>📄 Import Bank Statement</h3>
      <p style="font-size:.8rem;color:var(--text-secondary);margin-bottom:12px">ถ่ายรูปหรืออัพโหลดภาพ Statement ธนาคาร → AI จะอ่านรายการทั้งหมดให้อัตโนมัติ</p>
      <label class="btn btn-primary" style="cursor:pointer;display:inline-flex;align-items:center;gap:8px;margin-bottom:10px">
        📎 เลือกภาพ Statement
        <input type="file" id="stmtFile" accept="image/*" style="display:none">
      </label>
      <div id="stmtStatus" style="font-size:.8rem;margin-bottom:10px"></div>
      <div id="stmtPreview" style="display:none">
        <div style="font-weight:600;font-size:.85rem;margin-bottom:8px">รายการที่พบ — เลือกที่ต้องการ Import:</div>
        <div id="stmtList" style="max-height:320px;overflow-y:auto;display:flex;flex-direction:column;gap:4px"></div>
        <div style="margin-top:10px;display:flex;gap:6px;align-items:center">
          <label style="font-size:.78rem;display:flex;align-items:center;gap:4px;cursor:pointer"><input type="checkbox" id="stmtSelAll" checked> เลือกทั้งหมด</label>
          <span id="stmtCount" style="font-size:.75rem;color:var(--text-secondary);margin-left:auto"></span>
        </div>
      </div>
      <div class="modal-actions" style="margin-top:14px">
        <button class="btn btn-outline" id="stmtClose">ปิด</button>
        <button class="btn btn-primary" id="stmtImport" style="display:none">✅ Import รายการที่เลือก</button>
      </div>
    </div>`;
    document.getElementById('modalRoot').appendChild(o);
    o.querySelector('#stmtClose').onclick = () => o.remove();
    o.onclick = e => { if (e.target === o) o.remove(); };

    o.querySelector('#stmtSelAll')?.addEventListener('change', e => {
      o.querySelectorAll('.stmt-chk').forEach(c => { c.checked = e.target.checked; });
      _updateCount();
    });
    const _updateCount = () => {
      const sel = o.querySelectorAll('.stmt-chk:checked').length;
      const tot = o.querySelectorAll('.stmt-chk').length;
      const el = o.querySelector('#stmtCount'); if (el) el.textContent = `เลือก ${sel}/${tot} รายการ`;
    };

    // Compress + convert to JPEG via canvas (handles HEIC, large photos, etc.)
    const _prepareImage = (file) => new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX = 1600;
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

    o.querySelector('#stmtFile')?.addEventListener('change', async e => {
      const file = e.target.files[0]; if (!file) return;
      if (!AI._key()) { U.toast(AI._noKeyMsg().split('\n')[0], 'error'); return; }
      const status = o.querySelector('#stmtStatus');
      const sizeMB = (file.size / 1048576).toFixed(1);
      if (status) { status.style.color = 'var(--accent)'; status.textContent = `🔄 กำลังบีบอัดภาพ (${sizeMB} MB)...`; }
      try {
        const { b64, mimeType } = await _prepareImage(file);
        if (status) status.textContent = '🔄 AI กำลังอ่าน statement...';
        const prompt = `จากภาพ bank statement นี้ ให้สกัดรายการธุรกรรมทุกรายการ ตอบเป็น JSON array เท่านั้น ไม่มีข้อความอื่น:
[{"date":"YYYY-MM-DD","amount":0,"type":"expense","itemName":"ชื่อรายการ"}]
- type: "expense"=ถอน/จ่าย/เดบิต, "income"=ฝาก/รับ/เครดิต
- amount: ตัวเลขบวกเสมอ (ไม่มีลบ)
- date: YYYY-MM-DD (ปีปัจจุบัน ${new Date().getFullYear()} ถ้าไม่ระบุ)
- itemName: ชื่อร้านค้าหรือรายการ`;
        const text = await AI.vision(prompt, b64, mimeType, { maxTokens: 2000 });
        const clean = text.replace(/```json|```/g, '').trim();
        const match = clean.match(/\[[\s\S]*?\]/);
        pendingTxns = match ? JSON.parse(match[0]) : [];
        if (!pendingTxns.length) {
          if (status) { status.style.color = 'var(--warning,#f59e0b)'; status.textContent = '⚠️ ไม่พบรายการ — อาจเป็นเพราะภาพไม่ชัด หรือรูปแบบ statement ไม่ตรงมาตรฐาน'; }
          e.target.value = ''; return;
        }

        const preview = o.querySelector('#stmtPreview');
        const list = o.querySelector('#stmtList');
        if (preview) preview.style.display = '';
        if (list) list.innerHTML = pendingTxns.map((t, i) => {
          return `<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:var(--bg-input);border-radius:8px;font-size:.8rem">
            <input type="checkbox" class="stmt-chk" data-idx="${i}" checked>
            <span style="color:var(--text-secondary);flex-shrink:0;width:80px">${t.date}</span>
            <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.itemName||'รายการ'}</span>
            <span style="font-weight:700;color:${t.type==='income'?'var(--income)':'var(--expense)'};flex-shrink:0">${t.type==='income'?'+':'-'}${U.fmtCurrency(t.amount, cfg.currency)}</span>
          </div>`;
        }).join('');
        list?.querySelectorAll('.stmt-chk').forEach(c => c.addEventListener('change', _updateCount));
        _updateCount();
        if (status) { status.style.color = 'var(--success)'; status.textContent = `✅ พบ ${pendingTxns.length} รายการ`; }
        o.querySelector('#stmtImport').style.display = '';
        e.target.value = '';
      } catch(err) {
        const msg = err?.message || '';
        let hint = 'ลองรูปที่ชัดขึ้น หรืออัพโหลดใหม่';
        if (msg.includes('NO_KEY')) hint = 'ยังไม่ได้ตั้งค่า API Key';
        else if (msg.includes('โหลดภาพ')) hint = 'ไฟล์ภาพเปิดไม่ได้ (ลอง screenshot แทน)';
        else if (msg.toLowerCase().includes('size') || msg.includes('too large')) hint = 'ภาพใหญ่เกินไป ลอง screenshot แทน';
        if (status) { status.style.color = 'var(--danger)'; status.textContent = `⚠️ ${hint}`; }
        e.target.value = '';
      }
    });

    o.querySelector('#stmtImport')?.addEventListener('click', () => {
      const selected = [...o.querySelectorAll('.stmt-chk:checked')].map(c => pendingTxns[Number(c.dataset.idx)]).filter(Boolean);
      selected.forEach(t => {
        ST.add('transactions', { type: t.type || 'expense', amount: Number(t.amount) || 0, categoryId: '', itemName: t.itemName || 'รายการ', date: t.date || U.today(), note: 'นำเข้าจาก Statement' });
      });
      U.toast(`✅ Import ${selected.length} รายการแล้ว`, 'success');
      o.remove();
      App.rv('transactions');
    });
  },

  // ---------- SLIP SCANNER ----------
  openSlipScanner() {
    const cfg = U.getConfig();
    const cats = ST.getAll('categories');
    const o = document.createElement('div'); o.className = 'modal-overlay';
    o.innerHTML = `<div class="modal" style="max-width:460px">
      <h3>📲 สแกนสลิปโอนเงิน / PromptPay</h3>
      <p style="font-size:.8rem;color:var(--text-secondary);margin-bottom:12px">ถ่ายรูปหรืออัพโหลดสลิป → AI อ่านและบันทึกให้อัตโนมัติ รองรับ PromptPay, LINE Pay, สลิปธนาคาร</p>
      <label class="btn btn-primary" style="cursor:pointer;display:inline-flex;align-items:center;gap:8px;margin-bottom:10px">
        📷 เลือกรูปสลิป
        <input type="file" id="slipFile" accept="image/*" capture="environment" style="display:none">
      </label>
      <div id="slipStatus" style="font-size:.8rem;margin:10px 0"></div>
      <div id="slipPreview" style="display:none;background:var(--bg-input);border-radius:10px;padding:14px;margin-bottom:10px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div><div class="btag">จำนวนเงิน</div><div id="slipAmt" style="font-weight:700;color:var(--expense);font-size:1.1rem"></div></div>
          <div><div class="btag">วันที่</div><div id="slipDate" style="font-weight:600;font-size:.88rem"></div></div>
          <div style="grid-column:span 2"><div class="btag">รายการ / ผู้รับ</div><div id="slipName" style="font-weight:600;font-size:.88rem"></div></div>
          <div><div class="btag">ประเภท</div><div id="slipType" style="font-size:.85rem"></div></div>
          <div><div class="btag">หมวดหมู่</div><div id="slipCat" style="font-size:.85rem"></div></div>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-outline" id="slipClose">ปิด</button>
        <button class="btn btn-primary" id="slipSave" style="display:none">✅ บันทึกรายการ</button>
      </div>
    </div>`;
    document.getElementById('modalRoot').appendChild(o);
    o.querySelector('#slipClose').onclick = () => o.remove();
    o.onclick = e => { if (e.target === o) o.remove(); };
    let slipData = null;
    const _prep = (file) => new Promise((res, rej) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX = 1400; let w = img.width, h = img.height;
        if (w > MAX || h > MAX) { const r = Math.min(MAX/w, MAX/h); w = Math.round(w*r); h = Math.round(h*r); }
        const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        res({ b64: canvas.toDataURL('image/jpeg', 0.88).split(',')[1], mimeType: 'image/jpeg' });
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('โหลดภาพไม่ได้')); };
      img.src = url;
    });
    o.querySelector('#slipFile')?.addEventListener('change', async e => {
      const file = e.target.files[0]; if (!file) return;
      if (!AI._key()) { U.toast(AI._noKeyMsg().split('\n')[0], 'error'); return; }
      const status = o.querySelector('#slipStatus');
      if (status) { status.style.color = 'var(--accent)'; status.textContent = '🔄 AI กำลังอ่านสลิป...'; }
      try {
        const { b64, mimeType } = await _prep(file);
        const expCats = cats.filter(c => c.type === 'expense');
        const catList = expCats.map(c => `${c.id}:${c.name}`).join(', ');
        const text = await AI.vision(
          `จากรูปสลิปโอนเงิน/PromptPay/LINE Pay/ธนาคารนี้ ตอบเป็น JSON เท่านั้น:\n{"amount":<จำนวนเงิน>,"name":"<ชื่อผู้รับหรือรายการ>","date":"<YYYY-MM-DD>","type":"expense","categoryId":"<id หรือ null>"}\nหมวดหมู่: ${catList}\ntype: expense=โอนออก/จ่าย, income=รับเงิน`,
          b64, mimeType, { maxTokens: 350 }
        );
        const match = text.match(/\{[\s\S]*?\}/);
        if (!match) throw new Error('parse');
        slipData = JSON.parse(match[0]);
        const cat = cats.find(c => c.id === slipData.categoryId);
        const preview = o.querySelector('#slipPreview'); if (preview) preview.style.display = '';
        o.querySelector('#slipAmt').textContent = U.fmtCurrency(slipData.amount || 0, cfg.currency);
        o.querySelector('#slipDate').textContent = slipData.date || U.today();
        o.querySelector('#slipName').textContent = slipData.name || 'ไม่ระบุ';
        o.querySelector('#slipType').textContent = slipData.type === 'income' ? '💚 รายรับ' : '🔴 รายจ่าย';
        o.querySelector('#slipCat').textContent = cat ? `${cat.icon} ${cat.name}` : '❓ ไม่ระบุ';
        if (status) { status.style.color = 'var(--success)'; status.textContent = '✅ อ่านสลิปสำเร็จ'; }
        o.querySelector('#slipSave').style.display = '';
        e.target.value = '';
      } catch {
        if (status) { status.style.color = 'var(--danger)'; status.textContent = '⚠️ อ่านสลิปไม่ได้ ลองถ่ายรูปใหม่'; }
        e.target.value = '';
      }
    });
    o.querySelector('#slipSave')?.addEventListener('click', () => {
      if (!slipData) return;
      ST.add('transactions', { type: slipData.type || 'expense', amount: Number(slipData.amount) || 0, categoryId: slipData.categoryId || '', itemName: slipData.name || 'สลิปโอนเงิน', date: slipData.date || U.today(), note: 'สแกนจากสลิป' });
      U.toast('✅ บันทึกแล้ว', 'success');
      o.remove(); App.rv('transactions');
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
    const aiProv = cfg.aiProvider || 'claude';
    return `<div class="card"><div class="card-header"><span class="card-title">⚙️ การตั้งค่า</span></div><div class="form-group"><label>ชื่อผู้ใช้</label><input type="text" id="sUN" value="${cfg.userName||'ผู้ใช้'}"></div>
<div class="form-group"><label>🤖 AI Provider</label><div style="display:flex;gap:8px;margin-bottom:8px"><button class="btn btn-sm ${aiProv==='claude'?'btn-primary':'btn-outline'}" id="sPrvClaude" data-prv="claude">🟣 Claude (Anthropic)</button><button class="btn btn-sm ${aiProv==='gemini'?'btn-primary':'btn-outline'}" id="sPrvGemini" data-prv="gemini">🔵 Gemini (Google)</button></div><input type="hidden" id="sAiProvider" value="${aiProv}"></div>
<div class="form-group" id="grpClaudeKey" style="${aiProv==='gemini'?'display:none':''}"><label>Anthropic API Key <span style="font-size:.7rem;color:var(--text-secondary)">(Claude)</span></label><input type="password" id="sApiKey" value="${cfg.apiKey||''}" placeholder="sk-ant-api03-..."><div style="font-size:.72rem;color:var(--text-secondary);margin-top:4px">รับได้ที่ console.anthropic.com · มีค่าใช้จ่าย</div>${aiProv==='claude'&&!cfg.apiKey?'<div style="font-size:.72rem;color:var(--danger);margin-top:2px">⚠️ ยังไม่ได้ตั้งค่า</div>':''}</div>
<div class="form-group" id="grpGeminiKey" style="${aiProv!=='gemini'?'display:none':''}"><label>Gemini API Key <span style="font-size:.7rem;color:var(--success)">✅ ฟรี!</span></label><input type="password" id="sGeminiKey" value="${cfg.geminiApiKey||''}" placeholder="AIzaSy..."><div style="font-size:.72rem;color:var(--text-secondary);margin-top:4px">รับฟรีที่ aistudio.google.com · 1,500 req/วัน</div>${aiProv==='gemini'&&!cfg.geminiApiKey?'<div style="font-size:.72rem;color:var(--danger);margin-top:2px">⚠️ ยังไม่ได้ตั้งค่า</div>':''}</div><div class="form-group"><label>สกุลเงิน</label><select id="sCur"><option value="THB" ${cfg.currency==='THB'?'selected':''}>บาท (฿)</option><option value="USD" ${cfg.currency==='USD'?'selected':''}>ดอลลาร์ ($)</option><option value="EUR" ${cfg.currency==='EUR'?'selected':''}>ยูโร (€)</option><option value="JPY" ${cfg.currency==='JPY'?'selected':''}>เยน (¥)</option><option value="GBP" ${cfg.currency==='GBP'?'selected':''}>ปอนด์ (£)</option></select></div><div class="form-group"><label>สีธีม (Accent Color)</label><div class="ac-swatches">${accentColors.map(ac=>`<div class="ac-sw ${(cfg.accent||'indigo')===ac.id?'active':''}" style="background:${ac.color}" data-ac="${ac.id}" title="${ac.label}"></div>`).join('')}</div></div><button class="btn btn-primary" id="btnSaveS">💾 บันทึก</button></div><div class="card"><div class="card-header"><span class="card-title">☁️ Cloud Sync</span><span id="syncStatus" class="sync-dot ${CloudSync.isLoggedIn()?'sync-synced':'sync-offline'}" title="${CloudSync.isLoggedIn()?'ซิงค์แล้ว':'ออฟไลน์'}">${CloudSync.isLoggedIn()?'✅':'☁️'}</span></div><p style="font-size:.8rem;color:var(--text-secondary);margin-bottom:12px">ซิงค์ข้อมูลกับ Firebase Firestore — ใช้ได้ทุกอุปกรณ์ iOS, Android, PC</p><div class="form-group"><label>Firebase Config (JSON)</label><textarea id="sFBConfig" rows="5" style="font-size:.72rem;font-family:monospace;resize:vertical" placeholder='&#123;"apiKey":"...","authDomain":"...","projectId":"...","storageBucket":"...","messagingSenderId":"...","appId":"..."&#125;'>${cfg.firebaseConfig||''}</textarea></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><button class="btn btn-primary btn-sm" id="btnSaveFB">💾 บันทึก Config</button>${CloudSync.isLoggedIn()?`<button class="btn btn-outline btn-sm" id="btnForcePush">⬆️ Push</button><button class="btn btn-outline btn-sm" id="btnForcePull">⬇️ Pull</button><button class="btn btn-outline btn-sm" id="btnCloudSignOut" style="color:var(--danger)">🚪 ออกจากระบบ</button>`:CloudSync.isConfigured()?`<button class="btn btn-success btn-sm" id="btnCloudSignIn">🔑 Sign in with Google</button>`:''}</div><details style="margin-top:4px"><summary style="font-size:.78rem;color:var(--text-secondary);cursor:pointer">📋 วิธีตั้งค่า Firebase (ขยายดู)</summary><ol style="font-size:.74rem;color:var(--text-secondary);padding:8px 0 0 16px;line-height:2.1"><li>ไปที่ <b>console.firebase.google.com</b> → สร้างโปรเจคใหม่</li><li>เพิ่ม Web App (<b>&lt;/&gt;</b>) → คัดลอก <b>firebaseConfig</b> ทั้งก้อน JSON</li><li>เปิด <b>Firestore Database</b> → สร้างฐานข้อมูล → <b>Test Mode</b></li><li>เปิด <b>Authentication</b> → Sign-in method → เปิดใช้ <b>Google</b></li><li>เพิ่ม domain ที่ใช้งาน (localhost หรือ URL) ใน Authorized domains</li><li>วาง config → กด <b>บันทึก Config</b> → กด <b>☁️ Sign in</b> ใน sidebar</li></ol></details></div><div class="card"><div class="card-header"><span class="card-title">📁 หมวดหมู่ & รายการ</span><button class="btn btn-primary btn-sm" id="btnAddCat">➕ หมวดหมู่</button></div><div class="tabs"><div class="tab active" data-st="cats">หมวดหมู่ (${cats.length})</div><div class="tab" data-st="items">รายการ (${items.length})</div></div><div id="st-cats"><div class="table-wrap"><table><thead><tr><th>ไอคอน</th><th>ชื่อ</th><th>ประเภท</th><th>สี</th><th></th></tr></thead><tbody>${cats.map(c=>`<tr><td style="font-size:1.2rem">${c.icon}</td><td>${c.name}</td><td><span class="badge badge-${c.type}">${c.type==='income'?'รายรับ':'รายจ่าย'}</span></td><td><span class="cdot" style="background:${c.color}"></span>${c.color}</td><td><button class="btn-ghost btnEC" data-id="${c.id}">✏️</button><button class="btn-ghost btnDC" data-id="${c.id}" style="color:var(--danger)">🗑️</button></td></tr>`).join('')}</tbody></table></div></div><div id="st-items" style="display:none"><div style="margin-bottom:7px"><button class="btn btn-success btn-sm" id="btnAddItem">➕ รายการ</button></div><div class="table-wrap"><table><thead><tr><th>ไอคอน</th><th>ชื่อ</th><th>หมวดหมู่</th><th>จำนวนเริ่มต้น</th><th></th></tr></thead><tbody>${items.map(i=>{const cat=cats.find(c=>c.id===i.categoryId)||{icon:'❓',name:'?'};return`<tr><td style="font-size:1rem">${i.icon}</td><td>${i.name}</td><td>${cat.icon} ${cat.name}</td><td>${U.fmtCurrency(i.defaultAmount, cfg.currency)}</td><td><button class="btn-ghost btnEI" data-id="${i.id}">✏️</button><button class="btn-ghost btnDI" data-id="${i.id}" style="color:var(--danger)">🗑️</button></td></tr>`}).join('')}</tbody></table></div></div></div><div class="card"><div class="card-header"><span class="card-title">💾 สำรองข้อมูล</span></div><p style="color:var(--text-secondary);margin-bottom:10px;font-size:.84rem">Export ข้อมูลทั้งหมดเป็น JSON เพื่อสำรอง หรือ Import เพื่อกู้คืน</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-outline" id="btnExportJSON">📤 Export JSON</button><button class="btn btn-outline" id="btnExportCSV">📊 Export CSV</button><label class="btn btn-outline" style="cursor:pointer">📥 Import JSON<input type="file" id="inputImportJSON" accept=".json" style="display:none"></label><label class="btn btn-outline" style="cursor:pointer">📋 Import CSV (ธนาคาร)<input type="file" id="inputImportCSV" accept=".csv,.txt" style="display:none"></label></div></div><div class="card"><div class="card-header"><span class="card-title">🔐 PIN Lock</span><span style="font-size:.72rem;color:var(--text-secondary)">${cfg.pinHash ? '✅ เปิดใช้งาน' : 'ปิดอยู่'}</span></div><p style="font-size:.8rem;color:var(--text-secondary);margin-bottom:12px">ป้องกันการเข้าถึงแอปด้วย PIN 4 หลัก</p><div style="display:flex;gap:8px;flex-wrap:wrap">${cfg.pinHash ? `<button class="btn btn-outline btn-sm" id="btnChangePin">🔄 เปลี่ยน PIN</button><button class="btn btn-outline btn-sm" id="btnRemovePin" style="color:var(--danger)">🗑️ ปิด PIN</button>` : `<button class="btn btn-primary btn-sm" id="btnSetPin">🔐 ตั้ง PIN</button>`}</div></div><div class="card" style="border:2px solid var(--danger)"><div class="card-header"><span class="card-title" style="color:var(--danger)">⚠️ โซนอันตราย</span></div><p style="color:var(--text-secondary);margin-bottom:9px;font-size:.84rem">รีเซ็ตจะลบข้อมูลทั้งหมด</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-danger" id="btnReset">🗑️ รีเซ็ตทั้งหมด</button><button class="btn btn-outline btn-sm" id="btnResetOB">🎯 แสดง Onboarding ใหม่</button></div></div>`;
  },
  attachSettingsEvents() {
    // AI provider toggle
    document.querySelectorAll('[data-prv]').forEach(btn => btn.addEventListener('click', () => {
      const prv = btn.dataset.prv;
      document.getElementById('sAiProvider').value = prv;
      document.querySelectorAll('[data-prv]').forEach(b => {
        b.className = `btn btn-sm ${b.dataset.prv === prv ? 'btn-primary' : 'btn-outline'}`;
      });
      document.getElementById('grpClaudeKey').style.display = prv === 'claude' ? '' : 'none';
      document.getElementById('grpGeminiKey').style.display = prv === 'gemini' ? '' : 'none';
    }));
    document.getElementById('btnSaveS')?.addEventListener('click', () => {
      const accent = document.querySelector('.ac-sw.active')?.dataset.ac || 'indigo';
      U.updateConfig({
        userName: document.getElementById('sUN').value || 'ผู้ใช้',
        currency: document.getElementById('sCur').value || 'THB',
        accent,
        apiKey: document.getElementById('sApiKey')?.value.trim() || '',
        geminiApiKey: document.getElementById('sGeminiKey')?.value.trim() || '',
        aiProvider: document.getElementById('sAiProvider')?.value || 'claude'
      });
      App.updateUI(); App.applyTheme();
      U.toast('บันทึกแล้ว', 'success');
    });
    document.querySelectorAll('.ac-sw').forEach(sw => sw.addEventListener('click', () => {
      document.querySelectorAll('.ac-sw').forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
    }));
    document.getElementById('btnExportCSV')?.addEventListener('click', () => {
      const cfg = U.getConfig();
      const cats = ST.getAll('categories');
      const accs = [...ST.getAll('wallet_accounts'), ...ST.getAll('credit_cards')];
      const rows = [['วันที่','ชื่อรายการ','หมวดหมู่','ประเภท','จำนวนเงิน','บัญชี','หมายเหตุ']];
      ST.getAll('transactions').sort((a,b) => a.date < b.date ? 1 : -1).forEach(t => {
        const cat = cats.find(c => c.id === t.categoryId);
        const acc = accs.find(a => a.id === t.accountId);
        rows.push([
          t.date, `"${(t.itemName||'').replace(/"/g,'""')}"`,
          `"${cat ? cat.name : ''}"`,
          t.type === 'income' ? 'รายรับ' : 'รายจ่าย',
          t.amount,
          `"${acc ? acc.name : ''}"`,
          `"${(t.note||'').replace(/"/g,'""')}"`
        ]);
      });
      const csv = '﻿' + rows.map(r => r.join(',')).join('\n');
      U.dlBlob(csv, `transactions-${U.today()}.csv`);
      U.toast('Export CSV สำเร็จ 📊', 'success');
    });
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
    document.getElementById('inputImportCSV')?.addEventListener('change', async (e) => {
      const file = e.target.files[0]; if (!file) return;
      try {
        const text = await file.text();
        this.openCSVImportModal(text);
      } catch { U.toast('อ่านไฟล์ไม่ได้', 'error'); }
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
      CloudSync._renderSidebar();
      U.toast('บันทึก Firebase Config แล้ว ✅ — กด Sign in with Google', 'success');
      setTimeout(() => App.rv('settings'), 600);
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
    document.getElementById('btnSetPin')?.addEventListener('click', () => PinLock.setup(() => App.rv('settings')));
    document.getElementById('btnChangePin')?.addEventListener('click', () => PinLock.setup(() => App.rv('settings')));
    document.getElementById('btnRemovePin')?.addEventListener('click', () => PinLock.remove());
    document.getElementById('btnCloudSignIn')?.addEventListener('click', () => CloudSync.signIn());
    document.getElementById('btnCloudSignOut')?.addEventListener('click', async () => {
      const ok = await U.confirm('ออกจากระบบ Cloud?');
      if (ok) { await CloudSync.signOut(); App.rv('settings'); }
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
  },
  openCSVImportModal(csvText) {
    const lines = csvText.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) { U.toast('ไฟล์ CSV ว่างเปล่า', 'error'); return; }
    const parse = line => line.split(',').map(c => c.trim().replace(/^"|"$/g,'').replace(/""/g,'"'));
    const headers = parse(lines[0]);
    const rows = lines.slice(1).map(parse).filter(r => r.some(c => c));
    const cats = ST.getAll('categories');
    const cfg = U.getConfig();
    const o = document.createElement('div'); o.className = 'modal-overlay';
    const colOpts = headers.map((h,i) => `<option value="${i}">${h}</option>`).join('');
    const noneOpt = `<option value="-1">-- ไม่ใช้ --</option>`;
    o.innerHTML = `<div class="modal" style="max-width:520px"><h3>📋 Import CSV จากธนาคาร</h3>
      <p style="font-size:.78rem;color:var(--text-secondary);margin-bottom:12px">พบ ${rows.length} แถว — เลือก column ที่ตรงกัน</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
        <div class="form-group"><label>วันที่</label><select id="csvDate">${colOpts}</select></div>
        <div class="form-group"><label>จำนวนเงิน</label><select id="csvAmt">${colOpts}</select></div>
        <div class="form-group"><label>รายการ/คำอธิบาย</label><select id="csvName">${noneOpt}${colOpts}</select></div>
        <div class="form-group"><label>ประเภท (ถ้ามี)</label><select id="csvType">${noneOpt}${colOpts}</select></div>
      </div>
      <div class="form-group"><label>หมวดหมู่เริ่มต้น</label><select id="csvCat">${cats.map(c=>`<option value="${c.id}">${c.icon} ${c.name}</option>`).join('')}</select></div>
      <div style="font-size:.74rem;color:var(--text-secondary);margin-bottom:12px">ตัวอย่าง 3 แถวแรก: ${rows.slice(0,3).map(r=>`<code style="display:block;font-size:.68rem;background:var(--bg-input);padding:2px 6px;border-radius:4px;margin-top:2px">${r.slice(0,5).join(' | ')}</code>`).join('')}</div>
      <div class="modal-actions"><button class="btn btn-outline" id="csvCan">ยกเลิก</button><button class="btn btn-primary" id="csvImport">📥 Import ${rows.length} รายการ</button></div>
    </div>`;
    document.getElementById('modalRoot').appendChild(o);
    o.querySelector('#csvCan').onclick = () => o.remove();
    o.onclick = e => { if (e.target === o) o.remove(); };
    o.querySelector('#csvImport').onclick = () => {
      const di = parseInt(o.querySelector('#csvDate').value);
      const ai = parseInt(o.querySelector('#csvAmt').value);
      const ni = parseInt(o.querySelector('#csvName').value);
      const ti = parseInt(o.querySelector('#csvType').value);
      const catId = o.querySelector('#csvCat').value;
      let count = 0;
      rows.forEach(r => {
        const rawDate = r[di]||''; const rawAmt = r[ai]||'';
        const amt = Math.abs(parseFloat(rawAmt.replace(/[^0-9.-]/g,'')));
        if (!amt || isNaN(amt)) return;
        const dateParts = rawDate.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})|(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
        let date = U.today();
        if (dateParts) {
          if (dateParts[1]) date = `${dateParts[1]}-${dateParts[2].padStart(2,'0')}-${dateParts[3].padStart(2,'0')}`;
          else { const y = dateParts[6].length===2?'20'+dateParts[6]:dateParts[6]; date = `${y}-${dateParts[5].padStart(2,'0')}-${dateParts[4].padStart(2,'0')}`; }
        }
        const rawType = ti >= 0 ? (r[ti]||'') : '';
        const type = /รับ|income|credit|เข้า/i.test(rawType) ? 'income' : 'expense';
        const itemName = ni >= 0 ? (r[ni]||'').slice(0,80) : 'นำเข้าจาก CSV';
        ST.add('transactions', { type, amount: amt, categoryId: catId, itemName, date, note: 'CSV import', accountId: '' });
        count++;
      });
      U.toast(`Import สำเร็จ ${count} รายการ ✅`, 'success');
      o.remove(); App.rv('transactions');
    };
  }
};