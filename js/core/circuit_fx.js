// ============================================================
// circuit_fx.js — Kurumsal Modern Boot & Logout Splash Kontrolcüsü
// ============================================================
(function () {
  'use strict';

  const BOOT_START_TIME = Date.now();
  const MIN_BOOT_DURATION = 1200; // Zarif kurumsal geçiş için 1.2 sn
  let isDismissed = false;

  function dismissBoot() {
    if (isDismissed) return;
    const boot = document.getElementById('circuitAppBoot');
    if (!boot) return;

    const elapsed = Date.now() - BOOT_START_TIME;
    const remaining = Math.max(0, MIN_BOOT_DURATION - elapsed);

    setTimeout(() => {
      if (isDismissed) return;
      isDismissed = true;
      boot.classList.add('loaded');
      setTimeout(() => {
        try { boot.remove(); } catch (e) {}
      }, 450);
    }, remaining);
  }

  if (document.readyState === 'complete') {
    dismissBoot();
  } else {
    window.addEventListener('load', dismissBoot);
  }
  // Fail-safe (ağ gecikse de en geç 2.2 sn içinde aç)
  setTimeout(dismissBoot, 2200);

  let timer = null;

  function getGlowEl() {
    const bar = document.getElementById('circuitTopBar');
    return bar ? bar.querySelector('.circuit-progress-glow') : null;
  }

  function showLogoutSplash(onComplete) {
    let logoutOverlay = document.getElementById('circuitLogoutSplash');
    if (!logoutOverlay) {
      logoutOverlay = document.createElement('div');
      logoutOverlay.id = 'circuitLogoutSplash';
      logoutOverlay.className = 'circuit-boot-screen circuit-logout-screen';
      logoutOverlay.innerHTML = `
        <div class="circuit-boot-core" style="width:64px;height:64px;border-radius:18px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);display:flex;align-items:center;justify-content:center;margin-bottom:1.25rem;">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
        </div>
        <div class="circuit-boot-title" style="letter-spacing:1px;font-size:1.05rem;">Oturum Güvenle Kapatılıyor</div>
        <div class="circuit-boot-status" style="font-size:.78rem;color:var(--text-muted,#94a3b8);margin-bottom:1.5rem;">Kullanıcı anahtarları ve yerel önbellek temizleniyor...</div>
        <div class="circuit-boot-track" style="width:160px;height:4px;border-radius:4px;background:rgba(255,255,255,0.08);overflow:hidden;position:relative;">
          <div class="circuit-boot-fill" style="position:absolute;left:0;top:0;bottom:0;width:100%;background:linear-gradient(90deg, #ef4444, #f59e0b);animation:circuitIndeterminate 1.2s infinite ease-in-out;"></div>
        </div>
      `;
      document.body.appendChild(logoutOverlay);
    }

    requestAnimationFrame(() => {
      logoutOverlay.classList.remove('loaded');
      logoutOverlay.style.opacity = '1';
    });

    setTimeout(() => {
      if (typeof onComplete === 'function') onComplete();
    }, 850);
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
    dismissBoot,
    showLogoutSplash
  };
})();
