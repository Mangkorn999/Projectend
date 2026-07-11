// Gamified Quiz Engine (quiz.js)

let questions = [];
let currentQuestionIdx = 0;
let lives = 3;
let score = 0;
let isAnswered = false;
let roundXPEarned = 0;

document.addEventListener("DOMContentLoaded", () => {
  // Load questions dataset from data.js
  questions = window.quizQuestions || [];
  
  initQuizEvents();
});

function initQuizEvents() {
  const startBtn = document.getElementById("start-quiz-btn");
  const retryBtn = document.getElementById("retry-quiz-btn");
  const nextBtn = document.getElementById("next-question-btn");

  if (startBtn) {
    startBtn.addEventListener("click", startQuiz);
  }

  if (retryBtn) {
    retryBtn.addEventListener("click", resetQuiz);
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", handleNextQuestion);
  }
}

function startQuiz() {
  document.getElementById("quiz-start-screen").classList.add("hidden");
  document.getElementById("quiz-active-screen").classList.remove("hidden");
  document.getElementById("quiz-end-screen").classList.add("hidden");
  
  resetQuizVariables();
  renderQuestion(currentQuestionIdx);
}

function resetQuizVariables() {
  currentQuestionIdx = 0;
  lives = 3;
  score = 0;
  isAnswered = false;
  roundXPEarned = 0;
  updateHeartsDisplay();
}

function resetQuiz() {
  startQuiz();
}

function updateHeartsDisplay() {
  const container = document.getElementById("hearts-container");
  if (!container) return;

  container.innerHTML = "";
  for (let i = 0; i < 3; i++) {
    const heart = document.createElement("span");
    heart.className = "text-base transition-all duration-300";
    if (i < lives) {
      heart.textContent = "❤️";
    } else {
      heart.textContent = "🖤";
      heart.className += " opacity-30 scale-90";
    }
    container.appendChild(heart);
  }
}

// Render active question and options
function renderQuestion(idx) {
  isAnswered = false;
  const q = questions[idx];
  if (!q) return;

  // Hide Explainer
  document.getElementById("quiz-explainer-panel").classList.add("hidden");

  // Progress Bar
  const progressPercent = Math.round((idx / questions.length) * 100);
  document.getElementById("quiz-progress-fill").style.width = `${progressPercent}%`;

  // Info Badges
  document.getElementById("question-index-badge").textContent = `${idx + 1} / ${questions.length}`;
  
  const langBadge = document.getElementById("question-lang-badge");
  langBadge.textContent = q.language === "js" ? "JavaScript" 
                        : q.language === "py" ? "Python" 
                        : q.language === "java" ? "Java" 
                        : q.language === "c" ? "C" 
                        : q.language === "csharp" ? "C#" 
                        : "ทั่วไป";

  // Question Text
  document.getElementById("question-title").textContent = q.question;

  // Option Choices List
  const optionsContainer = document.getElementById("quiz-options-container");
  optionsContainer.innerHTML = "";

  q.options.forEach((optText, index) => {
    const btn = document.createElement("button");
    btn.className = "w-full text-left p-4 rounded-xl border border-slate-800 bg-slate-950/60 hover:bg-slate-800/40 hover:border-slate-700 text-slate-300 text-sm font-medium transition-all duration-200 flex items-center justify-between group";
    btn.innerHTML = `
      <span>${optText}</span>
      <span class="w-5 h-5 rounded-full border border-slate-700 group-hover:border-slate-500 flex items-center justify-center text-xs text-transparent"></span>
    `;

    btn.addEventListener("click", () => {
      handleAnswerSelection(index, btn);
    });

    optionsContainer.appendChild(btn);
  });
}

// Check selected answer
function handleAnswerSelection(selectedIdx, clickedBtn) {
  if (isAnswered) return;
  isAnswered = true;

  const q = questions[currentQuestionIdx];
  const isCorrect = selectedIdx === q.answer;

  const optionsContainer = document.getElementById("quiz-options-container");
  const buttons = optionsContainer.querySelectorAll("button");

  // Style buttons based on correct/incorrect choice
  buttons.forEach((btn, idx) => {
    // Disable hover states
    btn.classList.remove("hover:bg-slate-800/40", "hover:border-slate-700");
    btn.classList.add("cursor-default");

    const circle = btn.querySelector("span:last-child");

    if (idx === q.answer) {
      // Highlight the correct answer in green
      btn.classList.remove("border-slate-800", "bg-slate-950/60");
      btn.classList.add("border-emerald-500/50", "bg-emerald-500/10", "text-emerald-300");
      circle.className = "w-5 h-5 rounded-full bg-emerald-500/20 border-emerald-500 flex items-center justify-center text-xs text-emerald-400 font-bold";
      circle.textContent = "✓";
    }

    if (idx === selectedIdx && !isCorrect) {
      // Highlight incorrect choice in red
      btn.classList.remove("border-slate-800", "bg-slate-950/60");
      btn.classList.add("border-rose-500/50", "bg-rose-500/10", "text-rose-300");
      circle.className = "w-5 h-5 rounded-full bg-rose-500/20 border-rose-500 flex items-center justify-center text-xs text-rose-400 font-bold";
      circle.textContent = "✗";
    }
  });

  // Handle Score and Lives
  const statusIcon = document.getElementById("explain-status-icon");
  const statusText = document.getElementById("explain-status-text");

  if (isCorrect) {
    score++;
    roundXPEarned += 20;
    window.addXP(20);

    statusIcon.textContent = "✅";
    statusText.textContent = "ถูกต้องที่สุด!";
    statusText.className = "text-xs font-bold uppercase tracking-wider text-emerald-400";
  } else {
    lives--;
    updateHeartsDisplay();

    statusIcon.textContent = "❌";
    statusText.textContent = "ยังไม่ถูกต้องนะคะ";
    statusText.className = "text-xs font-bold uppercase tracking-wider text-rose-400";

    // Play slight screen shake effect
    const container = document.getElementById("quiz-game-container");
    container.classList.add("animate-shake");
    setTimeout(() => container.classList.remove("animate-shake"), 300);
  }

  // Show detailed explainer
  document.getElementById("explain-body").textContent = q.explanation;
  const explainerPanel = document.getElementById("quiz-explainer-panel");
  explainerPanel.classList.remove("hidden");

  // Check if player died
  if (lives <= 0) {
    document.getElementById("next-question-btn").textContent = "ดูผลลัพธ์การประลอง ☠️";
  } else if (currentQuestionIdx === questions.length - 1) {
    document.getElementById("next-question-btn").textContent = "เสร็จสิ้นและตรวจคะแนน 🏆";
  } else {
    document.getElementById("next-question-btn").textContent = "ข้อถัดไป ➔";
  }
}

function handleNextQuestion() {
  if (lives <= 0 || currentQuestionIdx === questions.length - 1) {
    endQuiz();
  } else {
    currentQuestionIdx++;
    renderQuestion(currentQuestionIdx);
  }
}

// Quiz completion / Death state
async function endQuiz() {
  document.getElementById("quiz-active-screen").classList.add("hidden");
  const endScreen = document.getElementById("quiz-end-screen");
  endScreen.classList.remove("hidden");

  const endIcon = document.getElementById("end-status-icon");
  const endTitle = document.getElementById("end-title");
  const endDesc = document.getElementById("end-desc");

  if (lives <= 0) {
    endIcon.textContent = "💀";
    endIcon.className = "w-20 h-20 bg-rose-500/10 text-rose-400 text-4xl rounded-2xl border border-rose-500/20 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-rose-500/5";
    endTitle.textContent = "พลังชีวิตหมดเสียก่อน!";
    endDesc.textContent = "เสียใจด้วยนะคะ ลอจิกของคุณยังมีช่องโหว่ ลองย้อนกลับไปอ่านไวยากรณ์เปรียบเทียบในหน้าหลักแล้วกลับมาท้าทายใหม่ดูนะ!";
  } else {
    endIcon.textContent = "🏆";
    endIcon.className = "w-20 h-20 bg-emerald-500/10 text-emerald-400 text-4xl rounded-2xl border border-emerald-500/20 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-500/5";
    endTitle.textContent = "การประลองเสร็จสมบูรณ์!";
    endDesc.textContent = "สุดยอดไปเลย! ความขยันและใส่ใจวิเคราะห์รายละเอียดทำให้ระดับทักษะโปรแกรมมิ่งของคุณเพิ่มขึ้นอย่างแน่นอน!";
    
    // Unlocked achievements / rewards bonus
    if (score === questions.length) {
      roundXPEarned += 50; // Perfect score bonus!
      window.addXP(50);
      window.showToast("🌟 ปลดล็อกเหรียญตรา: Perfect Score! (+50 XP โบนัส)");
    }
  }

  // Display Score ratio and round XP rewards
  document.getElementById("end-score-ratio").textContent = `${score} / ${questions.length}`;
  document.getElementById("end-xp-reward").textContent = `+${roundXPEarned} XP`;

  // Save score logs to backend via API (falls back to localStorage automatically)
  try {
    await window.apiRequest('/score.php', 'POST', {
      quizId: 'general_battle',
      score: score,
      total: questions.length
    });
  } catch (err) {
    console.error("Failed to log score to API:", err);
  }
}
