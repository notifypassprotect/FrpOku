// ============================================================
//  storage_tab.js — Yedekleme, İçe/Dışa Aktarma & Sıfırlama
// ============================================================

window.FrpSettingsTabs = window.FrpSettingsTabs || {};

window.FrpSettingsTabs.storage = {
  render({ stagedPrefs }) {
    const files = FrpStore.getAll() || [];
    const stats = FrpStore.getStats() || { total: files.length, queries: 0, storageFormatted: '0 MB' };

    return `
      <div style="display:flex;flex-direction:column;gap:1.25rem;">
        <div>
          <div style="font-size:1.1rem;font-weight:800;color:var(--text-primary);">Yedekleme & Depolama Yönetimi</div>
          <div style="font-size:.78rem;color:var(--text-muted);margin-top:.2rem;">
            Raporlarınızın snapshot yedeğini alın, otomatik yedekleme zamanlayın veya verileri sıfırlayın.
          </div>
        </div>

        <!-- Depolama İstatistikleri -->
        <div class="settings-card" style="display:flex;flex-direction:column;gap:.6rem;">
          <div style="font-weight:700;font-size:.85rem;">Yerel Depolama Durumu</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:.6rem;text-align:center;">
            <div style="background:var(--bg-surface);padding:.8rem .6rem;border-radius:10px;border:1px solid var(--border-light);">
              <div style="font-size:1.4rem;font-weight:800;color:var(--accent);">${stats.total || files.length}</div>
              <div style="font-size:.74rem;color:var(--text-muted);font-weight:600;margin-top:.15rem;">Kayıtlı Rapor</div>
            </div>
            <div style="background:var(--bg-surface);padding:.8rem .6rem;border-radius:10px;border:1px solid var(--border-light);">
              <div style="font-size:1.4rem;font-weight:800;color:var(--green);">${stats.queries || 0}</div>
              <div style="font-size:.74rem;color:var(--text-muted);font-weight:600;margin-top:.15rem;">SQL Sorgusu</div>
            </div>
            <div style="background:var(--bg-surface);padding:.8rem .6rem;border-radius:10px;border:1px solid var(--border-light);">
              <div style="font-size:1.4rem;font-weight:800;color:var(--purple);">${stats.storageFormatted || '0 MB'}</div>
              <div style="font-size:.74rem;color:var(--text-muted);font-weight:600;margin-top:.15rem;">Bellek Kullanımı</div>
            </div>
          </div>
        </div>

        <!-- Otomatik Yedekleme Sıklığı -->
        <div class="settings-card" style="display:flex;align-items:center;justify-content:space-between;gap:1rem;">
          <div>
            <div style="font-weight:700;font-size:.85rem;">Otomatik Snapshot Yedekleme</div>
            <div style="font-size:.72rem;color:var(--text-muted);">Sistemin arka planda belirli aralıklarla otomatik yedek almasını sağlar.</div>
          </div>
          <select id="stagedAutoBackup" class="master-search-input" style="width:170px;font-weight:700;">
            <option value="0" ${!stagedPrefs.autoBackupInterval ? 'selected' : ''}>Kapalı (Manuel)</option>
            <option value="15" ${stagedPrefs.autoBackupInterval === 15 ? 'selected' : ''}>Her 15 Dakikada</option>
            <option value="30" ${stagedPrefs.autoBackupInterval === 30 ? 'selected' : ''}>Her 30 Dakikada</option>
            <option value="60" ${stagedPrefs.autoBackupInterval === 60 ? 'selected' : ''}>Her 1 Saatte</option>
            <option value="360" ${stagedPrefs.autoBackupInterval === 360 ? 'selected' : ''}>Her 6 Saatte</option>
            <option value="1440" ${stagedPrefs.autoBackupInterval === 1440 ? 'selected' : ''}>Her 24 Saatte (Günlük)</option>
          </select>
        </div>

        <!-- Yedekleme Eylemleri -->
        <div class="settings-card" style="display:flex;flex-direction:column;gap:.75rem;">
          <div style="font-weight:700;font-size:.85rem;">JSON Yedekleme & İçe Aktarma</div>
          <div style="display:flex;gap:.65rem;flex-wrap:wrap;">
            <button type="button" class="btn btn-sm btn-primary" id="btnActionExportJson" style="font-weight:700;padding:.5rem 1rem;">
              Tümünü Yedekle (JSON İndir)
            </button>
            <input type="file" id="settingsBackupFileInput" accept=".json" style="display:none;" />
            <button type="button" class="btn btn-sm btn-ghost" id="btnActionImportJson" style="font-weight:700;padding:.5rem 1rem;border:1px solid var(--border);">
              Yedekten Geri Yükle (JSON Yükle)
            </button>
          </div>
        </div>

        <!-- Tümünü Sıfırlama -->
        <div class="settings-card" style="border:1px solid rgba(239,68,68,0.3);background:rgba(239,68,68,0.03);display:flex;align-items:center;justify-content:space-between;gap:1rem;">
          <div>
            <div style="font-weight:800;font-size:.85rem;color:var(--red);">🚨 Fabrika Ayarlarına Sıfırla</div>
            <div style="font-size:.72rem;color:var(--text-muted);">Tüm rapor verilerini, kategorileri ve önbelleği kalıcı olarak temizler.</div>
          </div>
          <button type="button" class="btn btn-sm btn-danger" id="btnActionResetAll" style="font-weight:800;padding:.5rem 1.1rem;">
            💥 Verileri Sıfırla
          </button>
        </div>
      </div>
    `;
  },

  bind({ overlay, stagedPrefs, renderModal, safeToast }) {
    overlay.querySelector('#btnActionExportJson')?.addEventListener('click', () => {
      const json = FrpStore.exportBackup();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `frpoku_yedek_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      safeToast('Tüm veriler JSON olarak yedeklendi.', 'success');
    });

    overlay.querySelector('#stagedAutoBackup')?.addEventListener('change', (e) => {
      const val = parseInt(e.target.value, 10) || 0;
      stagedPrefs.autoBackupInterval = val;
      if (typeof FrpStore.setAutoBackupInterval === 'function') {
        FrpStore.setAutoBackupInterval(val);
      }
      safeToast(val > 0 ? `Otomatik yedekleme her ${val} dakikada bir ayarlandı.` : 'Otomatik yedekleme kapatıldı.', 'info');
    });

    const backupInput = overlay.querySelector('#settingsBackupFileInput');
    overlay.querySelector('#btnActionImportJson')?.addEventListener('click', () => {
      backupInput?.click();
    });

    backupInput?.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const count = FrpStore.importBackup(ev.target.result);
        if (count > 0) {
          safeToast(`${count} rapor başarıyla içe aktarıldı.`, 'success');
          if (typeof window.refreshAll === 'function') window.refreshAll();
          renderModal();
        } else {
          safeToast('Geçersiz yedek dosyası.', 'error');
        }
      };
      reader.readAsText(file);
    });

    overlay.querySelector('#btnActionResetAll')?.addEventListener('click', () => {
      const authUser = window.FrpAuth?.getUser();
      const promptPass = prompt('DİKKAT: Tüm yüklenen raporları ve veritabanını temizlemek üzeresiniz!\n\nİşlemi onaylamak için lütfen hesap şifrenizi giriniz:');
      if (!promptPass) return;

      fetch('/api/auth/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: authUser?.id || 'admin', password: promptPass })
      }).then(r => r.json()).then(res => {
        if (!res.success || !res.verified) {
          alert('Hata: Girdiğiniz şifre hatalı! İşlem iptal edildi.');
          return;
        }

        window.showConfirmDialog({
          title: 'Tüm Verileri Sıfırla',
          message: 'Şifreniz doğrulandı. Tüm yüklenen raporlar, kategoriler ve veritabanı kalıcı olarak silinecektir! Devam edilsin mi?',
          confirmText: 'Evet, Hepsini Sil',
          isDanger: true,
          onConfirm: () => {
            FrpStore.deleteAll();
            if (window.FrpAudit) {
              window.FrpAudit.logAction({
                action: 'DATA_RESET',
                target: 'Tüm Veritabanı',
                details: 'Kullanıcı onayı ile tüm raporlar ve veritabanı sıfırlandı.'
              });
            }
            safeToast('Tüm veriler sıfırlandı.', 'info');
            if (typeof window.refreshAll === 'function') window.refreshAll();
            renderModal();
          }
        });
      }).catch(() => {
        safeToast('Şifre doğrulanırken hata oluştu.', 'error');
      });
    });
  }
};
