// quick-search.js — 全域查字邏輯 (Global Quick Search)

document.addEventListener('DOMContentLoaded', () => {
  const quickSearchBtn = document.getElementById('quickSearchBtn');
  const modal = document.getElementById('quickSearchModal');
  const closeBtn = document.getElementById('closeQuickSearchBtn');
  const input = document.getElementById('quickSearchInput');
  const resultsContainer = document.getElementById('quickSearchResults');

  if (!quickSearchBtn || !modal || !input) return;

  const API_CACHE_NAME = 'zi-trace-api-v1';

  // Open Modal
  const openModal = () => {
    modal.style.display = 'flex';
    input.focus();
    // Small delay to allow display:flex to apply before adding class for transition
    requestAnimationFrame(() => {
      modal.classList.add('visible');
    });
  };

  // Close Modal
  const closeModal = () => {
    modal.classList.remove('visible');
    setTimeout(() => {
      modal.style.display = 'none';
      input.value = '';
      resultsContainer.innerHTML = '';
    }, 400); // match CSS transition duration
  };

  quickSearchBtn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);

  // Close on outside click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      openModal();
    }
    if (e.key === 'Escape' && modal.classList.contains('visible')) {
      closeModal();
    }
  });

  // Search Logic
  let debounceTimeout;
  let currentSearchId = 0;

  input.addEventListener('input', (e) => {
    const char = e.target.value.trim();
    if (!char || char.length !== 1) {
      resultsContainer.innerHTML = '';
      currentSearchId++; // Cancel pending
      return;
    }

    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      performSearch(char);
    }, 300);
  });

  async function performSearch(char) {
    const searchId = ++currentSearchId;
    resultsContainer.innerHTML = `
      <div class="quick-search-loading">
        <svg class="spinner" viewBox="0 0 50 50"><circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle></svg>
        <span>正在翻閱典籍...</span>
      </div>
    `;

    try {
      let html;
      const cache = await caches.open(API_CACHE_NAME);
      const cacheReq = new Request(`/api/proxy?char=${encodeURIComponent(char)}`);
      const cachedRes = await cache.match(cacheReq);
      
      if (cachedRes) {
        html = await cachedRes.text();
      } else {
        const body = new URLSearchParams({ EudcFontChar: char, ImageSize: '128' });
        const res = await fetch('/api/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        });
        if (!res.ok) throw new Error('API Error');
        html = await res.text();
        if (!html.includes('沒有找到')) {
           cache.put(cacheReq, new Response(html));
        }
      }

      if (searchId !== currentSearchId) return; // Prevent race conditions

      if (html.includes('沒有找到')) {
        resultsContainer.innerHTML = `<div class="quick-search-error">字典中未收錄「${char}」字的古文字形。</div>`;
        return;
      }

      const doc = new DOMParser().parseFromString(html, 'text/html');
      const table = doc.getElementById('yanbian_result');

      resultsContainer.innerHTML = '';
      
      if (table) {
        table.querySelectorAll('img').forEach(img => {
          const src = img.getAttribute('src');
          if (src?.startsWith('/')) {
            img.src = '/api/proxy-img?url=' + encodeURIComponent(src);
          }
        });
        table.querySelectorAll('td').forEach(td => {
          if (!td.querySelector('img') && !td.textContent?.trim()) {
            td.style.display = 'none';
          }
        });
        
        // Wrap it in char-card for nice formatting
        const card = document.createElement('div');
        card.className = 'char-card';
        card.innerHTML = `<div class="card-char" style="font-size: 2rem; margin-bottom: 12px; color: oklch(90% 0.05 250);">${char}</div>`;
        const content = document.createElement('div');
        content.className = 'card-content';
        content.appendChild(table);
        card.appendChild(content);
        
        resultsContainer.appendChild(card);
      } else {
        resultsContainer.innerHTML = `<div class="quick-search-error">字典中未收錄「${char}」字的古文字形。</div>`;
      }
    } catch (err) {
      resultsContainer.innerHTML = `<div class="quick-search-error">查閱失敗，請稍後再試。</div>`;
    }
  }
});
