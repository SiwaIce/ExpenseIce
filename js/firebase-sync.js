// ===== FIREBASE CLOUD SYNC =====
const CloudSync = {
  _db: null,
  _auth: null,
  _user: null,
  _pushTimer: null,
  _cols: [
    'transactions','categories','items','recurring','budgets',
    'wallet_accounts','credit_cards','account_transfers','installments',
    'savings_goals','subscriptions','loan_plans','config'
  ],

  _parseCfg() {
    try {
      const s = U.getConfig().firebaseConfig;
      if (!s) return null;
      try { return JSON.parse(s); } catch {}
      // Accept JS object syntax (Firebase default copy format)
      return Function('"use strict";return (' + s + ')')();
    } catch { return null; }
  },

  isConfigured() {
    const c = this._parseCfg();
    return !!(c && c.projectId);
  },

  isLoggedIn() { return !!this._user; },

  init() {
    if (!window.firebase) return;
    const cfg = this._parseCfg();
    if (!cfg || !cfg.projectId) return;
    try {
      if (!firebase.apps.length) firebase.initializeApp(cfg);
      this._auth = firebase.auth();
      this._db   = firebase.firestore();

      // Handle redirect result (mobile sign-in)
      this._auth.getRedirectResult().catch(e => {
        if (e.code && e.code !== 'auth/no-auth-event') {
          U.toast('Cloud ล็อกอินไม่สำเร็จ: ' + e.message, 'error');
        }
      });

      this._auth.onAuthStateChanged(user => {
        this._user = user;
        this._renderSidebar();
        App.updateUI();
        if (user) {
          this._setStatus('syncing');
          this.pull()
            .then(() => this._setStatus('synced'))
            .catch(() => this._setStatus('error'))
            .finally(() => App.rv(App.cv));
        } else {
          this._setStatus('offline');
          App.rv(App.cv);
        }
      });
    } catch(e) {
      console.error('Firebase init error:', e);
    }
  },

  async uploadReceipt(file, txnId) {
    if (!this._user || !window.firebase) return null;
    try {
      const ext = file.type.includes('png') ? 'png' : 'jpg';
      const ref = firebase.storage().ref(`users/${this._user.uid}/receipts/${txnId}.${ext}`);
      const snap = await ref.put(file);
      return await snap.ref.getDownloadURL();
    } catch(e) {
      console.error('Receipt upload error:', e);
      return null;
    }
  },

  async deleteReceipt(txnId) {
    if (!this._user || !window.firebase) return;
    try {
      for (const ext of ['jpg', 'png']) {
        const ref = firebase.storage().ref(`users/${this._user.uid}/receipts/${txnId}.${ext}`);
        await ref.delete().catch(() => {});
      }
    } catch {}
  },

  reinit() {
    if (!window.firebase) return;
    const deleteApps = firebase.apps.map(a => a.delete());
    Promise.all(deleteApps).then(() => {
      this._db = null; this._auth = null; this._user = null;
      this.init();
    }).catch(() => {
      this._db = null; this._auth = null; this._user = null;
      this.init();
    });
  },

  async signIn() {
    if (!this._auth) { U.toast('กรุณาตั้งค่า Firebase ก่อน', 'error'); return; }
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
      if (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
        await this._auth.signInWithRedirect(provider);
      } else {
        await this._auth.signInWithPopup(provider);
      }
    } catch(e) {
      if (e.code !== 'auth/popup-closed-by-user') {
        U.toast('ล็อกอินไม่สำเร็จ', 'error');
      }
    }
  },

  async signOut() {
    if (!this._auth) return;
    await this._auth.signOut();
    U.toast('ออกจากระบบ Cloud แล้ว', 'info');
  },

  schedulePush() {
    if (!this._db || !this._user) return;
    clearTimeout(this._pushTimer);
    this._setStatus('pending');
    this._pushTimer = setTimeout(() => this.push(), 3000);
  },

  _ts() { return Date.now(); },

  async push() {
    if (!this._db || !this._user) return;
    this._setStatus('syncing');
    try {
      const batch = this._db.batch();
      for (const c of this._cols) {
        const ref = this._db.doc(`users/${this._user.uid}/exp/${c}`);
        const local = ST._raw(c);
        // Stamp _updatedAt on each record if missing
        const stamped = Array.isArray(local)
          ? local.map(r => r._updatedAt ? r : { ...r, _updatedAt: this._ts() })
          : local;
        batch.set(ref, { data: stamped, at: firebase.firestore.FieldValue.serverTimestamp() });
      }
      await batch.commit();
      this._setStatus('synced');
    } catch(e) {
      console.error('Sync push error:', e);
      this._setStatus('error');
    }
  },

  async pull() {
    if (!this._db || !this._user) return;
    try {
      for (const c of this._cols) {
        const snap = await this._db.doc(`users/${this._user.uid}/exp/${c}`).get();
        if (!snap.exists) continue;
        const remote = snap.data().data;
        const local = ST._raw(c);
        if (!Array.isArray(remote) || !Array.isArray(local)) {
          // For config (object), remote wins only if newer
          if (remote && !Array.isArray(remote)) localStorage.setItem('exp_' + c, JSON.stringify(remote));
          continue;
        }
        // Per-record merge: last _updatedAt wins
        const merged = {};
        local.forEach(r => { if (r.id) merged[r.id] = r; });
        remote.forEach(r => {
          if (!r.id) return;
          if (!merged[r.id] || (r._updatedAt || 0) > (merged[r.id]._updatedAt || 0)) merged[r.id] = r;
        });
        localStorage.setItem('exp_' + c, JSON.stringify(Object.values(merged)));
      }
    } catch(e) {
      console.error('Sync pull error:', e);
    }
  },

  _setStatus(s) {
    const el = document.getElementById('syncStatus');
    if (!el) return;
    const icons   = { offline: '☁️', pending: '🔄', syncing: '🔄', synced: '✅', error: '⚠️' };
    const labels  = { offline: 'ออฟไลน์', pending: 'รอซิงค์', syncing: 'กำลังซิงค์...', synced: 'ซิงค์แล้ว', error: 'ซิงค์ผิดพลาด' };
    el.textContent = icons[s] || '☁️';
    el.title = labels[s] || '';
    el.className = 'sync-dot sync-' + s;
  },

  _renderSidebar() {
    const nameEl   = document.getElementById('cloudUserName');
    const btnEl    = document.getElementById('cloudAuthBtn');
    const avatarEl = document.getElementById('userAvatar');
    const sbUserEl = document.getElementById('sidebarUser');

    if (this._user) {
      const displayName = this._user.displayName || this._user.email || 'ผู้ใช้';
      // Sidebar main user row
      if (avatarEl) {
        if (this._user.photoURL) {
          avatarEl.innerHTML = `<img src="${this._user.photoURL}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`;
          avatarEl.style.background = 'transparent';
          avatarEl.style.padding = '0';
        } else {
          avatarEl.textContent = displayName[0].toUpperCase();
          avatarEl.style.background = 'var(--success-light)';
          avatarEl.style.color = 'var(--success)';
        }
      }
      if (sbUserEl) { sbUserEl.textContent = displayName.split(' ')[0]; sbUserEl.style.fontWeight = '600'; sbUserEl.style.color = 'var(--text)'; }
      // Cloud row
      if (nameEl) { nameEl.textContent = '✅ ซิงค์แล้ว'; nameEl.style.display = ''; nameEl.style.color = 'var(--success)'; }
      if (btnEl)  { btnEl.textContent = 'ออก'; btnEl.title = 'ออกจากระบบ Cloud'; btnEl.dataset.caction = 'signout'; btnEl.style.color = 'var(--danger)'; }
    } else {
      if (avatarEl) { avatarEl.innerHTML = '👤'; avatarEl.style.background = ''; avatarEl.style.color = ''; avatarEl.style.padding = ''; }
      if (sbUserEl) { sbUserEl.textContent = 'ยังไม่ได้ล็อกอิน'; sbUserEl.style.fontWeight = ''; sbUserEl.style.color = ''; }
      if (nameEl)   { nameEl.style.display = 'none'; nameEl.style.color = ''; }
      if (btnEl) {
        btnEl.textContent = this.isConfigured() ? '☁️ Sign in' : '☁️ ตั้งค่า';
        btnEl.title = this.isConfigured() ? 'เข้าสู่ระบบด้วย Google' : 'ตั้งค่า Firebase ใน ⚙️ ตั้งค่า';
        btnEl.dataset.caction = this.isConfigured() ? 'signin' : 'settings';
        btnEl.style.color = '';
      }
    }
    // Header cloud button
    const hBtn = document.getElementById('headerCloudBtn');
    if (hBtn) {
      if (this._user) {
        const name = this._user.displayName || this._user.email || 'U';
        hBtn.innerHTML = this._user.photoURL
          ? `<img src="${this._user.photoURL}" style="width:22px;height:22px;border-radius:50%;object-fit:cover;vertical-align:middle">`
          : `<span style="font-weight:700;font-size:.8rem">${name[0].toUpperCase()}</span>`;
        hBtn.title = `${name} · คลิกเพื่อออกจากระบบ`;
        hBtn.classList.add('logged-in');
        hBtn.onclick = async () => { if (await U.confirm('ออกจากระบบ Cloud?')) CloudSync.signOut(); };
      } else {
        hBtn.innerHTML = '☁️';
        hBtn.title = this.isConfigured() ? 'Sign in with Google' : 'ตั้งค่า Cloud Sync';
        hBtn.classList.remove('logged-in');
        hBtn.onclick = () => this.isConfigured() ? this.signIn() : App.rv('settings');
      }
    }
    // อัปเดตปุ่มใน Settings card ถ้าเปิดอยู่
    const signInBtn  = document.getElementById('btnCloudSignIn');
    const signOutBtn = document.getElementById('btnCloudSignOut');
    const pushBtn    = document.getElementById('btnForcePush');
    const pullBtn    = document.getElementById('btnForcePull');
    if (signInBtn || signOutBtn) {
      if (this._user) {
        signInBtn?.remove();
        if (!signOutBtn && pushBtn) {
          const b = document.createElement('button');
          b.className = 'btn btn-outline btn-sm'; b.id = 'btnCloudSignOut';
          b.style.color = 'var(--danger)'; b.textContent = '🚪 ออกจากระบบ';
          b.addEventListener('click', async () => { const ok = await U.confirm('ออกจากระบบ Cloud?'); if (ok) { await CloudSync.signOut(); App.rv('settings'); } });
          pushBtn.parentNode.appendChild(b);
        }
      } else {
        signOutBtn?.remove(); pushBtn?.remove(); pullBtn?.remove();
        if (!signInBtn && this.isConfigured()) {
          const saveFB = document.getElementById('btnSaveFB');
          if (saveFB) {
            const b = document.createElement('button');
            b.className = 'btn btn-success btn-sm'; b.id = 'btnCloudSignIn';
            b.textContent = '🔑 Sign in with Google';
            b.addEventListener('click', () => CloudSync.signIn());
            saveFB.parentNode.appendChild(b);
          }
        }
      }
    }
  }
};
