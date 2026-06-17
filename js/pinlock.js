// ===== PIN LOCK =====
const PinLock = {
  _hash(pin) {
    let h = 0;
    for (let i = 0; i < pin.length; i++) { h = (Math.imul(31, h) + pin.charCodeAt(i)) | 0; }
    return String(h);
  },

  isEnabled() { return !!(U.getConfig().pinHash); },

  check(cb) {
    if (!this.isEnabled()) { cb(); return; }
    this._showPad('🔐 ใส่ PIN เพื่อเข้าใช้งาน', (pin) => {
      if (this._hash(pin) === U.getConfig().pinHash) { cb(); return true; }
      return false;
    });
  },

  _showPad(title, onCorrect, onCancel) {
    const overlay = document.createElement('div');
    overlay.id = 'pinOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:var(--bg-card);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px';
    overlay.innerHTML = `
      <div style="font-size:2rem">🔐</div>
      <div style="font-size:1rem;font-weight:600;color:var(--text)">${title}</div>
      <div id="pinDots" style="display:flex;gap:12px;margin:4px 0">
        ${[0,1,2,3].map(i => `<div class="pin-dot" style="width:16px;height:16px;border-radius:50%;border:2px solid var(--accent);background:transparent;transition:background .15s"></div>`).join('')}
      </div>
      <div id="pinErr" style="font-size:.78rem;color:var(--danger);min-height:18px"></div>
      <div style="display:grid;grid-template-columns:repeat(3,72px);gap:10px">
        ${[1,2,3,4,5,6,7,8,9,'','0','⌫'].map(n => `<button class="pin-key" data-k="${n}" style="height:64px;border-radius:14px;border:0.5px solid var(--border);background:var(--bg-input);font-size:1.4rem;font-weight:500;cursor:pointer;color:var(--text);${n===''?'visibility:hidden':''}">${n}</button>`).join('')}
      </div>
      ${onCancel ? `<button style="margin-top:8px;background:none;border:none;color:var(--text-secondary);font-size:.82rem;cursor:pointer" id="pinCancel">ยกเลิก</button>` : ''}
    `;
    document.body.appendChild(overlay);
    let val = '';
    const dots = overlay.querySelectorAll('.pin-dot');
    const err = overlay.querySelector('#pinErr');
    const updateDots = () => dots.forEach((d,i) => d.style.background = i < val.length ? 'var(--accent)' : 'transparent');
    overlay.querySelectorAll('.pin-key').forEach(btn => btn.addEventListener('click', () => {
      const k = btn.dataset.k;
      if (k === '⌫') { val = val.slice(0,-1); err.textContent = ''; }
      else if (k !== '' && val.length < 4) { val += k; }
      updateDots();
      if (val.length === 4) {
        const ok = onCorrect(val);
        if (ok === false) { err.textContent = 'PIN ไม่ถูกต้อง ลองใหม่'; val = ''; setTimeout(() => updateDots(), 0); }
        else if (ok === true || ok === undefined) { overlay.remove(); }
      }
    }));
    overlay.querySelector('#pinCancel')?.addEventListener('click', () => { overlay.remove(); if (onCancel) onCancel(); });
  },

  setup(cb) {
    let firstPin = '';
    this._showPad('ตั้ง PIN ใหม่ (4 หลัก)', (pin) => {
      if (!firstPin) {
        firstPin = pin;
        const overlay = document.getElementById('pinOverlay');
        if (overlay) { overlay.querySelector('div[style*="font-size:1rem"]').textContent = 'ยืนยัน PIN อีกครั้ง'; overlay.querySelectorAll('.pin-dot').forEach(d => d.style.background = 'transparent'); const err = overlay.querySelector('#pinErr'); err.textContent = ''; }
        return undefined;
      }
      if (pin === firstPin) { U.updateConfig({ pinHash: this._hash(pin) }); U.toast('ตั้ง PIN สำเร็จ 🔐', 'success'); if (cb) cb(); return true; }
      firstPin = ''; return false;
    }, cb ? null : () => {});
  },

  remove() {
    this.check(() => { U.updateConfig({ pinHash: '' }); U.toast('ปิด PIN แล้ว', 'info'); App.rv('settings'); });
  }
};
