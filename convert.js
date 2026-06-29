/* ══════════════════════════════════════════════════════════════
   繁簡轉換練習 · 主邏輯
   convert.js v1
   ══════════════════════════════════════════════════════════════ */

(() => {
  'use strict';

  // ── 狀態 ───────────────────────────────────────────────────
  const STORAGE_KEY_PHRASE = 'cvt_progress_phrase';
  const STORAGE_KEY_CHAR   = 'cvt_progress_char';

  let currentMode   = 'phrase';   // 'phrase' | 'char'
  let practiceMode  = 'learn';    // 'learn'  | 'test'
  let currentFilter = 'all';      // 'all' | 'unseen' | 'wrong' | 'mastered'
  let deck          = [];         // active item list
  let deckIndex     = 0;
  let testSession   = { total:0, correct:0, wrong:0 };

  // Progress maps: key => { status: 'unseen'|'known'|'mastered'|'wrong', streak: number }
  let phraseProgress = {};
  let charProgress   = {};

  // ── 工具函數 ────────────────────────────────────────────────

  function loadProgress() {
    try {
      phraseProgress = JSON.parse(localStorage.getItem(STORAGE_KEY_PHRASE) || '{}');
      charProgress   = JSON.parse(localStorage.getItem(STORAGE_KEY_CHAR)   || '{}');
    } catch {
      phraseProgress = {};
      charProgress   = {};
    }
  }

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_KEY_PHRASE, JSON.stringify(phraseProgress));
      localStorage.setItem(STORAGE_KEY_CHAR,   JSON.stringify(charProgress));
    } catch { /* storage full */ }
  }

  function getProgress(key, db) {
    return (db === 'phrase' ? phraseProgress : charProgress)[key]
      || { status: 'unseen', streak: 0 };
  }

  function setProgress(key, db, updates) {
    const map = db === 'phrase' ? phraseProgress : charProgress;
    map[key] = { ...getProgress(key, db), ...updates };
    saveProgress();
  }

  function getItemKey(item) {
    return currentMode === 'phrase' ? item.simp + '→' + item.trad : item.simp;
  }

  function getDB() {
    return currentMode === 'phrase' ? PHRASES : CHAR_DB;
  }

  function getProgressMap() {
    return currentMode === 'phrase' ? phraseProgress : charProgress;
  }

  // ── 初始化 ─────────────────────────────────────────────────

  function init() {
    loadProgress();
    setupEventListeners();
    switchMode('phrase');
    updateTabCounts();
  }

  function setupEventListeners() {
    // Mode tabs
    document.querySelectorAll('.cvt-mode-tab').forEach(btn => {
      btn.addEventListener('click', () => switchMode(btn.dataset.mode));
    });

    // Filter chips
    document.querySelectorAll('.cvt-chip').forEach(btn => {
      btn.addEventListener('click', () => setFilter(btn.dataset.filter));
    });

    // Practice mode switch
    document.getElementById('learnModeBtn').addEventListener('click', () => setPracticeMode('learn'));
    document.getElementById('testModeBtn').addEventListener('click',  () => setPracticeMode('test'));

    // Shuffle
    document.getElementById('shuffleBtn').addEventListener('click', shuffle);

    // Reset progress
    document.getElementById('resetProgressBtn').addEventListener('click', confirmReset);

    // Card nav
    document.getElementById('prevCardBtn').addEventListener('click', () => navigateCard(-1));
    document.getElementById('nextCardBtn').addEventListener('click', () => navigateCard(1));

    // Summary buttons
    document.getElementById('retryWrongBtn').addEventListener('click', () => {
      hideSummary();
      setFilter('wrong');
      setPracticeMode('test');
    });
    document.getElementById('restartBtn').addEventListener('click', () => {
      hideSummary();
      buildDeck();
      startTest();
    });
  }

  // ── 模式切換 ────────────────────────────────────────────────

  function switchMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.cvt-mode-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    buildDeck();
    render();
  }

  function setPracticeMode(mode) {
    practiceMode = mode;
    document.getElementById('learnModeBtn').classList.toggle('active', mode === 'learn');
    document.getElementById('testModeBtn').classList.toggle('active',  mode === 'test');

    const grid = document.getElementById('cvtGrid');
    if (mode === 'test') {
      grid.classList.add('test-mode');
    } else {
      grid.classList.remove('test-mode');
    }

    buildDeck();

    if (mode === 'test') {
      startTest();
    } else {
      document.getElementById('quizSection').style.display = 'none';
      document.getElementById('gridSection').style.display = '';
    }
  }

  function setFilter(filter) {
    currentFilter = filter;
    document.querySelectorAll('.cvt-chip').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    buildDeck();
    if (practiceMode === 'test') {
      startTest();
    } else {
      render();
    }
  }

  // ── 牌組構建 ────────────────────────────────────────────────

  function buildDeck() {
    const db = getDB();
    const map = getProgressMap();

    deck = db.filter(item => {
      const key = getItemKey(item);
      const p   = map[key] || { status: 'unseen' };
      if (currentFilter === 'all')      return true;
      if (currentFilter === 'unseen')   return p.status === 'unseen';
      if (currentFilter === 'wrong')    return p.status === 'wrong';
      if (currentFilter === 'mastered') return p.status === 'mastered' || p.status === 'known';
      return true;
    });

    deckIndex = 0;
  }

  function shuffle() {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    deckIndex = 0;
    if (practiceMode === 'test') {
      startTest();
    } else {
      render();
    }
  }

  // ── 渲染學習網格 ────────────────────────────────────────────

  function render() {
    updateProgress();
    renderGrid();
  }

  function renderGrid() {
    const grid   = document.getElementById('cvtGrid');
    const empty  = document.getElementById('cvtEmpty');
    const map    = getProgressMap();

    // Apply char-mode class
    grid.classList.toggle('char-mode', currentMode === 'char');

    if (deck.length === 0) {
      grid.innerHTML = '';
      empty.style.display = '';
      return;
    }
    empty.style.display = 'none';

    grid.innerHTML = deck.map(item => {
      const key    = getItemKey(item);
      const p      = map[key] || { status: 'unseen' };
      const statusClass = p.status !== 'unseen' ? `status-${p.status}` : '';
      const altsHtml = (item.alts && item.alts.length)
        ? `<div class="cvt-alts">亦作：${item.alts.join('、')}</div>` : '';

      if (currentMode === 'phrase') {
        return `
          <div class="cvt-item ${statusClass}" data-key="${escHtml(key)}" title="${escHtml(item.simp)} → ${escHtml(item.trad)}">
            <div class="cvt-simp">${escHtml(item.simp)}</div>
            <div class="cvt-arrow">→</div>
            <div class="cvt-trad">${escHtml(item.trad)}</div>
          </div>`;
      } else {
        return `
          <div class="cvt-item char-item ${statusClass}" data-key="${escHtml(key)}" title="${escHtml(item.simp)} → ${escHtml(item.trad)}">
            <div class="cvt-simp">${escHtml(item.simp)}</div>
            <div class="cvt-arrow">→</div>
            <div class="cvt-trad">${escHtml(item.trad)}</div>
            ${altsHtml}
          </div>`;
      }
    }).join('');

    // Click to reveal in test mode, mark known/wrong
    grid.querySelectorAll('.cvt-item').forEach(el => {
      el.addEventListener('click', () => {
        if (practiceMode === 'test') {
          el.classList.toggle('revealed');
        }
      });
    });
  }

  // ── 測驗模式 ────────────────────────────────────────────────

  function startTest() {
    if (deck.length === 0) {
      document.getElementById('quizSection').style.display = 'none';
      document.getElementById('gridSection').style.display = '';
      renderGrid();
      return;
    }

    testSession = { total: deck.length, correct: 0, wrong: 0 };
    deckIndex   = 0;

    document.getElementById('quizSection').style.display = '';
    document.getElementById('gridSection').style.display = 'none';

    renderCard();
  }

  function renderCard() {
    if (deckIndex >= deck.length) {
      showSummary();
      return;
    }

    updateProgress();
    updateCardCounter();

    const item    = deck[deckIndex];
    const card    = document.getElementById('quizCard');
    card.className = 'cvt-card';

    if (currentMode === 'phrase') {
      renderPhraseCard(item, card);
    } else {
      renderCharCard(item, card);
    }
  }

  function renderPhraseCard(item, card) {
    const options = buildOptions(item, PHRASES, 'trad', 4);

    card.innerHTML = `
      <div class="cvt-card-prompt">請選出對應的繁體詞組</div>
      <div class="cvt-card-question">${escHtml(item.simp)}</div>
      <div class="cvt-card-hint">（簡體）</div>
      <div class="cvt-options" id="optionsGrid">
        ${options.map(opt => `
          <button class="cvt-option" data-ans="${escHtml(opt)}">${escHtml(opt)}</button>
        `).join('')}
      </div>
      <div class="cvt-feedback" id="feedbackRow"></div>
      <div class="cvt-mark-row" id="markRow" style="display:none">
        <button class="cvt-mark-btn cvt-mark-known" id="markKnown">✓ 已掌握</button>
        <button class="cvt-mark-btn cvt-mark-flag"  id="markFlag">✗ 標記易錯</button>
      </div>
    `;

    attachOptionListeners(item);
  }

  function renderCharCard(item, card) {
    // Build options from CHAR_DB
    const options = buildOptions(item, CHAR_DB, 'trad', 4);

    card.innerHTML = `
      <div class="cvt-card-prompt">這個簡體字的繁體寫法是？</div>
      <div class="cvt-card-question">${escHtml(item.simp)}</div>
      <div class="cvt-card-hint">（簡體字）</div>
      <div class="cvt-options" id="optionsGrid">
        ${options.map(opt => `
          <button class="cvt-option" data-ans="${escHtml(opt)}">${escHtml(opt)}</button>
        `).join('')}
      </div>
      <div class="cvt-feedback" id="feedbackRow"></div>
      <div class="cvt-mark-row" id="markRow" style="display:none">
        <button class="cvt-mark-btn cvt-mark-known" id="markKnown">✓ 已掌握</button>
        <button class="cvt-mark-btn cvt-mark-flag"  id="markFlag">✗ 標記易錯</button>
      </div>
    `;

    attachOptionListeners(item);
  }

  function buildOptions(correctItem, db, field, count) {
    const correct = correctItem[field];
    const pool    = db
      .map(it => it[field])
      .filter(v => v && v !== correct);

    // Shuffle pool
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    const opts = [correct, ...pool.slice(0, count - 1)];
    // Shuffle options
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [opts[i], opts[j]] = [opts[j], opts[i]];
    }
    return opts;
  }

  function attachOptionListeners(item) {
    const card    = document.getElementById('quizCard');
    const key     = getItemKey(item);
    let answered  = false;

    card.querySelectorAll('.cvt-option').forEach(btn => {
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;

        const chosen  = btn.dataset.ans;
        const correct = item.trad;
        const isRight = chosen === correct;

        // Highlight options
        card.querySelectorAll('.cvt-option').forEach(b => {
          b.disabled = true;
          if (b.dataset.ans === correct) b.classList.add('opt-correct');
          if (b === btn && !isRight)     b.classList.add('opt-wrong');
        });

        // Feedback
        const fb = document.getElementById('feedbackRow');
        if (isRight) {
          fb.className = 'cvt-feedback correct';
          fb.textContent = '✓ 正確！繁體寫作「' + correct + '」';
          card.classList.add('correct');
          testSession.correct++;
          // Update progress
          const prev  = getProgress(key, currentMode);
          const streak = (prev.streak || 0) + 1;
          setProgress(key, currentMode, {
            status: streak >= 2 ? 'mastered' : 'known',
            streak
          });
        } else {
          fb.className = 'cvt-feedback wrong';
          fb.textContent = '✗ 正確答案是「' + correct + '」';
          card.classList.add('wrong-ans');
          testSession.wrong++;
          setProgress(key, currentMode, { status: 'wrong', streak: 0 });
        }

        // Show mark row
        document.getElementById('markRow').style.display = 'flex';

        // Mark buttons
        document.getElementById('markKnown').addEventListener('click', () => {
          setProgress(key, currentMode, { status: 'mastered', streak: 2 });
          autoAdvance();
        });
        document.getElementById('markFlag').addEventListener('click', () => {
          setProgress(key, currentMode, { status: 'wrong', streak: 0 });
          autoAdvance();
        });

        // Auto advance after 1.6s
        autoAdvance();
      });
    });
  }

  let advanceTimer = null;
  function autoAdvance() {
    if (advanceTimer) return;
    advanceTimer = setTimeout(() => {
      advanceTimer = null;
      navigateCard(1);
    }, 1600);
  }

  function navigateCard(dir) {
    if (advanceTimer) {
      clearTimeout(advanceTimer);
      advanceTimer = null;
    }
    deckIndex += dir;
    if (deckIndex < 0) deckIndex = 0;
    if (deckIndex >= deck.length) {
      showSummary();
      return;
    }
    renderCard();
  }

  function updateCardCounter() {
    document.getElementById('cardCounter').textContent =
      `${deckIndex + 1} / ${deck.length}`;
    document.getElementById('prevCardBtn').disabled = deckIndex === 0;
    document.getElementById('nextCardBtn').disabled = deckIndex >= deck.length - 1;
  }

  // ── 進度 & 統計 ─────────────────────────────────────────────

  function updateProgress() {
    const db   = getDB();
    const map  = getProgressMap();

    let mastered = 0, wrong = 0, unseen = 0;
    db.forEach(item => {
      const key = getItemKey(item);
      const p   = map[key] || { status: 'unseen' };
      if (p.status === 'mastered' || p.status === 'known') mastered++;
      else if (p.status === 'wrong') wrong++;
      else unseen++;
    });

    const total = db.length;
    const pct   = total > 0 ? Math.round(mastered / total * 100) : 0;

    document.getElementById('progressText').textContent =
      `掌握 ${mastered} / ${total}`;

    document.getElementById('progressFill').style.width = pct + '%';

    document.getElementById('progressBadges').innerHTML = `
      <span class="cvt-badge">
        <span class="cvt-badge-dot mastered"></span>${mastered} 掌握
      </span>
      <span class="cvt-badge">
        <span class="cvt-badge-dot wrong"></span>${wrong} 易錯
      </span>
      <span class="cvt-badge">
        <span class="cvt-badge-dot unseen"></span>${unseen} 未練
      </span>
    `;
  }

  function updateTabCounts() {
    document.getElementById('phraseCount').textContent = PHRASES.length + ' 組';
    document.getElementById('charCount').textContent   = CHAR_DB.length + ' 字';
  }

  // ── 總結 ────────────────────────────────────────────────────

  function showSummary() {
    const { total, correct, wrong } = testSession;
    const pct = total > 0 ? Math.round(correct / total * 100) : 0;

    document.getElementById('summaryStats').innerHTML = `
      <div class="cvt-stat">
        <div class="cvt-stat-num green">${correct}</div>
        <div class="cvt-stat-label">答對</div>
      </div>
      <div class="cvt-stat">
        <div class="cvt-stat-num red">${wrong}</div>
        <div class="cvt-stat-label">答錯</div>
      </div>
      <div class="cvt-stat">
        <div class="cvt-stat-num gold">${pct}%</div>
        <div class="cvt-stat-label">正確率</div>
      </div>
    `;

    document.getElementById('cvtSummary').style.display = 'flex';
    document.getElementById('quizSection').style.display = 'none';
  }

  function hideSummary() {
    document.getElementById('cvtSummary').style.display = 'none';
  }

  // ── 重置 ────────────────────────────────────────────────────

  function confirmReset() {
    const dbName = currentMode === 'phrase' ? '詞組' : '單字';
    if (!confirm(`確定要重置${dbName}練習的所有進度嗎？此操作不可撤銷。`)) return;
    if (currentMode === 'phrase') {
      phraseProgress = {};
      localStorage.removeItem(STORAGE_KEY_PHRASE);
    } else {
      charProgress = {};
      localStorage.removeItem(STORAGE_KEY_CHAR);
    }
    buildDeck();
    render();
  }

  // ── 工具 ────────────────────────────────────────────────────

  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── 鍵盤導航 ────────────────────────────────────────────────

  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (practiceMode !== 'test') return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      navigateCard(1);
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      navigateCard(-1);
    }
  });

  // ── 啟動 ────────────────────────────────────────────────────
  // convert_data.js and convert.js both use defer, so DOM is ready
  // and scripts execute in order. We can call init() directly.
  // Use requestAnimationFrame to ensure all deferred scripts have run.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => requestAnimationFrame(init));
  } else {
    requestAnimationFrame(init);
  }

})();
