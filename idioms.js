// idioms.js — 題庫練習頁邏輯

document.addEventListener('DOMContentLoaded', () => {
  const refreshBtn        = document.getElementById('refreshBtn');
  const idiomGrid         = document.getElementById('idiomOptions');
  const resultsContainer  = document.getElementById('resultsContainer');
  const charTemplate      = document.getElementById('charTemplate');
  const sentencePreview   = document.getElementById('sentencePreview');
  const sentenceSequence  = document.getElementById('sentenceSequence');
  const bingSearchBtn     = document.getElementById('bingSearchBtn');
  const bankSelect        = document.getElementById('bankSelect');
  const sectionTitle      = document.getElementById('sectionTitle');
  const batchInfo         = document.getElementById('batchInfo');
  const learnModeBtn      = document.getElementById('learnModeBtn');
  const testModeBtn       = document.getElementById('testModeBtn');
  const revealBtn         = document.getElementById('revealBtn');

  const responseCache = new Map();
  const ITEMS_PER_PAGE = 30;

  let originalPool = [];
  let currentPool  = [];
  let currentPage  = 1;
  let isTestMode   = false;

  // ── Pool Helpers ─────────────────────────────
  function getPool() {
    const v = bankSelect?.value || 'sprint';
    if (v === 'all')      return typeof ALL_IDIOMS      !== 'undefined' ? ALL_IDIOMS      : [];
    if (v === 'sprint')   return typeof SPRINT_IDIOMS   !== 'undefined' ? SPRINT_IDIOMS   : [];
    if (v === 'essential')return typeof ESSENTIAL_IDIOMS!== 'undefined' ? ESSENTIAL_IDIOMS: [];
    return typeof COMMON_IDIOMS !== 'undefined' ? COMMON_IDIOMS : [];
  }

  function initPool() {
    originalPool = [...getPool()];
    currentPool  = isTestMode
      ? [...originalPool].sort(() => 0.5 - Math.random())
      : [...originalPool];
    currentPage  = 1;
  }

  function nextBatch() {
    if (!currentPool.length) return [];
    const totalPages = Math.ceil(currentPool.length / ITEMS_PER_PAGE);
    if (currentPage > totalPages) currentPage = 1;
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    if (batchInfo) {
      const isMissing = bankSelect?.value === 'missing';
      batchInfo.textContent = `第 ${currentPage}/${totalPages} 批`;
    }
    currentPage++;
    return currentPool.slice(start, start + ITEMS_PER_PAGE);
  }

  // ── Render Idiom Grid ─────────────────────────
  function renderIdioms() {
    idiomGrid.innerHTML = '';
    if (sectionTitle) {
      sectionTitle.textContent = bankSelect?.value === 'missing' ? '可選單字' : '可選成語';
    }

    const batch = nextBatch();
    batch.forEach(idiom => {
      const btn = document.createElement('button');
      btn.className = 'idiom-btn';
      btn.dataset.idiom = idiom;
      btn.textContent = isTestMode
        ? (idiom.length === 1 ? '？' : '？'.repeat(idiom.length))
        : idiom;
      btn.addEventListener('click', () => {
        idiomGrid.querySelectorAll('.idiom-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        runSearch(idiom);
      });
      idiomGrid.appendChild(btn);
    });

    resultsContainer.innerHTML = '';
    sentencePreview.style.display = 'none';
    sentenceSequence.innerHTML = '';
  }

  // ── Controls ──────────────────────────────────
  refreshBtn?.addEventListener('click', renderIdioms);

  bankSelect?.addEventListener('change', () => {
    initPool();
    renderIdioms();
  });

  learnModeBtn?.addEventListener('click', () => {
    if (isTestMode) {
      isTestMode = false;
      learnModeBtn.classList.add('active');
      testModeBtn.classList.remove('active');
      currentPool = [...originalPool];
      currentPage = 1;
      renderIdioms();
    }
  });

  testModeBtn?.addEventListener('click', () => {
    if (!isTestMode) {
      isTestMode = true;
      testModeBtn.classList.add('active');
      learnModeBtn.classList.remove('active');
      currentPool = [...originalPool].sort(() => 0.5 - Math.random());
      currentPage = 1;
      renderIdioms();
    }
  });

  revealBtn?.addEventListener('click', () => {
    document.querySelectorAll('.blur-text').forEach(el => el.classList.remove('blur-text'));
    revealBtn.style.display = 'none';
    const activeBtn = idiomGrid.querySelector('.idiom-btn.active');
    if (activeBtn) activeBtn.textContent = activeBtn.dataset.idiom;
  });

  // ── Run Search ────────────────────────────────
  async function runSearch(text) {
    if (!text) return;

    resultsContainer.innerHTML = '';
    sentenceSequence.innerHTML = '';

    const chars = [...text].filter(c => c.trim());
    if (!chars.length) { sentencePreview.style.display = 'none'; return; }

    sentencePreview.style.display = '';

    if (bingSearchBtn) {
      bingSearchBtn.href = `https://www.bing.com/search?q=${encodeURIComponent(text + (text.length === 1 ? ' 漢字' : ' 成語'))}`;
      bingSearchBtn.classList.toggle('blur-text', isTestMode);
    }

    if (revealBtn) revealBtn.style.display = isTestMode ? '' : 'none';

    // Build sequence slots
    chars.forEach((char, idx) => {
      const slot = document.createElement('div');
      slot.className = 'seq-char';
      slot.dataset.char = char;
      slot.innerHTML = `
        <div class="ancient-img-placeholder">
          <div class="spinner spinner-sm"></div>
        </div>
        <div class="ancient-source"></div>
        <div class="modern-char ${isTestMode ? 'blur-text' : ''}">${char}</div>
      `;
      sentenceSequence.appendChild(slot);
    });

    const uniqueChars = [...new Set(chars)];

    // Create cards
    const cardsData = uniqueChars.map(char => {
      const node = charTemplate.content.cloneNode(true);
      const titleEl = node.querySelector('.card-char');
      titleEl.textContent = char;
      if (isTestMode) titleEl.classList.add('blur-text');
      resultsContainer.appendChild(node);

      const card      = resultsContainer.lastElementChild;
      const expandBtn = card.querySelector('.expand-btn');
      const content   = card.querySelector('.card-content');

      expandBtn.addEventListener('click', () => {
        const collapsed = content.style.display === 'none';
        content.style.display = collapsed ? '' : 'none';
        expandBtn.textContent = collapsed ? '收起演變表' : '展開完整演變';
      });

      return {
        char,
        container: content,
        loading:   card.querySelector('.loading-indicator'),
        error:     card.querySelector('.error-tag'),
        expandBtn,
      };
    });

    await Promise.allSettled(cardsData.map(d => fetchChar(d)));
  }

  // ── Fetch Ancient Forms ───────────────────────
  async function fetchChar({ char, container, loading, error, expandBtn }) {
    try {
      let html;
      if (responseCache.has(char)) {
        html = responseCache.get(char);
      } else {
        const body = new URLSearchParams({ EudcFontChar: char, ImageSize: '48' });
        const res  = await fetch('/api/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        html = await res.text();
        responseCache.set(char, html);
      }

      const doc   = new DOMParser().parseFromString(html, 'text/html');
      const table = doc.getElementById('yanbian_result');
      loading.style.display = 'none';

      if (table) {
        let count = 0;
        table.querySelectorAll('img').forEach(img => {
          const src = img.getAttribute('src');
          if (src?.startsWith('/')) {
            img.src = 'https://xiaoxue.iis.sinica.edu.tw' + src;
            count++;
          }
        });
        table.querySelectorAll('td').forEach(td => {
          if (!td.querySelector('img') && !td.textContent?.trim())
            td.style.display = 'none';
        });

        if (count > 0) {
          container.appendChild(table);
          expandBtn.style.display = '';

          const firstCell = Array.from(
            table.querySelectorAll('td.VariantListA, td.VariantListB')
          ).find(td => td.querySelector('img') && td.style.display !== 'none');

          if (firstCell) {
            const img   = firstCell.querySelector('img');
            const clone = firstCell.cloneNode(true);
            clone.querySelector('img')?.remove();
            const srcText = clone.textContent.replace(/\s+/g, ' ').trim();
            updateSlots(char, img.src, srcText);
          }
        } else {
          showErr(error, '暫無演變圖形');
          updateSlots(char, null, '暫無');
        }
      } else {
        showErr(error, '數據庫未收錄此字');
        updateSlots(char, null, '無記錄');
      }
    } catch (err) {
      console.error(char, err);
      loading.style.display = 'none';
      showErr(error, '請求失敗，請稍後再試');
      updateSlots(char, null, '加載失敗');
    }
  }

  function updateSlots(char, imgSrc, text) {
    document.querySelectorAll(`.seq-char[data-char="${char}"]`).forEach(slot => {
      const ph  = slot.querySelector('.ancient-img-placeholder');
      const src = slot.querySelector('.ancient-source');
      if (ph) {
        if (imgSrc) {
          const img = document.createElement('img');
          img.src = imgSrc; img.className = 'ancient-img'; img.alt = char;
          ph.replaceWith(img);
        } else {
          ph.innerHTML = '<span style="color:var(--red);font-size:18px">×</span>';
        }
      }
      if (src) src.textContent = text || '';
    });
  }

  function showErr(el, msg) { el.textContent = msg; el.style.display = ''; }

  // ── Init ──────────────────────────────────────
  const hasData = typeof SPRINT_IDIOMS !== 'undefined'
    || typeof ESSENTIAL_IDIOMS !== 'undefined'
    || typeof COMMON_IDIOMS !== 'undefined'
    || typeof ALL_IDIOMS !== 'undefined';

  if (hasData) {
    initPool();
    renderIdioms();
  }
});
