// Common utility scripts for SyntaxCraft (Navbar/Footer injector)

document.addEventListener("DOMContentLoaded", () => {
  // Inject navbar and footer dynamically
  initPageLayout();
});

async function initPageLayout() {
  const navContainer = document.getElementById("navbar-container");
  const footerContainer = document.getElementById("footer-container");

  // Determine path offset based on structure
  // Since our pages are inside frontend/pages/ and components are inside frontend/components/
  // The path relative to index.html/visualizer.html (inside pages/) to components is '../components/'
  const componentsPath = '../components/';

  if (navContainer) {
    try {
      const response = await fetch(componentsPath + 'navbar.html');
      if (response.ok) {
        navContainer.innerHTML = await response.text();
        highlightActiveNavLink();
        setupMobileMenu();
        updateXPDisplay();
      } else {
        console.error("Failed to load navbar.html status:", response.status);
      }
    } catch (e) {
      console.error("Error loading navbar.html:", e);
    }
  }

  if (footerContainer) {
    try {
      const response = await fetch(componentsPath + 'footer.html');
      if (response.ok) {
        footerContainer.innerHTML = await response.text();
      } else {
        console.error("Failed to load footer.html status:", response.status);
      }
    } catch (e) {
      console.error("Error loading footer.html:", e);
    }
  }
}

function highlightActiveNavLink() {
  const path = window.location.pathname;
  const page = path.substring(path.lastIndexOf('/') + 1) || 'index.html';
  
  // Extract key keyword (index, visualizer, playground, quiz)
  let pageKey = 'index';
  if (page.includes('visualizer')) pageKey = 'visualizer';
  else if (page.includes('playground')) pageKey = 'playground';
  else if (page.includes('quiz')) pageKey = 'quiz';

  const links = document.querySelectorAll(".nav-link");
  links.forEach(link => {
    const dataNav = link.getAttribute("data-nav");
    if (dataNav === pageKey) {
      link.classList.remove("text-slate-300", "hover:bg-slate-800/50");
      link.classList.add("text-white", "bg-indigo-600/90", "shadow-sm", "shadow-indigo-500/20");
    }
  });
}

function setupMobileMenu() {
  const btn = document.getElementById("mobile-menu-btn");
  const menu = document.getElementById("mobile-menu");
  if (btn && menu) {
    btn.addEventListener("click", () => {
      const expanded = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", !expanded);
      menu.classList.toggle("hidden");
    });
  }
}

// XP Points Manager
function addXP(amount) {
  const currentXP = parseInt(localStorage.getItem('syntaxcraft_xp') || '0');
  const newXP = currentXP + amount;
  localStorage.setItem('syntaxcraft_xp', newXP.toString());
  updateXPDisplay();
  
  // Show standard toast notification
  showToast(`🎉 ได้รับ +${amount} XP!`);
}

function updateXPDisplay() {
  const currentXP = localStorage.getItem('syntaxcraft_xp') || '0';
  const xpNav = document.getElementById("nav-xp-display");
  const xpMobile = document.getElementById("mobile-xp-display");
  if (xpNav) xpNav.textContent = `XP: ${currentXP}`;
  if (xpMobile) xpMobile.textContent = `XP: ${currentXP}`;
}

// Global Toast utility
function showToast(message) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'bg-slate-900 border border-slate-800 text-white font-medium text-sm px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 transform translate-y-4 opacity-0 transition-all duration-300 pointer-events-auto';
  toast.innerHTML = `
    <span class="text-indigo-400">✨</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  
  // Force reflow
  toast.offsetHeight;

  toast.classList.remove('translate-y-4', 'opacity-0');
  toast.classList.add('translate-y-0', 'opacity-100');

  setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('translate-y-4', 'opacity-0');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

// Expose functions globally
window.addXP = addXP;
window.updateXPDisplay = updateXPDisplay;
window.showToast = showToast;
