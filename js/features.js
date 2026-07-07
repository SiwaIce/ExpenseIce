// ===== INSIGHTS =====
const InsightsView = {
  render() {
    return `<div class="ai-tabs"><button class="ai-tab active" data-ait="insights">💡 AI วิเคราะห์</button><button class="ai-tab" data-ait="chat">🤖 แชท</button></div>
    <div id="aitInsights">
      <div class="card" style="padding:12px 16px"><div style="font-size:.72rem;font-weight:700;color:var(--text-secondary);margin-bottom:8px;text-transform:uppercase">🤖 เครื่องมือ AI</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(142px,1fr));gap:7px"><button class="btn btn-outline btn-sm" id="btnMonthReport">📊 รายงานเดือน</button><button class="btn btn-outline btn-sm" id="btnWeekly">📅 สรุปสัปดาห์</button><button class="btn btn-outline btn-sm" id="btnPattern">🔍 รูปแบบการใช้จ่าย</button><button class="btn btn-outline btn-sm" id="btnTaxAdvisor">🧾 ลดหย่อนภาษี</button><button class="btn btn-outline btn-sm" id="btnDebtPlan">💳 แผนปลดหนี้</button></div></div>
      <div class="card"><div class="card-header"><span class="card-title">🤖 AI Insights — วิเคราะห์การใช้จ่าย</span><button class="btn btn-primary btn-sm" id="btnRefreshInsights">🔄 วิเคราะห์ใหม่</button></div><div id="insightsContainer"><div class="ins-loading"><div class="ins-dot"></div><div class="ins-dot"></div><div class="ins-dot"></div><span>กำลังวิเคราะห์ข้อมูล...</span></div></div></div>
      <div class="card"><div class="card-header"><span class="card-title">🚨 รายการผิดปกติ</span></div><div id="anomalyContainer"></div></div>
      <div class="card"><div class="card-header"><span class="card-title">📅 คาดการณ์สิ้นเดือน</span></div><div id="forecastContainer"></div></div>
    </div>
    <div id="aitChat" style="display:none"></div>`;
  },
  attachEvents() {
    this.loadInsights();
    this.loadForecast();
    this.loadAnomalies();
    document.getElementById('btnRefreshInsights')?.addEventListener('click', () => {
      document.getElementById('insightsContainer').innerHTML = '<div class="ins-loading"><div class="ins-dot"></div><div class="ins-dot"></div><div class="ins-dot"></div><span>กำลังวิเคราะห์ใหม่...</span></div>';
      this.loadInsights();
    });
    document.getElementById('btnMonthReport')?.addEventListener('click', () => this.openMonthlyReport());
    document.getElementById('btnWeekly')?.addEventListener('click', () => this.openWeeklySummary());
    document.getElementById('btnPattern')?.addEventListener('click', () => this.openSpendingPattern());
    document.getElementById('btnTaxAdvisor')?.addEventListener('click', () => this.openTaxAdvisor());
    document.getElementById('btnDebtPlan')?.addEventListener('click', () => this.openDebtStrategy());
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
  async openWeeklySummary() {
    if (!AI._key()) { U.toast(AI._noKeyMsg().split('\n')[0], 'error'); return; }
    const cfg = U.getConfig();
    const now = new Date();
    const dates = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); dates.push(U._ld(d)); }
    const txns = ST.getAll('transactions').filter(t => t.date >= dates[0] && t.date <= dates[6]);
    const cats = ST.getAll('categories');
    const income = txns.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const expense = txns.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    const catBreakdown = EH.catSpending(txns, cats).slice(0, 5).map(s => `${s.name}: ${U.fmtCurrency(s.amount, cfg.currency)}`).join(', ');
    const dayDetails = dates.map(d => {
      const exp = txns.filter(t => t.date === d && t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
      return `${d}: ${exp > 0 ? U.fmtCurrency(exp, cfg.currency) : 'ไม่มีรายการ'}`;
    }).join('\n');
    const o = document.createElement('div'); o.className = 'modal-overlay';
    o.innerHTML = `<div class="modal" style="max-width:500px"><h3>📅 สรุป 7 วันที่ผ่านมา</h3><div id="weeklyBody"><div class="ins-loading"><div class="ins-dot"></div><div class="ins-dot"></div><div class="ins-dot"></div><span>AI กำลังสรุป...</span></div></div><div class="modal-actions" style="margin-top:16px"><button class="btn btn-outline" id="weeklyClose">ปิด</button></div></div>`;
    document.getElementById('modalRoot').appendChild(o);
    o.querySelector('#weeklyClose').onclick = () => o.remove();
    o.onclick = e => { if (e.target === o) o.remove(); };
    try {
      const text = await AI.call(
        `สรุปการใช้จ่าย 7 วันที่ผ่านมา เป็นภาษาไทย อ่านง่าย มีคำแนะนำและกำลังใจ:\n\nรายรับรวม: ${U.fmtCurrency(income, cfg.currency)}\nรายจ่ายรวม: ${U.fmtCurrency(expense, cfg.currency)}\nคงเหลือ: ${U.fmtCurrency(income - expense, cfg.currency)}\nหมวดที่ใช้มาก: ${catBreakdown || 'ไม่มีข้อมูล'}\n\nรายวัน:\n${dayDetails}\n\nสรุปสั้นๆ 3-4 ประโยค พร้อมคำแนะนำ 1-2 ข้อ`,
        { maxTokens: 600 }
      );
      const body = document.getElementById('weeklyBody');
      if (body) body.innerHTML = `<div style="line-height:1.8;font-size:.86rem;background:var(--bg-input);padding:14px;border-radius:10px;white-space:pre-wrap">${text}</div>`;
    } catch {
      const body = document.getElementById('weeklyBody');
      if (body) body.innerHTML = '<div class="insight-card"><div class="insight-icon">⚠️</div><div class="insight-text">ไม่สามารถสร้างสรุปได้ กรุณาลองใหม่</div></div>';
    }
  },
  async openSpendingPattern() {
    if (!AI._key()) { U.toast(AI._noKeyMsg().split('\n')[0], 'error'); return; }
    const cfg = U.getConfig();
    const txns = ST.getAll('transactions').filter(t => t.type === 'expense');
    if (txns.length < 10) { U.toast('ต้องมีรายการอย่างน้อย 10 รายการ', 'error'); return; }
    const dayNames = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัส','ศุกร์','เสาร์'];
    const dayTotals = Array(7).fill(0), dayCounts = Array(7).fill(0);
    txns.forEach(t => { const d = new Date(t.date + 'T00:00:00').getDay(); dayTotals[d] += Number(t.amount); dayCounts[d]++; });
    const dayStr = dayNames.map((n, i) => dayCounts[i] > 0 ? `${n}: เฉลี่ย ${U.fmtCurrency(Math.round(dayTotals[i]/dayCounts[i]), cfg.currency)}/ครั้ง (${dayCounts[i]} ครั้ง)` : `${n}: ไม่มีรายการ`).join('\n');
    const dateTotals = {};
    txns.forEach(t => { const day = parseInt(t.date.slice(8)); dateTotals[day] = (dateTotals[day] || 0) + Number(t.amount); });
    const topDates = Object.entries(dateTotals).sort((a,b) => b[1]-a[1]).slice(0,5).map(([d,v]) => `วันที่ ${d}: ${U.fmtCurrency(v, cfg.currency)}`).join(', ');
    const o = document.createElement('div'); o.className = 'modal-overlay';
    o.innerHTML = `<div class="modal" style="max-width:500px"><h3>🔍 วิเคราะห์รูปแบบการใช้จ่าย</h3><div id="patternBody"><div class="ins-loading"><div class="ins-dot"></div><div class="ins-dot"></div><div class="ins-dot"></div><span>AI กำลังวิเคราะห์...</span></div></div><div class="modal-actions" style="margin-top:16px"><button class="btn btn-outline" id="patternClose">ปิด</button></div></div>`;
    document.getElementById('modalRoot').appendChild(o);
    o.querySelector('#patternClose').onclick = () => o.remove();
    o.onclick = e => { if (e.target === o) o.remove(); };
    try {
      const text = await AI.call(
        `วิเคราะห์ pattern การใช้จ่ายและให้ insight เป็นภาษาไทย:\n\nค่าเฉลี่ยต่อวันในสัปดาห์:\n${dayStr}\n\nวันที่ของเดือนที่ใช้เงินมากสุด: ${topDates}\nจำนวนรายการทั้งหมด: ${txns.length}\n\nวิเคราะห์: 1)วันไหนในสัปดาห์ที่ใช้เงินมาก/น้อย 2)ช่วงไหนของเดือนที่ใช้เยอะ 3)แนะนำการจัดการ`,
        { maxTokens: 700 }
      );
      const body = document.getElementById('patternBody');
      if (body) body.innerHTML = `<div style="line-height:1.8;font-size:.86rem;background:var(--bg-input);padding:14px;border-radius:10px;white-space:pre-wrap">${text}</div>`;
    } catch {
      const body = document.getElementById('patternBody');
      if (body) body.innerHTML = '<div class="insight-card"><div class="insight-icon">⚠️</div><div class="insight-text">ไม่สามารถวิเคราะห์ได้</div></div>';
    }
  },
  async openTaxAdvisor() {
    if (!AI._key()) { U.toast(AI._noKeyMsg().split('\n')[0], 'error'); return; }
    const cfg = U.getConfig();
    const year = new Date().getFullYear();
    const txns = ST.getAll('transactions').filter(t => t.type === 'expense' && t.date.startsWith(String(year)));
    const cats = ST.getAll('categories');
    const spending = EH.catSpending(txns, cats).map(s => `${s.name}: ${U.fmtCurrency(s.amount, cfg.currency)}`).join(', ');
    const allItems = txns.slice(0, 60).map(t => { const cat = cats.find(c => c.id === t.categoryId); return `${t.date} ${t.itemName || (cat?.name || '?')} ${U.fmtCurrency(t.amount, cfg.currency)}`; }).join('\n');
    const o = document.createElement('div'); o.className = 'modal-overlay';
    o.innerHTML = `<div class="modal" style="max-width:520px"><h3>🧾 ที่ปรึกษาลดหย่อนภาษีไทย ${year}</h3><div id="taxBody"><div class="ins-loading"><div class="ins-dot"></div><div class="ins-dot"></div><div class="ins-dot"></div><span>AI กำลังวิเคราะห์...</span></div></div><div class="modal-actions" style="margin-top:16px"><button class="btn btn-outline" id="taxClose">ปิด</button></div></div>`;
    document.getElementById('modalRoot').appendChild(o);
    o.querySelector('#taxClose').onclick = () => o.remove();
    o.onclick = e => { if (e.target === o) o.remove(); };
    try {
      const text = await AI.call(
        `วิเคราะห์รายจ่ายของผู้ใช้ในปี ${year} และแนะนำสิทธิ์ลดหย่อนภาษีเงินได้บุคคลธรรมดาของไทยที่อาจใช้ได้ เป็นภาษาไทย:\n\nสรุปรายจ่ายปีนี้: ${spending || 'ยังไม่มีข้อมูล'}\n\nรายการล่าสุด:\n${allItems || 'ยังไม่มีรายการ'}\n\nให้: 1)รายการที่น่าจะใช้ลดหย่อนได้พร้อมวงเงินสูงสุดตามกฎหมาย 2)สิทธิ์ที่ยังไม่เห็นในรายการแต่น่าพิจารณา 3)คำเตือน: AI ไม่ใช่นักบัญชี ควรปรึกษาผู้เชี่ยวชาญ`,
        { maxTokens: 900 }
      );
      const body = document.getElementById('taxBody');
      if (body) body.innerHTML = `<div style="line-height:1.8;font-size:.85rem;background:var(--bg-input);padding:14px;border-radius:10px;white-space:pre-wrap;max-height:60vh;overflow-y:auto">${text}</div>`;
    } catch {
      const body = document.getElementById('taxBody');
      if (body) body.innerHTML = '<div class="insight-card"><div class="insight-icon">⚠️</div><div class="insight-text">ไม่สามารถวิเคราะห์ได้</div></div>';
    }
  },
  async openDebtStrategy() {
    if (!AI._key()) { U.toast(AI._noKeyMsg().split('\n')[0], 'error'); return; }
    const cfg = U.getConfig();
    const cards = ST.getAll('credit_cards');
    const loans = ST.getAll('loan_plans').filter(p => p.status === 'active');
    if (!cards.filter(c => c.used > 0).length && !loans.length) { U.toast('ไม่มีหนี้บัตรเครดิตหรือแผนผ่อนชำระ', 'info'); return; }
    const cardStr = cards.filter(c => c.used > 0).map(c => `บัตร ${c.name}: ยอดค้าง ${U.fmtCurrency(c.used||0, cfg.currency)} วงเงิน ${U.fmtCurrency(c.limit||0, cfg.currency)}`).join('\n');
    const loanStr = loans.map(p => { const rem = Math.max(0, p.numberOfMonths - p.paidMonths) * Number(p.monthlyPayment||0); return `${p.name}: ยอดค้าง ${U.fmtCurrency(rem, cfg.currency)} ผ่อน ${U.fmtCurrency(p.monthlyPayment||0, cfg.currency)}/เดือน ดอกเบี้ย ${p.interestRate||0}%/ปี`; }).join('\n');
    const o = document.createElement('div'); o.className = 'modal-overlay';
    o.innerHTML = `<div class="modal" style="max-width:520px"><h3>💳 แผนปลดหนี้ที่เหมาะสมที่สุด</h3><div id="debtBody"><div class="ins-loading"><div class="ins-dot"></div><div class="ins-dot"></div><div class="ins-dot"></div><span>AI กำลังวางแผน...</span></div></div><div class="modal-actions" style="margin-top:16px"><button class="btn btn-outline" id="debtClose">ปิด</button></div></div>`;
    document.getElementById('modalRoot').appendChild(o);
    o.querySelector('#debtClose').onclick = () => o.remove();
    o.onclick = e => { if (e.target === o) o.remove(); };
    try {
      const text = await AI.call(
        `วางแผนปลดหนี้สำหรับผู้ใช้นี้ เป็นภาษาไทย เข้าใจง่าย:\n${cardStr ? `\nบัตรเครดิต:\n${cardStr}` : ''}${loanStr ? `\nแผนผ่อนชำระ:\n${loanStr}` : ''}\n\nแนะนำ: 1)เปรียบเทียบ Avalanche(ดอกสูงก่อน) vs Snowball(ยอดน้อยก่อน) 2)ลำดับการจ่ายหนี้ที่แนะนำ 3)ประมาณเวลาปลดหนี้ทั้งหมด(สมมติจ่ายขั้นต่ำ+เงินเหลือ 5,000/เดือน) 4)เคล็ดลับเพิ่มเติม`,
        { maxTokens: 900 }
      );
      const body = document.getElementById('debtBody');
      if (body) body.innerHTML = `<div style="line-height:1.8;font-size:.85rem;background:var(--bg-input);padding:14px;border-radius:10px;white-space:pre-wrap;max-height:60vh;overflow-y:auto">${text}</div>`;
    } catch {
      const body = document.getElementById('debtBody');
      if (body) body.innerHTML = '<div class="insight-card"><div class="insight-icon">⚠️</div><div class="insight-text">ไม่สามารถวิเคราะห์ได้</div></div>';
    }
  },
  loadAnomalies() {
    const container = document.getElementById('anomalyContainer'); if (!container) return;
    const cfg = U.getConfig();
    const cats = ST.getAll('categories');
    const allTxns = ST.getAll('transactions').filter(t => t.type === 'expense');
    const month = U.thisMonth();
    const now = new Date();
    // Compute per-category monthly avg over last 3 months (excluding current)
    const anomalies = [];
    cats.forEach(cat => {
      const monthly = [];
      for (let i = 1; i <= 3; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const m = d.toISOString().slice(0, 7);
        const total = allTxns.filter(t => t.categoryId === cat.id && t.date.startsWith(m)).reduce((s, t) => s + Number(t.amount), 0);
        if (total > 0) monthly.push(total);
      }
      if (monthly.length < 1) return;
      const avg = monthly.reduce((s, v) => s + v, 0) / monthly.length;
      const current = allTxns.filter(t => t.categoryId === cat.id && t.date.startsWith(month)).reduce((s, t) => s + Number(t.amount), 0);
      if (current > avg * 2 && current > 500) {
        anomalies.push({ cat, current, avg, ratio: current / avg });
      }
    });
    if (!anomalies.length) {
      container.innerHTML = '<div style="text-align:center;color:var(--text-secondary);font-size:.8rem;padding:12px">✅ ไม่พบรายการผิดปกติเดือนนี้</div>';
      return;
    }
    container.innerHTML = anomalies.sort((a, b) => b.ratio - a.ratio).map(a => `
      <div class="insight-card" style="border-left:3px solid var(--danger)">
        <div class="insight-icon">${a.cat.icon}</div>
        <div class="insight-text">
          <strong>${a.cat.name}</strong> เดือนนี้ ${U.fmtCurrency(a.current, cfg.currency)}
          สูงกว่าปกติ <strong style="color:var(--danger)">${a.ratio.toFixed(1)}x</strong>
          (ค่าเฉลี่ย ${U.fmtCurrency(Math.round(a.avg), cfg.currency)}/เดือน)
        </div>
      </div>`).join('');
  },
  async openMonthlyReport() {
    if (!AI._key()) { U.toast(AI._noKeyMsg().split('\n')[0], 'error'); return; }
    const cfg = U.getConfig();
    const month = U.thisMonth();
    const cats = ST.getAll('categories');
    const txns = ST.getAll('transactions').filter(t => t.date.startsWith(month));
    const income = txns.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const expense = txns.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    const catBreakdown = cats.map(c => {
      const spent = txns.filter(t => t.type === 'expense' && t.categoryId === c.id).reduce((s, t) => s + Number(t.amount), 0);
      return spent > 0 ? `${c.name}: ${U.fmtCurrency(spent, cfg.currency)}` : null;
    }).filter(Boolean).join(', ');
    // prev month
    const now = new Date();
    const prevD = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevM = `${prevD.getFullYear()}-${String(prevD.getMonth()+1).padStart(2,'0')}`;
    const prevTxns = ST.getAll('transactions').filter(t => t.date.startsWith(prevM));
    const prevExp = prevTxns.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

    const o = document.createElement('div'); o.className = 'modal-overlay';
    o.innerHTML = `<div class="modal" style="max-width:520px"><h3>📊 รายงานการเงิน ${month}</h3><div id="reportBody"><div class="ins-loading"><div class="ins-dot"></div><div class="ins-dot"></div><div class="ins-dot"></div><span>AI กำลังสร้างรายงาน...</span></div></div><div class="modal-actions" style="margin-top:16px"><button class="btn btn-outline" id="rptClose">ปิด</button></div></div>`;
    document.getElementById('modalRoot').appendChild(o);
    o.querySelector('#rptClose').onclick = () => o.remove();
    o.onclick = e => { if (e.target === o) o.remove(); };
    try {
      const prompt = `สร้างรายงานสรุปการเงินรายเดือน ${month} เป็นภาษาไทย แบบ markdown ที่อ่านง่าย

ข้อมูล:
- รายรับ: ${U.fmtCurrency(income, cfg.currency)}
- รายจ่าย: ${U.fmtCurrency(expense, cfg.currency)}
- คงเหลือ: ${U.fmtCurrency(income - expense, cfg.currency)}
- ค่าใช้จ่ายตามหมวด: ${catBreakdown || 'ยังไม่มี'}
- รายจ่ายเดือนที่แล้ว: ${U.fmtCurrency(prevExp, cfg.currency)}
- จำนวนรายการ: ${txns.length}

รายงานควรมี: 1) สรุปภาพรวม 2) หมวดที่ใช้มากสุด 3) เปรียบเทียบเดือนก่อน 4) สิ่งที่ทำได้ดี 5) คำแนะนำสำหรับเดือนหน้า`;
      const text = await AI.call(prompt, { maxTokens: 1200 });
      const body = document.getElementById('reportBody');
      if (body) body.innerHTML = `<div style="line-height:1.7;font-size:.85rem;white-space:pre-wrap;background:var(--bg-input);padding:14px;border-radius:10px;max-height:60vh;overflow-y:auto">${text.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/^#{1,3}\s(.+)/gm,'<div style="font-weight:700;margin:10px 0 4px;font-size:.92rem">$1</div>')}</div>`;
    } catch {
      const body = document.getElementById('reportBody');
      if (body) body.innerHTML = '<div class="insight-card"><div class="insight-icon">⚠️</div><div class="insight-text">ไม่สามารถสร้างรายงานได้ กรุณาลองใหม่</div></div>';
    }
  },
  async loadInsights() {
    const container = document.getElementById('insightsContainer'); if (!container) return;
    const data = EH.getInsightData();
    const cfg = U.getConfig();
    const txns = ST.getAll('transactions');
    if (txns.length < 3) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><p>บันทึกรายการอย่างน้อย 3 รายการเพื่อรับการวิเคราะห์ AI</p></div>'; return;
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

    if (!AI._key()) {
      const prov = AI._provider();
      container.innerHTML = `<div class="insight-card"><div class="insight-icon">🔑</div><div class="insight-text">กรุณาตั้งค่า ${prov === 'gemini' ? 'Gemini' : 'Anthropic'} API Key ก่อน<br><small>ไปที่ ⚙️ ตั้งค่า แล้วกรอก API Key</small></div></div>`;
      return;
    }
    try {
      const text = await AI.call(prompt, { maxTokens: 1000 });
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
    return `<div class="card"><div class="card-header"><span class="card-title">🎯 งบประมาณรายเดือน — ${month}</span><div style="display:flex;gap:6px"><button class="btn btn-outline btn-sm" id="btnAIBudget">🤖 AI แนะนำ</button><button class="btn btn-primary btn-sm" id="btnAddB">➕ ตั้งงบ</button></div></div>${cats.map(cat => {
      const b = budgets.find(x => x.categoryId === cat.id);
      const spent = txns.filter(t => t.categoryId === cat.id).reduce((s, t) => s + Number(t.amount), 0);
      const pct = b && b.amount > 0 ? Math.min(spent / b.amount * 100, 100) : 0;
      const cls = pct < 70 ? 'bok' : pct < 90 ? 'bwarn' : 'bover';
      return `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)"><span style="font-size:1.35rem;width:26px;text-align:center">${cat.icon}</span><div style="flex:1;min-width:0"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px"><span style="font-weight:600;font-size:.84rem">${cat.name}</span><div style="display:flex;align-items:center;gap:6px"><span style="font-size:.78rem;color:var(--expense);font-weight:600">${U.fmtCurrency(spent, cfg.currency)}</span>${b ? `<span style="font-size:.72rem;color:var(--text-secondary)">/ ${U.fmtCurrency(b.amount, cfg.currency)}</span>` : ''}<button class="btn-ghost" style="padding:2px 5px;font-size:.7rem" data-be="${cat.id}">${b ? '✏️' : '+ ตั้ง'}</button></div></div>${b ? `<div class="bbar-wrap"><div class="bbar-fill ${cls}" style="width:${pct}%"></div></div><div style="display:flex;justify-content:space-between;margin-top:1px"><span class="btag">${pct.toFixed(0)}% ใช้ไป</span><span class="btag" style="color:${b.amount - spent < 0 ? 'var(--danger)' : 'inherit'}">${b.amount - spent >= 0 ? `เหลือ ${U.fmtCurrency(b.amount - spent, cfg.currency)}` : `เกิน ${U.fmtCurrency(spent - b.amount, cfg.currency)}`}</span></div>` : '<div class="btag">ยังไม่ได้ตั้งงบประมาณ</div>'}</div></div>`;
    }).join('')}</div>`;
  },
  attachEvents() {
    document.getElementById('btnAddB')?.addEventListener('click', () => this.openModal());
    document.getElementById('btnAIBudget')?.addEventListener('click', () => this.openAISuggest());
    document.querySelectorAll('[data-be]').forEach(btn => btn.addEventListener('click', () => {
      const ex = ST.getAll('budgets').find(b => b.categoryId === btn.dataset.be);
      this.openModal(btn.dataset.be, ex);
    }));
  },
  async openAISuggest() {
    if (!AI._key()) { U.toast(AI._noKeyMsg().split('\n')[0], 'error'); return; }
    const cfg = U.getConfig();
    const cats = ST.getAll('categories').filter(c => c.type === 'expense');
    const now = new Date();
    const catAvgs = cats.map(cat => {
      const monthly = [];
      for (let i = 1; i <= 3; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const m = d.toISOString().slice(0, 7);
        const total = ST.getAll('transactions').filter(t => t.type === 'expense' && t.categoryId === cat.id && t.date.startsWith(m)).reduce((s, t) => s + Number(t.amount), 0);
        if (total > 0) monthly.push(total);
      }
      const avg = monthly.length ? Math.round(monthly.reduce((s, v) => s + v, 0) / monthly.length) : 0;
      return { id: cat.id, name: cat.name, avg };
    }).filter(c => c.avg > 0);

    const o = document.createElement('div'); o.className = 'modal-overlay';
    o.innerHTML = `<div class="modal" style="max-width:480px"><h3>🤖 AI แนะนำงบประมาณ</h3><div id="aibBody"><div class="ins-loading"><div class="ins-dot"></div><div class="ins-dot"></div><div class="ins-dot"></div><span>AI กำลังวิเคราะห์...</span></div></div><div class="modal-actions"><button class="btn btn-outline" id="aibClose">ปิด</button><button class="btn btn-primary" id="aibApplyAll" style="display:none">✅ ใช้ทั้งหมด</button></div></div>`;
    document.getElementById('modalRoot').appendChild(o);
    o.querySelector('#aibClose').onclick = () => o.remove();
    o.onclick = e => { if (e.target === o) o.remove(); };

    try {
      const dataStr = catAvgs.map(c => `${c.name}: เฉลี่ย ${U.fmtCurrency(c.avg, cfg.currency)}/เดือน`).join('\n');
      const prompt = `วิเคราะห์การใช้จ่ายและแนะนำงบประมาณรายเดือนที่เหมาะสม ตอบเป็น JSON array เท่านั้น:
[{"categoryId":"id","suggested":0,"reason":"เหตุผลสั้นๆ ภาษาไทย"}]

ข้อมูลค่าเฉลี่ย 3 เดือนล่าสุด:
${dataStr}

หมวดหมู่และ ID: ${catAvgs.map(c => `${c.id}=${c.name}`).join(', ')}
แนะนำงบที่เหมาะสม (อาจต่างจากค่าเฉลี่ยถ้าดูแล้วสูงเกินไป)`;
      const text = await AI.call(prompt, { maxTokens: 800 });
      let suggestions = [];
      try { suggestions = JSON.parse(text.replace(/```json|```/g, '').trim()); } catch {}

      const body = document.getElementById('aibBody');
      if (!body) return;
      if (!suggestions.length) { body.innerHTML = '<div class="insight-card"><div class="insight-icon">⚠️</div><div class="insight-text">ไม่มีข้อมูลเพียงพอ กรุณาบันทึกรายการอย่างน้อย 1 เดือนก่อน</div></div>'; return; }

      body.innerHTML = suggestions.map(s => {
        const cat = cats.find(c => c.id === s.categoryId);
        if (!cat) return '';
        return `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
          <span style="font-size:1.2rem">${cat.icon}</span>
          <div style="flex:1"><div style="font-weight:600;font-size:.86rem">${cat.name}</div><div style="font-size:.72rem;color:var(--text-secondary)">${s.reason||''}</div></div>
          <div style="text-align:right"><div style="font-weight:700;color:var(--accent)">${U.fmtCurrency(s.suggested, cfg.currency)}</div><button class="btn btn-outline btn-sm" data-aib-cat="${s.categoryId}" data-aib-amt="${s.suggested}" style="font-size:.68rem;margin-top:3px">ใช้</button></div>
        </div>`;
      }).join('');
      o.querySelector('#aibApplyAll').style.display = '';

      body.querySelectorAll('[data-aib-cat]').forEach(btn => btn.addEventListener('click', () => {
        const catId = btn.dataset.aibCat; const amount = Number(btn.dataset.aibAmt);
        const ex = ST.getAll('budgets').find(b => b.categoryId === catId);
        if (ex) ST.update('budgets', ex.id, { amount }); else ST.add('budgets', { categoryId: catId, amount });
        btn.textContent = '✅'; btn.disabled = true;
        U.toast('ตั้งงบแล้ว', 'success');
        App.rv('budget');
      }));
      o.querySelector('#aibApplyAll').addEventListener('click', () => {
        suggestions.forEach(s => {
          if (!s.suggested || !s.categoryId) return;
          const ex = ST.getAll('budgets').find(b => b.categoryId === s.categoryId);
          if (ex) ST.update('budgets', ex.id, { amount: s.suggested }); else ST.add('budgets', { categoryId: s.categoryId, amount: s.suggested });
        });
        U.toast('ตั้งงบทั้งหมดแล้ว ✅', 'success');
        o.remove(); App.rv('budget');
      });
    } catch {
      const body = document.getElementById('aibBody');
      if (body) body.innerHTML = '<div class="insight-card"><div class="insight-icon">⚠️</div><div class="insight-text">ไม่สามารถเชื่อมต่อ AI ได้</div></div>';
    }
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
    <div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;font-size:.74rem;color:var(--text-secondary);margin-bottom:4px"><span>ทรัพย์สิน ${((totalAsset/Math.max(totalAsset+totalDebt,1))*100).toFixed(0)}%</span><span>หนี้สิน ${((totalDebt/Math.max(totalAsset+totalDebt,1))*100).toFixed(0)}%</span></div><div style="height:12px;border-radius:6px;overflow:hidden;display:flex">${totalAsset+totalDebt===0?'<div style="background:var(--border);width:100%"></div>':`<div style="background:var(--success);width:${totalAsset/(totalAsset+totalDebt)*100}%;transition:width .4s"></div><div style="background:var(--expense);flex:1"></div>`}</div></div>
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
    o.innerHTML = `<div class="modal"><h3>${isEdit ? '✏️ แก้ไข' : '➕ เพิ่มบัญชี/ทรัพย์สิน'}</h3><div class="form-group"><label>ประเภท</label><select id="aT"><option value="asset" ${!isEdit || edit.atype === 'asset' ? 'selected' : ''}>ทรัพย์สิน</option><option value="debt" ${isEdit && edit.atype === 'debt' ? 'selected' : ''}>หนี้สิน</option></select></div><div class="form-group"><label>ไอคอน</label><div style="display:flex;flex-wrap:wrap;gap:5px" id="aip">${icons.map(ic => `<span style="font-size:1.4rem;cursor:pointer;padding:3px;border-radius:5px;border:2px solid ${isEdit && edit.icon === ic ? 'var(--accent)' : 'transparent'}" data-ic="${ic}">${ic}</span>`).join('')}</div><input type="text" id="aI" value="${isEdit ? edit.icon : '💰'}" maxlength="4" placeholder="หรือพิมพ์/วางอีโมจิเอง" style="width:120px;margin-top:6px;font-size:1.1rem;text-align:center"></div><div class="form-group"><label>ชื่อ</label><input type="text" id="aN" value="${isEdit ? edit.name : ''}" placeholder="เช่น บัญชีออมทรัพย์ SCB"></div><div class="form-group"><label>หมวดหมู่</label><input type="text" id="aC" value="${isEdit ? edit.category || '' : ''}" placeholder="เช่น บัญชีธนาคาร, กองทุน, อสังหา"></div><div class="form-group"><label>มูลค่าปัจจุบัน</label><input type="number" id="aA" value="${isEdit ? edit.amount : ''}" placeholder="0.00" step="1" min="0"></div><div class="modal-actions"><button class="btn btn-outline" id="ac">ยกเลิก</button><button class="btn btn-primary" id="as">บันทึก</button></div></div>`;
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