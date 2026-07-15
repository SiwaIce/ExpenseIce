// ===== OCR Receipt Scanner v2 — Tesseract.js offline, bank-aware =====
const OCRScanner = {
  _worker: null,
  _workerReady: false,
  _ov: null,

  // ── Entry point ──────────────────────────────────────────────────
  open(onResult) {
    if (this._ov) return;
    this._onResult = onResult;
    this._showChoose();
  },

  // ── State 1: Choose source ──────────────────────────────────────
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
        <div class="ocr-src-btns">
          <label class="ocr-src-btn" for="ocrFileGallery">
            <span class="ocr-src-ico">🖼️</span>
            <span class="ocr-src-label">แกลเลอรี่</span>
            <input type="file" id="ocrFileGallery" accept="image/*" style="display:none">
          </label>
          <label class="ocr-src-btn" for="ocrFileCamera">
            <span class="ocr-src-ico">📷</span>
            <span class="ocr-src-label">กล้อง</span>
            <input type="file" id="ocrFileCamera" accept="image/*" capture="environment" style="display:none">
          </label>
        </div>
        <div class="ocr-drop-zone" id="ocrDropZone">
          <div class="ocr-drop-icon">🧾</div>
          <div class="ocr-drop-text">หรือลากรูปมาวางที่นี่</div>
          <div class="ocr-drop-sub">ใบเสร็จ · สลิปโอน · QR PromptPay</div>
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

    const onFile = e => { const f = e.target.files[0]; if (f) this._startScan(f); e.target.value = ''; };
    ov.querySelector('#ocrFileGallery').addEventListener('change', onFile);
    ov.querySelector('#ocrFileCamera').addEventListener('change', onFile);

    const dz = ov.querySelector('#ocrDropZone');
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
    dz.addEventListener('drop', e => {
      e.preventDefault(); dz.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) this._startScan(file);
    });
    dz.addEventListener('click', () => ov.querySelector('#ocrFileGallery').click());
  },

  // ── State 2: Scanning ────────────────────────────────────────────
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
        <div class="ocr-corner tl"></div><div class="ocr-corner tr"></div>
        <div class="ocr-corner bl"></div><div class="ocr-corner br"></div>
      </div>
      <div class="ocr-prog-wrap">
        <div class="ocr-prog-bar"><div class="ocr-prog-fill" id="ocrFill" style="width:0%"></div></div>
        <div class="ocr-prog-status" id="ocrStatus">เตรียมระบบ OCR...</div>
      </div>`;

    this._ov.querySelector('#ocrClose').onclick = () => this._close();

    const setP = ({ status, progress }) => {
      const fill = document.getElementById('ocrFill');
      const stat = document.getElementById('ocrStatus');
      if (fill) fill.style.width = Math.round((progress || 0) * 100) + '%';
      if (stat) stat.textContent = status || '';
    };

    try {
      // ── Feature #1: QR decode (ลอง QR ก่อน — ถ้าได้ ไม่ต้อง OCR เลย) ──
      setP({ status: '📱 ค้นหา QR code...', progress: 0.04 });
      const origCanvas = await this._loadOriginal(file);
      const qrData = await this._tryQR(origCanvas);
      if (qrData) {
        URL.revokeObjectURL(imgUrl);
        setP({ status: '✅ พบ QR code!', progress: 1 });
        await new Promise(r => setTimeout(r, 400));
        this._showResult(qrData, file);
        return;
      }

      setP({ status: '🖼️ ปรับคุณภาพภาพ...', progress: 0.07 });
      const canvas = await this._binarize(origCanvas);

      setP({ status: '⚙️ โหลดระบบ OCR...', progress: 0.12 });
      const worker = await this._getWorker(setP);

      // ── Feature #3: Multi-pass PSM ──────────────────────────────────
      const text = await this._recognizeMultiPass(canvas, worker, setP);

      setP({ status: '🔍 วิเคราะห์สลิป...', progress: 0.95 });
      URL.revokeObjectURL(imgUrl);

      const parsed = this._parse(text);

      await new Promise(r => setTimeout(r, 300));
      setP({ status: '✅ เสร็จแล้ว!', progress: 1 });
      await new Promise(r => setTimeout(r, 250));

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
    const catOpt = cats.map(c =>
      `<option value="${c.id}" ${c.id === data.categoryId ? 'selected' : ''}>${c.icon} ${c.name}</option>`
    ).join('');

    const confColor = c => c === 'high' ? '#10b981' : c === 'low' ? '#f59e0b' : '#94a3b8';
    const confLabel = c => c === 'high' ? '✓ มั่นใจ' : c === 'low' ? '~ คาดเดา' : '? ไม่พบ';

    const bankBadge = data.bank
      ? `<div class="ocr-bank-badge">${data.bank.icon} ${data.bank.name}</div>` : '';
    const slipBadge = data.isSlip
      ? '<span class="ocr-type-badge slip">💸 สลิปโอน</span>'
      : '<span class="ocr-type-badge receipt">🧾 ใบเสร็จ</span>';

    // Overall confidence indicator
    const fields = [data.amount, data.date, data.merchant];
    const highCount = fields.filter(f => f.confidence === 'high').length;
    const overallConf = highCount >= 2 ? 'สูง' : highCount === 1 ? 'ปานกลาง' : 'ต่ำ';
    const overallColor = highCount >= 2 ? '#10b981' : highCount === 1 ? '#f59e0b' : '#ef4444';

    panel.innerHTML = `
      <div class="ocr-header">
        <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap">
          ${slipBadge}${bankBadge}
          <span style="font-size:.68rem;font-weight:700;color:${overallColor}">ความแม่นยำ: ${overallConf}</span>
        </div>
        <button class="ocr-close" id="ocrClose">✕</button>
      </div>
      <div class="ocr-result-scroll">
        <div class="ocr-result-section">
          <div class="ocr-field-label">💰 ยอดเงิน</div>
          <div class="ocr-field-row">
            <input class="ocr-field-input ocr-amount-input" id="ocrAmount"
              type="number" value="${data.amount.value || ''}" placeholder="0.00" step="0.01">
            <span class="ocr-conf-badge" style="background:${confColor(data.amount.confidence)}20;color:${confColor(data.amount.confidence)}">${confLabel(data.amount.confidence)}</span>
          </div>
        </div>
        <div class="ocr-result-section">
          <div class="ocr-field-label">📅 วันที่</div>
          <div class="ocr-field-row">
            <input class="ocr-field-input" id="ocrDate" type="date" value="${data.date.value || U.today()}">
            <span class="ocr-conf-badge" style="background:${confColor(data.date.confidence)}20;color:${confColor(data.date.confidence)}">${confLabel(data.date.confidence)}</span>
          </div>
        </div>
        <div class="ocr-result-section">
          <div class="ocr-field-label">🏪 ชื่อร้าน / ผู้รับ</div>
          <div class="ocr-field-row">
            <input class="ocr-field-input" id="ocrName" type="text"
              value="${(data.merchant.value || '').replace(/"/g,'&quot;')}" placeholder="ชื่อร้านหรือผู้รับโอน">
            <span class="ocr-conf-badge" style="background:${confColor(data.merchant.confidence)}20;color:${confColor(data.merchant.confidence)}">${confLabel(data.merchant.confidence)}</span>
          </div>
        </div>
        <div class="ocr-result-section">
          <div class="ocr-field-label">📁 หมวดหมู่</div>
          <select class="ocr-field-input" id="ocrCat">
            <option value="">— ไม่ระบุ —</option>${catOpt}
          </select>
        </div>
        ${highCount === 0 ? `<div class="ocr-low-conf-hint">
          ⚠️ OCR อ่านตัวอักษรได้น้อย — ลองถ่ายรูปใหม่ที่แสงดีขึ้น หรือกรอกข้อมูลด้วยตนเอง
        </div>` : ''}
        <details class="ocr-raw-toggle">
          <summary>🔎 ข้อความที่ OCR อ่านได้ (raw)</summary>
          <pre class="ocr-raw-text">${(data.rawText || '').substring(0, 800)}</pre>
        </details>
      </div>
      <div class="ocr-result-actions">
        <button class="ocr-retry-btn" id="ocrRetry">↩ สแกนใหม่</button>
        <button class="ocr-use-btn" id="ocrUse">ใช้ข้อมูลนี้ →</button>
      </div>`;

    this._ov.querySelector('#ocrClose').onclick = () => this._close();
    this._ov.querySelector('#ocrRetry').onclick = () => { this._close(); setTimeout(() => this.open(this._onResult), 80); };
    this._ov.querySelector('#ocrUse').onclick = () => {
      const amount = parseFloat(this._ov.querySelector('#ocrAmount').value) || null;
      const date   = this._ov.querySelector('#ocrDate').value || null;
      const name   = this._ov.querySelector('#ocrName').value.trim() || null;
      const catId  = this._ov.querySelector('#ocrCat').value || null;

      // Feature #4: บันทึก correction เสมอเมื่อมี merchant — เรียนรู้ category ด้วย
      if (data.merchant.value || name) {
        this._learnCorrection(data.merchant.value || name, name, catId);
      }

      this._close();
      if (this._onResult) this._onResult({ amount, date, name, categoryId: catId, _file: originalFile });
    };
  },

  _showError(msg) {
    const panel = this._ov?.querySelector('.ocr-panel');
    if (!panel) return;
    panel.innerHTML = `
      <div class="ocr-header"><span class="ocr-title">⚠️ เกิดข้อผิดพลาด</span><button class="ocr-close" id="ocrClose">✕</button></div>
      <div style="text-align:center;padding:32px 20px">
        <div style="font-size:3rem;margin-bottom:12px">😕</div>
        <div style="font-size:.88rem;color:var(--text-secondary);margin-bottom:6px">${msg}</div>
        <div style="font-size:.78rem;color:var(--text-secondary)">ลองถ่ายรูปใหม่ที่แสงสว่างและภาพคมชัดขึ้น</div>
      </div>
      <div class="ocr-result-actions">
        <button class="ocr-retry-btn" id="ocrRetry">↩ ลองใหม่</button>
      </div>`;
    this._ov.querySelector('#ocrClose').onclick = () => this._close();
    this._ov.querySelector('#ocrRetry').onclick = () => { this._close(); setTimeout(() => this.open(this._onResult), 80); };
  },

  _close() { this._ov?.remove(); this._ov = null; },

  // ── Tesseract worker ────────────────────────────────────────────
  async _getWorker(progressCb) {
    if (this._workerReady && this._worker) return this._worker;
    if (!window.Tesseract) {
      progressCb?.({ status: '📦 โหลดไลบรารี OCR...', progress: 0.02 });
      await this._loadScript('https://unpkg.com/tesseract.js@5/dist/tesseract.min.js');
    }
    const w = await Tesseract.createWorker(['tha', 'eng'], 1, {
      logger: m => {
        if (m.status === 'loading tesseract core')
          progressCb?.({ status: '⚙️ โหลดระบบ...', progress: 0.05 + m.progress * 0.12 });
        else if (m.status.startsWith('loading language'))
          progressCb?.({ status: `📚 โหลดโมเดลภาษา${m.status.includes('tha') ? 'ไทย' : 'อังกฤษ'}...`, progress: 0.17 + m.progress * 0.5 });
        else if (m.status === 'initializing api')
          progressCb?.({ status: '🔧 เตรียมพร้อม...', progress: 0.67 + m.progress * 0.14 });
        else if (m.status === 'recognizing text')
          progressCb?.({ status: '🔤 อ่านตัวอักษร...', progress: 0.82 + m.progress * 0.1 });
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
      s.src = src; s.onload = res;
      s.onerror = () => rej(new Error('โหลด Tesseract.js ไม่ได้ — ตรวจสอบอินเทอร์เน็ต'));
      document.head.appendChild(s);
    });
  },

  // ── Load + upscale only (no binarization — used for QR decode) ──
  _loadOriginal(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const TARGET = 1800;
        let { width: w, height: h } = img;
        const scale = Math.max(1, Math.min(3, TARGET / Math.max(w, h)));
        w = Math.round(w * scale); h = Math.round(h * scale);
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);
        res(cv);
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('โหลดภาพไม่ได้')); };
      img.src = url;
    });
  },

  // ── Binarize scaled canvas for Tesseract ────────────────────────
  _binarize(src) {
    const w = src.width, h = src.height;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    ctx.drawImage(src, 0, 0);

    const id = ctx.getImageData(0, 0, w, h);
    const d = id.data;

    // Grayscale
    const gray = new Uint8Array(w * h);
    for (let i = 0; i < d.length; i += 4)
      gray[i >> 2] = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);

    // Detect dark background
    let sum = 0;
    for (let i = 0; i < gray.length; i++) sum += gray[i];
    const isDark = sum / gray.length < 100;

    // Adaptive binarization (32×32 blocks)
    const BLOCK = 32;
    const cols = Math.ceil(w / BLOCK), rows = Math.ceil(h / BLOCK);
    const blockAvg = new Float32Array(cols * rows);
    for (let br = 0; br < rows; br++)
      for (let bc = 0; bc < cols; bc++) {
        let s = 0, cnt = 0;
        const y0 = br*BLOCK, y1 = Math.min(y0+BLOCK,h);
        const x0 = bc*BLOCK, x1 = Math.min(x0+BLOCK,w);
        for (let y=y0;y<y1;y++) for(let x=x0;x<x1;x++){s+=gray[y*w+x];cnt++;}
        blockAvg[br*cols+bc] = s/cnt;
      }
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const localAvg = blockAvg[Math.min(Math.floor(y/BLOCK),rows-1)*cols + Math.min(Math.floor(x/BLOCK),cols-1)];
        const g = gray[y*w+x];
        const out = isDark ? (g > localAvg-10 ? 255 : 0) : (g < localAvg+10 ? 0 : 255);
        const idx = (y*w+x)*4;
        d[idx] = d[idx+1] = d[idx+2] = out; d[idx+3] = 255;
      }
    ctx.putImageData(id, 0, 0);

    // White border padding
    const padded = document.createElement('canvas');
    const PAD = 20;
    padded.width = w+PAD*2; padded.height = h+PAD*2;
    const pctx = padded.getContext('2d');
    pctx.fillStyle = '#ffffff';
    pctx.fillRect(0, 0, padded.width, padded.height);
    pctx.drawImage(cv, PAD, PAD);
    return padded;
  },

  // ── Feature #1: QR Code decode (jsQR) ───────────────────────────
  async _tryQR(canvas) {
    try {
      if (!window.jsQR)
        await this._loadScript('https://unpkg.com/jsqr@1/dist/jsQR.js');
      const ctx = canvas.getContext('2d');
      const { width: w, height: h } = canvas;
      const imgData = ctx.getImageData(0, 0, w, h);
      const code = jsQR(imgData.data, w, h, { inversionAttempts: 'attemptBoth' });
      if (!code) return null;
      return this._parseEMV(code.data);
    } catch { return null; }
  },

  // ── EMV QR parser (PromptPay / Thai bank standard) ───────────────
  _parseEMV(raw) {
    if (!raw || raw.length < 10) return null;
    // TLV walk: 2-char tag, 2-char length, N-char value
    let pos = 0;
    const fields = {};
    while (pos + 4 <= raw.length) {
      const tag = raw.slice(pos, pos+2);
      const len = parseInt(raw.slice(pos+2, pos+4), 10);
      if (isNaN(len) || pos+4+len > raw.length) break;
      fields[tag] = raw.slice(pos+4, pos+4+len);
      pos += 4 + len;
    }
    // Tag 54 = amount, 59 = merchant name, 60 = city, 58 = country
    const amtStr  = fields['54'];
    const merchant = (fields['59'] || '').trim() || null;
    const amount  = amtStr ? parseFloat(amtStr) : null;
    if (!amount && !merchant) return null; // QR has no useful financial data

    const bank = merchant ? this._detectBank(merchant) : null;
    return {
      amount:   { value: amount,   confidence: amount   ? 'high' : 'none' },
      date:     { value: null,     confidence: 'none' },  // QR rarely has date
      merchant: { value: merchant, confidence: merchant ? 'high' : 'none' },
      bank, isSlip: true,
      categoryId: this._guessCategory(merchant, merchant || '', false),
      rawText: '(QR: ' + raw.slice(0, 60) + (raw.length > 60 ? '…' : '') + ')',
      _fromQR: true,
    };
  },

  // ── Feature #3: Multi-pass Tesseract (PSM 6 → PSM 3 fallback) ───
  async _recognizeMultiPass(canvas, worker, progressCb) {
    // PSM 6: uniform text block — best for structured slips
    await worker.setParameters({ tessedit_pageseg_mode: '6' });
    progressCb?.({ status: '📖 อ่าน pass 1 (สลิป)...', progress: 0.83 });
    const r1 = await worker.recognize(canvas);
    if (r1.data.confidence >= 42) return r1.data.text;

    // PSM 3: fully automatic — better for receipts with logos/images
    await worker.setParameters({ tessedit_pageseg_mode: '3' });
    progressCb?.({ status: '🔄 อ่าน pass 2 (ใบเสร็จ)...', progress: 0.91 });
    const r2 = await worker.recognize(canvas);
    return r2.data.confidence >= r1.data.confidence ? r2.data.text : r1.data.text;
  },

  // ── Main parser ─────────────────────────────────────────────────
  _parse(rawText) {
    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const text = rawText.replace(/[|}{\\]/g, ' ').replace(/\s+/g, ' ').trim();

    const bank       = this._detectBank(text);
    const isSlip     = this._isSlip(text);
    const amount     = this._extractAmountV2(text, lines, bank);
    const date       = this._extractDateV2(text, lines);
    let   merchant   = this._extractMerchantV2(text, lines, isSlip, bank);
    let   categoryId = this._guessCategory(merchant.value, text, isSlip);

    // Feature #4: apply learned corrections first (exact match)
    if (merchant.value) {
      const learned = this._applyLearning(merchant.value);
      if (learned) {
        merchant   = { value: learned.merchant, confidence: 'high' };
        categoryId = learned.categoryId || categoryId;
      } else {
        // Feature #2: fuzzy-match against transaction history
        const fuzzy = this._fuzzyMerchant(merchant.value);
        if (fuzzy) {
          merchant   = { value: fuzzy.merchant, confidence: 'high' };
          categoryId = fuzzy.categoryId || categoryId;
        }
      }
    }

    return { amount, date, merchant, bank, isSlip, categoryId, rawText: text };
  },

  // ── Feature #2: Fuzzy merchant match from history ────────────────
  _fuzzyMerchant(name) {
    if (!name || name.length < 3) return null;
    const txns = (typeof ST !== 'undefined' ? ST.getAll('transactions') : [])
      .filter(t => t.type === 'expense' && t.itemName && t.itemName.length >= 2);
    if (!txns.length) return null;

    const bigrams = s => {
      const n = s.toLowerCase().replace(/\s+/g, '');
      const bg = new Set();
      for (let i = 0; i < n.length - 1; i++) bg.add(n.slice(i, i+2));
      return bg;
    };
    const dice = (a, b) => {
      const ba = bigrams(a), bb = bigrams(b);
      if (!ba.size || !bb.size) return 0;
      let common = 0;
      ba.forEach(g => { if (bb.has(g)) common++; });
      return 2 * common / (ba.size + bb.size);
    };

    let best = null, bestScore = 0;
    const seen = new Set();
    for (const t of txns) {
      if (seen.has(t.itemName)) continue;
      seen.add(t.itemName);
      const score = dice(name, t.itemName);
      if (score > bestScore) { bestScore = score; best = t; }
    }
    if (bestScore < 0.65) return null;
    return { merchant: best.itemName, categoryId: best.categoryId, score: bestScore };
  },

  // ── Feature #4: Learn + apply corrections ───────────────────────
  _learnCorrection(ocrName, userName, categoryId) {
    if (!ocrName) return;
    const key = 'ocr_learn';
    const db = JSON.parse(localStorage.getItem(key) || '{}');
    const norm = s => s.toLowerCase().trim().replace(/\s+/g, ' ');
    db[norm(ocrName)] = { merchant: userName || ocrName, categoryId: categoryId || null, ts: Date.now() };
    // Keep newest 300 entries only
    const trimmed = Object.fromEntries(
      Object.entries(db).sort((a,b) => b[1].ts - a[1].ts).slice(0, 300)
    );
    localStorage.setItem(key, JSON.stringify(trimmed));
  },

  _applyLearning(name) {
    if (!name) return null;
    const db = JSON.parse(localStorage.getItem('ocr_learn') || '{}');
    const norm = s => s.toLowerCase().trim().replace(/\s+/g, ' ');
    return db[norm(name)] || null;
  },

  // ── Bank detection ───────────────────────────────────────────────
  _detectBank(text) {
    const t = text.toLowerCase().replace(/\s/g, '');
    const banks = [
      { id:'scb',  name:'ไทยพาณิชย์ (SCB)',   icon:'🟣', keys:['scb','ไทยพาณิชย์','siamcommercial','easy','scbeasy'] },
      { id:'kbank',name:'กสิกรไทย (KBank)',    icon:'🟢', keys:['kbank','กสิกร','kasikorn','kplus'] },
      { id:'bbl',  name:'กรุงเทพ (BBL)',       icon:'🔵', keys:['bangkokbank','กรุงเทพ','bbl','bualuang'] },
      { id:'ktb',  name:'กรุงไทย (KTB)',       icon:'🔷', keys:['krungthai','กรุงไทย','ktb','paotang','เป๋าตัง'] },
      { id:'bay',  name:'กรุงศรี (Krungsri)',   icon:'🟡', keys:['krungsri','กรุงศรี','bay','ayudhya'] },
      { id:'ttb',  name:'ทีเอ็มบี (TTB)',       icon:'🔴', keys:['ttb','ทหารไทย','tmb','tmbbank'] },
      { id:'gsb',  name:'ออมสิน (GSB)',         icon:'🟠', keys:['ออมสิน','gsb','governmentsavings'] },
      { id:'lhb',  name:'แลนด์แอนด์เฮ้าส์',   icon:'🏠', keys:['lhbank','แลนด์แอนด์เฮ้าส์','lh bank'] },
      { id:'uob',  name:'ยูโอบี (UOB)',         icon:'🔵', keys:['uob','tmrw','ยูโอบี'] },
      { id:'truemoney', name:'TrueMoney Wallet', icon:'🔴', keys:['truemoney','true money','truewallet','ascend pay','ascendpay'] },
      { id:'gwallet',   name:'G Wallet (เป๋าตัง)', icon:'🔷', keys:['g-wallet','g wallet','gwallet','เป๋าตัง','paotang'] },
      { id:'promptpay', name:'พร้อมเพย์',       icon:'💙', keys:['promptpay','พร้อมเพย์','prompt pay','qrcode','qr code'] },
    ];
    return banks.find(b => b.keys.some(k => t.includes(k))) || null;
  },

  // ── Slip vs receipt detection ────────────────────────────────────
  _isSlip(text) {
    const t = text.toLowerCase();
    const slipWords = ['โอนเงิน','transfer','สลิป','slip','ผู้รับ','payee','พร้อมเพย์','promptpay',
                       'ยอดโอน','สำเร็จ','success','รายการสำเร็จ','โอนสำเร็จ','ยืนยันการโอน',
                       'account transfer','interbank','บัญชีปลายทาง','ref.'];
    return slipWords.filter(w => t.includes(w)).length >= 2;
  },

  // ── Amount extraction v2 — multi-strategy with cross-validation ──
  _extractAmountV2(text, lines, bank) {
    const candidates = [];

    // Strategy 1: Bank-specific labeled fields (highest priority)
    // NOTE: ลำดับสำคัญ — ยิ่ง specific ยิ่งขึ้นก่อน เพื่อไม่ให้ "จำนวนสลากฯ" ชนะ
    const labeledPatterns = [
      // ยอดชำระทั้งหมด (most specific — lottery, TrueMoney)
      /(?:ยอดชำระทั้งหมด|ยอดสุทธิ|ยอดรวมทั้งหมด)[^\d]*([\d,]+(?:\.\d{1,2})?)/,
      // ยอดโอน / ยอดเงิน / ยอดที่ชำระ / ยอดชำระ / จำนวนเงิน (require เงิน or ที่ after จำนวน to avoid จำนวนสลากฯ)
      /(?:ยอดโอน|ยอดเงิน|จำนวนเงิน|จำนวนที่ชำระ|ยอดที่ชำระ|ยอดชำระ|ยอดสุทธิ|ยอดรวม)[^\d]*([\d,]+(?:\.\d{1,2})?)/,
      // stand-alone จำนวน: only if on its own line (colon or newline follows) to avoid จำนวนสลากฯ
      /จำนวน[:\s]*\n?\s*([\d,]+(?:\.\d{1,2})?)/,
      // Amount / Total / Grand Total
      /(?:amount|total|grand\s*total|subtotal)[:\s]*([\d,]+(?:\.\d{1,2})?)/i,
      // ฿ prefix
      /฿\s*([\d,]+(?:\.\d{1,2})?)/,
      // THB prefix/suffix
      /(?:THB|thb)\s*([\d,]+(?:\.\d{1,2})?)/,
      /([\d,]+(?:\.\d{2}))\s*(?:บาท|THB|thb)/i,
    ];

    for (const pat of labeledPatterns) {
      const m = text.match(pat);
      if (m) {
        const v = parseFloat(m[1].replace(/,/g, ''));
        if (v > 0 && v < 9_000_000) candidates.push({ val: v, conf: 'high', src: 'label' });
      }
    }

    // Strategy 2: SCB-specific — amount is on line right after "ยอดเงิน"
    if (bank?.id === 'scb') {
      for (let i = 0; i < lines.length - 1; i++) {
        if (/ยอดเงิน|จำนวนเงิน/.test(lines[i])) {
          const v = this._parseNum(lines[i + 1]);
          if (v > 0) candidates.push({ val: v, conf: 'high', src: 'scb-next-line' });
        }
      }
    }

    // Strategy 3: KBank-specific — "จำนวน" then number
    if (bank?.id === 'kbank') {
      const m = text.match(/จำนวน\s*\n?\s*([\d,]+(?:\.\d{2})?)/);
      if (m) {
        const v = parseFloat(m[1].replace(/,/g, ''));
        if (v > 0) candidates.push({ val: v, conf: 'high', src: 'kbank' });
      }
    }

    // Strategy 4: Standalone large decimal numbers (fallback)
    // Look for numbers in format X,XXX.XX — very likely monetary
    const allMoney = [...text.matchAll(/([\d]{1,3}(?:,\d{3})+(?:\.\d{2})?|\d{2,7}\.\d{2})/g)]
      .map(m => parseFloat(m[1].replace(/,/g, '')))
      .filter(v => v >= 1 && v < 9_000_000);

    if (allMoney.length) {
      // Prefer the maximum (usually grand total) if no labeled match
      const max = Math.max(...allMoney);
      if (!candidates.some(c => c.conf === 'high')) {
        candidates.push({ val: max, conf: 'low', src: 'largest-decimal' });
      }
    }

    if (!candidates.length) return { value: null, confidence: 'none' };

    // Cross-validation: if 2+ high-conf candidates agree → very confident
    const highConf = candidates.filter(c => c.conf === 'high');
    if (highConf.length >= 2) {
      const vals = highConf.map(c => c.val);
      const maxV = Math.max(...vals);
      return { value: maxV, confidence: 'high' };
    }
    const best = (highConf.length ? highConf : candidates)
      .reduce((a, b) => b.val > a.val ? b : a);
    return { value: best.val, confidence: best.conf };
  },

  _parseNum(str) {
    if (!str) return 0;
    const m = str.match(/([\d,]+(?:\.\d{1,2})?)/);
    return m ? parseFloat(m[1].replace(/,/g, '')) : 0;
  },

  // ── Date extraction v2 ───────────────────────────────────────────
  _extractDateV2(text, lines) {
    // Multiple Thai date formats
    const patterns = [
      // 01/07/68 or 01/07/2568 (Buddhist Era)
      [/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/, 'dmy'],
      // 2568-07-14 or 2025-07-14
      [/(\d{4})-(\d{2})-(\d{2})/, 'ymd'],
      // Thai written: 14 ก.ค. 68 / 14 กรกฎาคม 2569 / 28 มิ.ย. 2569
      // ใช้ ฀-๿ ครอบ vowel marks (มิ.ย., มี.ค., เม.ย.) ด้วย
      [/(\d{1,2})\s+([฀-๿][ก-๏.]+)\s*(\d{2,4})/, 'dMonthY'],
      // English: 30 Jun 2026 / 30 June 2026
      [/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i, 'dEnMonY'],
    ];

    const thaiMonths = {
      'ม.ค.':1,'ก.พ.':2,'มี.ค.':3,'เม.ย.':4,'พ.ค.':5,'มิ.ย.':6,
      'ก.ค.':7,'ส.ค.':8,'ก.ย.':9,'ต.ค.':10,'พ.ย.':11,'ธ.ค.':12,
      'มกราคม':1,'กุมภาพันธ์':2,'มีนาคม':3,'เมษายน':4,'พฤษภาคม':5,'มิถุนายน':6,
      'กรกฎาคม':7,'สิงหาคม':8,'กันยายน':9,'ตุลาคม':10,'พฤศจิกายน':11,'ธันวาคม':12,
    };
    const enMonths = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};

    const toISO = (y, m, d) => {
      let year = parseInt(y, 10), month = parseInt(m, 10) - 1, day = parseInt(d, 10);
      if (y.length <= 2) {
        // Thai 2-digit BE shorthand: "68" = 2568 BE = 2025 CE
        year = year + 1957; // 2500 - 543 = 1957
      } else if (year > 2400) {
        // Full Buddhist Era year: 2568 → 2025 CE
        year -= 543;
      }
      // else: already CE (2025, 2024 …)
      if (year < 2000 || year > 2100) return null;
      const dt = new Date(year, month, day);
      if (isNaN(dt.getTime())) return null;
      return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
    };

    // Priority: prefer line(s) that begin with "วันที่ทำรายการ" (not "งวดวันที่" or other contexts)
    // If the date is on the NEXT line (KTB style), combine label line + next line
    const txnLineIdx = lines.findIndex(l => /^(?:วันที่ทำรายการ|transaction\s*date)/i.test(l.trim()));
    const searchTargets = txnLineIdx !== -1
      ? [lines.slice(txnLineIdx, txnLineIdx + 2).join(' '), text]
      : [text];

    for (const src of searchTargets) {
      for (const [pat, fmt] of patterns) {
        const m = src.match(pat);
        if (!m) continue;
        let iso;
        if (fmt === 'dmy')    iso = toISO(m[3], m[2], m[1]);
        else if (fmt === 'ymd') iso = toISO(m[1], m[2], m[3]);
        else if (fmt === 'dMonthY') {
          const monthNum = thaiMonths[m[2]];
          if (monthNum) iso = toISO(m[3], String(monthNum), m[1]);
        } else if (fmt === 'dEnMonY') {
          const monthNum = enMonths[m[2].toLowerCase().slice(0, 3)];
          if (monthNum) iso = toISO(m[3], String(monthNum), m[1]);
        }
        if (iso) return { value: iso, confidence: 'high' };
      }
    }
    return { value: null, confidence: 'none' };
  },

  // ── Merchant/payee extraction v2 ─────────────────────────────────
  _extractMerchantV2(text, lines, isSlip, bank) {
    const cleanName = v => v.trim().replace(/\s+/g, ' ')
      // ตัด masked account ก่อน (XXX, xxx, ***) ท้าย — ต้องก่อน keyword เพราะ "พร้อมเพย์ XXX" จะซ่อน keyword
      .replace(/\s+[Xx\*]{2,}[\s\d\*X\-]*$/i, '')
      // แล้วค่อยตัด keyword
      .replace(/\s*(?:วันที่|เวลา|date|time|ref\.?|หมายเหตุ|พร้อมเพย์|promptpay|g[\s-]?wallet)\s*$/i, '')
      .replace(/[\d฿,\.:\-\/]+$/, '').trim();

    if (isSlip) {
      // Transfer slip: look for recipient name
      const patterns = [
        /(?:ชื่อผู้รับ|ผู้รับเงิน|ผู้รับโอน|ไปยัง|บัญชีปลายทาง)[:\s]+([^\n\r\d฿]{2,40})/,
        /(?:To|Payee|Beneficiary)[:\s]+([^\n\r\d]{2,40})/i,
        /(?:หมายเหตุ|Note|Ref(?:erence)?)[:\s]+([^\n\r]{2,40})/i,
      ];
      for (const p of patterns) {
        const m = text.match(p);
        if (m) {
          const v = cleanName(m[1]);
          if (v.length >= 2) return { value: v, confidence: 'high' };
        }
      }
      // KBank slip: recipient on line after "ผู้รับ"
      // KTB slip: recipient on line after "ไปยัง" (line-by-line is more precise than flat-text regex)
      for (let i = 0; i < lines.length - 1; i++) {
        if (/^(?:ผู้รับ|ชื่อผู้รับ|ไปยัง)$/.test(lines[i].trim())) {
          const next = lines[i + 1];
          if (next && !/^[Xx\*\d]/.test(next) && next.length >= 2)
            return { value: cleanName(next), confidence: 'high' };
        }
      }
    }

    // Arrow separator (↓/→) — works for Krungsri, KTB, and other slips regardless of isSlip flag
    // Layout: sender → bank → acct → ↓ → RECIPIENT → acct
    const arrowIdx = lines.findIndex(l => /^[↓→▼⬇]$/.test(l.trim()));
    if (arrowIdx !== -1) {
      for (let i = arrowIdx + 1; i < Math.min(arrowIdx + 5, lines.length); i++) {
        const l = lines[i].trim();
        if (!l) continue;
        if (/^[Xx\*\d\-\.]+$/i.test(l)) continue;           // masked acct
        if (/^(xxx|ธ\.|bank|สาขา|พร้อมเพย์|promptpay|ไปยัง|จาก)/i.test(l)) continue;
        if (l.length >= 2 && l.length <= 60)
          return { value: cleanName(l), confidence: 'high' };
      }
    }

    // Receipt: shop name is usually the first meaningful lines
    // Skip lines that are clearly bank/wallet/app names, not merchant names
    const skipLineRx = /^(?:truemoney|true money|kbank|scb|bbl|uob|tmrw|glo|krungthai|krungsri|kasikorn|gsb|paotang|เป๋าตัง|กสิกร|กรุงไทย|กรุงศรี|กรุงเทพ|ไทยพาณิชย์|ออมสิน|ยูโอบี|ascend)$/i;
    for (const line of lines.slice(0, 8)) {
      if (!line || /^[\d฿]/.test(line)) continue;                          // skip digit/฿ start
      if (/^(?:สาขา|branch)/i.test(line)) continue;                        // สาขา only when LINE starts with it
      if (/(?:tel|โทร|www\.?|http|co\.,|ltd\.?|จำกัด|receipt|invoice|ใบเสร็จ|สำเร็จ|หมายเลข|รหัสอ้างอิง)/i.test(line)) continue;
      if (skipLineRx.test(line.trim())) continue;
      if (line.length >= 2 && line.length <= 60)
        return { value: line, confidence: 'low' };
    }

    return { value: null, confidence: 'none' };
  },

  // ── Category guesser ────────────────────────────────────────────
  _guessCategory(merchant, text, isSlip) {
    if (isSlip) return null;
    const combined = ((merchant || '') + ' ' + text).toLowerCase();
    const cats = ST.getAll('categories').filter(c => c.type === 'expense');
    const hints = [
      ['cat_food',      ['ร้านอาหาร','food','restaurant','coffee','กาแฟ','ชา','pizza','kfc','mcdonald',
                         'burger','noodle','ก๋วยเตี๋ยว','ข้าว','ส้มตำ','sushiro','shabu','hotpot',
                         'starbucks','cafe amazon','black canyon','ชาบู','ยำ','กระทะ',
                         'อเมซอน','cafe อเมซอน','คาเฟ่']],
      ['cat_transport', ['grab','taxi','bolt','แท็กซี่','bts','mrt','รถไฟ','น้ำมัน','ptt',
                         'bangchak','esso','pt ','caltex','shell','บางจาก','ปตท','ค่าทางด่วน','แอร์พอร์ต']],
      ['cat_shopping',  ['lazada','shopee','amazon','7-eleven','7eleven','lotus','bigc','tesco',
                         'makro','tops','villa','central','the mall','เซ็นทรัล','โลตัส','เทสโก้']],
      ['cat_health',    ['pharmacy','เภสัช','hospital','โรงพยาบาล','clinic','คลินิก','ยา',
                         'vitamin','วิตามิน','medpark','bangkok hospital','สมิติเวช','นครธน']],
      ['cat_bills',     ['ais','true','dtac','nt ','internet','โทรศัพท์','การไฟฟ้า','ประปา',
                         'electricity','water','cat telecom']],
      ['cat_entertain', ['netflix','youtube','spotify','steam','game','cinema','sf ','major','cgv',
                         'imax','สยามพารา','ฟิตเนส','fitness','gym']],
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
