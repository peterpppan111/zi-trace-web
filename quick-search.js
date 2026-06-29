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
    // Small delay to allow display:flex to apply before adding class for transition
    requestAnimationFrame(() => {
      modal.classList.add('visible');
      input.focus();
    });
  };

  // Close Modal
  const closeModal = () => {
    modal.classList.remove('visible');
    setTimeout(() => {
      modal.style.display = 'none';
      input.value = '';
      resultsContainer.innerHTML = '';
    }, 300); // match CSS transition duration
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
  input.addEventListener('input', (e) => {
    const char = e.target.value.trim();
    if (!char) {
      resultsContainer.innerHTML = '';
      return;
    }
    
    // Only search single characters
    if (char.length > 1) {
      input.value = char.substring(0, 1);
      return;
    }

    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      performSearch(char);
    }, 300);
  });

  async function performSearch(char) {
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
        const res = await fetch(cacheReq);
        if (!res.ok) throw new Error('API Error');
        html = await res.text();
        if (!html.includes('沒有找到')) {
           cache.put(cacheReq, new Response(html));
        }
      }

      if (html.includes('沒有找到')) {
        resultsContainer.innerHTML = `<div class="quick-search-error">字典中未收錄「${char}」字的古文字形。</div>`;
        return;
      }

      // Inject HTML directly, similar to index.html
      resultsContainer.innerHTML = html;
      
      // Fix image paths returned by the proxy if necessary
      const imgs = resultsContainer.querySelectorAll('img');
      imgs.forEach(img => {
        let src = img.getAttribute('src');
        if (src && !src.startsWith('http')) {
           // Ensure correct domain is prefixed if relative
           img.setAttribute('src', 'https://xiaoxue.iis.sinica.edu.tw' + (src.startsWith('/') ? '' : '/') + src);
        }
      });
    } catch (err) {
      resultsContainer.innerHTML = `<div class="quick-search-error">查閱失敗，請稍後再試。</div>`;
    }
  }
});
