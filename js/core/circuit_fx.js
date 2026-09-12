// ============================================================
// circuit_fx.js — Futuristic Neon Circuit Loading FX & Boot Controller
// ============================================================
(function () {
  'use strict';

  function dismissBoot() {
    const boot = document.getElementById('circuitAppBoot');
    if (!boot) return;
    boot.classList.add('loaded');
    setTimeout(() => {
      try { boot.remove(); } catch (e) {}
    }, 450);
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(dismissBoot, 350);
  } else {
    window.addEventListener('DOMContentLoaded', () => setTimeout(dismissBoot, 350));
    window.addEventListener('load', () => setTimeout(dismissBoot, 200));
  }
  // Fail-safe
  setTimeout(dismissBoot, 1200);

  let timer = null;

  function getGlowEl() {
    const bar = document.getElementById('circuitTopBar');
    return bar ? bar.querySelector('.circuit-progress-glow') : null;
  }

  window.FrpCircuit = {
    start() {
      const glow = getGlowEl();
      if (!glow) return;
      clearTimeout(timer);
      glow.style.opacity = '1';
      glow.style.width = '35%';
      timer = setTimeout(() => {
        const g = getGlowEl();
        if (g) g.style.width = '75%';
      }, 200);
    },
    progress(percent) {
      const glow = getGlowEl();
      if (!glow) return;
      clearTimeout(timer);
      glow.style.opacity = '1';
      glow.style.width = Math.min(100, Math.max(0, percent)) + '%';
    },
    done() {
      const glow = getGlowEl();
      if (!glow) return;
      clearTimeout(timer);
      glow.style.width = '100%';
      timer = setTimeout(() => {
        const g = getGlowEl();
        if (g) {
          g.style.opacity = '0';
          setTimeout(() => {
            const finalGlow = getGlowEl();
            if (finalGlow) finalGlow.style.width = '0%';
          }, 250);
        }
      }, 320);
    },
    dismissBoot
  };
})();
