// ===== PIN LOCK =====
const PinLock = {
  _hash(pin) {
    let h = 0;
    for (let i = 0; i < pin.length; i++) { h = (Math.imul(31, h) + pin.charCodeAt(i)) | 0; }
    return String(h);
  },

  isEnabled()  { return !!(U.getConfig().pinHash); },
  _hasFaceID() { return !!(U.getConfig().faceIdCredId) && !!window.PublicKeyCredential; },

  async check(cb) {
    if (!this.isEnabled()) { cb(); return; }
    if (this._hasFaceID()) {
      const ok = await this._checkBiometric();
      if (ok) { cb(); return; }
    }
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
      <div style="font-size:2.2rem">🔐</div>
      <div style="font-size:1rem;font-weight:600;color:var(--text)" id="pinTitle">${title}</div>
      <div id="pinDots" style="display:flex;gap:14px;margin:4px 0">
        ${[0,1,2,3].map(() => `<div class="pin-dot" style="width:18px;height:18px;border-radius:50%;border:2px solid var(--accent);background:transparent;transition:all .15s"></div>`).join('')}
      </div>
      <div id="pinErr" style="font-size:.78rem;color:var(--danger);min-height:18px;text-align:center"></div>
      <div style="display:grid;grid-template-columns:repeat(3,76px);gap:10px">
        ${[1,2,3,4,5,6,7,8,9,'','0','⌫'].map(n => `<button class="pin-key" data-k="${n}" style="height:68px;border-radius:16px;border:1px solid var(--border);background:var(--bg-input);font-size:1.5rem;font-weight:500;cursor:pointer;color:var(--text);touch-action:manipulation;${n===''?'visibility:hidden':''}">${n}</button>`).join('')}
      </div>
      ${this._hasFaceID() ? `<button id="pinBioBtn" style="background:none;border:1.5px solid var(--border);border-radius:14px;padding:8px 22px;color:var(--accent);font-size:.88rem;font-weight:500;cursor:pointer;touch-action:manipulation;margin-top:2px"> Face ID / Touch ID</button>` : ''}
      ${onCancel ? `<button style="margin-top:4px;background:none;border:none;color:var(--text-secondary);font-size:.82rem;cursor:pointer;touch-action:manipulation" id="pinCancel">ยกเลิก</button>` : ''}
    `;
    document.body.appendChild(overlay);
    let val = '';
    const dots = overlay.querySelectorAll('.pin-dot');
    const err  = overlay.querySelector('#pinErr');
    const updateDots = () => dots.forEach((d, i) => d.style.background = i < val.length ? 'var(--accent)' : 'transparent');

    const shakeErr = (msg) => {
      err.textContent = msg;
      val = ''; updateDots();
      dots.forEach(d => { d.style.borderColor = 'var(--danger)'; d.style.transform = 'scale(1.1)'; });
      setTimeout(() => dots.forEach(d => { d.style.borderColor = 'var(--accent)'; d.style.transform = ''; }), 500);
    };

    overlay.querySelectorAll('.pin-key').forEach(btn => btn.addEventListener('click', () => {
      const k = btn.dataset.k;
      if (k === '⌫') { val = val.slice(0, -1); err.textContent = ''; }
      else if (k !== '' && val.length < 4) { val += k; }
      updateDots();
      if (val.length === 4) {
        const ok = onCorrect(val);
        if (ok === false) {
          shakeErr('PIN ไม่ถูกต้อง ลองใหม่');
        } else if (ok === true) {
          overlay.remove();
        }
        // ok === undefined → keep overlay open, reset val (setup step 1 waiting for confirm)
        else { val = ''; updateDots(); }
      }
    }));

    // Biometric button
    const bioBtn = overlay.querySelector('#pinBioBtn');
    if (bioBtn) {
      bioBtn.addEventListener('click', async () => {
        const ok = await this._checkBiometric();
        if (ok) { overlay.remove(); onCorrect('__bio__'); }
        else { shakeErr('Face ID ไม่สำเร็จ ลองใส่ PIN'); }
      });
      // Auto-trigger Face ID on check (not setup) after short delay
      if (!onCancel && title.includes('เข้าใช้')) setTimeout(() => bioBtn.click(), 400);
    }

    overlay.querySelector('#pinCancel')?.addEventListener('click', () => { overlay.remove(); if (onCancel) onCancel(); });
  },

  async _setupBiometric() {
    if (!window.PublicKeyCredential) return false;
    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const userId    = crypto.getRandomValues(new Uint8Array(16));
      const cred = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'Expense Tracker', id: location.hostname },
          user: { id: userId, name: 'expense-user', displayName: 'Expense User' },
          pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
          authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
          timeout: 60000
        }
      });
      const credId = btoa(String.fromCharCode(...new Uint8Array(cred.rawId)));
      U.updateConfig({ faceIdCredId: credId });
      return true;
    } catch { return false; }
  },

  async _checkBiometric() {
    const credId = U.getConfig().faceIdCredId;
    if (!credId || !window.PublicKeyCredential) return false;
    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const rawId = Uint8Array.from(atob(credId), c => c.charCodeAt(0));
      await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials: [{ type: 'public-key', id: rawId }],
          userVerification: 'required',
          timeout: 60000
        }
      });
      return true;
    } catch { return false; }
  },

  setup(cb) {
    let firstPin = '';
    this._showPad('ตั้ง PIN ใหม่ (4 หลัก)', (pin) => {
      if (!firstPin) {
        firstPin = pin;
        const ov = document.getElementById('pinOverlay');
        if (ov) {
          ov.querySelector('#pinTitle').textContent = 'ยืนยัน PIN อีกครั้ง';
          ov.querySelectorAll('.pin-dot').forEach(d => d.style.background = 'transparent');
          ov.querySelector('#pinErr').textContent = '';
        }
        return undefined; // keep overlay open for second entry
      }
      if (pin === firstPin) {
        U.updateConfig({ pinHash: this._hash(pin) });
        U.toast('ตั้ง PIN สำเร็จ 🔐', 'success');
        if (window.PublicKeyCredential) {
          setTimeout(async () => {
            const want = await U.confirm(' ต้องการเปิด Face ID / Touch ID ด้วยไหม?');
            if (want) {
              const ok = await this._setupBiometric();
              U.toast(ok ? 'เปิด Face ID แล้ว ✅' : 'ไม่สามารถใช้ Face ID ได้', ok ? 'success' : 'error');
            }
            if (cb) cb();
          }, 100);
        } else {
          if (cb) cb();
        }
        return true;
      }
      firstPin = '';
      return false;
    }, cb ? null : () => {});
  },

  remove() {
    this.check(() => {
      U.updateConfig({ pinHash: '', faceIdCredId: '' });
      U.toast('ปิด PIN แล้ว', 'info');
      App.rv('settings');
    });
  }
};
