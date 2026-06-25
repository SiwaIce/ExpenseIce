// ===== EV CHARGING CALCULATOR =====
const EVView = {
  _selProviderId: null,
  _customRate: 0,
  _amt: '',

  render() {
    const cfg = U.getConfig();
    const vehicle = cfg.evVehicle || null;
    const providers = ST.getAll('ev_providers');
    if (this._selProviderId === null && providers.length) this._selProviderId = providers[0].id;
    const isCustom = this._selProviderId === 'custom';
    const sel = !isCustom ? providers.find(p => p.id === this._selProviderId) : null;
    const rate = isCustom ? this._customRate : (sel ? sel.rate : 0);
    const r = this._calc(rate, vehicle);

    const chipsHTML = providers.map(p => `<span class="ev-chip ${p.id===this._selProviderId?'sel':''}" data-evp="${p.id}">${p.icon} ${p.name} · ${p.rate}/kWh</span>`).join('')
      + `<span class="ev-chip ${isCustom?'sel':''}" data-evp="custom">✏️ กำหนดเอง</span>`;

    const month = U.thisMonth();
    const evTxns = ST.getAll('transactions').filter(t => t.categoryId === 'cat_ev' && t.date.startsWith(month));
    const totalKwh = evTxns.reduce((s, t) => s + (Number(t.evKwh) || 0), 0);
    const totalCost = evTxns.reduce((s, t) => s + Number(t.amount), 0);
    const avgRate = totalKwh > 0 ? totalCost / totalKwh : 0;

    return `<div style="padding-bottom:20px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <h2 style="margin:0;font-size:1.1rem">⚡ คำนวณค่าชาร์จ EV</h2>
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
        <div class="ev-res-grid">
          <div class="ev-res-box"><div class="ev-res-label">ได้ไฟ</div><div class="ev-res-val" id="evResKwh">${r.kwh.toFixed(1)} kWh</div></div>
          <div class="ev-res-box"><div class="ev-res-label">วิ่งได้ประมาณ</div><div class="ev-res-val" id="evResRange">${vehicle ? r.rangeKm.toFixed(0) + ' กม.' : '–'}</div></div>
          <div class="ev-res-box"><div class="ev-res-label">% แบตที่ได้</div><div class="ev-res-val" id="evResBatt">${vehicle ? r.battPct.toFixed(1) + '%' : '–'}</div></div>
          <div class="ev-res-box"><div class="ev-res-label">ต้นทุน/กม.</div><div class="ev-res-val" id="evResCost">${vehicle && r.rangeKm > 0 ? U.fmtCurrency(r.costPerKm, cfg.currency) : '–'}</div></div>
        </div>
        <button class="btn" id="btnEvSave" style="width:100%;margin-top:12px;background:#fff;color:#0d9488;font-weight:700">💾 บันทึกเป็นรายจ่าย</button>
      </div>

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
      <div class="card">
        ${providers.length === 0 ? '<div style="font-size:.82rem;color:var(--text-secondary);text-align:center;padding:8px 0">ยังไม่มีผู้ให้บริการ</div>' : providers.map(p => `
          <div class="ev-provider-row">
            <span style="font-size:1.1rem">${p.icon}</span>
            <div style="flex:1;min-width:0">
              <div style="font-size:.82rem;font-weight:600">${p.name}</div>
              <div style="font-size:.72rem;color:var(--text-secondary)">${p.rate} บาท/kWh</div>
            </div>
            <button class="btn-ghost btn-sm" data-evpe="${p.id}">✏️</button>
            <button class="btn-ghost btn-sm" data-evpd="${p.id}">🗑️</button>
          </div>
        `).join('')}
      </div>

      <div class="pos-section-label" style="margin-top:16px">📊 สรุปค่าชาร์จเดือนนี้</div>
      <div class="card">
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center">
          <div><div class="btag">ชาร์จไป</div><div style="font-weight:800;font-size:.92rem">${evTxns.length} ครั้ง</div></div>
          <div><div class="btag">รวม kWh</div><div style="font-weight:800;font-size:.92rem;color:#0d9488">${totalKwh.toFixed(1)} kWh</div></div>
          <div><div class="btag">รวมค่าไฟ</div><div style="font-weight:800;font-size:.92rem;color:var(--expense)">${U.fmtCurrency(totalCost, cfg.currency)}</div></div>
        </div>
        ${totalKwh > 0 ? `<div style="margin-top:8px;font-size:.74rem;color:var(--text-secondary);text-align:center">เฉลี่ย ${avgRate.toFixed(2)} บาท/kWh</div>` : ''}
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
    document.getElementById('btnEvSave')?.addEventListener('click', () => this._saveAsExpense());
    document.getElementById('btnEvVehicle')?.addEventListener('click', () => this.openVehicleModal());
    document.getElementById('btnEvAddProvider')?.addEventListener('click', () => this.openProviderModal());
    document.querySelectorAll('[data-evpe]').forEach(btn => btn.addEventListener('click', () => {
      const p = ST.getById('ev_providers', btn.dataset.evpe); if (p) this.openProviderModal(p);
    }));
    document.querySelectorAll('[data-evpd]').forEach(btn => btn.addEventListener('click', async () => {
      const ok = await U.confirm('ลบผู้ให้บริการนี้?');
      if (ok) { ST.delete('ev_providers', btn.dataset.evpd); if (this._selProviderId === btn.dataset.evpd) this._selProviderId = null; App.rv('ev'); }
    }));
  },

  _calc(rate, vehicle) {
    const amt = Number(this._amt) || 0;
    const kwh = rate > 0 ? amt / rate : 0;
    const rangeKm = vehicle ? kwh * (Number(vehicle.efficiencyKmPerKwh) || 0) : 0;
    const battPct = vehicle && vehicle.batteryKwh ? Math.min(100, (kwh / Number(vehicle.batteryKwh)) * 100) : 0;
    const costPerKm = rangeKm > 0 ? amt / rangeKm : 0;
    return { rate, kwh, rangeKm, battPct, costPerKm };
  },

  _updateResult() {
    const cfg = U.getConfig();
    const vehicle = cfg.evVehicle || null;
    const providers = ST.getAll('ev_providers');
    const isCustom = this._selProviderId === 'custom';
    const sel = !isCustom ? providers.find(p => p.id === this._selProviderId) : null;
    const rate = isCustom ? this._customRate : (sel ? sel.rate : 0);
    const r = this._calc(rate, vehicle);
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('evResKwh', r.kwh.toFixed(1) + ' kWh');
    set('evResRange', vehicle ? r.rangeKm.toFixed(0) + ' กม.' : '–');
    set('evResBatt', vehicle ? r.battPct.toFixed(1) + '%' : '–');
    set('evResCost', vehicle && r.rangeKm > 0 ? U.fmtCurrency(r.costPerKm, cfg.currency) : '–');
  },

  _saveAsExpense() {
    const amt = Number(this._amt) || 0;
    if (amt <= 0) { U.toast('กรุณากรอกจำนวนเงินที่จ่าย', 'error'); return; }
    const cfg = U.getConfig();
    const vehicle = cfg.evVehicle || null;
    const providers = ST.getAll('ev_providers');
    const isCustom = this._selProviderId === 'custom';
    const sel = !isCustom ? providers.find(p => p.id === this._selProviderId) : null;
    const rate = isCustom ? this._customRate : (sel ? sel.rate : 0);
    const r = this._calc(rate, vehicle);
    const providerName = isCustom ? 'กำหนดเอง' : (sel ? sel.name : 'ไม่ระบุ');
    POS.type = 'expense';
    POS.openModal(null, 'cat_ev', null, {
      name: `ชาร์จรถ EV (${providerName})`,
      amount: amt,
      date: U.today(),
      extra: { evKwh: r.kwh, evProvider: providerName, evRate: rate }
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

  openProviderModal(edit = null) {
    const isEdit = !!edit;
    const o = document.createElement('div'); o.className = 'modal-overlay';
    const icons = ['⚡', '🔌', '🏠', '🏪', '🛣️'];
    const selIcon = edit?.icon || icons[0];
    o.innerHTML = `<div class="modal" style="max-width:360px">
      <h3>${isEdit ? '✏️ แก้ไขผู้ให้บริการ' : '🔌 เพิ่มผู้ให้บริการชาร์จ'}</h3>
      <div class="form-group"><label>ชื่อผู้ให้บริการ</label><input type="text" id="evpName" value="${isEdit ? edit.name : ''}" placeholder="เช่น EA Anywhere"></div>
      <div class="form-group"><label>ไอคอน</label><div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:6px" id="evpIconPick">${icons.map(ic => `<span style="font-size:1.3rem;cursor:pointer;padding:3px 5px;border-radius:6px;border:2px solid ${selIcon===ic?'var(--accent)':'transparent'}" data-evpic="${ic}">${ic}</span>`).join('')}</div><input type="text" id="evpIcon" value="${selIcon}" maxlength="4" placeholder="หรือพิมพ์/วางอีโมจิเอง" style="width:120px;margin-top:6px;font-size:1.1rem;text-align:center"></div>
      <div class="form-group"><label>อัตราค่าไฟ (บาท/kWh)</label><input type="number" id="evpRate" value="${isEdit ? edit.rate : ''}" placeholder="7.5" min="0" step="0.01"></div>
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
      const data = { name, icon: o.querySelector('#evpIcon').value, rate };
      if (isEdit) ST.update('ev_providers', edit.id, data);
      else ST.add('ev_providers', data);
      U.toast(isEdit ? 'อัปเดตแล้ว ✅' : 'เพิ่มแล้ว ✅', 'success');
      o.remove(); App.rv('ev');
    };
  }
};
