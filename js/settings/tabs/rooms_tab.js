// ============================================================
//  rooms_tab.js — Sohbet Odaları & Kanallar Yönetimi (Admin Sekmesi)
// ============================================================

window.FrpSettingsTabs = window.FrpSettingsTabs || {};

window.FrpSettingsTabs.rooms = {
  render({ escHtml }) {
    return `
      <div style="display:flex;flex-direction:column;gap:1.25rem;">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.8rem;">
          <div>
            <div style="font-size:1.1rem;font-weight:800;color:var(--text-primary);">🏢 Sohbet Odaları & Grup Kanalları</div>
            <div style="font-size:.78rem;color:var(--text-muted);margin-top:.2rem;">
              Ekip sohbet panelindeki kurumsal odaları, departman kanallarını ve üye erişim izinlerini yönetin.
            </div>
          </div>
          <button type="button" id="btnAdminCreateRoomInSettings" class="btn btn-primary" style="display:inline-flex;align-items:center;gap:.4rem;font-weight:700;padding:.5rem 1rem;">
            <span>➕ Yeni Oda / Kanal Ekle</span>
          </button>
        </div>

        <div id="settingsRoomsListContainer" style="display:flex;flex-direction:column;gap:.75rem;">
          <div style="text-align:center;padding:3rem 1rem;color:var(--text-muted);">
            <div class="splash-spinner" style="margin:0 auto 1rem;"></div>
            <div>Odalar ve kanallar yükleniyor...</div>
          </div>
        </div>
      </div>
    `;
  },

  async bind({ overlay, escHtml, safeToast }) {
    const container = overlay.querySelector('#settingsRoomsListContainer');
    const btnCreate = overlay.querySelector('#btnAdminCreateRoomInSettings');
    if (!container) return;

    const headers = (window.FrpAuth && typeof window.FrpAuth.getAuthHeaders === 'function') ? window.FrpAuth.getAuthHeaders() : {};
    let rooms = [];
    let allUsers = [];

    async function loadRoomsAndUsers() {
      try {
        const [roomsRes, usersRes] = await Promise.all([
          fetch('/api/chat/rooms', { headers }),
          fetch('/api/admin/all-users', { headers })
        ]);
        const roomsData = await roomsRes.json();
        const usersData = await usersRes.json();
        rooms = (roomsData && roomsData.success && Array.isArray(roomsData.rooms)) ? roomsData.rooms : [];
        allUsers = (usersData && usersData.success && Array.isArray(usersData.users)) ? usersData.users : [];
        renderRoomsList();
      } catch (err) {
        container.innerHTML = `<div style="text-align:center;padding:2rem;color:#ef4444;font-weight:700;">Odalar yüklenemedi: ${escHtml(err.message)}</div>`;
      }
    }

    function renderRoomsList() {
      if (rooms.length === 0) {
        container.innerHTML = `
          <div style="text-align:center;padding:3rem 1rem;background:var(--bg-card,#f8fafc);border-radius:14px;border:1px dashed var(--border,#cbd5e1);">
            <div style="font-size:2.2rem;margin-bottom:.5rem;">🏢</div>
            <div style="font-size:1.05rem;font-weight:800;color:var(--text-primary,#0f172a);">Henüz Tanımlı Bir Oda Yok</div>
            <div style="font-size:.82rem;color:var(--text-muted,#64748b);margin-top:.3rem;">
              "Yeni Oda / Kanal Ekle" butonunu kullanarak departman veya proje kanalları oluşturabilirsiniz.
            </div>
          </div>
        `;
        return;
      }

      container.innerHTML = rooms.map(room => {
        const isAll = room.is_all_users !== false;
        const memberCount = Array.isArray(room.member_user_ids) ? room.member_user_ids.length : 0;
        const accessBadge = isAll
          ? `<span class="badge badge-green" style="font-size:.72rem;padding:.2rem .5rem;">👥 Tüm Kullanıcılar</span>`
          : `<span class="badge badge-blue" style="font-size:.72rem;padding:.2rem .5rem;">🔒 ${memberCount} Özel Üye</span>`;

        return `
          <div class="admin-user-card" style="display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;border:1px solid var(--border,#e2e8f0);border-radius:12px;background:var(--bg-surface,#fff);gap:1rem;">
            <div style="display:flex;align-items:center;gap:.9rem;min-width:0;flex:1;">
              <div style="width:44px;height:44px;border-radius:12px;background:rgba(37,99,235,0.08);display:flex;align-items:center;justify-content:center;font-size:1.45rem;flex-shrink:0;">
                ${escHtml(room.icon || '🏢')}
              </div>
              <div style="min-width:0;flex:1;">
                <div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;">
                  <span style="font-weight:800;font-size:.98rem;color:var(--text-primary,#0f172a);">${escHtml(room.name)}</span>
                  ${accessBadge}
                </div>
                <div style="font-size:.8rem;color:var(--text-secondary,#475569);margin-top:.2rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                  ${escHtml(room.description || 'Açıklama belirtilmedi.')}
                </div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:.5rem;flex-shrink:0;">
              <button type="button" class="btn btn-sm btn-secondary btn-settings-edit-room" data-id="${room.id}" style="padding:.4rem .75rem;font-weight:700;">
                ✏️ Düzenle
              </button>
              <button type="button" class="btn btn-sm btn-ghost btn-settings-delete-room" data-id="${room.id}" data-name="${escHtml(room.name)}" style="color:#ef4444;padding:.4rem .75rem;font-weight:700;">
                🗑️ Sil
              </button>
            </div>
          </div>
        `;
      }).join('');

      container.querySelectorAll('.btn-settings-edit-room').forEach(btn => {
        btn.addEventListener('click', () => {
          const rId = btn.getAttribute('data-id');
          const roomToEdit = rooms.find(r => String(r.id) === String(rId));
          if (roomToEdit) openRoomEditModal(roomToEdit);
        });
      });

      container.querySelectorAll('.btn-settings-delete-room').forEach(btn => {
        btn.addEventListener('click', () => {
          const rId = btn.getAttribute('data-id');
          const rName = btn.getAttribute('data-name');
          if (typeof window.showConfirmDialog === 'function') {
            window.showConfirmDialog({
              title: 'Odayı Sil',
              message: `"${rName}" odasını silmek istediğinize emin misiniz? Odaya ait tüm mesaj geçmişi silinecektir.`,
              confirmText: 'Evet, Odayı Sil',
              isDanger: true,
              onConfirm: async () => {
                try {
                  const delRes = await fetch(`/api/chat/rooms/${rId}`, { method: 'DELETE', headers });
                  const delData = await delRes.json();
                  if (delData && delData.success) {
                    safeToast(`"${rName}" odası silindi.`, 'info');
                    loadRoomsAndUsers();
                    if (window.FrpPresence?.refresh) window.FrpPresence.refresh();
                  } else {
                    safeToast(delData?.reason || 'Oda silinemedi.', 'error');
                  }
                } catch (e) {
                  safeToast('Silme hatası: ' + e.message, 'error');
                }
              }
            });
          }
        });
      });
    }

    function openRoomEditModal(existingRoom = null) {
      const isEdit = !!existingRoom;
      const defaultIcon = existingRoom ? existingRoom.icon : '🏢';
      const isAllUsers = existingRoom ? (existingRoom.is_all_users !== false) : true;
      const selectedUserIds = new Set(existingRoom && Array.isArray(existingRoom.member_user_ids) ? existingRoom.member_user_ids.map(String) : []);

      const modalOverlay = document.createElement('div');
      modalOverlay.className = 'modal-overlay';
      modalOverlay.style.zIndex = '200060';

      const userCheckboxesHtml = allUsers.map(u => {
        const checked = selectedUserIds.has(String(u.id)) ? 'checked' : '';
        return `
          <label style="display:flex;align-items:center;gap:.6rem;padding:.45rem .65rem;border-radius:8px;background:var(--bg-card,#f8fafc);cursor:pointer;border:1px solid var(--border,#e2e8f0);">
            <input type="checkbox" class="cb-room-user" data-user-id="${u.id}" ${checked} style="width:16px;height:16px;accent-color:var(--accent,#2563eb);cursor:pointer;" />
            <div style="min-width:0;flex:1;">
              <div style="font-weight:700;font-size:.82rem;color:var(--text-primary,#0f172a);">${escHtml(u.fullName || u.username)}</div>
              <div style="font-size:.7rem;color:var(--text-muted,#64748b);">@${escHtml(u.username)} ${u.department ? `· ${escHtml(u.department)}` : ''}</div>
            </div>
          </label>
        `;
      }).join('');

      modalOverlay.innerHTML = `
        <div class="modal" style="max-width:540px;width:92vw;padding:1.6rem;border-radius:18px;background:var(--bg-surface,#fff);border:1px solid var(--border,#cbd5e1);box-shadow:0 25px 60px rgba(0,0,0,0.35);">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.1rem;border-bottom:1px solid var(--border,#e2e8f0);padding-bottom:.7rem;">
            <div style="font-size:1.1rem;font-weight:800;color:var(--text-primary,#0f172a);">
              ${isEdit ? '✏️ Odayı Düzenle' : '➕ Yeni Oda / Grup Kanalı Oluştur'}
            </div>
            <button type="button" id="btnCloseRoomModal" style="border:none;background:rgba(148,163,184,0.15);width:32px;height:32px;border-radius:8px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;">✕</button>
          </div>

          <div style="display:flex;flex-direction:column;gap:1rem;">
            <div>
              <label style="font-size:.8rem;font-weight:700;display:block;margin-bottom:.3rem;">Oda Adı *</label>
              <input type="text" id="tbRoomName" class="master-search-input" value="${escHtml(existingRoom?.name || '')}" placeholder="Örn: Muhasebe & Finans" style="width:100%;font-size:.9rem;padding:.55rem .8rem;" />
            </div>

            <div>
              <label style="font-size:.8rem;font-weight:700;display:block;margin-bottom:.3rem;">İkon (Emoji)</label>
              <input type="text" id="tbRoomIcon" class="master-search-input" value="${escHtml(defaultIcon)}" style="width:80px;text-align:center;font-size:1.2rem;padding:.4rem;" />
            </div>

            <div>
              <label style="font-size:.8rem;font-weight:700;display:block;margin-bottom:.3rem;">Açıklama</label>
              <input type="text" id="tbRoomDesc" class="master-search-input" value="${escHtml(existingRoom?.description || '')}" placeholder="Örn: Fatura ve finans koordinasyon kanalı" style="width:100%;font-size:.88rem;padding:.55rem .8rem;" />
            </div>

            <div style="background:var(--bg-card,#f8fafc);padding:.8rem .95rem;border-radius:10px;border:1px solid var(--border,#e2e8f0);">
              <label style="display:flex;align-items:center;gap:.6rem;cursor:pointer;font-weight:700;font-size:.85rem;">
                <input type="checkbox" id="cbRoomAllUsers" ${isAllUsers ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--accent,#2563eb);cursor:pointer;" />
                <span>Tüm Onaylı Kullanıcılar Katılsın (Genel Oda)</span>
              </label>

              <div id="roomMemberSelectorArea" style="margin-top:.9rem;display:${isAllUsers ? 'none' : 'block'};border-top:1px solid var(--border,#e2e8f0);padding-top:.8rem;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.5rem;">
                  <span style="font-size:.8rem;font-weight:700;color:var(--text-secondary);">Odaya Eklenecek Üyeleri Seçin:</span>
                  <span id="selectedCountBadge" class="badge badge-blue" style="font-size:.7rem;">${selectedUserIds.size} kullanıcı seçildi</span>
                </div>
                <div style="max-height:180px;overflow-y:auto;display:flex;flex-direction:column;gap:.35rem;padding-right:.3rem;">
                  ${userCheckboxesHtml || '<div style="font-size:.78rem;color:var(--text-muted);padding:.5rem;">Kayıtlı kullanıcı bulunamadı.</div>'}
                </div>
              </div>
            </div>
          </div>

          <div style="display:flex;align-items:center;justify-content:flex-end;gap:.6rem;margin-top:1.4rem;border-top:1px solid var(--border,#e2e8f0);padding-top:.9rem;">
            <button type="button" class="btn btn-ghost" id="btnCancelRoomModal" style="font-weight:700;">İptal</button>
            <button type="button" class="btn btn-primary" id="btnSaveRoomModal" style="font-weight:800;padding:.5rem 1.4rem;">
              ${isEdit ? 'Değişiklikleri Kaydet' : 'Odayı Oluştur'}
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(modalOverlay);
      const close = () => modalOverlay.remove();
      modalOverlay.querySelector('#btnCloseRoomModal')?.addEventListener('click', close);
      modalOverlay.querySelector('#btnCancelRoomModal')?.addEventListener('click', close);

      const cbAll = modalOverlay.querySelector('#cbRoomAllUsers');
      const memberArea = modalOverlay.querySelector('#roomMemberSelectorArea');
      const countBadge = modalOverlay.querySelector('#selectedCountBadge');

      cbAll?.addEventListener('change', () => {
        if (memberArea) memberArea.style.display = cbAll.checked ? 'none' : 'block';
      });

      modalOverlay.querySelectorAll('.cb-room-user').forEach(cb => {
        cb.addEventListener('change', () => {
          const uId = cb.getAttribute('data-user-id');
          if (cb.checked) selectedUserIds.add(String(uId));
          else selectedUserIds.delete(String(uId));
          if (countBadge) countBadge.textContent = `${selectedUserIds.size} kullanıcı seçildi`;
        });
      });

      modalOverlay.querySelector('#btnSaveRoomModal')?.addEventListener('click', async () => {
        const name = (modalOverlay.querySelector('#tbRoomName')?.value || '').trim();
        const icon = (modalOverlay.querySelector('#tbRoomIcon')?.value || '').trim() || '🏢';
        const description = (modalOverlay.querySelector('#tbRoomDesc')?.value || '').trim();
        const is_all_users = cbAll ? cbAll.checked : true;
        const member_user_ids = is_all_users ? [] : Array.from(selectedUserIds);

        if (!name) {
          safeToast('Lütfen oda adını girin.', 'warning');
          return;
        }

        const saveBtn = modalOverlay.querySelector('#btnSaveRoomModal');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Kaydediliyor...';

        try {
          const bodyPayload = JSON.stringify({ name, icon, description, is_all_users, member_user_ids });
          const reqHeaders = { 'Content-Type': 'application/json', ...headers };
          const res = isEdit
            ? await fetch(`/api/chat/rooms/${existingRoom.id}`, { method: 'PUT', headers: reqHeaders, body: bodyPayload })
            : await fetch('/api/chat/rooms', { method: 'POST', headers: reqHeaders, body: bodyPayload });
          
          const data = await res.json();
          if (data && data.success) {
            safeToast(`"${name}" odası kaydedildi.`, 'success');
            close();
            loadRoomsAndUsers();
            if (window.FrpPresence?.refresh) window.FrpPresence.refresh();
          } else {
            safeToast(data?.reason || 'Oda kaydedilemedi.', 'error');
            saveBtn.disabled = false;
            saveBtn.textContent = isEdit ? 'Değişiklikleri Kaydet' : 'Odayı Oluştur';
          }
        } catch (err) {
          safeToast('Hata: ' + err.message, 'error');
          saveBtn.disabled = false;
        }
      };
    }

    if (btnCreate) {
      btnCreate.addEventListener('click', () => openRoomEditModal(null));
    }

    loadRoomsAndUsers();
  }
};
