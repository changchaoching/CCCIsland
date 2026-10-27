// site/js/center-quiz.js
export class CenterQuizManager {
  constructor(contentData, onProgressUpdate) {
    this.data = contentData;
    this.onProgressUpdate = onProgressUpdate;
    this.modal = document.getElementById("modal-center-quiz");
    this.modalBody = document.getElementById("center-quiz-modal-body");

    this.activeQuestions = [];
    this.userAnswers = {};

    this.initEvents();
  }

  initEvents() {
    window.addEventListener("openCenterQuiz", () => this.open());
    
    // 監聽關閉按鈕
    const closeBtns = this.modal.querySelectorAll(".modal-close-btn");
    closeBtns.forEach(btn => btn.addEventListener("click", () => this.close()));

    // 點擊遮罩關閉
    this.modal.addEventListener("click", (e) => {
      if (e.target === this.modal) this.close();
    });
  }

  open() {
    this.startNewQuiz();
    this.modal.classList.add("open");
  }

  close() {
    this.modal.classList.remove("open");
  }

  startNewQuiz() {
    // 匯集 7 座島所有題目 (共 28 題)
    const allQuestions = [];
    this.data.islands.forEach(island => {
      if (island.quiz) {
        island.quiz.forEach(q => {
          allQuestions.push({
            ...q,
            fromIsland: island.name,
            fromIslandId: island.id
          });
        });
      }
    });

    // 隨機抽選 10 題
    const shuffled = [...allQuestions].sort(() => 0.5 - Math.random());
    this.activeQuestions = shuffled.slice(0, 10).map(q => {
      // 選項隨機打亂，但保留原本 id
      const shuffledOptions = [...q.options].sort(() => 0.5 - Math.random());
      return {
        ...q,
        options: shuffledOptions
      };
    });

    this.userAnswers = {};
    this.renderQuizForm();
  }

  renderQuizForm() {
    let html = `
      <div style="margin-bottom: 20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span style="font-weight:600; font-size:0.95rem;">答題進度</span>
          <span id="center-quiz-progress-text" style="color:var(--primary); font-weight:700;">0 / 10 題</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" id="center-quiz-progress-bar" style="width: 0%;"></div>
        </div>
      </div>
    `;

    this.activeQuestions.forEach((q, idx) => {
      html += `
        <div class="quiz-item" data-c-qid="${q.id}">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
            <div class="quiz-q-title" style="margin-bottom:0;">第 ${idx + 1} 題：${q.question}</div>
            <span class="group-badge" style="font-size:0.7rem; flex-shrink:0;">出自：${q.fromIsland}</span>
          </div>
          <div class="quiz-options">
      `;

      q.options.forEach(opt => {
        html += `
          <button class="option-btn" data-c-opt-id="${opt.id}">
            <strong>${opt.id}.</strong> ${opt.text}
          </button>
        `;
      });

      html += `
          </div>
        </div>
      `;
    });

    html += `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:24px; padding-top:16px; border-top:1px solid var(--line);">
        <button class="btn-secondary" id="btn-restart-center-quiz">🔄 重新抽題</button>
        <button class="action-pill primary" id="btn-submit-center-quiz">交卷結算成績</button>
      </div>
    `;

    this.modalBody.innerHTML = html;

    // 綁定選項點擊
    const items = this.modalBody.querySelectorAll(".quiz-item");
    items.forEach(item => {
      const qid = item.getAttribute("data-c-qid");
      const btns = item.querySelectorAll(".option-btn");
      btns.forEach(btn => {
        btn.addEventListener("click", () => {
          btns.forEach(b => b.classList.remove("selected"));
          btn.classList.add("selected");
          this.userAnswers[qid] = btn.getAttribute("data-c-opt-id");
          this.updateProgress();
        });
      });
    });

    this.modalBody.querySelector("#btn-restart-center-quiz").addEventListener("click", () => {
      if (confirm("確定要重新隨機抽題嗎？當前作答將會重設。")) {
        this.startNewQuiz();
      }
    });

    this.modalBody.querySelector("#btn-submit-center-quiz").addEventListener("click", () => {
      this.evaluateQuiz();
    });
  }

  updateProgress() {
    const answeredCount = Object.keys(this.userAnswers).length;
    const pct = Math.round((answeredCount / 10) * 100);
    const textEl = this.modalBody.querySelector("#center-quiz-progress-text");
    const barEl = this.modalBody.querySelector("#center-quiz-progress-bar");
    if (textEl) textEl.textContent = `${answeredCount} / 10 題`;
    if (barEl) barEl.style.width = `${pct}%`;
  }

  evaluateQuiz() {
    const answeredCount = Object.keys(this.userAnswers).length;
    if (answeredCount < 10) {
      if (!confirm(`您還有 ${10 - answeredCount} 題尚未作答，確定要提早交卷嗎？`)) {
        return;
      }
    }

    let correctCount = 0;
    this.activeQuestions.forEach(q => {
      if (this.userAnswers[q.id] === q.correctId) {
        correctCount++;
      }
    });

    const score = correctCount * 10;

    // 評級徽章與評語
    let rankTitle = "探索學員";
    let rankDesc = "繼續加油！多回到各島研讀教材與練習題，你的思維將更加敏銳！";
    if (score >= 90) {
      rankTitle = "👑 跨域策略大宗師";
      rankDesc = "不可思議！你已經完美貫通管理矩陣、系統基模、策略形態與 4C 成本理論，具備極強的管理即戰力！";
    } else if (score >= 70) {
      rankTitle = "🌟 系統思考精英";
      rankDesc = "表現相當優異！你對大部分策略工具與因果迴路已有深入理解，能敏銳辨識商業盲點！";
    } else if (score >= 50) {
      rankTitle = "🚀 潛力管理新星";
      rankDesc = "掌握了核心概念的基本脈絡，建議針對錯題重回相關島嶼進行複習！";
    }

    // 儲存最高分至 localStorage
    const prevBest = parseInt(localStorage.getItem("best_center_quiz_score") || "0", 10);
    if (score > prevBest) {
      localStorage.setItem("best_center_quiz_score", score.toString());
    }

    if (this.onProgressUpdate) {
      this.onProgressUpdate();
    }

    // 渲染成績結算與詳細解析單
    let resultHtml = `
      <div style="text-align:center; padding: 20px 10px; background:var(--surface-alt); border-radius:var(--radius-md); margin-bottom:24px; border:1.5px solid var(--primary);">
        <div style="font-size:0.85rem; color:var(--muted); margin-bottom:4px;">CCC 即戰力 總複習成績單</div>
        <div style="font-size:3rem; font-weight:800; color:var(--primary); line-height:1.1;">${score} <span style="font-size:1.2rem; font-weight:500;">分</span></div>
        <div style="display:inline-block; background:var(--accent); color:#ffffff; font-weight:700; padding:4px 16px; border-radius:var(--radius-full); margin:10px 0; font-size:1rem;">${rankTitle}</div>
        <p style="font-size:0.9rem; color:var(--ink-secondary); max-width:500px; margin:0 auto;">${rankDesc}</p>
        <div style="margin-top:14px; font-size:0.8rem; color:var(--muted);">答對題數：${correctCount} / 10 題｜歷史最高：${Math.max(score, prevBest)} 分</div>
      </div>

      <h3 style="font-size:1.05rem; font-family:var(--font-heading); margin-bottom:14px;">📝 本次測驗試題全詳解</h3>
    `;

    this.activeQuestions.forEach((q, idx) => {
      const userAns = this.userAnswers[q.id];
      const isCorrect = userAns === q.correctId;
      resultHtml += `
        <div class="quiz-item" style="border-left: 4px solid ${isCorrect ? "var(--success)" : "var(--danger)"};">
          <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
            <span style="font-weight:700; font-size:0.95rem;">第 ${idx + 1} 題：${q.question}</span>
            <span style="font-size:0.8rem; font-weight:600; color:${isCorrect ? "var(--success)" : "var(--danger)"};">${isCorrect ? "✅ 答對" : "❌ 答錯"}</span>
          </div>
          <div style="font-size:0.82rem; color:var(--muted); margin-bottom:10px;">出自島嶼：${q.fromIsland}</div>
          <div style="font-size:0.88rem; line-height:1.6; margin-bottom:8px;">
            <strong>您的選擇：</strong> ${userAns ? userAns : "（未作答）"} ｜ <strong>正確解答：</strong> (${q.correctId})
          </div>
          <div class="note-box" style="margin:6px 0 0; font-size:0.85rem; line-height:1.5;">
            💡 <strong>深度解析：</strong> ${q.explanation}
          </div>
        </div>
      `;
    });

    resultHtml += `
      <div style="display:flex; justify-content:center; gap:12px; margin-top:24px;">
        <button class="action-pill primary" id="btn-play-again-center">再測驗一次</button>
        <button class="btn-secondary modal-close-btn">關閉總複習</button>
      </div>
    `;

    this.modalBody.innerHTML = resultHtml;
    this.modalBody.scrollTop = 0;

    this.modalBody.querySelector("#btn-play-again-center")?.addEventListener("click", () => {
      this.startNewQuiz();
    });

    const newCloseBtns = this.modalBody.querySelectorAll(".modal-close-btn");
    newCloseBtns.forEach(btn => btn.addEventListener("click", () => this.close()));
  }
}
