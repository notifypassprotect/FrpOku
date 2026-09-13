function startServer(app, { ensureAdminUser, port, safeLogStr }) {
  return Promise.resolve().then(ensureAdminUser).catch(error => {
    console.warn('Bootstrap admin başlatma uyarısı:', safeLogStr(error.message));
  }).then(() => {
    const server = app.listen(port, () => {
      const url = `http://localhost:${port}`;
      console.log(`\n======================================================`);
      console.log(' FrpOku Sunucusu Başarıyla Başlatıldı!');
      console.log(` Web Adresi: ${url}`);
      console.log(`======================================================\n`);
      if (process.env.AUTO_OPEN_BROWSER !== 'false') {
        const { exec } = require('child_process');
        const command = process.platform === 'win32' ? `start "" "${url}"`
          : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
        exec(command, () => {});
      }
    });
    server.on('error', error => {
      if (error.code === 'EADDRINUSE') {
        console.error(`\n[HATA] ${port} portu zaten başka bir FrpOku penceresi veya uygulama tarafından kullanılıyor!`);
        console.error('Lütfen açık olan diğer Node.js / FrpOku pencerelerini kapatıp tekrar deneyin.\n');
      } else {
        console.error('Sunucu başlatılamadı:', safeLogStr(error.message));
      }
      process.exit(1);
    });
    return server;
  });
}

module.exports = { startServer };
