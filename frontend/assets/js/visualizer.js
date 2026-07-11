// Logic & Algorithm Visualizer Engine (visualizer.js)

let currentAlgo = "bubbleSort";
let currentStepIdx = 0;
let steps = [];
let playInterval = null;
let animationSpeed = 1000; // ms

// Algorithm-specific configurations
const algoMeta = {
  bubbleSort: {
    time: "O(N²)",
    space: "O(1)",
    learnExp: "Bubble Sort ทำงานโดยเปรียบเทียบค่าเป็นคู่ๆ สลับตำแหน่งให้ค่ามากไปอยู่ทางขวาหลังจบรอบ เราจะเห็นว่าตัวเลขที่มากที่สุดจะค่อยๆ ลอยขึ้นมาต่อท้าย (เหมือนฟองอากาศ) ทำแบบนี้จำนวน N รอบ เหมาะสำหรับทำความเข้าใจลูปซ้อนกันสองชั้น (Nested Loops)"
  },
  binarySearch: {
    time: "O(log N)",
    space: "O(1)",
    learnExp: "Binary Search เป็นการค้นหาข้อมูลในอาร์เรย์ที่เรียงลำดับแล้วอย่างรวดเร็ว โดยคำนวณตำแหน่งกึ่งกลาง (mid) เปรียบเทียบกับเป้าหมาย แล้วปรับขอบเขตซ้าย (low) หรือขวา (high) ทำให้ข้อมูลที่จะต้องค้นหาถูกหดสั้นลงทีละครึ่งหนึ่งในทุกขั้นตอน"
  },
  recursion: {
    time: "O(N)",
    space: "O(N)",
    learnExp: "Recursion (ฟังก์ชันเรียกตัวเอง) จะทำการผลักภารกิจประมวลผลย่อยๆ ลงไปในโครงสร้างหน่วยความจำกองซ้อน (Call Stack) จนกว่าจะถึงจุดสิ้นสุด (Base Case) จากนั้นจะค่อยๆ คำนวณคำตอบส่งสะท้อนย้อนกลับขึ้นมารวมผลลัพธ์จนครบถ้วน"
  }
};

document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initControls();
  loadAlgorithm(currentAlgo);
});

// Setup Tab Switching
function initTabs() {
  const tabs = document.querySelectorAll(".algo-tab-btn");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => {
        t.className = "algo-tab-btn px-5 py-3 rounded-xl text-sm font-semibold border transition-all duration-300 flex items-center gap-2 bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-300";
      });
      tab.className = "algo-tab-btn px-5 py-3 rounded-xl text-sm font-semibold border transition-all duration-300 flex items-center gap-2 bg-indigo-600/20 text-indigo-300 border-indigo-500 shadow-md";
      
      const algoKey = tab.getAttribute("data-algo");
      loadAlgorithm(algoKey);
    });
  });
}

// Load chosen algorithm dataset and initialize steps
function loadAlgorithm(algoKey) {
  currentAlgo = algoKey;
  currentStepIdx = 0;
  stopAutoPlay();
  
  const data = window.visualizerData[algoKey];
  const meta = algoMeta[algoKey];
  if (!data) return;

  // Set general information
  document.getElementById("algo-title").textContent = data.title;
  document.getElementById("time-complexity").textContent = meta.time;
  document.getElementById("space-complexity").textContent = meta.space;
  document.getElementById("algo-learn-explanation").textContent = meta.learnExp;

  // Render Pseudocode
  renderPseudocode(data.pseudocode);

  // Generate simulation trace steps
  if (algoKey === "bubbleSort") {
    steps = data.generateSteps(data.initialArray);
  } else if (algoKey === "binarySearch") {
    steps = data.generateSteps(data.initialArray, data.target);
  } else if (algoKey === "recursion") {
    steps = data.generateSteps(data.n);
  }

  renderStep(0);
}

// Render Pseudocode into line-by-line HTML elements
function renderPseudocode(pseudocode) {
  const container = document.getElementById("code-trace-block");
  if (!container) return;

  container.innerHTML = "";
  const lines = pseudocode.split("\n");
  lines.forEach((line, index) => {
    const lineDiv = document.createElement("div");
    lineDiv.id = `code-line-${index}`;
    lineDiv.className = "px-3 py-1.5 rounded-lg transition-colors duration-200 flex gap-4 border border-transparent font-mono";
    lineDiv.innerHTML = `
      <span class="text-slate-650 w-5 select-none font-semibold text-right">${index + 1}</span>
      <span class="whitespace-pre">${escapeHTML(line)}</span>
    `;
    container.appendChild(lineDiv);
  });
}

// Render specific step visual representations and updates
function renderStep(idx) {
  currentStepIdx = idx;
  const step = steps[idx];
  if (!step) return;

  // Update Counters & Logs
  document.getElementById("step-counter").textContent = `สเต็ปที่: ${idx + 1} / ${steps.length}`;
  document.getElementById("step-description").textContent = step.desc;

  // Update Pseudocode Highlights
  const codeLines = document.querySelectorAll("[id^='code-line-']");
  codeLines.forEach(l => {
    l.classList.remove("bg-indigo-600/25", "text-white", "border-indigo-500/30");
    l.classList.add("text-slate-400");
  });

  if (step.highlights) {
    step.highlights.forEach(lineIdx => {
      const activeLine = document.getElementById(`code-line-${lineIdx}`);
      if (activeLine) {
        activeLine.classList.remove("text-slate-400");
        activeLine.classList.add("bg-indigo-600/25", "text-white", "border-indigo-500/30");
      }
    });
  }

  // Render Visual Arena elements based on active Algorithm
  renderVisualArena(step);

  // Render Variable Inspector panel
  renderVariableInspector(step);

  // Handle XP award when user reaches the last final step
  if (idx === steps.length - 1) {
    stopAutoPlay();
    awardAlgoXP(currentAlgo);
  }
}

// Draw graphic elements in the arena
function renderVisualArena(step) {
  const arena = document.getElementById("visualizer-arena");
  if (!arena) return;

  arena.innerHTML = "";

  if (currentAlgo === "bubbleSort") {
    // Render Array Bars
    const maxVal = Math.max(...step.array);
    step.array.forEach((val, i) => {
      const container = document.createElement("div");
      container.className = "flex flex-col items-center flex-1 max-w-[50px] transition-all duration-300";
      
      const height = (val / maxVal) * 120 + 20; // scale between 20px and 140px
      
      // Determine bar colors matching state
      let barColor = "bg-slate-700 border-slate-600 text-slate-300";
      let labelText = "";

      if (step.comparing.includes(i)) {
        barColor = step.swapped 
          ? "bg-rose-500 border-rose-400 shadow-lg shadow-rose-500/20 text-white" 
          : "bg-amber-500 border-amber-400 shadow-lg shadow-amber-500/20 text-white";
        labelText = step.swapped ? "Swap!" : "Compare";
      } else if (i >= step.array.length - step.i) {
        // Sorted elements at the end
        barColor = "bg-emerald-500/20 border-emerald-500/40 text-emerald-300";
        labelText = "Sorted";
      }

      container.innerHTML = `
        <span class="text-xs font-mono font-semibold text-slate-400 mb-1.5">${val}</span>
        <div style="height: ${height}px;" class="w-full rounded-lg border flex flex-col justify-end items-center pb-2 transition-all duration-300 ${barColor}">
          <span class="text-[9px] uppercase tracking-wider font-bold opacity-85 select-none rotate-90 origin-center translate-y-[-10px] text-center">${labelText}</span>
        </div>
        <span class="text-[10px] font-mono text-slate-500 mt-2">idx ${i}</span>
      `;
      arena.appendChild(container);
    });
  } 
  
  else if (currentAlgo === "binarySearch") {
    // Render Sorted Array Blocks with Low/High/Mid pointers
    step.array.forEach((val, i) => {
      const isOutsideScope = i < step.low || i > step.high;
      const isMid = i === step.mid;
      const isLow = i === step.low;
      const isHigh = i === step.high;

      const block = document.createElement("div");
      block.className = `w-10 h-14 sm:w-12 sm:h-16 rounded-xl border flex flex-col justify-center items-center font-bold text-sm relative transition-all duration-300 ${
        isOutsideScope 
          ? "opacity-25 bg-slate-950 border-slate-900 text-slate-650" 
          : isMid 
            ? "bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-500/20 scale-110 z-10"
            : "bg-slate-900 border-slate-800 text-slate-200"
      }`;

      // Pointers markers on top and bottom
      let pointersHTML = "";
      if (!isOutsideScope) {
        if (isLow && isHigh && isLow === isHigh) {
          pointersHTML += `<span class="absolute -top-6 text-[9px] font-bold text-yellow-400 tracking-wider">L & H</span>`;
        } else {
          if (isLow) pointersHTML += `<span class="absolute -top-6 text-[9px] font-bold text-amber-500 tracking-wider">LOW</span>`;
          if (isHigh) pointersHTML += `<span class="absolute -top-6 text-[9px] font-bold text-rose-500 tracking-wider">HIGH</span>`;
        }
        if (isMid) pointersHTML += `<span class="absolute -bottom-6 text-[9px] font-bold text-indigo-400 tracking-wider animate-bounce">MID</span>`;
      }

      block.innerHTML = `
        ${pointersHTML}
        <span>${val}</span>
        <span class="text-[9px] text-slate-500 font-mono mt-1 font-normal">idx ${i}</span>
      `;
      arena.appendChild(block);
    });
  } 
  
  else if (currentAlgo === "recursion") {
    // Render Call Stack pile representation
    const stackContainer = document.createElement("div");
    stackContainer.className = "flex flex-col-reverse gap-2 w-full max-w-[320px] mx-auto transition-all duration-300";

    if (step.stack && step.stack.length > 0) {
      step.stack.forEach((frame, idx) => {
        const frameDiv = document.createElement("div");
        const isActiveFrame = idx === step.stack.length - 1;
        
        frameDiv.className = `p-3.5 rounded-xl border font-mono text-xs flex justify-between items-center transition-all duration-300 ${
          isActiveFrame 
            ? "bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-500/25 scale-105" 
            : "bg-slate-900 border-slate-850 text-slate-400"
        }`;
        frameDiv.innerHTML = `
          <span class="font-bold">${frame.text}</span>
          <span class="text-[9px] px-2 py-0.5 rounded bg-black/30 text-indigo-200">Level ${frame.level}</span>
        `;
        stackContainer.appendChild(frameDiv);
      });
      arena.appendChild(stackContainer);
    } else {
      // Empty Stack state representation
      const emptyDiv = document.createElement("div");
      emptyDiv.className = "flex flex-col items-center justify-center py-8 text-slate-500 text-sm font-medium w-full text-center";
      emptyDiv.innerHTML = `
        <span class="text-4xl mb-2">📁</span>
        <span>Call Stack ว่างเปล่า</span>
      `;
      arena.appendChild(emptyDiv);
    }
  }
}

// Update the inspect variables table
function renderVariableInspector(step) {
  const container = document.getElementById("variable-inspector");
  if (!container) return;

  container.innerHTML = "";
  
  let variables = {};
  if (currentAlgo === "bubbleSort") {
    variables = {
      "i (รอบหลัก)": step.i,
      "j (ตำแหน่งเปรียบเทียบ)": step.j === -1 ? "N/A" : step.j,
      "comparing (คู่เปรียบเทียบ)": step.comparing[0] === -1 ? "ไม่มี" : `[${step.comparing.join(', ')}]`,
      "swapped (มีการสลับค่า)": step.swapped ? "✅ จริง" : "❌ เท็จ"
    };
  } else if (currentAlgo === "binarySearch") {
    variables = {
      "low (ช่วงเริ่มต้น)": step.low,
      "high (ช่วงลงท้าย)": step.high,
      "mid (ตำแหน่งกึ่งกลาง)": step.mid === -1 ? "N/A" : step.mid,
      "target (เป้าหมายค้นหา)": 23
    };
  } else if (currentAlgo === "recursion") {
    variables = {
      "n (พารามิเตอร์)": step.n,
      "stack.length (ขนาดกองซ้อน)": step.stack ? step.stack.length : 0,
      "phase (ช่วงการทำงาน)": step.phase === "CALL" ? "📥 กำลังยัดเข้า Stack" : step.phase === "BASE" ? "🛑 ชนจุดสิ้นสุด" : "📤 กำลังดึงออก / ส่งผลลัพธ์",
      "returnValue (ส่งค่ากลับ)": step.returnValue !== undefined ? step.returnValue : "ยังไม่ส่งกลับ"
    };
  }

  Object.keys(variables).forEach(varName => {
    const box = document.createElement("div");
    box.className = "bg-slate-950/80 border border-slate-850 px-3.5 py-3 rounded-xl";
    box.innerHTML = `
      <span class="text-[10px] text-slate-500 font-medium block">${varName}</span>
      <span class="text-sm font-bold text-indigo-300 font-mono mt-1 block">${variables[varName]}</span>
    `;
    container.appendChild(box);
  });
}

// Controller buttons listeners setup
function initControls() {
  const prevBtn = document.getElementById("prev-btn");
  const playBtn = document.getElementById("play-btn");
  const nextBtn = document.getElementById("next-btn");
  const resetBtn = document.getElementById("reset-btn");
  const speedSlider = document.getElementById("speed-slider");
  const speedLabel = document.getElementById("speed-label");

  prevBtn.addEventListener("click", () => {
    stopAutoPlay();
    if (currentStepIdx > 0) renderStep(currentStepIdx - 1);
  });

  nextBtn.addEventListener("click", () => {
    stopAutoPlay();
    if (currentStepIdx < steps.length - 1) renderStep(currentStepIdx + 1);
  });

  resetBtn.addEventListener("click", () => {
    stopAutoPlay();
    renderStep(0);
  });

  playBtn.addEventListener("click", () => {
    if (playInterval) {
      stopAutoPlay();
    } else {
      startAutoPlay();
    }
  });

  speedSlider.addEventListener("input", (e) => {
    // Reverse values so min slider value is slower and max value is faster
    // Speed range: slider is min 300 to max 2000
    // 2300 - value to reverse: 300 slider -> 2000ms delay, 2000 slider -> 300ms delay
    const val = parseInt(e.target.value);
    animationSpeed = val;
    speedLabel.textContent = `${(val / 1000).toFixed(1)}s`;
    
    // If playing, restart interval with new speed
    if (playInterval) {
      stopAutoPlay();
      startAutoPlay();
    }
  });
}

function startAutoPlay() {
  const playBtn = document.getElementById("play-btn");
  playBtn.textContent = "⏸️ หยุดชั่วคราว";
  playBtn.classList.remove("bg-indigo-600", "hover:bg-indigo-500");
  playBtn.classList.add("bg-amber-600", "hover:bg-amber-500");

  // If already at end, reset to beginning
  if (currentStepIdx === steps.length - 1) {
    currentStepIdx = 0;
    renderStep(0);
  }

  playInterval = setInterval(() => {
    if (currentStepIdx < steps.length - 1) {
      renderStep(currentStepIdx + 1);
    } else {
      stopAutoPlay();
    }
  }, animationSpeed);
}

function stopAutoPlay() {
  const playBtn = document.getElementById("play-btn");
  if (!playBtn) return;
  playBtn.textContent = "▶ เล่นอัตโนมัติ";
  playBtn.classList.remove("bg-amber-600", "hover:bg-amber-500");
  playBtn.classList.add("bg-indigo-600", "hover:bg-indigo-500");

  if (playInterval) {
    clearInterval(playInterval);
    playInterval = null;
  }
}

// Reward XP on visualizer completion
function awardAlgoXP(algoKey) {
  const completedKey = `syntaxcraft_visualizer_comp_${algoKey}`;
  if (!localStorage.getItem(completedKey)) {
    localStorage.setItem(completedKey, "true");
    
    // Trigger custom window event to sync dashboard stats
    window.addXP(50);
  }
}

function escapeHTML(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
