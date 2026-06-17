// ===== APP ROUTER =====
const App = {
  cv: 'add',
  init() {
    seedData();
    seedWalletAccounts();
    ST.purgeExpired(30);
    this.applyTheme();
    this.bindNav();
    document.getElementById('btnTheme').addEventListener('click', () => this.toggleTheme());
    document.getElementById('btnRefresh').addEventListener('click', () => { this.rv(this.cv); U.toast('รีเฟรชแล้ว', 'info'); });
    this.rv('add');
    this.updateUI();
    this.updateSBBudgets();
    window.addEventListener('sc', () => { this.updateSBBudgets(); this.updateUI(); CloudSync.schedulePush(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { const o = document.querySelector('#modalRoot .modal-overlay'); if (o) o.remove(); }
    });
    setTimeout(() => Onboarding.show(), 400);
    setTimeout(() => CloudSync.init(), 200);
  },
  applyTheme() {
    const cfg = U.getConfig();
    document.documentElement.setAttribute('data-theme', cfg.theme || 'light');
    if (cfg.accent && cfg.accent !== 'indigo') document.documentElement.setAttribute('data-accent', cfg.accent);
    else document.documentElement.removeAttribute('data-accent');
  },
  toggleTheme() {
    const next = U.getConfig().theme === 'dark' ? 'light' : 'dark';
    U.updateConfig({ theme: next });
    document.documentElement.setAttribute('data-theme', next);
    U.toast(next === 'dark' ? '🌙 โหมดกลางคืน' : '☀️ โหมดสว่าง', 'info');
    if (this.cv) this.rv(this.cv);
  },
  bindNav() {
    document.querySelectorAll('.sidebar-nav a').forEach(link =>
      link.addEventListener('click', e => { e.preventDefault(); this.nav(link.dataset.view); })
    );
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    document.getElementById('menuToggle').addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('show', sidebar.classList.contains('open'));
    });
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('show');
    });
    document.getElementById('cloudAuthBtn')?.addEventListener('click', () => {
      const action = document.getElementById('cloudAuthBtn').dataset.caction;
      if (action === 'signin') CloudSync.signIn();
      else if (action === 'signout') CloudSync.signOut();
      else this.nav('settings');
    });
  },
  nav(view) {
    this.cv = view;
    document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
    const link = document.querySelector(`.sidebar-nav a[data-view="${view}"]`);
    if (link) link.classList.add('active');
    const titles = {
      add: '➕ บันทึกรายการ', transactions: '💳 รายการทั้งหมด', dashboard: '📊 แดชบอร์ด',
      insights: '🤖 AI & แชท', reports: '📈 รายงาน', recurring: '🔁 รายการประจำ',
      budget: '🎯 งบประมาณ', accounts: '🏧 บัญชี & บัตร', networth: '🏦 Net Worth', settings: '⚙️ ตั้งค่า', trash: '🗑️ ถังขยะ',
      savings: '🎯 เป้าหมายการออม', subscriptions: '📱 ตัวติดตามสมาชิก', loans: '🏦 แผนผ่อนชำระ'
    };
    document.getElementById('headerTitle').textContent = titles[view] || view;
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('show');
    this.rv(view);
  },
  rv(view) {
    const c = document.getElementById('appContent');
    switch (view) {
      case 'add': c.innerHTML = POS.render(); setTimeout(() => POS.attachEvents(), 30); break;
      case 'transactions': c.innerHTML = Views.renderTxns(); setTimeout(() => Views.attachTxnEvents(), 50); break;
      case 'dashboard': c.innerHTML = Views.renderDash(); setTimeout(() => Views.attachDashCharts(), 50); break;
      case 'insights': c.innerHTML = InsightsView.render(); setTimeout(() => InsightsView.attachEvents(), 50); break;
      case 'reports': c.innerHTML = Views.renderReports(); setTimeout(() => Views.attachReportCharts(), 50); break;
      case 'recurring': c.innerHTML = RV.render(); setTimeout(() => RV.attachEvents(), 50); break;
      case 'budget': c.innerHTML = BV.render(); setTimeout(() => BV.attachEvents(), 50); break;
      case 'accounts': c.innerHTML = AccountsView.render(); setTimeout(() => AccountsView.attachEvents(), 50); break;
      case 'networth': c.innerHTML = NWView.render(); setTimeout(() => NWView.attachEvents(), 50); break;
      case 'settings': c.innerHTML = Views.renderSettings(); setTimeout(() => Views.attachSettingsEvents(), 50); break;
      case 'trash': Views.renderTrash(); setTimeout(() => Views.attachTrashEvents(), 50); break;
      case 'savings': c.innerHTML = SavingsView.render(); setTimeout(() => SavingsView.attachEvents(), 50); break;
      case 'subscriptions': c.innerHTML = SubsView.render(); setTimeout(() => SubsView.attachEvents(), 50); break;
      case 'loans': c.innerHTML = LoansView.render(); setTimeout(() => LoansView.attachEvents(), 50); break;
      default: c.innerHTML = POS.render(); setTimeout(() => POS.attachEvents(), 30);
    }
  },
  updateUI() {
    const cfg = U.getConfig();
    const name = cfg.userName || 'ผู้ใช้';
    document.getElementById('sidebarUser').textContent = name;
    document.getElementById('userAvatar').textContent = name.charAt(0).toUpperCase();
    CloudSync._renderSidebar();
    const trashCount = ['transactions','credit_cards','wallet_accounts'].reduce((n,c) => n + ST.getAllDeleted(c).length, 0);
    const navTrash = document.getElementById('navTrash');
    if (navTrash) navTrash.innerHTML = `<span class="nav-icon">🗑️</span> ถังขยะ${trashCount > 0 ? ` <span style="background:var(--danger);color:#fff;font-size:.6rem;font-weight:700;padding:1px 5px;border-radius:10px;vertical-align:middle">${trashCount}</span>` : ''}`;
  },
  updateSBBudgets() {
    const el = document.getElementById('sbBudgets'); if (!el) return;
    const budgets = ST.getAll('budgets');
    const cats = ST.getAll('categories');
    const cfg = U.getConfig();
    const month = U.thisMonth();
    const txns = ST.getAll('transactions').filter(t => t.date.startsWith(month) && t.type === 'expense');
    if (!budgets.length) {
      el.innerHTML = '<div style="padding:3px 12px;font-size:.7rem;color:var(--text-secondary)">ยังไม่ได้ตั้งงบประมาณ</div>';
      return;
    }
    el.innerHTML = budgets.slice(0, 5).map(b => {
      const cat = cats.find(c => c.id === b.categoryId) || { icon: '❓', name: '?' };
      const spent = txns.filter(t => t.categoryId === b.categoryId).reduce((s, t) => s + Number(t.amount), 0);
      const pct = b.amount > 0 ? Math.min(spent / b.amount * 100, 100) : 0;
      const cls = pct < 70 ? 'bok' : pct < 90 ? 'bwarn' : 'bover';
      return `<div class="sb-budget"><div class="sb-budget-row"><span>${cat.icon} ${cat.name}</span><span style="font-weight:700;color:${pct >= 100 ? 'var(--danger)' : 'var(--text-secondary)'}">${pct.toFixed(0)}%</span></div><div class="sb-bar"><div class="sb-bar-fill ${cls}" style="width:${pct}%"></div></div></div>`;
    }).join('');
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
window.addEventListener('hashchange', () => {
  if (App.cv === 'transactions') App.rv('transactions');
  if (App.cv === 'reports') App.rv('reports');
});