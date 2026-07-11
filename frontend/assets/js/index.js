// JS Logic for Language Hub (index.html)

let activeCategory = "variables";
let activeLangs = ["js", "py"]; // Default visible languages

const langMetadata = {
  js: { name: "JavaScript", color: "text-yellow-400 border-yellow-400/20 bg-yellow-400/5", glowClass: "text-glow-js" },
  py: { name: "Python", color: "text-sky-400 border-sky-400/20 bg-sky-400/5", glowClass: "text-glow-py" },
  java: { name: "Java", color: "text-orange-500 border-orange-500/20 bg-orange-500/5", glowClass: "text-glow-java" },
  c: { name: "C", color: "text-slate-400 border-slate-400/20 bg-slate-400/5", glowClass: "text-glow-c" },
  csharp: { name: "C#", color: "text-purple-400 border-purple-400/20 bg-purple-400/5", glowClass: "text-glow-csharp" }
};

document.addEventListener("DOMContentLoaded", () => {
  // Load saved preferences if available
  const savedLangs = localStorage.getItem("syntaxcraft_active_langs");
  if (savedLangs) {
    try {
      activeLangs = JSON.parse(savedLangs);
      if (activeLangs.length === 0) activeLangs = ["js", "py"];
    } catch (e) {
      activeLangs = ["js", "py"];
    }
  }

  const savedCategory = localStorage.getItem("syntaxcraft_active_category");
  if (savedCategory) {
    activeCategory = savedCategory;
  }

  // Load dashboards and statistics
  loadStats();
  renderCategories();
  renderLanguageSelectors();
  renderComparisonGrid();

  // Listen to custom XP adjustments to update homepage stats instantly
  window.addEventListener("storage", loadStats);
});

// Calculate user achievements & stats
async function loadStats() {
  // Fetch via standard apiRequest (falls back to local storage)
  const scoreRes = await window.apiRequest('/score.php', 'GET');
  const progressRes = await window.apiRequest('/progress.php', 'GET');

  const xp = parseInt(localStorage.getItem('syntaxcraft_xp') || '0');
  const level = Math.floor(xp / 100) + 1;
  const xpNeeded = level * 100;
  
  const statsLevel = document.getElementById("stats-level");
  if (statsLevel) {
    statsLevel.innerHTML = `Lv. ${level} <span class="text-xs text-indigo-400 font-normal">(${xp}/${xpNeeded} XP)</span>`;
  }

  // Answered quizzes count
  const completedQuizzes = scoreRes?.data?.length || 0;
  const statsQuiz = document.getElementById("stats-quiz");
  if (statsQuiz) {
    statsQuiz.textContent = `${completedQuizzes} ชุด`;
  }

  // Progress calculating
  const readTopics = JSON.parse(localStorage.getItem('syntaxcraft_read_topics') || '[]');
  const totalTopics = window.syntaxData ? window.syntaxData.length : 5;
  const progressPercentage = Math.round((readTopics.length / totalTopics) * 100);
  
  const statsProgress = document.getElementById("stats-progress");
  if (statsProgress) {
    statsProgress.textContent = `${progressPercentage}%`;
  }
}

// Render the sidebar category navigation
function renderCategories() {
  const container = document.getElementById("category-list");
  if (!container || !window.syntaxData) return;

  container.innerHTML = "";
  window.syntaxData.forEach(item => {
    const isActive = item.id === activeCategory;
    const btn = document.createElement("button");
    btn.className = `w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 flex items-center justify-between group ${
      isActive 
        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/10" 
        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
    }`;
    btn.innerHTML = `
      <span>${item.title.split(' ')[0]} ${item.title.split(' ').slice(1).join(' ')}</span>
      <span class="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-indigo-400 group-hover:translate-x-1 transform transition-transform">➔</span>
    `;

    btn.addEventListener("click", () => {
      // Mark concept as read & reward XP if first time
      markTopicAsRead(item.id);
      
      activeCategory = item.id;
      localStorage.setItem("syntaxcraft_active_category", activeCategory);
      renderCategories();
      renderComparisonGrid();
    });

    container.appendChild(btn);
  });
}

// Render the toggle pill buttons for selecting active languages
function renderLanguageSelectors() {
  const container = document.getElementById("lang-selector-container");
  if (!container) return;

  container.innerHTML = "";
  Object.keys(langMetadata).forEach(langKey => {
    const isSelected = activeLangs.includes(langKey);
    const meta = langMetadata[langKey];
    
    const btn = document.createElement("button");
    btn.className = `px-4 py-2 rounded-xl text-xs font-semibold border transition-all duration-200 flex items-center gap-2 ${
      isSelected 
        ? "bg-indigo-600/20 text-indigo-300 border-indigo-500 shadow-md shadow-indigo-500/5 scale-105" 
        : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-300"
    }`;
    
    // Add visual indicator dots matching language styling
    btn.innerHTML = `
      <span class="w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-indigo-400' : 'bg-slate-600'}"></span>
      ${meta.name}
    `;

    btn.addEventListener("click", () => {
      if (isSelected) {
        // Prevent deselecting all languages
        if (activeLangs.length <= 1) {
          window.showToast("ต้องเลือกเปรียบเทียบอย่างน้อย 1 ภาษาค่ะ");
          return;
        }
        activeLangs = activeLangs.filter(l => l !== langKey);
      } else {
        activeLangs.push(langKey);
      }
      
      localStorage.setItem("syntaxcraft_active_langs", JSON.stringify(activeLangs));
      renderLanguageSelectors();
      renderComparisonGrid();
    });

    container.appendChild(btn);
  });
}

// Render side-by-side columns containing actual code comparison
function renderComparisonGrid() {
  const grid = document.getElementById("comparison-grid");
  const conceptTitle = document.getElementById("concept-title");
  const conceptDesc = document.getElementById("concept-desc");
  
  if (!grid || !window.syntaxData) return;

  const concept = window.syntaxData.find(c => c.id === activeCategory);
  if (!concept) return;

  // Set header info
  conceptTitle.innerHTML = concept.title;
  conceptDesc.innerHTML = concept.desc;

  grid.innerHTML = "";
  
  activeLangs.forEach(langKey => {
    const langData = concept.languages[langKey];
    if (!langData) return;

    const meta = langMetadata[langKey];
    const column = document.createElement("div");
    column.className = "bg-slate-900 border border-slate-800/80 rounded-2xl p-5 flex flex-col hover:border-slate-700/80 transition-all duration-300 shadow-lg relative overflow-hidden group";
    
    // Aesthetic subtle top border glow
    column.innerHTML = `
      <div class="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-slate-700 to-transparent opacity-30"></div>
      
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-lg text-white flex items-center gap-2">
          <span class="px-2.5 py-1 text-xs rounded-lg font-mono tracking-wide ${meta.color} ${meta.glowClass}">
            ${meta.name}
          </span>
        </h3>
        <button class="copy-btn text-xs text-slate-500 hover:text-slate-300 font-medium px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg hover:bg-slate-800 transition-all duration-200">
          คัดลอกโค้ด
        </button>
      </div>

      <!-- Code editor container with custom syntax styling -->
      <div class="bg-slate-950 rounded-xl border border-slate-850 p-4 font-mono text-xs overflow-x-auto leading-relaxed text-indigo-200 select-all mb-4 relative">
        <pre class="whitespace-pre">${escapeHTML(langData.code)}</pre>
      </div>

      <!-- Explanation -->
      <div class="mt-auto border-t border-slate-850 pt-4">
        <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">📌 คำอธิบายเจาะลึก</h4>
        <p class="text-slate-300 text-sm leading-relaxed">${langData.explanation}</p>
      </div>
    `;

    // Add copy event listener
    const copyBtn = column.querySelector(".copy-btn");
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(langData.code)
        .then(() => {
          copyBtn.textContent = "คัดลอกแล้ว! ✓";
          copyBtn.classList.add("text-indigo-400", "border-indigo-500/25");
          setTimeout(() => {
            copyBtn.textContent = "คัดลอกโค้ด";
            copyBtn.classList.remove("text-indigo-400", "border-indigo-500/25");
          }, 1500);
        })
        .catch(err => {
          window.showToast("ไม่สามารถคัดลอกโค้ดได้: " + err);
        });
    });

    grid.appendChild(column);
  });
}

// Track topic reading behavior
function markTopicAsRead(topicId) {
  const readTopics = JSON.parse(localStorage.getItem('syntaxcraft_read_topics') || '[]');
  if (!readTopics.includes(topicId)) {
    readTopics.push(topicId);
    localStorage.setItem('syntaxcraft_read_topics', JSON.stringify(readTopics));
    
    // Reward user for learning!
    window.addXP(20);
    loadStats(); // Update dashboard metric
  }
}

function escapeHTML(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
