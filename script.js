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

  // ── Core Search ──────────────────────────────
  async function performSearch() {
    const text = searchInput.value.trim();
    if (!text) return;

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
        container: content,
        loading:   card.querySelector('.loading-indicator'),
        error:     card.querySelector('.error-tag'),
        expandBtn,
      };
    });

    await Promise.allSettled(cardsData.map(d => fetchCharEvolution(d)));
  }

  // ── Fetch from Proxy ─────────────────────────
  async function fetchCharEvolution({ char, container, loading, error, expandBtn }) {
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
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        htmlString = await res.text();
        responseCache.set(char, htmlString);
      }

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
});
