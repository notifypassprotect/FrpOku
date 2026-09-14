const fs = require('fs');
const path = require('path');

function registerReportNoteRoutes(app, deps) {
  const { apiWriteRateLimiter, attachmentsDir, canEditReportNote, canReadReport, getReportRecord, readLocalReports, recordAuditLog, reportId, reportRowToClient, requireAuth, safeLogStr, sanitizeRichHtml, supabase, writeLocalReports } = deps;
  const attachmentRoot = path.resolve(attachmentsDir);

  function resolveAttachmentPath(...segments) {
    const resolved = path.resolve(attachmentRoot, ...segments.map(value => String(value)));
    return resolved === attachmentRoot || resolved.startsWith(attachmentRoot + path.sep) ? resolved : null;
  }

  app.patch('/api/reports/:id/note', apiWriteRateLimiter, requireAuth, async (req, res) => {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ success: false, reason: 'Rapor kimliği gereklidir.' });

    try {
      const existing = await getReportRecord(id);
      if (!existing) return res.status(404).json({ success: false, reason: 'Rapor bulunamadı.' });
      if (!canEditReportNote(req.authUser, existing)) {
        return res.status(403).json({ success: false, reason: 'Bu rapora not ekleme yetkiniz bulunmamaktadır.' });
      }

      const { userNote, noteHtml, attachments } = req.body || {};
      const cleanNote = String(userNote || '').slice(0, 500000);
      const cleanHtml = sanitizeRichHtml(noteHtml, 500000);
      const cleanAttachments = Array.isArray(attachments) ? attachments.slice(0, 50) : (existing.data?.attachments || []);

      const now = new Date().toISOString();

      if (supabase) {
        const current = reportRowToClient(existing);
        const data = {
          ...current,
          userNote: cleanNote,
          user_note: cleanNote,
          noteHtml: cleanHtml,
          note_html: cleanHtml,
          attachments: cleanAttachments,
          noteAttachments: cleanAttachments
        };
        const updatePayload = {
          user_note: cleanNote,
          data,
          updated_at: now
        };
        try {
          const fullPayload = { ...updatePayload, note_html: cleanHtml, note_attachments: cleanAttachments };
          const res1 = await supabase.from('reports').update(fullPayload).eq('id', id).select('*').limit(1);
          if (res1.error) throw res1.error;
        } catch {
          const res2 = await supabase.from('reports').update(updatePayload).eq('id', id).select('*').limit(1);
          if (res2.error) throw res2.error;
        }
      } else {
        const reports = readLocalReports();
        const idx = reports.findIndex(r => reportId(r) === id);
        if (idx >= 0) {
          reports[idx].user_note = cleanNote;
          reports[idx].userNote = cleanNote;
          reports[idx].note_html = cleanHtml;
          reports[idx].noteHtml = cleanHtml;
          reports[idx].attachments = cleanAttachments;
          reports[idx].noteAttachments = cleanAttachments;
          reports[idx].updated_at = now;
          writeLocalReports(reports);
        }
      }

      recordAuditLog({
        userId: req.authUser.id,
        username: req.authUser.username,
        fullName: req.authUser.full_name,
        role: req.authUser.role,
        action: 'NOTE_UPDATE',
        target: existing.name || id,
        details: 'Rapor zengin notu ve ekleri güncellendi.',
        ip: req.ip
      });

      res.json({
        success: true,
        userNote: cleanNote,
        noteHtml: cleanHtml,
        attachments: cleanAttachments
      });
    } catch (err) {
      console.warn('Rapor notu kaydedilemedi:', safeLogStr(err.message));
      res.status(500).json({ success: false, reason: 'Rapor notu kaydedilemedi: ' + err.message });
    }
  });

  app.post('/api/reports/:id/attachments', apiWriteRateLimiter, requireAuth, async (req, res) => {
    const reportIdParam = String(req.params.id || '').trim();
    if (!reportIdParam) return res.status(400).json({ success: false, reason: 'Rapor kimliği gereklidir.' });

    try {
      const report = await getReportRecord(reportIdParam);
      if (!report) return res.status(404).json({ success: false, reason: 'Rapor bulunamadı.' });
      if (!canEditReportNote(req.authUser, report)) {
        return res.status(403).json({ success: false, reason: 'Bu rapora ek yükleme yetkiniz yok.' });
      }

      const { filename, mimeType, base64Data } = req.body || {};
      if (!filename || !base64Data) {
        return res.status(400).json({ success: false, reason: 'Dosya adı ve içeriği gereklidir.' });
      }

      const baseName = path.basename(filename).replace(/[^a-zA-Z0-9.\-_ğüşıöçĞÜŞİÖÇ]/g, '_');
      const safeName = Date.now() + '_' + baseName;
      const targetDir = resolveAttachmentPath(reportIdParam);
      if (!targetDir) return res.status(400).json({ success: false, reason: 'Geçersiz rapor kimliği.' });
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

      const buffer = Buffer.from(base64Data.replace(/^data:[^;]+;base64,/, ''), 'base64');
      if (buffer.length > 15 * 1024 * 1024) {
        return res.status(400).json({ success: false, reason: 'Dosya boyutu 15 MB sınırını aşamaz.' });
      }

      const targetFile = resolveAttachmentPath(reportIdParam, safeName);
      if (!targetFile) return res.status(400).json({ success: false, reason: 'Geçersiz dosya adı.' });
      fs.writeFileSync(targetFile, buffer);

      const attachmentItem = {
        id: 'att_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        name: baseName,
        size: buffer.length,
        type: mimeType || 'application/octet-stream',
        url: `/api/reports/${encodeURIComponent(reportIdParam)}/attachments/${encodeURIComponent(safeName)}`,
        uploadedAt: new Date().toISOString(),
        uploadedBy: req.authUser.full_name || req.authUser.username
      };

      res.json({ success: true, attachment: attachmentItem });
    } catch (err) {
      console.warn('Ek yükleme hatası:', safeLogStr(err.message));
      res.status(500).json({ success: false, reason: 'Ek yüklenemedi: ' + err.message });
    }
  });

  app.get('/api/reports/:id/attachments/:filename', requireAuth, async (req, res) => {
    const reportIdParam = String(req.params.id || '').trim();
    const filename = path.basename(String(req.params.filename || '').trim());
    if (!reportIdParam || !filename) return res.status(400).send('Geçersiz dosya isteği.');

    try {
      const report = await getReportRecord(reportIdParam);
      if (!report || !canReadReport(req.authUser, report)) {
        return res.status(403).send('Bu eki görüntüleme yetkiniz yok.');
      }

      const targetDir = resolveAttachmentPath(reportIdParam);
      if (!targetDir) return res.status(400).send('Geçersiz dosya konumu.');
      const filePath = resolveAttachmentPath(reportIdParam, filename);
      if (!filePath || !fs.existsSync(filePath)) {
        return res.status(404).send('Ek dosya bulunamadı.');
      }

      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.sendFile(filePath);
    } catch (err) {
      res.status(500).send('Dosya getirilemedi.');
    }
  });


}

module.exports = { registerReportNoteRoutes };
