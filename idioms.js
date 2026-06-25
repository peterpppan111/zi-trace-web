// idioms.js — 題庫練習頁邏輯

document.addEventListener('DOMContentLoaded', () => {
  const refreshBtn       = document.getElementById('refreshBtn');
  const idiomGrid        = document.getElementById('idiomOptions');
  const resultsContainer = document.getElementById('resultsContainer');
  const charTemplate     = document.getElementById('charTemplate');
  const sentencePreview  = document.getElementById('sentencePreview');
  const sentenceSequence = document.getElementById('sentenceSequence');
  const bingSearchBtn    = document.getElementById('bingSearchBtn');
  const tierTabs         = document.getElementById('tierTabs');
  const sectionTitle     = document.getElementById('sectionTitle');
  const batchInfo        = document.getElementById('batchInfo');
  const learnModeBtn     = document.getElementById('learnModeBtn');
  const testModeBtn      = document.getElementById('testModeBtn');
  const revealBtn        = document.getElementById('revealBtn');

  const responseCache  = new Map();
  const ITEMS_PER_PAGE = 30;

  let currentBank  = 'review';
  let originalPool = [];
  let currentPool  = [];
  let currentPage  = 1;
  let isTestMode   = false;

  // ── Pool ──────────────────────────────────────
  function getPool() {
    if (currentBank === 'review')    return typeof REVIEW_IDIOMS    !== 'undefined' ? REVIEW_IDIOMS    : [];
    if (currentBank === 'all')       return typeof ALL_IDIOMS       !== 'undefined' ? ALL_IDIOMS       : [];
    if (currentBank === 'sprint')    return typeof SPRINT_IDIOMS    !== 'undefined' ? SPRINT_IDIOMS    : [];
    if (currentBank === 'essential') return typeof ESSENTIAL_IDIOMS !== 'undefined' ? ESSENTIAL_IDIOMS : [];
    return typeof COMMON_IDIOMS !== 'undefined' ? COMMON_IDIOMS : [];
  }

  function initPool() {
    originalPool = [...getPool()];
    currentPool  = isTestMode
      ? [...originalPool].sort(() => 0.5 - Math.random())
      : [...originalPool];
    currentPage = 1;
  }

  function nextBatch() {
    if (!currentPool.length) return [];
    const totalPages = Math.ceil(currentPool.length / ITEMS_PER_PAGE);
    if (currentPage > totalPages) currentPage = 1;
    if (batchInfo) batchInfo.textContent = `第 ${currentPage} / ${totalPages} 批`;
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    currentPage++;
    return currentPool.slice(start, start + ITEMS_PER_PAGE);
  }

  // ── Render idioms ──────────────────────────────
  function renderIdioms() {
    idiomGrid.innerHTML = '';
    if (sectionTitle) sectionTitle.textContent = '可選成語';

    const batch = nextBatch();
    batch.forEach(idiom => {
      const btn = document.createElement('button');
      btn.className = 'idiom-btn';
      btn.dataset.idiom = idiom;
      btn.textContent = isTestMode ? '？'.repeat(idiom.length) : idiom;
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

  // ── Tier tabs ──────────────────────────────────
  tierTabs?.querySelectorAll('.tier-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      tierTabs.querySelectorAll('.tier-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentBank = tab.dataset.bank;
      initPool();
      renderIdioms();
    });
  });

  refreshBtn?.addEventListener('click', renderIdioms);

  // ── Mode switch ────────────────────────────────
  learnModeBtn?.addEventListener('click', () => {
    if (!isTestMode) return;
    isTestMode = false;
    learnModeBtn.classList.add('active');
    testModeBtn.classList.remove('active');
    currentPool = [...originalPool];
    currentPage = 1;
    renderIdioms();
  });

  testModeBtn?.addEventListener('click', () => {
    if (isTestMode) return;
    isTestMode = true;
    testModeBtn.classList.add('active');
    learnModeBtn.classList.remove('active');
    currentPool = [...originalPool].sort(() => 0.5 - Math.random());
    currentPage = 1;
    renderIdioms();
  });

  // ── Reveal ─────────────────────────────────────
  revealBtn?.addEventListener('click', () => {
    document.querySelectorAll('.blur-text').forEach(el => el.classList.remove('blur-text'));
    revealBtn.style.display = 'none';
    const active = idiomGrid.querySelector('.idiom-btn.active');
    if (active) active.textContent = active.dataset.idiom;
  });

  // ── Search ─────────────────────────────────────
  async function runSearch(text) {
    if (!text) return;
    resultsContainer.innerHTML = '';
    sentenceSequence.innerHTML = '';

    const chars = [...text].filter(c => c.trim() && /[\u4e00-\u9fff\u3400-\u4dbf]/.test(c));
    if (!chars.length) { sentencePreview.style.display = 'none'; return; }

    sentencePreview.style.display = '';

    if (bingSearchBtn) {
      bingSearchBtn.href = `https://www.bing.com/search?q=${encodeURIComponent(text + ' 成語')}`;
      bingSearchBtn.classList.toggle('blur-text', isTestMode);
    }
    if (revealBtn) revealBtn.style.display = isTestMode ? '' : 'none';

    // Build sequence slots with staggered animation
    chars.forEach((char, idx) => {
      const slot = document.createElement('div');
      slot.className = 'seq-char';
      slot.dataset.char = char;
      slot.style.animationDelay = `${idx * 0.08}s`;
      slot.innerHTML = `
        <div class="ancient-img-placeholder">
          <div class="spinner spinner-sm"></div>
        </div>
        <div class="ancient-source"></div>
        <div class="modern-char${isTestMode ? ' blur-text' : ''}">${char}</div>
      `;
      sentenceSequence.appendChild(slot);
    });

    const uniqueChars = [...new Set(chars)];
    const cardsData = uniqueChars.map((char, i) => {
      const node = charTemplate.content.cloneNode(true);
      const titleEl = node.querySelector('.card-char');
      titleEl.textContent = char;
      if (isTestMode) titleEl.classList.add('blur-text');
      resultsContainer.appendChild(node);

      const card      = resultsContainer.lastElementChild;
      card.style.animationDelay = `${i * 0.1}s`;
      const expandBtn = card.querySelector('.expand-btn');
      const content   = card.querySelector('.card-content');

      expandBtn.addEventListener('click', () => {
        const collapsed = content.style.display === 'none';
        content.style.display = collapsed ? '' : 'none';
        expandBtn.textContent = collapsed ? '收起演變表' : '展開完整演變';
      });

      return { char, container: content,
        loading: card.querySelector('.loading-indicator'),
        error:   card.querySelector('.error-tag'),
        expandBtn };
    });

    await Promise.allSettled(cardsData.map(d => fetchChar(d)));
  }

  // ── Fetch ──────────────────────────────────────
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
          if (!td.querySelector('img') && !td.textContent?.trim()) td.style.display = 'none';
        });

        if (count > 0) {
          container.appendChild(table);
          expandBtn.style.display = '';
          const firstCell = Array.from(table.querySelectorAll('td.VariantListA,td.VariantListB'))
            .find(td => td.querySelector('img') && td.style.display !== 'none');
          if (firstCell) {
            const img   = firstCell.querySelector('img');
            const clone = firstCell.cloneNode(true);
            clone.querySelector('img')?.remove();
            updateSlots(char, img.src, clone.textContent.replace(/\s+/g,' ').trim());
          }
        } else {
          showErr(error, '暫無演變圖形'); updateSlots(char, null, '暫無');
        }
      } else {
        showErr(error, '數據庫未收錄此字'); updateSlots(char, null, '無記錄');
      }
    } catch (err) {
      console.error(char, err);
      loading.style.display = 'none';
      showErr(error, '請求失敗'); updateSlots(char, null, '加載失敗');
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
          ph.innerHTML = '<span style="color:var(--red);font-size:20px">×</span>';
        }
      }
      if (src) src.textContent = text || '';
    });
  }

  function showErr(el, msg) { el.textContent = msg; el.style.display = ''; }

  // ── Share Link ─────────────────────────────────
  const CURRENT_VERSION = 'v1';
  const shareBtn = document.getElementById('shareVersionBtn');
  shareBtn?.addEventListener('click', () => {
    const origin = window.location.origin;
    let pathname = window.location.pathname;
    
    // 移除現有的版本首碼
    pathname = pathname.replace(/^\/v\d+/, '');
    if (!pathname.startsWith('/')) pathname = '/' + pathname;
    
    const shareUrl = `${origin}/${CURRENT_VERSION}${pathname}`;
    
    navigator.clipboard.writeText(shareUrl).then(() => {
      const originalText = shareBtn.innerHTML;
      shareBtn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        已複製！
      `;
      shareBtn.classList.add('success');
      setTimeout(() => {
        shareBtn.innerHTML = originalText;
        shareBtn.classList.remove('success');
      }, 2000);
    }).catch(err => {
      console.error('複製失敗:', err);
      alert('複製連結失敗，請手動複製地址欄鏈接');
    });
  });

  // ── Init ───────────────────────────────────────
  const hasData = ['REVIEW_IDIOMS','SPRINT_IDIOMS','ESSENTIAL_IDIOMS','COMMON_IDIOMS','ALL_IDIOMS']
    .some(k => typeof window[k] !== 'undefined');
  if (hasData) { initPool(); renderIdioms(); }
});
