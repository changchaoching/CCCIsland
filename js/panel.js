// site/js/panel.js
export class PanelManager {
  constructor(contentData, onProgressUpdate) {
    this.data = contentData;
    this.onProgressUpdate = onProgressUpdate;
    this.currentIsland = null;

    this.drawer = document.getElementById("island-panel");
    this.btnClose = document.getElementById("btn-close-panel");
    
    this.groupBadge = document.getElementById("panel-group");
    this.landmarkBadge = document.getElementById("panel-landmark-badge");
    this.titleEl = document.getElementById("panel-title");
    this.taglineEl = document.getElementById("panel-tagline");

    this.tabBtns = {
      course: document.getElementById("tab-btn-course"),
      worksheet: document.getElementById("tab-btn-worksheet"),
      quiz: document.getElementById("tab-btn-quiz")
    };

    this.tabPanes = {
      course: document.getElementById("pane-course"),
      worksheet: document.getElementById("pane-worksheet"),
      quiz: document.getElementById("pane-quiz")
    };

    this.courseArticleBody = document.getElementById("course-article-body");
    this.courseLinkBox = document.getElementById("course-link-box");
    this.worksheetContainer = document.getElementById("worksheet-container");
    this.quizContainer = document.getElementById("quiz-container");

    this.btnSaveWorksheet = document.getElementById("btn-save-worksheet");
    this.btnExportMarkdown = document.getElementById("btn-export-markdown");
    this.btnSubmitIslandQuiz = document.getElementById("btn-submit-island-quiz");

    this.initEvents();
  }

  initEvents() {
    this.btnClose.addEventListener("click", () => this.close());

    // 分頁切換
    Object.keys(this.tabBtns).forEach(tabKey => {
      this.tabBtns[tabKey].addEventListener("click", () => this.switchTab(tabKey));
    });

    // 儲存學習單
    this.btnSaveWorksheet.addEventListener("click", () => this.saveWorksheet(true));

    // 匯出 Markdown
    this.btnExportMarkdown.addEventListener("click", () => this.exportMarkdown());

    // 送出隨堂測驗
    this.btnSubmitIslandQuiz.addEventListener("click", () => this.submitQuiz());

    // 鍵盤 Esc 關閉
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.isOpen()) {
        this.close();
      }
    });
  }

  isOpen() {
    return this.drawer.classList.contains("open");
  }

  open(islandId) {
    let item = this.data.islands.find(i => i.id === islandId);
    if (!item && this.data.centerIsland.id === islandId) {
      item = this.data.centerIsland;
    }
    if (!item) return;

    this.currentIsland = item;

    // 記錄已訪問進度
    this.recordVisited(item.id);

    // 填寫標頭資訊
    this.groupBadge.textContent = item.group || "核心海域";
    this.landmarkBadge.textContent = "📍 " + (item.landmark || "地標建築");
    this.titleEl.textContent = item.name;
    this.taglineEl.textContent = item.intro;

    // 預設切換至教材分頁
    this.switchTab("course");

    // 渲染教材
    this.renderCourse(item);

    // 渲染學習單
    this.renderWorksheet(item);

    // 渲染隨堂測驗
    this.renderQuiz(item);

    this.drawer.classList.add("open");
    this.drawer.setAttribute("aria-hidden", "false");
  }

  close() {
    this.drawer.classList.remove("open");
    this.drawer.setAttribute("aria-hidden", "true");
  }

  switchTab(tabKey) {
    Object.keys(this.tabBtns).forEach(k => {
      const isActive = k === tabKey;
      this.tabBtns[k].classList.toggle("active", isActive);
      this.tabBtns[k].setAttribute("aria-selected", isActive ? "true" : "false");
      this.tabPanes[k].classList.toggle("active", isActive);
    });
  }

  renderCourse(item) {
    const isCenter = item.id === "island-center";
    let html = "";

    // 標註示意說明
    html += `<div class="note-box">${item.materialNote || "本島教材與測驗依據管理學大師經典理論與 points 延伸編撰（標示為示意／自編練習題）。"}</div>`;

    if (item.courseContent) {
      html += `<p style="font-size: 1.05rem; line-height: 1.8; margin-bottom: 20px; font-weight: 500;">${item.courseContent.overview}</p>`;

      if (item.courseContent.sections) {
        item.courseContent.sections.forEach(sec => {
          html += `<h3>${sec.title}</h3>`;
          html += `<p>${sec.content}</p>`;
        });
      }
    }

    this.courseArticleBody.innerHTML = html;

    // 外部參考連結
    if (item.link) {
      this.courseLinkBox.innerHTML = `
        <a href="${item.link}" target="_blank" rel="noopener noreferrer" class="external-link-card">
          <div>
            <div style="font-size: 0.75rem; color: var(--muted); margin-bottom: 2px;">權威延伸學習參考（外開分頁）</div>
            <div class="link-text">${item.link}</div>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </a>
      `;
    } else {
      this.courseLinkBox.innerHTML = "";
    }
  }

  renderWorksheet(item) {
    if (!item.worksheet || item.worksheet.length === 0) {
      this.worksheetContainer.innerHTML = "<p style='color:var(--muted);'>本島目前無指定學習單題目。</p>";
      return;
    }

    const savedWorksheet = JSON.parse(localStorage.getItem(`ws_${item.id}`) || "{}");
    let html = "";

    item.worksheet.forEach((q, idx) => {
      const val = savedWorksheet[q.id] || "";
      html += `
        <div class="worksheet-item">
          <div class="worksheet-q">Q${idx + 1}. ${q.question}</div>
          <div class="worksheet-hint">${q.hint}</div>
          <textarea class="worksheet-textarea" data-qid="${q.id}" placeholder="請在此輸入您的觀察與思考草稿...">${val}</textarea>
        </div>
      `;
    });

    this.worksheetContainer.innerHTML = html;

    // 自動輸入即時暫存
    const textareas = this.worksheetContainer.querySelectorAll("textarea");
    textareas.forEach(t => {
      t.addEventListener("input", () => this.saveWorksheet(false));
    });
  }

  saveWorksheet(showToast = false) {
    if (!this.currentIsland) return;
    const textareas = this.worksheetContainer.querySelectorAll("textarea");
    const wsData = {};
    let filledCount = 0;

    textareas.forEach(t => {
      const qid = t.getAttribute("data-qid");
      const val = t.value.trim();
      wsData[qid] = val;
      if (val.length > 0) filledCount++;
    });

    localStorage.setItem(`ws_${this.currentIsland.id}`, JSON.stringify(wsData));
    
    // 更新全站學習單筆記計數
    if (this.onProgressUpdate) {
      this.onProgressUpdate();
    }

    if (showToast) {
      alert("✅ 學習單草稿已成功儲存至瀏覽器！");
    }
  }

  exportMarkdown() {
    if (!this.currentIsland) return;
    const item = this.currentIsland;
    const textareas = this.worksheetContainer.querySelectorAll("textarea");
    
    let md = `# 【${this.data.site.title}】學習單筆記：${item.name}\n`;
    md += `> 導師：${this.data.site.mascot.name}｜分類海域：${item.group || "核心"}｜匯出時間：${new Date().toLocaleString("zh-TW")}\n\n`;
    md += `## 課程簡介\n${item.intro}\n\n`;
    md += `## 學習單思考與心得記錄\n\n`;

    item.worksheet.forEach((q, idx) => {
      const t = Array.from(textareas).find(el => el.getAttribute("data-qid") === q.id);
      const answer = t && t.value.trim() ? t.value.trim() : "（尚未填寫）";
      md += `### Q${idx + 1}. ${q.question}\n`;
      md += `> 引導提示：${q.hint}\n\n`;
      md += `**我的回答：**\n\n${answer}\n\n---\n\n`;
    });

    md += `*本筆記由「${this.data.site.title}」自動產生。*\n`;

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${item.name}_學習單筆記.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  renderQuiz(item) {
    if (item.id === "island-center") {
      this.quizContainer.innerHTML = `
        <div style="text-align:center; padding: 24px 16px;">
          <h3 style="font-family:var(--font-heading); margin-bottom:12px;">🌟 中央總複習挑戰</h3>
          <p style="color:var(--muted); font-size:0.92rem; margin-bottom:20px;">本島負責統整 7 座島嶼之全方位題庫！請點擊下方按鈕啟動 10 題跨課實戰隨機抽測！</p>
          <button class="action-pill primary" id="btn-start-center-quiz-panel" style="margin: 0 auto;">立即啟動跨課總複習 (10題)</button>
        </div>
      `;
      document.getElementById("btn-start-center-quiz-panel")?.addEventListener("click", () => {
        window.dispatchEvent(new CustomEvent("openCenterQuiz"));
      });
      this.btnSubmitIslandQuiz.style.display = "none";
      return;
    }

    this.btnSubmitIslandQuiz.style.display = "inline-flex";

    if (!item.quiz || item.quiz.length === 0) {
      this.quizContainer.innerHTML = "<p style='color:var(--muted);'>本島目前無指定隨堂測驗。</p>";
      this.btnSubmitIslandQuiz.style.display = "none";
      return;
    }

    const savedAnswers = JSON.parse(localStorage.getItem(`quiz_${item.id}`) || "{}");
    let html = "";

    item.quiz.forEach((q, qIdx) => {
      const selected = savedAnswers[q.id] || "";
      html += `
        <div class="quiz-item" data-quiz-id="${q.id}">
          <div class="quiz-q-title">${qIdx + 1}. ${q.question}</div>
          <div class="quiz-options">
      `;

      q.options.forEach(opt => {
        const isSel = selected === opt.id;
        html += `
          <button class="option-btn ${isSel ? "selected" : ""}" data-opt-id="${opt.id}">
            <strong>${opt.id}.</strong> ${opt.text}
          </button>
        `;
      });

      html += `
          </div>
          <div class="quiz-feedback" id="feedback-${q.id}" style="display: none;"></div>
        </div>
      `;
    });

    this.quizContainer.innerHTML = html;

    // 綁定選項點擊事件
    const quizItems = this.quizContainer.querySelectorAll(".quiz-item");
    quizItems.forEach(card => {
      const btns = card.querySelectorAll(".option-btn");
      btns.forEach(btn => {
        btn.addEventListener("click", () => {
          btns.forEach(b => b.classList.remove("selected"));
          btn.classList.add("selected");
        });
      });
    });
  }

  submitQuiz() {
    if (!this.currentIsland || !this.currentIsland.quiz) return;
    const item = this.currentIsland;
    let score = 0;
    const total = item.quiz.length;
    const userAnswers = {};

    item.quiz.forEach(q => {
      const card = this.quizContainer.querySelector(`[data-quiz-id="${q.id}"]`);
      if (!card) return;
      const selBtn = card.querySelector(".option-btn.selected");
      const selOptId = selBtn ? selBtn.getAttribute("data-opt-id") : null;
      userAnswers[q.id] = selOptId;

      const fb = card.querySelector(`#feedback-${q.id}`);
      fb.style.display = "block";

      const allBtns = card.querySelectorAll(".option-btn");
      allBtns.forEach(b => {
        const optId = b.getAttribute("data-opt-id");
        if (optId === q.correctId) {
          b.classList.add("correct");
        } else if (optId === selOptId && selOptId !== q.correctId) {
          b.classList.add("wrong");
        }
      });

      if (selOptId === q.correctId) {
        score++;
        fb.className = "quiz-feedback correct-feedback";
        fb.innerHTML = `✅ <strong>回答正確！</strong> ${q.explanation}`;
      } else {
        fb.className = "quiz-feedback wrong-feedback";
        fb.innerHTML = `❌ <strong>答案是 (${q.correctId})</strong>：${q.explanation}`;
      }
    });

    localStorage.setItem(`quiz_${item.id}`, JSON.stringify(userAnswers));
    const pctScore = Math.round((score / total) * 100);
    localStorage.setItem(`quiz_score_${item.id}`, pctScore);

    if (this.onProgressUpdate) {
      this.onProgressUpdate();
    }

    alert(`🎉 隨堂測驗完成！您獲得 ${score} / ${total} 題 (${pctScore}分)！`);
  }

  recordVisited(islandId) {
    const visited = JSON.parse(localStorage.getItem("visited_islands") || "[]");
    if (!visited.includes(islandId)) {
      visited.push(islandId);
      localStorage.setItem("visited_islands", JSON.stringify(visited));
      if (this.onProgressUpdate) {
        this.onProgressUpdate();
      }
    }
  }
}
