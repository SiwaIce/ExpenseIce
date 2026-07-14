// ===== OCR Receipt Scanner (Tesseract.js — 100% offline) =====
const OCRScanner = {
  _worker: null,
  _workerReady: false,
  _ov: null,

  // ── Entry point ─────────────────────────────────────────────────
  open(onResult) {
    if (this._ov) return;
    this._onResult = onResult;
    this._showChoose();
  },

  // ── State 1: Choose source ───────────────────────────────────────
  _showChoose() {
    const ov = document.createElement('div');
    ov.id = 'ocrOverlay';
    ov.className = 'ocr-overlay';
    ov.innerHTML = `
      <div class="ocr-panel ocr-choose">
        <div class="ocr-header">
          <span class="ocr-title">📷 สแกนใบเสร็จ / สลิป</span>
          <button class="ocr-close" id="ocrClose">✕</button>
        </div>
        <div class="ocr-drop-zone" id="ocrDropZone">
          <div class="ocr-drop-icon">🧾</div>
          <div class="ocr-drop-text">แตะเพื่อเลือกรูป</div>
          <div class="ocr-drop-sub">ใบเสร็จ · สลิปโอน · QR PromptPay</div>
          <input type="file" id="ocrFile" accept="image/*" capture="environment" style="display:none">
        </div>
        <div class="ocr-tips">
          <div class="ocr-tip">📸 ถ่ายตรง ไม่เอียง</div>
          <div class="ocr-tip">💡 แสงสว่างพอ</div>
          <div class="ocr-tip">🔒 ข้อมูลไม่ออกจากเครื่อง</div>
        </div>
        <div class="ocr-offline-badge">⚡ Offline · ไม่ใช้ API</div>
      </div>`;
    document.body.appendChild(ov);
    this._ov = ov;

    ov.querySelector('#ocrClose').onclick = () => this._close();
    ov.addEventListener('click', e => { if (e.target === ov) this._close(); });

    const fileInput = ov.querySelector('#ocrFile');
    ov.querySelector('#ocrDropZone').addEventListener('click', () => fileInput.click());

    // Drag & drop support
    ov.querySelector('#ocrDropZone').addEventListener('dragover', e => {
      e.preventDefault();
      ov.querySelector('#ocrDropZone').classList.add('drag-over');
    });
    ov.querySelector('#ocrDropZone').addEventListener('dragleave', () => {
      ov.querySelector('#ocrDropZone').classList.remove('drag-over');
    });
    ov.querySelector('#ocrDropZone').addEventListener('drop', e => {
      e.preventDefault();
      ov.querySelector('#ocrDropZone').classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) this._startScan(file);
    });

    fileInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (file) this._startScan(file);
    });
  },

  // ── State 2: Scanning ─────────────────────────────────────────────
  async _startScan(file) {
    const panel = this._ov.querySelector('.ocr-panel');
    const imgUrl = URL.createObjectURL(file);

    panel.innerHTML = `
      <div class="ocr-header">
        <span class="ocr-title">🔍 กำลังอ่าน...</span>
        <button class="ocr-close" id="ocrClose">✕</button>
      </div>
      <div class="ocr-scan-wrap" id="ocrScanWrap">
        <img id="ocrPreview" src="${imgUrl}" class="ocr-preview-img" alt="preview">
        <div class="ocr-scan-line" id="ocrScanLine"></div>
        <div class="ocr-corner tl"></div>
        <div class="ocr-corner tr"></div>
        <div class="ocr-corner bl"></div>
        <div class="ocr-corner br"></div>
      </div>
      <div class="ocr-prog-wrap">
        <div class="ocr-prog-bar"><div class="ocr-prog-fill" id="ocrFill" style="width:0%"></div></div>
        <div class="ocr-prog-status" id="ocrStatus">เตรียมระบบ OCR...</div>
      </div>`;

    this._ov.querySelector('#ocrClose').onclick = () => this._close();

    const setProgress = ({ status, progress }) => {
      const fill = document.getElementById('ocrFill');
      const stat = document.getElementById('ocrStatus');
      if (fill) fill.style.width = Math.round((progress || 0) * 100) + '%';
      if (stat) stat.textContent = status || '';
    };

    try {
      // Preprocess image
      setProgress({ status: '🖼️ ปรับคุณภาพภาพ...', progress: 0.05 });
      const canvas = await this._preprocess(file);

      // Load & run Tesseract
      setProgress({ status: '⚙️ โหลดระบบ OCR...', progress: 0.1 });
      const worker = await this._getWorker(setProgress);

      setProgress({ status: '📖 กำลังอ่านตัวอักษร...', progress: 0.85 });
      const { data: { text, confidence } } = await worker.recognize(canvas);

      setProgress({ status: '🧠 วิเคราะห์ข้อมูล...', progress: 0.97 });
      URL.revokeObjectURL(imgUrl);

      const parsed = this._parse(text);
      parsed._rawConfidence = confidence;

      await new Promise(r => setTimeout(r, 400)); // brief pause so user sees 100%
      setProgress({ status: '✅ เสร็จแล้ว!', progress: 1 });
      await new Promise(r => setTimeout(r, 300));

      this._showResult(parsed, file);
    } catch (err) {
      URL.revokeObjectURL(imgUrl);
      this._showError(err.message || 'ไม่สามารถอ่านภาพได้');
    }
  },

  // ── State 3: Results ─────────────────────────────────────────────
  _showResult(data, originalFile) {
    const panel = this._ov.querySelector('.ocr-panel');
    const cfg = U.getConfig();
    const cats = ST.getAll('categories').filter(c => c.type === 'expense');
    const catOpt = cats.map(c => `<option value="${c.id}" ${c.id === data.categoryId ? 'selected' : ''}>${c.icon} ${c.name}</option>`).join('');

    const confColor = c => c === 'high' ? '#10b981' : c === 'low' ? '#f59e0b' : '#94a3b8';
    const confLabel = c => c === 'high' ? '✓ มั่นใจ' : c === 'low' ? '~ คาดเดา' : '? ไม่พบ';

    const amtDisplay = data.amount.value ? U.fmtCurrency(data.amount.value, cfg.currency) : '—';
    const dateDisplay = data.date.value || '—';
    const mercDisplay = data.merchant.value || '—';

    const bankBadge = data.bank
      ? `<div class="ocr-bank-badge">${data.bank.icon} ${data.bank.name}</div>`
      : '';
    const slipBadge = data.isSlip
      ? '<span class="ocr-type-badge slip">💸 สลิปโอน</span>'
      : '<span class="ocr-type-badge receipt">🧾 ใบเสร็จ</span>';

    panel.innerHTML = `
      <div class="ocr-header">
        <div style="display:flex;align-items:center;gap:8px">
          ${slipBadge}
          ${bankBadge}
        </div>
        <button class="ocr-close" id="ocrClose">✕</button>
      </div>

      <div class="ocr-result-scroll">
        <div class="ocr-result-section">
          <div class="ocr-field-label">💰 ยอดเงิน</div>
          <div class="ocr-field-row">
            <input class="ocr-field-input ocr-amount-input" id="ocrAmount"
              type="number" value="${data.amount.value || ''}" placeholder="0.00">
            <span class="ocr-conf-badge" style="background:${confColor(data.amount.confidence)}20;color:${confColor(data.amount.confidence)}">${confLabel(data.amount.confidence)}</span>
          </div>
        </div>

        <div class="ocr-result-section">
          <div class="ocr-field-label">📅 วันที่</div>
          <div class="ocr-field-row">
            <input class="ocr-field-input" id="ocrDate"
              type="date" value="${data.date.value || U.today()}">
            <span class="ocr-conf-badge" style="background:${confColor(data.date.confidence)}20;color:${confColor(data.date.confidence)}">${confLabel(data.date.confidence)}</span>
          </div>
        </div>

        <div class="ocr-result-section">
          <div class="ocr-field-label">🏪 ชื่อร้าน / รายการ</div>
          <div class="ocr-field-row">
            <input class="ocr-field-input" id="ocrName"
              type="text" value="${(data.merchant.value || '').replace(/"/g,'&quot;')}" placeholder="ชื่อร้านหรือรายการ">
            <span class="ocr-conf-badge" style="background:${confColor(data.merchant.confidence)}20;color:${confColor(data.merchant.confidence)}">${confLabel(data.merchant.confidence)}</span>
          </div>
        </div>

        <div class="ocr-result-section">
          <div class="ocr-field-label">📁 หมวดหมู่</div>
          <select class="ocr-field-input" id="ocrCat">
            <option value="">— ไม่ระบุ —</option>
            ${catOpt}
          </select>
        </div>

        <details class="ocr-raw-toggle">
          <summary>🔎 ข้อความที่อ่านได้ (OCR raw)</summary>
          <pre class="ocr-raw-text">${(data.rawText || '').substring(0, 600)}${data.rawText?.length > 600 ? '...' : ''}</pre>
        </details>
      </div>

      <div class="ocr-result-actions">
        <button class="ocr-retry-btn" id="ocrRetry">↩ สแกนใหม่</button>
        <button class="ocr-use-btn" id="ocrUse">ใช้ข้อมูลนี้ →</button>
      </div>`;

    this._ov.querySelector('#ocrClose').onclick = () => this._close();
    this._ov.querySelector('#ocrRetry').onclick = () => {
      panel.innerHTML = '';
      this._ov.querySelector('.ocr-panel').className = 'ocr-panel ocr-choose';
      this._showChoose._replacePanel?.call(this) || this._close() || this.open(this._onResult);
    };
    this._ov.querySelector('#ocrRetry').onclick = () => {
      this._close();
      setTimeout(() => this.open(this._onResult), 100);
    };

    this._ov.querySelector('#ocrUse').onclick = () => {
      const amount = parseFloat(this._ov.querySelector('#ocrAmount').value) || null;
      const date = this._ov.querySelector('#ocrDate').value || null;
      const name = this._ov.querySelector('#ocrName').value.trim() || null;
      const catId = this._ov.querySelector('#ocrCat').value || null;
      this._close();
      if (this._onResult) this._onResult({ amount, date, name, categoryId: catId, _file: originalFile });
    };
  },

  // ── Error state ──────────────────────────────────────────────────
  _showError(msg) {
    const panel = this._ov?.querySelector('.ocr-panel');
    if (!panel) return;
    panel.innerHTML = `
      <div class="ocr-header">
        <span class="ocr-title">⚠️ เกิดข้อผิดพลาด</span>
        <button class="ocr-close" id="ocrClose">✕</button>
      </div>
      <div style="text-align:center;padding:32px 20px">
        <div style="font-size:3rem;margin-bottom:12px">😕</div>
        <div style="font-size:.9rem;color:var(--text-secondary);margin-bottom:6px">${msg}</div>
        <div style="font-size:.8rem;color:var(--text-secondary)">ลองถ่ายรูปใหม่ที่แสงสว่างและชัดขึ้น</div>
      </div>
      <div class="ocr-result-actions">
        <button class="ocr-retry-btn" id="ocrRetry">↩ ลองใหม่</button>
      </div>`;
    this._ov.querySelector('#ocrClose').onclick = () => this._close();
    this._ov.querySelector('#ocrRetry').onclick = () => {
      this._close();
      setTimeout(() => this.open(this._onResult), 100);
    };
  },

  _close() {
    this._ov?.remove();
    this._ov = null;
  },

  // ── Tesseract worker management ──────────────────────────────────
  async _getWorker(progressCb) {
    if (this._workerReady && this._worker) return this._worker;

    if (!window.Tesseract) {
      progressCb?.({ status: '📦 โหลดไลบรารี OCR...', progress: 0.02 });
      await this._loadScript('https://unpkg.com/tesseract.js@5/dist/tesseract.min.js');
    }

    let phase = 'init';
    const w = await Tesseract.createWorker(['tha', 'eng'], 1, {
      logger: m => {
        if (m.status === 'loading tesseract core') {
          progressCb?.({ status: '⚙️ โหลดระบบ OCR...', progress: 0.05 + m.progress * 0.15 });
        } else if (m.status.startsWith('loading language')) {
          const lang = m.status.includes('tha') ? 'ภาษาไทย' : 'ภาษาอังกฤษ';
          progressCb?.({ status: `📚 โหลดโมเดล${lang}...`, progress: 0.2 + m.progress * 0.5 });
        } else if (m.status === 'initializing api') {
          progressCb?.({ status: '🔧 เตรียมพร้อม...', progress: 0.7 + m.progress * 0.12 });
        } else if (m.status === 'recognizing text') {
          progressCb?.({ status: '🔤 อ่านตัวอักษร...', progress: 0.85 + m.progress * 0.1 });
        }
      }
    });

    this._worker = w;
    this._workerReady = true;
    return w;
  },

  _loadScript(src) {
    return new Promise((res, rej) => {
      if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
      const s = document.createElement('script');
      s.src = src;
      s.onload = res;
      s.onerror = () => rej(new Error('โหลด Tesseract.js ไม่ได้ — ตรวจสอบอินเทอร์เน็ต'));
      document.head.appendChild(s);
    });
  },

  // ── Image preprocessing ──────────────────────────────────────────
  _preprocess(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX = 2200;
        let { width: w, height: h } = img;
        if (w > MAX || h > MAX) {
          const r = Math.min(MAX / w, MAX / h);
          w = Math.round(w * r); h = Math.round(h * r);
        }
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);

        // Grayscale + contrast boost for better OCR accuracy
        const id = ctx.getImageData(0, 0, w, h);
        const d = id.data;
        for (let i = 0; i < d.length; i += 4) {
          const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          // S-curve contrast: push mid-tones toward black or white
          const c = Math.min(255, Math.max(0, (gray - 128) * 1.5 + 145));
          d[i] = d[i + 1] = d[i + 2] = c;
        }
        ctx.putImageData(id, 0, 0);
        res(cv);
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('โหลดภาพไม่ได้')); };
      img.src = url;
    });
  },

  // ── Text parsing ─────────────────────────────────────────────────
  _parse(rawText) {
    // Clean up OCR noise
    const text = rawText
      .replace(/[|}{\\]/g, '')   // common OCR misreads
      .replace(/\s+/g, ' ')
      .trim();

    const amount   = this._extractAmount(text);
    const date     = this._extractDate(text);
    const merchant = this._extractMerchant(text);
    const bank     = this._extractBank(text);
    const isSlip   = this._isTransferSlip(text);
    const categoryId = this._guessCategory(merchant.value, text, isSlip);

    return { amount, date, merchant, bank, isSlip, categoryId, rawText: text };
  },

  _extractAmount(text) {
    // Priority-ordered patterns: labeled fields first, then currency symbols, then bare numbers
    const patterns = [
      // Labeled Thai keywords
      [/(?:จำนวนเงิน|ยอดเงิน|ยอดชำระ|ยอดรวม|ยอดโอน|จำนวน|ยอดสุทธิ)\s*[฿:]*\s*([\d,]+(?:\.\d{1,2})?)/i, 'high'],
      // English labels
      [/(?:Total|Grand\s*Total|Amount|Subtotal)\s*[:\s]*(?:THB|฿)?\s*([\d,]+(?:\.\d{1,2})?)/i, 'high'],
      // Currency prefix
      [/(?:THB|฿)\s*([\d,]{1,10}(?:\.\d{1,2})?)/g, 'high'],
      // Number + unit suffix
      [/([\d,]{2,10}(?:\.\d{2}))\s*(?:บาท|THB)/i, 'high'],
      // Bare decimal number (fallback — pick largest)
      [/([\d,]{2,10}\.\d{2})/g, 'low'],
    ];

    const candidates = [];

    for (const [pat, conf] of patterns) {
      const re = new RegExp(pat.source, pat.flags.includes('g') ? 'gi' : 'i');
      let m;
      while ((m = re.exec(text)) !== null) {
        const val = parseFloat((m[1] || m[0]).replace(/,/g, ''));
        if (val > 0 && val < 9999999) candidates.push({ val, conf });
      }
      if (candidates.some(c => c.conf === 'high')) break;
    }

    if (!candidates.length) return { value: null, confidence: 'none' };

    // Among high-conf picks, prefer the largest (usually total, not subtotal)
    const highConf = candidates.filter(c => c.conf === 'high');
    const pool = highConf.length ? highConf : candidates;
    const best = pool.reduce((a, b) => b.val > a.val ? b : a);
    return { value: best.val, confidence: best.conf };
  },

  _extractDate(text) {
    const tryParseDMY = (d, m, y) => {
      let year = +y, mon = +m - 1, day = +d;
      if (y.length === 2) year = year > 60 ? 1900 + year : 2000 + year;
      if (year > 2400) year -= 543;  // Buddhist Era
      if (year > 2100) year -= 543;
      if (year < 2000 || year > 2100) return null;
      if (mon < 0 || mon > 11 || day < 1 || day > 31) return null;
      return new Date(year, mon, day);
    };

    const patterns = [
      // DD/MM/YYYY or DD-MM-YYYY (Thai format, possibly Buddhist)
      [/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/, (m) => tryParseDMY(m[1], m[2], m[3])],
      // YYYY-MM-DD (ISO)
      [/(\d{4})-(\d{2})-(\d{2})/, (m) => { const d = new Date(+m[1], +m[2]-1, +m[3]); return d.getFullYear() >= 2000 ? d : null; }],
    ];

    for (const [pat, parse] of patterns) {
      const m = text.match(pat);
      if (m) {
        const d = parse(m);
        if (d && !isNaN(d)) {
          const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
          return { value: iso, confidence: 'high' };
        }
      }
    }
    return { value: null, confidence: 'none' };
  },

  _extractMerchant(text) {
    // Transfer slip: recipient name
    const slipPats = [
      /(?:ชื่อผู้รับ|ผู้รับเงิน|ไปยัง|To\s*:|Payee\s*:)\s*([^\n\r\d]{2,40})/i,
      /(?:หมายเหตุ|Note|Reference|Ref\.?)\s*[:\s]+([^\n\r]{2,40})/i,
    ];
    for (const p of slipPats) {
      const m = text.match(p);
      if (m) {
        const val = m[1].trim().replace(/\s+/g, ' ').replace(/[฿\d,\.]+/g, '').trim();
        if (val.length >= 2) return { value: val, confidence: 'high' };
      }
    }

    // Receipt: look for shop name (usually on first 1-3 lines, uppercase or long Thai word)
    const lines = text.split(/[\n\r]+/).map(l => l.trim()).filter(l => l.length >= 3);
    for (const line of lines.slice(0, 5)) {
      if (/^\d/.test(line)) continue; // skip lines starting with numbers
      if (/(?:สาขา|branch|tel|โทร|www|http|vat|บาท|baht)/i.test(line)) continue;
      if (line.length >= 2 && line.length <= 60) {
        return { value: line, confidence: 'low' };
      }
    }
    return { value: null, confidence: 'none' };
  },

  _extractBank(text) {
    const lower = text.toLowerCase().replace(/\s/g, '');
    const banks = [
      { name: 'ธนาคารไทยพาณิชย์ (SCB)', icon: '🟣', keys: ['scb','ไทยพาณิชย์','siamcommercial'] },
      { name: 'ธนาคารกสิกรไทย (KBank)', icon: '🟢', keys: ['kbank','กสิกร','kasikorn'] },
      { name: 'ธนาคารกรุงเทพ (BBL)', icon: '🔵', keys: ['bangkokbank','กรุงเทพ','bbl'] },
      { name: 'ธนาคารกรุงไทย (KTB)', icon: '🔷', keys: ['krungthai','กรุงไทย','ktb'] },
      { name: 'ธนาคารกรุงศรี (BAY)', icon: '🟡', keys: ['krungsri','กรุงศรี','baybank'] },
      { name: 'ธนาคารทหารไทย (TTB)', icon: '🔴', keys: ['ttb','ทหารไทย','tmb'] },
      { name: 'ธนาคารออมสิน (GSB)', icon: '🟠', keys: ['ออมสิน','gsb','governmentsavings'] },
      { name: 'PromptPay / พร้อมเพย์', icon: '💙', keys: ['promptpay','พร้อมเพย์','promptpay'] },
    ];
    return banks.find(b => b.keys.some(k => lower.includes(k))) || null;
  },

  _isTransferSlip(text) {
    const lower = text.toLowerCase();
    const keywords = ['โอนเงิน','transfer','สลิป','slip','ผู้รับ','payee','พร้อมเพย์','promptpay','ยอดโอน','สำเร็จ','success'];
    return keywords.filter(k => lower.includes(k)).length >= 2;
  },

  _guessCategory(merchant, text, isSlip) {
    if (isSlip) return null;
    const combined = ((merchant || '') + ' ' + text).toLowerCase();
    const cats = ST.getAll('categories').filter(c => c.type === 'expense');
    const hints = [
      ['cat_food',      ['ร้านอาหาร','food','restaurant','coffee','กาแฟ','ชา','pizza','kfc','mcdonald','burger','noodle','ก๋วยเตี๋ยว','ข้าว','ส้มตำ','ลาบ','sushiro','shabu','hotpot','สตาร์บัคส์','starbucks','cafe amazon','black canyon']],
      ['cat_transport', ['grab','taxi','bolt','แท็กซี่','bts','mrt','รถไฟ','fuel','น้ำมัน','ptt','bangchak','esso','pt','caltex','shell','บางจาก','ปตท']],
      ['cat_shopping',  ['lazada','shopee','amazon','7-eleven','7eleven','lotus','bigc','tesco','makro','tops','villa','central','the mall','เซ็นทรัล','โลตัส']],
      ['cat_health',    ['pharmacy','เภสัช','hospital','โรงพยาบาล','clinic','คลินิก','drug','ยา','vitamin','วิตามิน','medpark','bangkok hospital','สมิติเวช']],
      ['cat_bills',     ['ais','true','dtac','nt','cat','internet','โทรศัพท์','electricity','การไฟฟ้า','ประปา','water','dtac','isp']],
      ['cat_entertain', ['netflix','youtube','spotify','steam','game','cinema','sf','major','cgv','สยามพารา','บีทีเอส']],
    ];
    for (const [catId, kw] of hints) {
      if (kw.some(k => combined.includes(k))) {
        const cat = cats.find(c => c.id === catId);
        if (cat) return cat.id;
      }
    }
    return null;
  },
};
