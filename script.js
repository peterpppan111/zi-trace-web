// script.js — 主頁：自由查詢任意漢字的字形演變

document.addEventListener('DOMContentLoaded', () => {
  const searchInput    = document.getElementById('searchInput');
  const searchBtn      = document.getElementById('searchBtn');
  const resultsContainer  = document.getElementById('resultsContainer');
  const charTemplate   = document.getElementById('charTemplate');
  const sentencePreview = document.getElementById('sentencePreview');
  const sentenceSequence = document.getElementById('sentenceSequence');

  const responseCache = new Map();

  // ── Event Listeners ─────────────────────────
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') performSearch();
  });
  searchBtn.addEventListener('click', performSearch);

  // ── Typewriter Placeholder ────────────────────
  const placeholderExamples = [
    '自強不息', '天下為公', '知行合一',
    '格物致知', '厚德載物', '民為貴', '山河歲月',
  ];
  let twIndex = 0, twCharIndex = 0, twDeleting = false, twTimer = null;

  function typewriterStep() {
    if (document.activeElement === searchInput) {
      // 用戶正在輸入時暫停，等待失焦後繼續
      twTimer = setTimeout(typewriterStep, 500);
      return;
    }
    const target = '例如：' + placeholderExamples[twIndex];
    if (!twDeleting) {
      twCharIndex++;
      searchInput.placeholder = target.slice(0, twCharIndex);
      if (twCharIndex >= target.length) {
        twDeleting = true;
        twTimer = setTimeout(typewriterStep, 2000); // 停留 2s
        return;
      }
    } else {
      twCharIndex--;
      searchInput.placeholder = target.slice(0, twCharIndex);
      if (twCharIndex <= 0) {
        twDeleting = false;
        twIndex = (twIndex + 1) % placeholderExamples.length;
        twTimer = setTimeout(typewriterStep, 400);
        return;
      }
    }
    twTimer = setTimeout(typewriterStep, twDeleting ? 40 : 80);
  }
  // 延遲 1s 後開始，避免搶奪首屏注意力
  twTimer = setTimeout(typewriterStep, 1000);
  searchInput.addEventListener('focus', () => { searchInput.placeholder = ''; });
  searchInput.addEventListener('blur',  () => {
    if (!searchInput.value) { twCharIndex = 0; twDeleting = false; typewriterStep(); }
  });

  // ── Core Search ──────────────────────────────
  let currentSearchId = 0;
  let currentAbortController = null;

  async function performSearch() {
    const text = searchInput.value.trim();
    if (!text) {
      currentSearchId++; // Cancel pending searches
      if (currentAbortController) currentAbortController.abort();
      return;
    }

    const searchId = ++currentSearchId;
    if (currentAbortController) currentAbortController.abort();
    currentAbortController = new AbortController();
    const signal = currentAbortController.signal;

    resultsContainer.innerHTML = '';
    sentenceSequence.innerHTML = '';

    const originalChars = [...text].filter(c => c.trim());
    if (!originalChars.length) {
      sentencePreview.style.display = 'none';
      return;
    }

    sentencePreview.style.display = 'block';

    // Build preview slots
    originalChars.forEach((char, idx) => {
      const slot = document.createElement('div');
      slot.className = 'seq-char';
      slot.id = `seq-slot-${idx}`;
      slot.dataset.char = char;
      slot.innerHTML = `
        <div class="ancient-img-placeholder">
          <div class="spinner spinner-sm"></div>
        </div>
        <div class="ancient-source"></div>
        <div class="modern-char">${char}</div>
      `;
      sentenceSequence.appendChild(slot);
    });

    const uniqueChars = [...new Set(originalChars)];

    // Create cards
    const cardsData = uniqueChars.map(char => {
      const node = charTemplate.content.cloneNode(true);
      node.querySelector('.card-char').textContent = char;
      resultsContainer.appendChild(node);

      const card     = resultsContainer.lastElementChild;
      const expandBtn = card.querySelector('.expand-btn');
      const content   = card.querySelector('.card-content');

      expandBtn.addEventListener('click', () => {
        const collapsed = content.style.display === 'none';
        content.style.display = collapsed ? '' : 'none';
        expandBtn.textContent = collapsed ? '收起演變表' : '展開完整演變';
      });

      return {
        char,
        searchId,
        container: content,
        loading:   card.querySelector('.loading-indicator'),
        error:     card.querySelector('.error-tag'),
        expandBtn,
      };
    });

    await Promise.allSettled(cardsData.map(d => fetchCharEvolution({ ...d, signal })));
  }

  // ── Fetch from Proxy ─────────────────────────
  async function fetchCharEvolution({ char, searchId, container, loading, error, expandBtn, signal }) {
    try {
      let htmlString;
      if (responseCache.has(char)) {
        htmlString = responseCache.get(char);
      } else {
        const body = new URLSearchParams({ EudcFontChar: char, ImageSize: '128' });
        const res  = await fetch('/api/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
          signal
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        htmlString = await res.text();
        responseCache.set(char, htmlString);
      }

      if (searchId !== currentSearchId) return; // Prevent race conditions

      const doc   = new DOMParser().parseFromString(htmlString, 'text/html');
      const table = doc.getElementById('yanbian_result');

      loading.style.display = 'none';

      if (table) {
        let validCount = 0;
        table.querySelectorAll('img').forEach(img => {
          const src = img.getAttribute('src');
          if (src?.startsWith('/')) {
            img.src = '/api/proxy-img?url=' + encodeURIComponent(src);
            validCount++;
          }
        });
        table.querySelectorAll('td').forEach(td => {
          if (!td.querySelector('img') && !td.textContent?.trim())
            td.style.display = 'none';
        });

        if (validCount > 0) {
          container.appendChild(table);
          expandBtn.style.display = '';

          // ── 時代計數徽章 ────────────────────────────────────
          const eraBadge = container.closest('.char-card')?.querySelector('.era-count-badge');
          if (eraBadge) {
            // 統計有效字形圖片數量
            const imgCount = table.querySelectorAll('img.charValue').length;
            if (imgCount > 0) {
              eraBadge.innerHTML = `<span class="era-pill">${imgCount} 個字形</span>`;
              eraBadge.style.display = 'flex';
            }
          }

          const firstCell = Array.from(
            table.querySelectorAll('td.VariantListA, td.VariantListB')
          ).find(td => td.querySelector('img') && td.style.display !== 'none');

          if (firstCell) {
            const img  = firstCell.querySelector('img');
            const clone = firstCell.cloneNode(true);
            clone.querySelector('img')?.remove();
            const srcText = clone.textContent.replace(/\s+/g, ' ').trim();
            updateSlots(char, img.src, srcText);
          }
        } else {
          showError(error, '暫無該字的演變圖形');
          updateSlots(char, null, '暫無');
        }

      } else {
        showError(error, '數據庫中未找到該字');
        updateSlots(char, null, '無記錄');
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error(char, err);
      loading.style.display = 'none';
      showError(error, '請求失敗，請稍後再試');
      updateSlots(char, null, '加載失敗');
    }
  }

  function updateSlots(char, imgSrc, text) {
    document.querySelectorAll(`.seq-char[data-char="${char}"]`).forEach(slot => {
      const ph   = slot.querySelector('.ancient-img-placeholder');
      const src  = slot.querySelector('.ancient-source');
      if (ph) {
        if (imgSrc) {
          const img = document.createElement('img');
          img.src = imgSrc;
          img.className = 'ancient-img';
          img.alt = char;
          ph.replaceWith(img);
        } else {
          ph.innerHTML = '<span style="color:var(--red);font-size:18px;">×</span>';
        }
      }
      if (src) src.textContent = text || '';
    });
  }

  function showError(el, msg) {
    el.textContent = msg;
    el.style.display = '';
  }
});
