// ===== AI CHATBOT =====
const ChatView = {
  history: [],
  _loading: false,

  render() {
    this.history = [];
    this._loading = false;
    const chips = ['เดือนนี้ใช้เงินเท่าไหร่?','หมวดไหนใช้เยอะสุด?','ควรออมเดือนละเท่าไหร่?','สรุปการเงินเดือนนี้','ช่วยวางแผนลดค่าใช้จ่าย'];
    return `<div class="chat-wrap">
      <div class="chat-messages" id="chatMessages">
        <div class="chat-bubble ai">👋 สวัสดีครับ! ผมเป็น AI ผู้ช่วยด้านการเงิน ถามเรื่องรายรับ-รายจ่าย การออม หรือการวางแผนการเงินได้เลยครับ</div>
      </div>
      <div class="chat-chips" id="chatChips">${chips.map(c => `<button class="chat-chip" data-chip="${c}">${c}</button>`).join('')}</div>
      <div class="chat-input-row">
        <textarea id="chatInput" class="chat-textarea" placeholder="พิมพ์คำถาม... (Enter=ส่ง, Shift+Enter=ขึ้นบรรทัด)" rows="1"></textarea>
        <button class="btn btn-primary" id="chatSend" style="flex-shrink:0">➤</button>
      </div>
    </div>`;
  },

  attachEvents() {
    const input = document.getElementById('chatInput');
    const send = document.getElementById('chatSend');
    if (!input || !send) return;
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this._send(input.value); input.value = ''; }
    });
    send.addEventListener('click', () => { this._send(input.value); input.value = ''; });
    document.querySelectorAll('.chat-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        this._send(chip.dataset.chip);
        document.getElementById('chatChips')?.remove();
      });
    });
  },

  _send(text) {
    text = text.trim(); if (!text || this._loading) return;
    this._appendBubble('user', text);
    this.history.push({ role: 'user', content: text });
    const loadId = this._appendBubble('ai', '<div class="ins-loading"><div class="ins-dot"></div><div class="ins-dot"></div><div class="ins-dot"></div></div>', true);
    this._loading = true;
    this._callAPI().then(reply => {
      document.getElementById(loadId)?.remove();
      // Parse and execute [TXN:{...}] block if present
      const txnMatch = reply.match(/\[TXN:(\{[^}]+\})\]/);
      if (txnMatch) {
        try {
          const td = JSON.parse(txnMatch[1]);
          if (td.amount > 0) {
            ST.add('transactions', { type: td.type || 'expense', amount: Number(td.amount), categoryId: td.categoryId || '', itemName: td.itemName || '', date: U.today(), note: 'บันทึกผ่าน AI Chat' });
            window.dispatchEvent(new Event('sc'));
            if (typeof App !== 'undefined' && App.cv === 'add') App.rv('add');
          }
        } catch {}
      }
      const cleanReply = reply.replace(/\[TXN:\{[^}]+\}\]\s*/g, '');
      this._appendBubble('ai', cleanReply);
      this.history.push({ role: 'assistant', content: cleanReply });
      this._loading = false;
    }).catch(() => {
      document.getElementById(loadId)?.remove();
      this._appendBubble('ai', '⚠️ ไม่สามารถเชื่อมต่อ AI ได้ กรุณาลองใหม่');
      this._loading = false;
    });
  },

  _appendBubble(role, html, isLoading = false) {
    const msgs = document.getElementById('chatMessages'); if (!msgs) return null;
    const id = 'cb_' + Date.now();
    const div = document.createElement('div');
    div.className = `chat-bubble ${role}`;
    div.id = id;
    div.innerHTML = html;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return isLoading ? id : null;
  },

  _buildSystemPrompt() {
    const cfg = U.getConfig();
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 90);
    const txns = ST.getAll('transactions').filter(t => new Date(t.date) >= cutoff);
    const cats = Object.fromEntries(ST.getAll('categories').map(c => [c.id, c]));
    const wallets = ST.getAll('wallet_accounts');
    const cards = ST.getAll('credit_cards');
    const budgets = ST.getAll('budgets');
    const goals = ST.getAll('savings_goals');
    const subs = ST.getAll('subscriptions');
    const installments = ST.getAll('installments').filter(i => i.status === 'active');
    const month = U.thisMonth();
    const thisMonthTxns = txns.filter(t => t.date.startsWith(month));
    const totalIncome = thisMonthTxns.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const totalExpense = thisMonthTxns.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    const catSpending = {};
    thisMonthTxns.filter(t => t.type === 'expense').forEach(t => {
      const n = cats[t.categoryId]?.name || 'อื่นๆ';
      catSpending[n] = (catSpending[n] || 0) + Number(t.amount);
    });
    const top5cats = Object.entries(catSpending).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([n,v])=>`${n}: ${U.fmtCurrency(v,cfg.currency)}`).join(', ');
    const walletSummary = wallets.map(w => `${w.name}: ${U.fmtCurrency(w.balance||0, cfg.currency)}`).join(', ');
    const cardSummary = cards.map(c => `${c.name} (ใช้ ${U.fmtCurrency(c.used||0, cfg.currency)} / วงเงิน ${U.fmtCurrency(c.limit||0, cfg.currency)})`).join(', ');
    const budgetSummary = budgets.map(b => {
      const cat = cats[b.categoryId]; const spent = catSpending[cat?.name] || 0;
      return `${cat?.name||'?'}: ใช้ ${U.fmtCurrency(spent, cfg.currency)} / งบ ${U.fmtCurrency(b.amount, cfg.currency)}`;
    }).join(', ');
    const goalSummary = goals.map(g => `${g.name}: ออม ${U.fmtCurrency(g.currentAmount||0, cfg.currency)} / เป้า ${U.fmtCurrency(g.targetAmount, cfg.currency)}`).join(', ');
    const subsSummary = subs.filter(s=>s.active!==false).map(s=>`${s.name} ${U.fmtCurrency(s.cost||0,cfg.currency)}/เดือน`).join(', ');
    const instSummary = installments.map(i=>`${i.itemName}: เหลือ ${i.remainingMonths} งวด x ${U.fmtCurrency(i.monthlyPayment,cfg.currency)}`).join(', ');
    const allCats = ST.getAll('categories');
    const catOptions = allCats.map(c => `${c.id}=${c.name}(${c.type==='expense'?'จ่าย':'รับ'})`).join(', ');
    return `คุณเป็น AI ผู้ช่วยการเงินส่วนตัวที่ฉลาดและเป็นมิตร ตอบเป็นภาษาไทย กระชับ เข้าใจง่าย

ข้อมูลการเงินของผู้ใช้ (เดือน ${month}):
- รายรับเดือนนี้: ${U.fmtCurrency(totalIncome, cfg.currency)}
- รายจ่ายเดือนนี้: ${U.fmtCurrency(totalExpense, cfg.currency)}
- คงเหลือ: ${U.fmtCurrency(totalIncome - totalExpense, cfg.currency)}
- ค่าใช้จ่ายตามหมวด: ${top5cats || 'ยังไม่มีข้อมูล'}
- บัญชีกระเป๋า: ${walletSummary || 'ยังไม่มี'}
- บัตรเครดิต: ${cardSummary || 'ยังไม่มี'}
- งบประมาณ: ${budgetSummary || 'ยังไม่ได้ตั้ง'}
- เป้าหมายการออม: ${goalSummary || 'ยังไม่มี'}
- ค่าสมาชิกรายเดือน: ${subsSummary || 'ยังไม่มี'}
- แผนผ่อนชำระ: ${instSummary || 'ไม่มี'}
- ธุรกรรม 90 วันล่าสุด: ${txns.length} รายการ

หมวดหมู่ที่มี: ${catOptions}

🔴 กฎพิเศษ: ถ้าผู้ใช้ต้องการบันทึกรายการ (เช่น "ซื้อข้าว 60", "จ่ายค่าน้ำ 300", "ได้เงินเดือน 30000") ให้เริ่มต้นตอบด้วย [TXN:{"type":"expense","amount":0,"itemName":"","categoryId":""}] ก่อนเสมอ แล้วตามด้วยข้อความยืนยันภาษาไทย
ตัวอย่าง: ผู้ใช้: "ซื้อกาแฟ 80" → [TXN:{"type":"expense","amount":80,"itemName":"กาแฟ","categoryId":"cat_food"}] บันทึกค่ากาแฟ 80 บาทแล้วนะครับ ✅

ตอบโดยอ้างอิงข้อมูลจริงข้างต้น ให้คำแนะนำที่ปฏิบัติได้จริง`;
  },

  async _callAPI() {
    if (!AI._key()) return AI._noKeyMsg();
    try {
      return await AI.chat(this._buildSystemPrompt(), this.history, { maxTokens: 1500 });
    } catch(e) {
      return `⚠️ ${e.message || 'เกิดข้อผิดพลาด'}`;
    }
  }
};
