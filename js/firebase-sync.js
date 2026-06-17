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
        if (user) {
          this._setStatus('syncing');
          this.pull().then(() => {
            this._setStatus('synced');
            App.updateUI();
            App.rv(App.cv);
          });
        } else {
          this._setStatus('offline');
        }
      });
    } catch(e) {
      console.error('Firebase init error:', e);
    }
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

  async push() {
    if (!this._db || !this._user) return;
    this._setStatus('syncing');
    try {
      const batch = this._db.batch();
      for (const c of this._cols) {
        const ref = this._db.doc(`users/${this._user.uid}/exp/${c}`);
        batch.set(ref, {
          data: ST._raw(c),
          at: firebase.firestore.FieldValue.serverTimestamp()
        });
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
        if (snap.exists && Array.isArray(snap.data().data)) {
          localStorage.setItem('exp_' + c, JSON.stringify(snap.data().data));
        }
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
    const nameEl = document.getElementById('cloudUserName');
    const btnEl  = document.getElementById('cloudAuthBtn');
    if (!nameEl || !btnEl) return;
    if (this._user) {
      nameEl.textContent = (this._user.displayName || this._user.email || 'ผู้ใช้').split(' ')[0];
      nameEl.style.display = '';
      btnEl.textContent = 'ออก';
      btnEl.title = 'ออกจากระบบ Cloud';
      btnEl.dataset.caction = 'signout';
    } else {
      nameEl.style.display = 'none';
      btnEl.textContent = this.isConfigured() ? '☁️ Sign in' : '☁️ ตั้งค่า';
      btnEl.title = this.isConfigured() ? 'เข้าสู่ระบบด้วย Google' : 'ตั้งค่า Firebase ใน ⚙️ ตั้งค่า';
      btnEl.dataset.caction = this.isConfigured() ? 'signin' : 'settings';
    }
  }
};
