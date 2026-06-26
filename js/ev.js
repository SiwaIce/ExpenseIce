// ===== EV CHARGING CALCULATOR =====
const EVView = {
  _selProviderId: null,
  _customRate: 0,
  _amt: '',
  _startTime: '',
  _endTime: '',
  _startPct: 20,
  _endPct: 80,
  _pctTouched: false,
  _kwhConfirmed: '',
  _rangeConfirmed: '',
  _odo: '',
  _showExtra: false,

  // Providers are item_groups under cat_ev — same storage as every other subcategory,
  // so adding/editing/deleting here or from Settings > หมวดรอง stays in sync automatically.
  _providers() {
    return ST.getAll('item_groups').filter(g => g.categoryId === 'cat_ev')
      .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
  },

  _sortedTxns() {
    const key = t => t.date + 'T' + (t.createdAt || '');
    return ST.getAll('transactions').filter(t => t.categoryId === 'cat_ev').sort((a, b) => key(a).localeCompare(key(b)));
  },

  // Actual distance/cost-per-km is derived fresh every time from consecutive ODO
  // readings — never stored on the transaction. That means editing or deleting any
  // charge (or its ODO) self-heals the whole chain automatically on the next read,
  // with no manual relinking code and no risk of stale data.
  _evChain() {
    const txns = this._sortedTxns().filter(t => Number(t.evOdo) > 0);
    const map = new Map();
    for (let i = 0; i < txns.length - 1; i++) {
      const a = txns[i], b = txns[i + 1];
      const dist = Number(b.evOdo) - Number(a.evOdo);
      if (dist > 0) map.set(a.id, { distanceKm: dist, costPerKm: Number(a.amount) / dist });
    }
    return map;
  },

  _lastOdoTxn() {
    const sorted = this._sortedTxns().filter(t => Number(t.evOdo) > 0);
    return sorted[sorted.length - 1] || null;
  },

  _bestDistance(t, chain) {
    const actual = chain.get(t.id);
    return actual ? actual.distanceKm : (Number(t.evRangeKm) || 0);
  },

  // kWh delivered per 1% of battery filled — only computable for charges where the
  // % slider was actually used. A declining trend over time hints at battery degradation
  // (the same % span holds less real energy as max capacity shrinks).
  _battHealthSeries() {
    return this._sortedTxns()
      .filter(t => t.evStartPct !== undefined && t.evEndPct !== undefined && Number(t.evKwh) > 0 && Math.abs(Number(t.evEndPct) - Number(t.evStartPct)) > 0)
      .map(t => ({ date: t.date, kwhPerPct: Number(t.evKwh) / Math.abs(Number(t.evEndPct) - Number(t.evStartPct)) }));
  },

  _providerStats() {
    const chain = this._evChain();
    const map = {};
    this._sortedTxns().forEach(t => {
      const name = t.evProvider || 'ไม่ระบุ';
      if (!map[name]) map[name] = { name, count: 0, cost: 0, kwh: 0, distance: 0 };
      map[name].count++;
      map[name].cost += Number(t.amount);
      map[name].kwh += Number(t.evKwh) || 0;
      map[name].distance += this._bestDistance(t, chain);
    });
    return Object.values(map).map(p => ({
      ...p,
      avgRatePerKwh: p.kwh > 0 ? p.cost / p.kwh : 0,
      avgCostPerKm: p.distance > 0 ? p.cost / p.distance : 0
    })).sort((a, b) => b.count - a.count);
  },

  render() {
    const cfg = U.getConfig();
    const vehicle = cfg.evVehicle || null;
    const providers = this._providers();
    if (this._selProviderId === null && providers.length) this._selProviderId = providers[0].id;
    const isCustom = this._selProviderId === 'custom';
    const sel = !isCustom ? providers.find(p => p.id === this._selProviderId) : null;
    const rate = isCustom ? this._customRate : (sel ? Number(sel.rate) || 0 : 0);
    const r = this._calc(rate, vehicle);

    const chipsHTML = providers.map(p => `<span class="ev-chip ${p.id===this._selProviderId?'sel':''}" data-evp="${p.id}">${p.icon||'🔌'} ${p.name} · ${p.rate ? p.rate + '/kWh' : 'ยังไม่ตั้งอัตรา'}</span>`).join('')
      + `<span class="ev-chip ${isCustom?'sel':''}" data-evp="custom">✏️ กำหนดเอง</span>`;

    const lo = Math.min(this._startPct, this._endPct), hi = Math.max(this._startPct, this._endPct);
    const lastOdoTxn = this._lastOdoTxn();

    return `<div style="padding-bottom:20px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <h2 style="margin:0;font-size:1.1rem">⚡ คำนวณค่าชาร์จ EV</h2>
        <button class="btn btn-outline btn-sm" id="btnEvHistory">📜 ประวัติ</button>
      </div>

      <div class="card ev-calc-card">
        <div style="font-size:.78rem;opacity:.85;font-weight:600;margin-bottom:8px">เลือกผู้ให้บริการชาร์จ</div>
        <div class="ev-chip-row" id="evChipRow">${chipsHTML}</div>
        <div class="form-group" id="evCustomRateGrp" style="${isCustom ? '' : 'display:none'};margin-top:10px">
          <label style="color:rgba(255,255,255,.85)">อัตราค่าไฟ (บาท/kWh)</label>
          <input type="number" id="evCustomRate" value="${this._customRate || ''}" placeholder="7.5" min="0" step="0.01">
        </div>
        <div class="ev-amt-box">
          <div style="font-size:.7rem;opacity:.85;margin-bottom:4px">จำนวนเงินที่จ่าย</div>
          <input type="number" id="evAmt" value="${this._amt || ''}" placeholder="0" min="0" step="0.01">
        </div>

        <button type="button" id="btnEvToggleExtra" style="width:100%;background:rgba(255,255,255,.14);border:none;color:#fff;border-radius:10px;padding:8px;font-size:.74rem;font-weight:600;margin-bottom:${this._showExtra ? '12px' : '0'};cursor:pointer">🔋 รายละเอียดเพิ่มเติม (ไม่บังคับ) ${this._showExtra ? '▴' : '▾'}</button>

        <div id="evExtraGrp" style="${this._showExtra ? '' : 'display:none'}">
          <div style="display:flex;gap:8px;margin-bottom:12px">
            <div style="flex:1"><div class="ev-sub-label">⏱ เริ่มชาร์จ</div><input type="time" id="evStartTime" value="${this._startTime}"></div>
            <div style="flex:1"><div class="ev-sub-label">⏱ สิ้นสุด</div><input type="time" id="evEndTime" value="${this._endTime}"></div>
          </div>

          <div class="ev-sub-label">🔋 % แบตเตอรี่ — ลากเพื่อระบุช่วงที่ชาร์จ (ไม่ลาก = ไม่ใช้คำนวณ)</div>
          <div class="ev-batt-preview"><div class="ev-batt-fill" id="evBattFill" style="left:${lo}%;width:${hi-lo}%"></div></div>
          <div style="display:flex;justify-content:space-between;font-size:.66rem;opacity:.8;margin:2px 0 4px"><span>เริ่ม <b id="evStartPctLbl">${this._startPct}</b>%</span><span>จบ <b id="evEndPctLbl">${this._endPct}</b>%</span></div>
          <input type="range" id="evStartPct" class="ev-range" min="0" max="100" value="${this._startPct}">
          <input type="range" id="evEndPct" class="ev-range" min="0" max="100" style="margin-top:6px" value="${this._endPct}">
          <div style="text-align:center;font-size:.7rem;opacity:.9;margin:6px 0 12px" id="evBattDelta">${this._pctTouched ? `ได้แบตเพิ่ม <b>+${(hi-lo)}%</b>${vehicle ? ` · ประมาณ <b>${(((hi-lo)/100)*vehicle.batteryKwh).toFixed(1)} kWh</b>` : ''}` : 'ยังไม่ได้ลากระบุช่วง % แบต'}</div>

          <div style="display:flex;gap:8px;margin-bottom:12px">
            <div style="flex:1"><div class="ev-sub-label">หน่วยจริงจากเครื่องชาร์จ (kWh)</div><input type="number" id="evKwhConfirmed" value="${this._kwhConfirmed}" placeholder="เช่น 23.1" min="0" step="0.1"></div>
            <div style="flex:1"><div class="ev-sub-label">ระยะที่ได้จริง (กม.)</div><input type="number" id="evRangeConfirmed" value="${this._rangeConfirmed}" placeholder="เช่น 145" min="0" step="1"></div>
          </div>

          <div class="ev-sub-label">🛣 เลข ODO ก่อนชาร์จ (กม.)${lastOdoTxn ? ` <span style="font-weight:400;opacity:.75">— ครั้งก่อน: ${Number(lastOdoTxn.evOdo).toLocaleString()} กม.</span>` : ''}</div>
          <input type="number" id="evOdo" value="${this._odo}" placeholder="เช่น 12345" min="0" step="1">
          <div style="font-size:.66rem;opacity:.75;margin-top:3px">ใส่ทุกครั้งที่ชาร์จ ระบบจะคำนวณระยะทางที่ขับได้จริงจากการชาร์จครั้งก่อนให้อัตโนมัติ (ดูได้ใน 📜 ประวัติ)</div>
        </div>

        <div class="ev-res-grid" style="margin-top:12px">
          <div class="ev-res-box"><div class="ev-res-label">ได้ไฟ</div><div class="ev-res-val" id="evResKwh">${r.kwh.toFixed(1)} kWh</div></div>
          <div class="ev-res-box"><div class="ev-res-label">วิ่งได้ประมาณ</div><div class="ev-res-val" id="evResRange">${r.rangeKm > 0 ? r.rangeKm.toFixed(0) + ' กม.' : '–'}</div></div>
          <div class="ev-res-box"><div class="ev-res-label">% แบตที่ได้</div><div class="ev-res-val" id="evResBatt">${vehicle ? r.battPct.toFixed(1) + '%' : '–'}</div></div>
          <div class="ev-res-box"><div class="ev-res-label">ต้นทุน/กม.</div><div class="ev-res-val" id="evResCost">${r.rangeKm > 0 ? U.fmtCurrency(r.costPerKm, cfg.currency) : '–'}</div></div>
        </div>
        <button class="btn" id="btnEvSave" style="width:100%;margin-top:12px;background:#fff;color:#0d9488;font-weight:700">💾 บันทึกเป็นรายจ่าย</button>
      </div>

      ${this._fuelCompareHTML(cfg, r)}

      <div class="pos-section-label" style="margin-top:16px">🚗 รถของฉัน</div>
      <div class="card" style="display:flex;align-items:center;gap:10px">
        ${vehicle ? `
          <div class="ev-veh-ico">🚗</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:.86rem;font-weight:700">${vehicle.name || 'รถของฉัน'}</div>
            <div style="font-size:.74rem;color:var(--text-secondary)">แบตเตอรี่ ${vehicle.batteryKwh} kWh · ${vehicle.efficiencyKmPerKwh} กม./kWh</div>
          </div>
        ` : `<div style="flex:1;font-size:.82rem;color:var(--text-secondary)">ยังไม่ได้ตั้งค่ารถ — ตั้งค่าเพื่อให้คำนวณระยะทาง/ต้นทุนต่อกม.ได้</div>`}
        <button class="btn btn-outline btn-sm" id="btnEvVehicle">${vehicle ? 'แก้ไข' : 'ตั้งค่า'}</button>
      </div>

      <div class="pos-section-label" style="margin-top:16px;display:flex;justify-content:space-between;align-items:center">
        <span>🔌 ผู้ให้บริการชาร์จ</span>
        <button class="btn btn-outline btn-sm" id="btnEvAddProvider">+ เพิ่ม</button>
      </div>
      <div class="card" id="evProviderList">
        ${providers.length === 0 ? '<div style="font-size:.82rem;color:var(--text-secondary);text-align:center;padding:8px 0">ยังไม่มีผู้ให้บริการ</div>' : providers.map(p => `
          <div class="ev-provider-row" data-evgid="${p.id}">
            <span class="ev-drag-handle" data-evdrag="${p.id}">⠿</span>
            <span style="font-size:1.1rem">${p.icon||'🔌'}</span>
            <div style="flex:1;min-width:0">
              <div style="font-size:.82rem;font-weight:600">${p.name}</div>
              <div style="font-size:.72rem;color:var(--text-secondary)">${p.rate ? p.rate + ' บาท/kWh' : 'ยังไม่ตั้งอัตรา'}</div>
            </div>
            <button class="btn-ghost btn-sm" data-evpe="${p.id}">✏️</button>
            <button class="btn-ghost btn-sm" data-evpd="${p.id}">🗑️</button>
          </div>
        `).join('')}
      </div>

      ${this._statsHTML(cfg)}
    </div>`;
  },

  _fuelCfg(cfg) {
    return cfg.evFuelCompare || { pricePerLiter: 35.5, kmPerLiter: 12 };
  },

  _fuelCompareHTML(cfg, r) {
    const fc = this._fuelCfg(cfg);
    const amt = Number(this._amt) || 0;
    const fuelCost = r.rangeKm > 0 && fc.kmPerLiter > 0 ? (r.rangeKm / fc.kmPerLiter) * fc.pricePerLiter : 0;
    const savings = fuelCost - amt;
    const savingsPct = fuelCost > 0 ? (savings / fuelCost) * 100 : 0;
    return `
      <div class="pos-section-label" style="margin-top:16px;display:flex;justify-content:space-between;align-items:center">
        <span>⛽ เทียบกับรถน้ำมัน</span>
        <button class="btn btn-outline btn-sm" id="btnEvFuelCfg">✏️ ตั้งค่า</button>
      </div>
      <div class="card" id="evFuelCard">${this._fuelCompareInner(amt, fuelCost, savings, savingsPct, cfg, r)}</div>`;
  },

  _fuelCompareInner(amt, fuelCost, savings, savingsPct, cfg, r) {
    if (r.rangeKm <= 0) return `<div style="font-size:.82rem;color:var(--text-secondary);text-align:center;padding:6px 0">ตั้งค่ารถของฉันก่อน เพื่อเทียบกับรถน้ำมัน</div>`;
    return `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <div style="flex:1;text-align:center;background:var(--bg-input);border-radius:11px;padding:9px">
          <div style="font-size:.62rem;color:var(--text-secondary);margin-bottom:2px">⚡ ค่าไฟที่จ่าย</div>
          <div style="font-size:1rem;font-weight:800;color:#0d9488">${U.fmtCurrency(amt, cfg.currency)}</div>
        </div>
        <div style="font-size:1.1rem;color:var(--text-secondary)">vs</div>
        <div style="flex:1;text-align:center;background:var(--danger-light);border-radius:11px;padding:9px">
          <div style="font-size:.62rem;color:var(--text-secondary);margin-bottom:2px">⛽ ถ้าขับน้ำมัน (${r.rangeKm.toFixed(0)} กม.)</div>
          <div style="font-size:1rem;font-weight:800;color:var(--expense)">${U.fmtCurrency(fuelCost, cfg.currency)}</div>
        </div>
      </div>
      <div style="background:linear-gradient(135deg,#10b981,#0d9488);border-radius:12px;padding:11px 12px;text-align:center;color:#fff">
        <div style="font-size:.7rem;opacity:.9">${savings >= 0 ? 'ประหยัดไปครั้งนี้' : 'แพงกว่าน้ำมัน'}</div>
        <div style="font-size:1.3rem;font-weight:800">${U.fmtCurrency(Math.abs(savings), cfg.currency)} <span style="font-size:.78rem;font-weight:600;opacity:.9">(${Math.abs(savingsPct).toFixed(0)}%)</span></div>
      </div>`;
  },

  // Monthly summary, month-over-month delta, monthly budget target, all-time
  // totals, and a 6-month trend — kept here (not a separate view) since it's
  // specific to cat_ev transactions.
  _statsHTML(cfg) {
    const chain = this._evChain();
    const allEvTxns = ST.getAll('transactions').filter(t => t.categoryId === 'cat_ev');
    const month = U.thisMonth();
    const now = new Date();
    const lastMonthD = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = `${lastMonthD.getFullYear()}-${String(lastMonthD.getMonth()+1).padStart(2,'0')}`;

    const sumOf = txns => ({
      count: txns.length,
      kwh: txns.reduce((s, t) => s + (Number(t.evKwh) || 0), 0),
      cost: txns.reduce((s, t) => s + Number(t.amount), 0),
      range: txns.reduce((s, t) => s + this._bestDistance(t, chain), 0)
    });
    const thisM = sumOf(allEvTxns.filter(t => t.date.startsWith(month)));
    const prevM = sumOf(allEvTxns.filter(t => t.date.startsWith(lastMonth)));
    const all = sumOf(allEvTxns);
    const avgRateM = thisM.kwh > 0 ? thisM.cost / thisM.kwh : 0;
    const avgRateAll = all.kwh > 0 ? all.cost / all.kwh : 0;
    const deltaPct = prevM.cost > 0 ? ((thisM.cost - prevM.cost) / prevM.cost) * 100 : null;
    const fc = this._fuelCfg(cfg);
    const fuelCostAll = fc.kmPerLiter > 0 ? allEvTxns.reduce((s, t) => s + (this._bestDistance(t, chain) / fc.kmPerLiter) * fc.pricePerLiter, 0) : 0;
    const savingsAll = fuelCostAll - all.cost;
    const budget = Number(cfg.evMonthlyBudget) || 0;
    const budgetPct = budget > 0 ? Math.min(100, (thisM.cost / budget) * 100) : 0;
    const budgetCls = budgetPct < 70 ? 'bok' : budgetPct < 90 ? 'bwarn' : 'bover';

    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      months.push({ label: d.toLocaleDateString('th-TH', { month: 'short' }), cost: sumOf(allEvTxns.filter(t => t.date.startsWith(m))).cost });
    }
    const maxCost = Math.max(...months.map(m => m.cost), 1);

    return `
      <div class="pos-section-label" style="margin-top:16px">📊 สรุปค่าชาร์จเดือนนี้</div>
      <div class="card">
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center">
          <div><div class="btag">ชาร์จไป</div><div style="font-weight:800;font-size:.92rem">${thisM.count} ครั้ง</div></div>
          <div><div class="btag">รวม kWh</div><div style="font-weight:800;font-size:.92rem;color:#0d9488">${thisM.kwh.toFixed(1)} kWh</div></div>
          <div><div class="btag">รวมค่าไฟ</div><div style="font-weight:800;font-size:.92rem;color:var(--expense)">${U.fmtCurrency(thisM.cost, cfg.currency)}</div></div>
        </div>
        <div style="margin-top:8px;font-size:.74rem;color:var(--text-secondary);text-align:center">
          ${thisM.kwh > 0 ? `เฉลี่ย ${avgRateM.toFixed(2)} บาท/kWh` : ''}
          ${deltaPct !== null ? ` · เทียบเดือนก่อน <b style="color:${deltaPct>0?'var(--expense)':'var(--success)'}">${deltaPct>0?'▲':'▼'} ${Math.abs(deltaPct).toFixed(0)}%</b>` : ''}
        </div>
        <div class="ev-trend-bars">
          ${months.map(m => `<div class="ev-trend-col"><div class="ev-trend-bar" style="height:${maxCost>0?(m.cost/maxCost*100):0}%"></div><div class="ev-trend-lbl">${m.label}</div></div>`).join('')}
        </div>
      </div>

      <div class="pos-section-label" style="margin-top:16px;display:flex;justify-content:space-between;align-items:center">
        <span>🎯 เป้าหมายค่าชาร์จต่อเดือน</span>
        <button class="btn btn-outline btn-sm" id="btnEvBudget">✏️ ตั้งค่า</button>
      </div>
      <div class="card">
        ${budget > 0 ? `
          <div style="display:flex;justify-content:space-between;font-size:.8rem;margin-bottom:6px"><span>${U.fmtCurrency(thisM.cost, cfg.currency)} / ${U.fmtCurrency(budget, cfg.currency)}</span><span style="font-weight:700;color:${budgetPct>=100?'var(--danger)':'var(--text-secondary)'}">${budgetPct.toFixed(0)}%</span></div>
          <div class="sb-bar"><div class="sb-bar-fill ${budgetCls}" style="width:${budgetPct}%"></div></div>
        ` : `<div style="font-size:.82rem;color:var(--text-secondary);text-align:center;padding:6px 0">ยังไม่ได้ตั้งเป้าหมาย</div>`}
      </div>

      <div class="pos-section-label" style="margin-top:16px">🗂 สะสมทั้งหมด (All-time)</div>
      <div class="card">
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;text-align:center">
          <div><div class="btag">รวมค่าไฟทั้งหมด</div><div style="font-weight:800;font-size:.95rem;color:var(--expense)">${U.fmtCurrency(all.cost, cfg.currency)}</div></div>
          <div><div class="btag">รวม kWh ทั้งหมด</div><div style="font-weight:800;font-size:.95rem;color:#0d9488">${all.kwh.toFixed(1)} kWh</div></div>
          <div><div class="btag">ระยะทางสะสม</div><div style="font-weight:800;font-size:.95rem">${all.range > 0 ? all.range.toFixed(0) + ' กม.' : '–'}</div></div>
          <div><div class="btag">เฉลี่ย/kWh ทั้งหมด</div><div style="font-weight:800;font-size:.95rem">${all.kwh > 0 ? avgRateAll.toFixed(2) + ' บาท' : '–'}</div></div>
          <div style="grid-column:1/-1"><div class="btag">⛽ ${savingsAll >= 0 ? 'ประหยัดสะสม' : 'แพงกว่าน้ำมันสะสม'}</div><div style="font-weight:800;font-size:1rem;color:${savingsAll>=0?'#0d9488':'var(--expense)'}">${all.range > 0 ? U.fmtCurrency(Math.abs(savingsAll), cfg.currency) : '–'}</div></div>
        </div>
      </div>`;
  },

  attachEvents() {
    const amtEl = document.getElementById('evAmt');
    amtEl?.addEventListener('input', () => { this._amt = amtEl.value; this._updateResult(); });
    const rateEl = document.getElementById('evCustomRate');
    rateEl?.addEventListener('input', () => { this._customRate = parseFloat(rateEl.value) || 0; this._updateResult(); });
    document.querySelectorAll('[data-evp]').forEach(chip => chip.addEventListener('click', () => {
      this._selProviderId = chip.dataset.evp;
      document.querySelectorAll('[data-evp]').forEach(c => c.classList.remove('sel'));
      chip.classList.add('sel');
      const customGrp = document.getElementById('evCustomRateGrp');
      if (customGrp) customGrp.style.display = this._selProviderId === 'custom' ? '' : 'none';
      this._updateResult();
    }));
    document.getElementById('btnEvToggleExtra')?.addEventListener('click', () => { this._showExtra = !this._showExtra; App.rv('ev'); });
    document.getElementById('evStartTime')?.addEventListener('input', e => { this._startTime = e.target.value; });
    document.getElementById('evEndTime')?.addEventListener('input', e => { this._endTime = e.target.value; });
    const startEl = document.getElementById('evStartPct'), endEl = document.getElementById('evEndPct');
    const onPctChange = () => {
      this._pctTouched = true;
      this._startPct = parseInt(startEl.value) || 0;
      this._endPct = parseInt(endEl.value) || 0;
      this._updateBattPreview();
      this._updateResult();
    };
    startEl?.addEventListener('input', onPctChange);
    endEl?.addEventListener('input', onPctChange);
    document.getElementById('evKwhConfirmed')?.addEventListener('input', e => { this._kwhConfirmed = e.target.value; this._updateResult(); });
    document.getElementById('evRangeConfirmed')?.addEventListener('input', e => { this._rangeConfirmed = e.target.value; this._updateResult(); });
    document.getElementById('evOdo')?.addEventListener('input', e => { this._odo = e.target.value; });
    document.getElementById('btnEvHistory')?.addEventListener('click', () => this.openHistoryModal());
    document.getElementById('btnEvBudget')?.addEventListener('click', () => this.openBudgetModal());
    document.getElementById('btnEvSave')?.addEventListener('click', () => this._saveAsExpense());
    document.getElementById('btnEvFuelCfg')?.addEventListener('click', () => this.openFuelCompareModal());
    document.getElementById('btnEvVehicle')?.addEventListener('click', () => this.openVehicleModal());
    document.getElementById('btnEvAddProvider')?.addEventListener('click', () => this.openProviderModal());
    document.querySelectorAll('[data-evpe]').forEach(btn => btn.addEventListener('click', () => {
      const p = ST.getById('item_groups', btn.dataset.evpe); if (p) this.openProviderModal(p);
    }));
    document.querySelectorAll('[data-evpd]').forEach(btn => btn.addEventListener('click', async () => {
      const ok = await U.confirm('ลบผู้ให้บริการนี้?');
      if (ok) { ST.delete('item_groups', btn.dataset.evpd); if (this._selProviderId === btn.dataset.evpd) this._selProviderId = null; App.rv('ev'); }
    }));
    this._attachDragReorder();
  },

  // Long-press a provider row's handle, then drag up/down to reorder. The list
  // reorders live as the dragged row crosses a sibling's midpoint; the final
  // DOM order is committed to item_groups.order on release.
  _attachDragReorder() {
    const container = document.getElementById('evProviderList');
    if (!container) return;
    container.querySelectorAll('[data-evdrag]').forEach(handle => {
      handle.addEventListener('pointerdown', e => {
        const row = handle.closest('.ev-provider-row');
        let dragging = false;
        const longPressTimer = setTimeout(() => {
          dragging = true;
          row.classList.add('dragging');
        }, 160);
        const onMove = e2 => {
          if (!dragging) return;
          e2.preventDefault();
          const rows = [...container.querySelectorAll('.ev-provider-row')];
          const after = rows.find(r => {
            if (r === row) return false;
            const rect = r.getBoundingClientRect();
            return e2.clientY < rect.top + rect.height / 2;
          });
          if (after) container.insertBefore(row, after);
          else container.appendChild(row);
        };
        const onUp = () => {
          clearTimeout(longPressTimer);
          document.removeEventListener('pointermove', onMove);
          document.removeEventListener('pointerup', onUp);
          if (dragging) {
            row.classList.remove('dragging');
            const ids = [...container.querySelectorAll('.ev-provider-row')].map(r => r.dataset.evgid);
            ids.forEach((id, i) => ST.update('item_groups', id, { order: i }));
          }
        };
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
      });
    });
  },

  _updateBattPreview() {
    const lo = Math.min(this._startPct, this._endPct), hi = Math.max(this._startPct, this._endPct);
    const fill = document.getElementById('evBattFill');
    if (fill) { fill.style.left = lo + '%'; fill.style.width = (hi - lo) + '%'; }
    const sl = document.getElementById('evStartPctLbl'); if (sl) sl.textContent = this._startPct;
    const el = document.getElementById('evEndPctLbl'); if (el) el.textContent = this._endPct;
    const cfg = U.getConfig();
    const vehicle = cfg.evVehicle || null;
    const delta = document.getElementById('evBattDelta');
    if (delta) delta.innerHTML = `ได้แบตเพิ่ม <b>+${hi - lo}%</b>${vehicle ? ` · ประมาณ <b>${((hi - lo) / 100 * vehicle.batteryKwh).toFixed(1)} kWh</b>` : ''}`;
  },

  // Priority for accuracy: confirmed reading from the charger/trip computer > battery
  // % delta against the known pack size (only once the user has actually dragged the
  // sliders — the 20/80 default position is just a UI placeholder, not real data) >
  // a plain rate-based estimate from the price paid.
  _calc(rate, vehicle) {
    const amt = Number(this._amt) || 0;
    const kwhFromRate = rate > 0 ? amt / rate : 0;
    const pctDelta = Math.abs(this._endPct - this._startPct);
    const kwhFromPct = this._pctTouched && vehicle && pctDelta > 0 ? (pctDelta / 100) * Number(vehicle.batteryKwh) : 0;
    const kwhConfirmed = Number(this._kwhConfirmed) || 0;
    const kwh = kwhConfirmed > 0 ? kwhConfirmed : (kwhFromPct > 0 ? kwhFromPct : kwhFromRate);
    const rangeConfirmed = Number(this._rangeConfirmed) || 0;
    const rangeKm = rangeConfirmed > 0 ? rangeConfirmed : (vehicle ? kwh * (Number(vehicle.efficiencyKmPerKwh) || 0) : 0);
    const battPct = vehicle && vehicle.batteryKwh ? Math.min(100, (kwh / Number(vehicle.batteryKwh)) * 100) : 0;
    const costPerKm = rangeKm > 0 ? amt / rangeKm : 0;
    return { rate, kwh, rangeKm, battPct, costPerKm };
  },

  _updateResult() {
    const cfg = U.getConfig();
    const vehicle = cfg.evVehicle || null;
    const providers = this._providers();
    const isCustom = this._selProviderId === 'custom';
    const sel = !isCustom ? providers.find(p => p.id === this._selProviderId) : null;
    const rate = isCustom ? this._customRate : (sel ? Number(sel.rate) || 0 : 0);
    const r = this._calc(rate, vehicle);
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('evResKwh', r.kwh.toFixed(1) + ' kWh');
    set('evResRange', r.rangeKm > 0 ? r.rangeKm.toFixed(0) + ' กม.' : '–');
    set('evResBatt', vehicle ? r.battPct.toFixed(1) + '%' : '–');
    set('evResCost', r.rangeKm > 0 ? U.fmtCurrency(r.costPerKm, cfg.currency) : '–');
    const fc = this._fuelCfg(cfg);
    const amt = Number(this._amt) || 0;
    const fuelCost = r.rangeKm > 0 && fc.kmPerLiter > 0 ? (r.rangeKm / fc.kmPerLiter) * fc.pricePerLiter : 0;
    const savings = fuelCost - amt;
    const savingsPct = fuelCost > 0 ? (savings / fuelCost) * 100 : 0;
    const fuelCard = document.getElementById('evFuelCard');
    if (fuelCard) fuelCard.innerHTML = this._fuelCompareInner(amt, fuelCost, savings, savingsPct, cfg, r);
  },

  _saveAsExpense() {
    const amt = Number(this._amt) || 0;
    if (amt <= 0) { U.toast('กรุณากรอกจำนวนเงินที่จ่าย', 'error'); return; }
    const cfg = U.getConfig();
    const vehicle = cfg.evVehicle || null;
    const providers = this._providers();
    const isCustom = this._selProviderId === 'custom';
    const sel = !isCustom ? providers.find(p => p.id === this._selProviderId) : null;
    const rate = isCustom ? this._customRate : (sel ? Number(sel.rate) || 0 : 0);
    const r = this._calc(rate, vehicle);
    const providerName = isCustom ? 'กำหนดเอง' : (sel ? sel.name : 'ไม่ระบุ');
    const odo = Number(this._odo) || 0;
    POS.type = 'expense';
    POS.openModal(null, 'cat_ev', null, {
      name: `ชาร์จรถ EV (${providerName})`,
      amount: amt,
      date: U.today(),
      groupId: sel ? sel.id : '',
      extra: {
        evKwh: r.kwh, evProvider: providerName, evRate: rate, evRangeKm: r.rangeKm,
        evStartTime: this._startTime, evEndTime: this._endTime,
        ...(this._pctTouched ? { evStartPct: this._startPct, evEndPct: this._endPct } : {}),
        ...(odo > 0 ? { evOdo: odo } : {})
      }
    });
  },

  openVehicleModal() {
    const cfg = U.getConfig();
    const v = cfg.evVehicle || { name: '', batteryKwh: '', efficiencyKmPerKwh: '' };
    const o = document.createElement('div'); o.className = 'modal-overlay';
    o.innerHTML = `<div class="modal" style="max-width:360px">
      <h3>🚗 ตั้งค่ารถของฉัน</h3>
      <div class="form-group"><label>ชื่อรุ่นรถ</label><input type="text" id="evVName" value="${v.name || ''}" placeholder="เช่น Tesla Model 3"></div>
      <div class="form-group"><label>ความจุแบตเตอรี่ (kWh)</label><input type="number" id="evVBatt" value="${v.batteryKwh || ''}" placeholder="60" min="0" step="0.1"></div>
      <div class="form-group"><label>อัตราสิ้นเปลือง (กม./kWh)</label><input type="number" id="evVEff" value="${v.efficiencyKmPerKwh || ''}" placeholder="6.0" min="0" step="0.1"></div>
      <div style="font-size:.72rem;color:var(--text-secondary);margin:-4px 0 10px">แนะนำใช้ค่าเฉลี่ยจริงจากการขับสะสม แม่นยำกว่าค่าที่ค่ายรถแจ้งหรือเลขหน้าปัด ซึ่งแปรผันตามการขับแต่ละครั้ง</div>
      <div class="modal-actions"><button class="btn btn-outline" id="evVCan">ยกเลิก</button><button class="btn btn-primary" id="evVSave">💾 บันทึก</button></div>
    </div>`;
    document.getElementById('modalRoot').appendChild(o);
    o.querySelector('#evVCan').onclick = () => o.remove();
    o.onclick = e => { if (e.target === o) o.remove(); };
    o.querySelector('#evVSave').onclick = () => {
      const batteryKwh = parseFloat(o.querySelector('#evVBatt').value) || 0;
      const efficiencyKmPerKwh = parseFloat(o.querySelector('#evVEff').value) || 0;
      if (batteryKwh <= 0 || efficiencyKmPerKwh <= 0) { U.toast('กรุณากรอกความจุแบตและอัตราสิ้นเปลือง', 'error'); return; }
      U.updateConfig({ evVehicle: { name: o.querySelector('#evVName').value.trim(), batteryKwh, efficiencyKmPerKwh } });
      U.toast('บันทึกแล้ว ✅', 'success');
      o.remove(); App.rv('ev');
    };
  },

  openFuelCompareModal() {
    const cfg = U.getConfig();
    const fc = this._fuelCfg(cfg);
    const o = document.createElement('div'); o.className = 'modal-overlay';
    o.innerHTML = `<div class="modal" style="max-width:340px">
      <h3>⛽ ตั้งค่าเทียบรถน้ำมัน</h3>
      <div class="form-group"><label>ราคาน้ำมัน (บาท/ลิตร)</label><input type="number" id="evFcPrice" value="${fc.pricePerLiter}" placeholder="35.5" min="0" step="0.1"></div>
      <div class="form-group"><label>อัตราสิ้นเปลือง (กม./ลิตร)</label><input type="number" id="evFcKm" value="${fc.kmPerLiter}" placeholder="12" min="0" step="0.1"></div>
      <div class="modal-actions"><button class="btn btn-outline" id="evFcCan">ยกเลิก</button><button class="btn btn-primary" id="evFcSave">💾 บันทึก</button></div>
    </div>`;
    document.getElementById('modalRoot').appendChild(o);
    o.querySelector('#evFcCan').onclick = () => o.remove();
    o.onclick = e => { if (e.target === o) o.remove(); };
    o.querySelector('#evFcSave').onclick = () => {
      const pricePerLiter = parseFloat(o.querySelector('#evFcPrice').value) || 0;
      const kmPerLiter = parseFloat(o.querySelector('#evFcKm').value) || 0;
      if (pricePerLiter <= 0 || kmPerLiter <= 0) { U.toast('กรุณากรอกราคาน้ำมันและอัตราสิ้นเปลือง', 'error'); return; }
      U.updateConfig({ evFuelCompare: { pricePerLiter, kmPerLiter } });
      U.toast('บันทึกแล้ว ✅', 'success');
      o.remove(); App.rv('ev');
    };
  },

  openBudgetModal() {
    const cfg = U.getConfig();
    const o = document.createElement('div'); o.className = 'modal-overlay';
    o.innerHTML = `<div class="modal" style="max-width:320px">
      <h3>🎯 เป้าหมายค่าชาร์จต่อเดือน</h3>
      <div class="form-group"><label>วงเงินต่อเดือน (บาท)</label><input type="number" id="evBudgetVal" value="${cfg.evMonthlyBudget || ''}" placeholder="เช่น 1000" min="0" step="10"></div>
      <div class="modal-actions"><button class="btn btn-outline" id="evBudgetCan">ยกเลิก</button><button class="btn btn-primary" id="evBudgetSave">💾 บันทึก</button></div>
    </div>`;
    document.getElementById('modalRoot').appendChild(o);
    o.querySelector('#evBudgetCan').onclick = () => o.remove();
    o.onclick = e => { if (e.target === o) o.remove(); };
    o.querySelector('#evBudgetSave').onclick = () => {
      const val = parseFloat(o.querySelector('#evBudgetVal').value) || 0;
      U.updateConfig({ evMonthlyBudget: val });
      U.toast('บันทึกแล้ว ✅', 'success');
      o.remove(); App.rv('ev');
    };
  },

  openProviderModal(edit = null) {
    const isEdit = !!edit;
    const o = document.createElement('div'); o.className = 'modal-overlay';
    const icons = ['⚡', '🔌', '🏠', '🏪', '🛣️'];
    const selIcon = edit?.icon || icons[0];
    o.innerHTML = `<div class="modal" style="max-width:360px">
      <h3>${isEdit ? '✏️ แก้ไขผู้ให้บริการ' : '🔌 เพิ่มผู้ให้บริการชาร์จ'}</h3>
      <div class="form-group"><label>ชื่อผู้ให้บริการ</label><input type="text" id="evpName" value="${isEdit ? edit.name : ''}" placeholder="เช่น EA Anywhere"></div>
      <div class="form-group"><label>ไอคอน</label><div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:6px" id="evpIconPick">${icons.map(ic => `<span style="font-size:1.3rem;cursor:pointer;padding:3px 5px;border-radius:6px;border:2px solid ${selIcon===ic?'var(--accent)':'transparent'}" data-evpic="${ic}">${ic}</span>`).join('')}</div><input type="text" id="evpIcon" value="${selIcon}" maxlength="4" placeholder="หรือพิมพ์/วางอีโมจิเอง" style="width:120px;margin-top:6px;font-size:1.1rem;text-align:center"></div>
      <div class="form-group"><label>อัตราค่าไฟ (บาท/kWh)</label><input type="number" id="evpRate" value="${isEdit ? (edit.rate||'') : ''}" placeholder="7.5" min="0" step="0.01"></div>
      <div class="modal-actions"><button class="btn btn-outline" id="evpCan">ยกเลิก</button><button class="btn btn-primary" id="evpSave">💾 บันทึก</button></div>
    </div>`;
    document.getElementById('modalRoot').appendChild(o);
    o.querySelectorAll('[data-evpic]').forEach(sp => sp.addEventListener('click', () => {
      o.querySelectorAll('[data-evpic]').forEach(s => s.style.borderColor = 'transparent');
      sp.style.borderColor = 'var(--accent)'; o.querySelector('#evpIcon').value = sp.dataset.evpic;
    }));
    o.querySelector('#evpCan').onclick = () => o.remove();
    o.onclick = e => { if (e.target === o) o.remove(); };
    o.querySelector('#evpSave').onclick = () => {
      const name = o.querySelector('#evpName').value.trim();
      const rate = parseFloat(o.querySelector('#evpRate').value) || 0;
      if (!name) { U.toast('กรุณากรอกชื่อผู้ให้บริการ', 'error'); return; }
      if (rate <= 0) { U.toast('กรุณากรอกอัตราค่าไฟ', 'error'); return; }
      const icon = o.querySelector('#evpIcon').value;
      if (isEdit) ST.update('item_groups', edit.id, { name, icon, rate });
      else ST.add('item_groups', { categoryId: 'cat_ev', name, icon, rate, order: this._providers().length });
      U.toast(isEdit ? 'อัปเดตแล้ว ✅' : 'เพิ่มแล้ว ✅', 'success');
      o.remove(); App.rv('ev');
    };
  },

  // ---------- History: list / edit / delete + provider comparison + trends ----------

  openHistoryModal() {
    const cfg = U.getConfig();
    const o = document.createElement('div'); o.className = 'modal-overlay';
    o.innerHTML = `<div class="modal" style="max-width:440px">
      <h3>📜 ประวัติการชาร์จ</h3>
      <div class="tabs" style="margin-bottom:10px">
        <div class="tab active" data-evht="hist">ประวัติ</div>
        <div class="tab" data-evht="prov">เทียบผู้ให้บริการ</div>
        <div class="tab" data-evht="trend">เทรนด์</div>
      </div>
      <div style="max-height:55vh;overflow-y:auto">
        <div id="evHistPane">${this._historyTabHTML(cfg)}</div>
        <div id="evProvPane" style="display:none">${this._providerTabHTML(cfg)}</div>
        <div id="evTrendPane" style="display:none">${this._trendTabHTML(cfg)}</div>
      </div>
      <div class="modal-actions"><button class="btn btn-outline" id="evHistCan">ปิด</button></div>
    </div>`;
    document.getElementById('modalRoot').appendChild(o);
    o.querySelectorAll('[data-evht]').forEach(tab => tab.addEventListener('click', () => {
      o.querySelectorAll('[data-evht]').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      o.querySelector('#evHistPane').style.display = tab.dataset.evht === 'hist' ? '' : 'none';
      o.querySelector('#evProvPane').style.display = tab.dataset.evht === 'prov' ? '' : 'none';
      o.querySelector('#evTrendPane').style.display = tab.dataset.evht === 'trend' ? '' : 'none';
    }));
    o.querySelectorAll('[data-evhe]').forEach(btn => btn.addEventListener('click', () => {
      const t = ST.getById('transactions', btn.dataset.evhe);
      if (t) { o.remove(); this.openEditChargeModal(t); }
    }));
    o.querySelectorAll('[data-evhd]').forEach(btn => btn.addEventListener('click', async () => {
      const ok = await U.confirm('ลบรายการชาร์จนี้? (ย้ายไปถังขยะ กู้คืนได้)');
      if (!ok) return;
      deleteTransaction(btn.dataset.evhd, () => { o.remove(); App.rv('ev'); this.openHistoryModal(); });
    }));
    o.querySelector('#evHistCan').onclick = () => o.remove();
    o.onclick = e => { if (e.target === o) o.remove(); };
  },

  _historyTabHTML(cfg) {
    const chain = this._evChain();
    const txns = this._sortedTxns().slice().reverse();
    if (txns.length === 0) return '<div style="text-align:center;padding:16px;color:var(--text-secondary);font-size:.85rem">ยังไม่มีประวัติ</div>';
    return txns.map(t => {
      const actual = chain.get(t.id);
      const hasActual = !!actual;
      const distLabel = hasActual ? `${actual.distanceKm.toFixed(0)} กม. (จริง)` : (Number(t.evRangeKm) > 0 ? `≈${Number(t.evRangeKm).toFixed(0)} กม. (ประมาณ)` : 'ไม่มีข้อมูลระยะทาง');
      const costPerKm = hasActual ? actual.costPerKm : (Number(t.evRangeKm) > 0 ? Number(t.amount) / Number(t.evRangeKm) : 0);
      const costLabel = costPerKm > 0 ? `${hasActual ? '' : '≈'}${U.fmtCurrency(costPerKm, cfg.currency)}/กม.` : '–';
      return `<div class="ev-provider-row">
        <span style="font-size:1.1rem">⚡</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:.82rem;font-weight:600">${t.evProvider || 'ไม่ระบุ'} · ${U.fmtDateShort(t.date)}</div>
          <div style="font-size:.72rem;color:var(--text-secondary)">${U.fmtCurrency(Number(t.amount), cfg.currency)} · ${Number(t.evKwh || 0).toFixed(1)} kWh · ${distLabel}</div>
        </div>
        <div style="text-align:right;font-size:.74rem;font-weight:700;color:${hasActual ? '#0d9488' : 'var(--text-secondary)'};flex-shrink:0;margin-right:2px">${costLabel}</div>
        <button class="btn-ghost btn-sm" data-evhe="${t.id}">✏️</button>
        <button class="btn-ghost btn-sm" data-evhd="${t.id}">🗑️</button>
      </div>`;
    }).join('');
  },

  _providerTabHTML(cfg) {
    const stats = this._providerStats();
    if (stats.length === 0) return '<div style="text-align:center;padding:16px;color:var(--text-secondary);font-size:.85rem">ยังไม่มีข้อมูล</div>';
    const maxCount = Math.max(...stats.map(s => s.count));
    return stats.map(s => `<div class="ev-provider-row">
      <span style="font-size:1.1rem">🔌</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:.82rem;font-weight:600">${s.name}${s.count === maxCount ? ' <span style="font-size:.6rem;background:var(--accent-light);color:var(--accent);padding:1px 6px;border-radius:8px;font-weight:700">🔥 ใช้บ่อยสุด</span>' : ''}</div>
        <div style="font-size:.72rem;color:var(--text-secondary)">ใช้ ${s.count} ครั้ง · เฉลี่ย ${s.avgRatePerKwh.toFixed(2)} บาท/kWh${s.avgCostPerKm > 0 ? ` · ${s.avgCostPerKm.toFixed(2)} บาท/กม.` : ''}</div>
      </div>
    </div>`).join('');
  },

  _trendTabHTML() {
    const chain = this._evChain();
    const costRows = this._sortedTxns().filter(t => chain.get(t.id)).slice(-8);
    const maxCost = Math.max(...costRows.map(t => chain.get(t.id).costPerKm), 0.01);
    const battRows = this._battHealthSeries().slice(-8);
    const maxKwhPct = Math.max(...battRows.map(b => b.kwhPerPct), 0.01);
    return `
      <div style="font-size:.78rem;font-weight:700;margin-bottom:6px">💸 บาท/กม.จริง ตามเวลา</div>
      ${costRows.length === 0 ? '<div style="font-size:.78rem;color:var(--text-secondary);text-align:center;padding:8px 0 16px">ยังไม่มีข้อมูลพอ (ต้องชาร์จอย่างน้อย 2 ครั้งพร้อมใส่ ODO)</div>' : `<div class="ev-trend-bars" style="margin-bottom:16px">${costRows.map(t => `<div class="ev-trend-col"><div class="ev-trend-bar" style="height:${(chain.get(t.id).costPerKm/maxCost*100)}%"></div><div class="ev-trend-lbl">${U.fmtDateShort(t.date)}</div></div>`).join('')}</div>`}
      <div style="font-size:.78rem;font-weight:700;margin-bottom:6px">🔋 kWh ต่อ 1% แบต <span style="font-weight:400;color:var(--text-secondary)">(ค่าลดลงเรื่อยๆ = แบตเสื่อม)</span></div>
      ${battRows.length === 0 ? '<div style="font-size:.78rem;color:var(--text-secondary);text-align:center;padding:8px 0">ยังไม่มีข้อมูล — ต้องลากสไลเดอร์ % แบตตอนชาร์จด้วย</div>' : `<div class="ev-trend-bars">${battRows.map(b => `<div class="ev-trend-col"><div class="ev-trend-bar" style="height:${(b.kwhPerPct/maxKwhPct*100)}%;background:linear-gradient(180deg,#f59e0b,#d97706)"></div><div class="ev-trend-lbl">${U.fmtDateShort(b.date)}</div></div>`).join('')}</div>`}
    `;
  },

  openEditChargeModal(editTxn) {
    const providers = this._providers();
    const knownProvider = providers.some(p => p.name === editTxn.evProvider);
    const o = document.createElement('div'); o.className = 'modal-overlay';
    o.innerHTML = `<div class="modal" style="max-width:380px">
      <h3>✏️ แก้ไขการชาร์จ</h3>
      <div class="form-group"><label>ผู้ให้บริการ</label><select id="evEProv">${providers.map(p => `<option value="${p.id}" ${p.name===editTxn.evProvider?'selected':''}>${p.icon||'🔌'} ${p.name}</option>`).join('')}${!knownProvider ? `<option value="" selected>✏️ ${editTxn.evProvider || 'ไม่ระบุ'} (เดิม)</option>` : ''}</select></div>
      <div class="form-group"><label>จำนวนเงินที่จ่าย</label><input type="number" id="evEAmt" value="${editTxn.amount}" min="0" step="0.01"></div>
      <div class="form-row">
        <div class="form-group"><label>ได้ไฟ (kWh)</label><input type="number" id="evEKwh" value="${editTxn.evKwh||''}" min="0" step="0.1"></div>
        <div class="form-group"><label>ระยะที่ได้ (กม.)</label><input type="number" id="evERange" value="${editTxn.evRangeKm||''}" min="0" step="1"></div>
      </div>
      <div class="form-group"><label>เลข ODO ก่อนชาร์จ (กม.)</label><input type="number" id="evEOdo" value="${editTxn.evOdo||''}" min="0" step="1"></div>
      <div class="form-group"><label>วันที่</label><input type="date" id="evEDate" value="${editTxn.date}"></div>
      <div class="modal-actions"><button class="btn btn-outline" id="evECan">ยกเลิก</button><button class="btn btn-primary" id="evESave">💾 บันทึก</button></div>
    </div>`;
    document.getElementById('modalRoot').appendChild(o);
    o.querySelector('#evECan').onclick = () => { o.remove(); this.openHistoryModal(); };
    o.onclick = e => { if (e.target === o) { o.remove(); this.openHistoryModal(); } };
    o.querySelector('#evESave').onclick = () => {
      const amount = parseFloat(o.querySelector('#evEAmt').value) || 0;
      if (amount <= 0) { U.toast('กรุณากรอกจำนวนเงิน', 'error'); return; }
      const provSel = o.querySelector('#evEProv').value;
      const prov = providers.find(p => p.id === provSel);
      const evKwh = parseFloat(o.querySelector('#evEKwh').value) || 0;
      const evRangeKm = parseFloat(o.querySelector('#evERange').value) || 0;
      const evOdo = parseFloat(o.querySelector('#evEOdo').value) || 0;
      const date = o.querySelector('#evEDate').value;
      if (editTxn.accountId && amount !== Number(editTxn.amount)) {
        POS._applyAcctDelta(editTxn.accountId, editTxn.type, Number(editTxn.amount), true);
        POS._applyAcctDelta(editTxn.accountId, editTxn.type, amount, false);
      }
      const providerName = prov ? prov.name : editTxn.evProvider;
      ST.update('transactions', editTxn.id, {
        amount, date, evKwh, evRangeKm, evOdo: evOdo > 0 ? evOdo : undefined,
        evProvider: providerName, groupId: prov ? prov.id : editTxn.groupId,
        itemName: `ชาร์จรถ EV (${providerName})`
      });
      U.toast('อัปเดตแล้ว ✅', 'success');
      o.remove();
      App.rv('ev');
      this.openHistoryModal();
    };
  }
};
