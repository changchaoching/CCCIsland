// site/js/main.js
import { SceneManager } from "./scene3d.js";
import { PanelManager } from "./panel.js";
import { CenterQuizManager } from "./center-quiz.js";

class App {
  constructor() {
    this.contentData = null;
    this.sceneManager = null;
    this.panelManager = null;
    this.centerQuizManager = null;

    this.currentTheme = localStorage.getItem("preferred_theme") || "sky";
    this.isReducedMotion = localStorage.getItem("reduced_motion") === "true";
    this.dayNightCycle = "day"; // "day", "sunset", "night"
    this.activeFilter = "all";

    this.init();
  }

  async init() {
    try {
      const res = await fetch("data/content.json");
      if (!res.ok) throw new Error("Failed to load content.json");
      this.contentData = await res.json();
    } catch (err) {
      console.error("Data loading error:", err);
      alert("無法載入課程群島資料，請確認本機伺服器運作正常。");
      return;
    }

    this.applyTheme(this.currentTheme);
    this.applyReducedMotion(this.isReducedMotion);

    const canvasContainer = document.getElementById("canvas-container");
    const labelContainer = document.getElementById("island-label-container");

    try {
      this.sceneManager = new SceneManager(
        canvasContainer,
        labelContainer,
        (islandId) => this.onIslandSelect(islandId)
      );
      this.sceneManager.loadIslands(this.contentData);
      this.sceneManager.setTheme(this.currentTheme);
      this.sceneManager.setReducedMotion(this.isReducedMotion);
    } catch (e) {
      console.warn("3D Scene fallback triggered:", e);
      document.getElementById("btn-open-list").click();
      canvasContainer.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:center; height:100%; text-align:center; padding:20px; color:var(--muted);">
          <div>
            <h2 style="font-family:var(--font-heading); color:var(--ink); margin-bottom:10px;">🏝️ 歡迎來到生成式 AI 探索群島</h2>
            <p>您的裝置目前未開啟 WebGL 3D 加速。已自動為您切換至平等純文字閱讀模式！</p>
          </div>
        </div>
      `;
    }

    this.panelManager = new PanelManager(this.contentData, () => this.updateProgressUI());
    this.centerQuizManager = new CenterQuizManager(this.contentData, () => this.updateProgressUI());

    this.initUIEvents();
    this.startClock();
    this.updateProgressUI();
  }

  onIslandSelect(islandId) {
    if (this.panelManager) {
      this.panelManager.open(islandId);
    }
  }

  initUIEvents() {
    // 主題切換按鈕
    const themePills = document.querySelectorAll(".theme-pill");
    themePills.forEach(pill => {
      pill.addEventListener("click", () => {
        const theme = pill.getAttribute("data-theme");
        this.applyTheme(theme);
      });
    });

    // 晝夜光線按鈕
    const btnDayNight = document.getElementById("btn-day-night");
    btnDayNight.addEventListener("click", () => {
      if (this.dayNightCycle === "day") {
        this.dayNightCycle = "sunset";
      } else if (this.dayNightCycle === "sunset") {
        this.dayNightCycle = "night";
      } else {
        this.dayNightCycle = "day";
      }
      if (this.sceneManager) {
        this.sceneManager.setDayNight(this.dayNightCycle);
      }
      this.updateClockPeriodText();
    });

    // 減少動態按鈕
    const btnMotion = document.getElementById("btn-motion");
    btnMotion.addEventListener("click", () => {
      this.applyReducedMotion(!this.isReducedMotion);
    });

    // 支援系統 prefers-reduced-motion
    if (window.matchMedia) {
      const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      motionQuery.addEventListener("change", (e) => {
        this.applyReducedMotion(e.matches);
      });
    }

    // 回到全景按鈕
    const btnResetView = document.getElementById("btn-reset-view");
    btnResetView.addEventListener("click", () => {
      if (this.sceneManager) {
        this.sceneManager.resetView();
      }
      if (this.panelManager) {
        this.panelManager.close();
      }
    });

    // 中央島快捷按鈕
    const btnCenterHub = document.getElementById("btn-center-hub");
    btnCenterHub.addEventListener("click", () => {
      if (this.sceneManager) {
        this.sceneManager.focusIsland("island-center");
      }
      if (this.panelManager) {
        this.panelManager.open("island-center");
      }
    });

    // 地點清單 Modal
    const btnOpenList = document.getElementById("btn-open-list");
    const modalList = document.getElementById("modal-list");
    btnOpenList.addEventListener("click", () => {
      this.renderIslandList();
      modalList.classList.add("open");
    });

    // 搜尋按鈕直接開啟清單並聚焦搜尋框
    const btnOpenSearch = document.getElementById("btn-open-search");
    btnOpenSearch.addEventListener("click", () => {
      this.renderIslandList();
      modalList.classList.add("open");
      const searchInput = document.getElementById("island-search-input");
      if (searchInput) {
        setTimeout(() => searchInput.focus(), 150);
      }
    });

    // 搜尋即時篩選
    const searchInput = document.getElementById("island-search-input");
    searchInput.addEventListener("input", () => {
      this.renderIslandList();
    });

    // 海域分類標籤篩選
    const filterChips = document.querySelectorAll(".filter-chip");
    filterChips.forEach(chip => {
      chip.addEventListener("click", () => {
        filterChips.forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        this.activeFilter = chip.getAttribute("data-filter");
        this.renderIslandList();
      });
    });

    // 探索進度 Modal
    const btnOpenProgress = document.getElementById("btn-open-progress");
    const modalProgress = document.getElementById("modal-progress");
    btnOpenProgress.addEventListener("click", () => {
      this.updateProgressUI();
      modalProgress.classList.add("open");
    });

    // 清除進度按鈕
    const btnClearStorage = document.getElementById("btn-clear-storage");
    btnClearStorage.addEventListener("click", () => {
      if (confirm("⚠️ 確定要清除所有已讀記錄、學習單草稿與測驗成績嗎？此動作無法復原。")) {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k.startsWith("ws_") || k.startsWith("quiz_") || k === "visited_islands" || k === "best_center_quiz_score") {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
        this.updateProgressUI();
        alert("已清除所有探索與測驗記錄。");
      }
    });

    // 說明 Modal
    const btnOpenHelp = document.getElementById("btn-open-help");
    const brandBadge = document.getElementById("brand-badge");
    const modalHelp = document.getElementById("modal-help");
    const modalCenterQuiz = document.getElementById("modal-center-quiz");
    const openHelp = () => modalHelp.classList.add("open");
    btnOpenHelp.addEventListener("click", openHelp);
    brandBadge.addEventListener("click", openHelp);

    // 通用 Modal 關閉與 Esc 鍵處理
    const allModals = [modalList, modalProgress, modalHelp, modalCenterQuiz];
    allModals.forEach(modal => {
      if (!modal) return;
      const closeBtns = modal.querySelectorAll(".modal-close-btn");
      closeBtns.forEach(btn => btn.addEventListener("click", () => modal.classList.remove("open")));
      modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.classList.remove("open");
      });
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        allModals.forEach(m => {
          if (m) m.classList.remove("open");
        });
      }
    });
  }

  applyTheme(theme) {
    this.currentTheme = theme;
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("preferred_theme", theme);

    const pills = document.querySelectorAll(".theme-pill");
    pills.forEach(p => {
      p.classList.toggle("active", p.getAttribute("data-theme") === theme);
    });

    if (this.sceneManager) {
      this.sceneManager.setTheme(theme);
    }
  }

  applyReducedMotion(isReduced) {
    this.isReducedMotion = isReduced;
    localStorage.setItem("reduced_motion", isReduced.toString());

    document.documentElement.classList.toggle("reduced-motion", isReduced);
    const btnMotion = document.getElementById("btn-motion");
    if (btnMotion) {
      btnMotion.classList.toggle("active", isReduced);
      btnMotion.title = isReduced ? "動態已暫停（保護暈眩）" : "減少動態模式 (暫停動畫)";
    }

    if (this.sceneManager) {
      this.sceneManager.setReducedMotion(isReduced);
    }
  }

  startClock() {
    const clockTime = document.getElementById("clock-time");
    const updateTime = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, "0");
      const m = String(now.getMinutes()).padStart(2, "0");
      if (clockTime) clockTime.textContent = `${h}:${m}`;
    };
    updateTime();
    setInterval(updateTime, 1000);
    this.updateClockPeriodText();
  }

  updateClockPeriodText() {
    const clockPeriod = document.getElementById("clock-period");
    if (!clockPeriod) return;
    if (this.dayNightCycle === "day") {
      clockPeriod.textContent = "☀️ 白晝";
    } else if (this.dayNightCycle === "sunset") {
      clockPeriod.textContent = "🌇 黃昏";
    } else {
      clockPeriod.textContent = "🌙 星夜";
    }
  }

  renderIslandList() {
    const container = document.getElementById("island-list-container");
    const searchInput = document.getElementById("island-search-input");
    const query = searchInput ? searchInput.value.trim().toLowerCase() : "";

    const allIslands = [this.contentData.centerIsland, ...this.contentData.islands];
    const visited = JSON.parse(localStorage.getItem("visited_islands") || "[]");

    let filtered = allIslands.filter(item => {
      if (this.activeFilter !== "all") {
        if (this.activeFilter === "樞紐總島" && item.id !== "island-center") return false;
        if (this.activeFilter !== "樞紐總島" && item.group !== this.activeFilter) return false;
      }
      if (query.length > 0) {
        const text = `${item.name} ${item.intro} ${item.points ? item.points.join(" ") : ""} ${item.extra || ""} ${item.landmark || ""}`.toLowerCase();
        if (!text.includes(query)) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      container.innerHTML = `<p style="text-align:center; color:var(--muted); padding:30px 0;">找不到符合條件的島嶼或內容。</p>`;
      return;
    }

    let html = "";
    filtered.forEach(item => {
      const isCenter = item.id === "island-center";
      const isVisited = visited.includes(item.id);
      html += `
        <div class="island-list-card" data-island-id="${item.id}" role="button" tabindex="0">
          <div class="order-num" style="${isCenter ? 'background:var(--accent-light); color:var(--accent);' : ''}">${isCenter ? '★' : item.order}</div>
          <div class="island-list-info">
            <h3>
              ${item.name}
              <span class="group-badge" style="font-size:0.7rem;">${item.group || '樞紐總島'}</span>
              ${isVisited ? '<span style="font-size:0.75rem; color:var(--success); font-weight:600;">✓ 已探索</span>' : ''}
            </h3>
            <p>${item.intro}</p>
            <div style="font-size:0.75rem; color:var(--muted); margin-top:4px;">📍 地標：${item.landmark}</div>
          </div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--muted);"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      `;
    });

    container.innerHTML = html;

    const cards = container.querySelectorAll(".island-list-card");
    cards.forEach(card => {
      card.addEventListener("click", () => {
        const id = card.getAttribute("data-island-id");
        document.getElementById("modal-list").classList.remove("open");
        if (this.sceneManager) {
          this.sceneManager.focusIsland(id);
        }
        if (this.panelManager) {
          this.panelManager.open(id);
        }
      });
    });
  }

  updateProgressUI() {
    const allIslands = [this.contentData.centerIsland, ...this.contentData.islands];
    const totalIslands = allIslands.length;

    const visited = JSON.parse(localStorage.getItem("visited_islands") || "[]");
    const visitedCount = visited.length;
    const visitedPct = Math.round((visitedCount / totalIslands) * 100);

    const pctEl = document.getElementById("visited-percentage");
    const barEl = document.getElementById("visited-bar-fill");
    const statVisitedCount = document.getElementById("stat-visited-count");
    if (pctEl) pctEl.textContent = `${visitedPct}%`;
    if (barEl) barEl.style.width = `${visitedPct}%`;
    if (statVisitedCount) statVisitedCount.textContent = `${visitedCount} / ${totalIslands}`;

    let worksheetCount = 0;
    allIslands.forEach(item => {
      const ws = JSON.parse(localStorage.getItem(`ws_${item.id}`) || "{}");
      if (Object.values(ws).some(v => v.trim().length > 0)) {
        worksheetCount++;
      }
    });
    const statWsCount = document.getElementById("stat-worksheet-count");
    if (statWsCount) statWsCount.textContent = `${worksheetCount} 份`;

    const bestScore = localStorage.getItem("best_center_quiz_score");
    const statQuizScore = document.getElementById("stat-quiz-score");
    if (statQuizScore) {
      statQuizScore.textContent = bestScore ? `${bestScore} 分` : "-- 分";
    }

    const breakdownEl = document.getElementById("progress-islands-breakdown");
    if (breakdownEl) {
      let bHtml = "";
      allIslands.forEach(item => {
        const isV = visited.includes(item.id);
        const ws = JSON.parse(localStorage.getItem(`ws_${item.id}`) || "{}");
        const hasWs = Object.values(ws).some(v => v.trim().length > 0);
        const qScore = localStorage.getItem(`quiz_score_${item.id}`);

        bHtml += `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-sm); font-size:0.85rem;">
            <div>
              <strong>${item.name}</strong>
              <span style="color:var(--muted); font-size:0.75rem; margin-left:6px;">(${item.group || "樞紐"})</span>
            </div>
            <div style="display:flex; gap:10px; font-size:0.78rem;">
              <span style="color:${isV ? 'var(--success)' : 'var(--muted)'};">${isV ? '✓ 已讀' : '○ 未讀'}</span>
              <span style="color:${hasWs ? 'var(--accent)' : 'var(--muted)'};">${hasWs ? '✎ 筆記' : '○ 筆記'}</span>
              <span style="color:${qScore ? 'var(--primary)' : 'var(--muted)'}; font-weight:600;">${qScore ? qScore + '分' : '--'}</span>
            </div>
          </div>
        `;
      });
      breakdownEl.innerHTML = bHtml;
    }
  }
}

window.addEventListener("DOMContentLoaded", () => {
  new App();
});
