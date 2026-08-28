// ============================================================
//  shortcuts_tab.js — Klavye Kısayolları Referans Tablosu
// ============================================================

window.FrpSettingsTabs = window.FrpSettingsTabs || {};

window.FrpSettingsTabs.shortcuts = {
  shortcutsList: [
    { key: 'Ctrl + F', desc: 'Raporlar ve sorgularda anında ara' },
    { key: 'Ctrl + E', desc: 'Tüm rapor listesini Excel tablosu olarak dışa aktar' },
    { key: 'Ctrl + R', desc: 'Editörde seçili ifadeyi değiştir (Replace)' },
    { key: 'Ctrl + ,', desc: 'Ayarlar & Kullanıcı Yönetimi penceresini aç' },
    { key: 'Alt + N / Ctrl + I', desc: 'Yeni .frp rapor dosyası ekle' },
    { key: 'Ctrl + M', desc: 'Komut Paletini aç (Hızlı Menü)' },
    { key: 'ESC',      desc: 'Açık modal pencereleri veya aramayı kapat' },
    { key: 'F6',       desc: 'Görünüm modunu değiştir (Tablo / Kartlar / Zaman Tüneli)' },
    { key: 'F7',       desc: '🧠 SQL Karmaşıklık & Anti-Pattern Analizini aç' },
    { key: 'F8',       desc: 'Seçili raporlar için Karşılaştırma (Diff) modunu aç' }
  ],

  render() {
    return `
      <div style="display:flex;flex-direction:column;gap:1.25rem;">
        <div>
          <div style="font-size:1.1rem;font-weight:800;color:var(--text-primary);">⌨️ Klavye Kısayolları</div>
          <div style="font-size:.78rem;color:var(--text-muted);margin-top:.2rem;">
            FrpOku içerisinde işinizi hızlandıracak tüm klavye kısayolları.
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:.5rem;">
          ${this.shortcutsList.map(s => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:.7rem 1rem;background:var(--bg-surface);border:1px solid var(--border-light);border-radius:10px;">
              <span class="badge" style="font-family:var(--mono);font-size:.78rem;padding:.3rem .65rem;background:var(--bg-raised);border:1px solid var(--border);color:var(--accent);font-weight:700;">
                ${s.key}
              </span>
              <span style="font-size:.82rem;color:var(--text-secondary);font-weight:600;">${s.desc}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  bind() {
    // Shortcuts tab is purely informative
  }
};
