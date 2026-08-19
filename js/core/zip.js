/**
 * FrpOku Pure JavaScript ZipBuilder
 * Saf JavaScript ile istemci tarafında standart PKZip (.zip) arşivi üretme kütüphanesi.
 */

(function (window) {
  'use strict';

  // CRC32 Tablosu
  const crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[i] = c;
  }

  function crc32(bytes) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) {
      crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[i]) & 0xFF];
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function stringToUint8Array(str) {
    const encoder = new TextEncoder();
    return encoder.encode(str);
  }

  class ZipWriter {
    constructor() {
      this.files = [];
    }

    /**
     * Arşive dosya ekler
     * @param {string} name - Dosya adı (ör: "rapor.frp")
     * @param {Uint8Array|string} content - Dosya içeriği
     */
    addFile(name, content) {
      const data = typeof content === 'string' ? stringToUint8Array(content) : content;
      const nameBytes = stringToUint8Array(name);
      const crc = crc32(data);
      this.files.push({
        name,
        nameBytes,
        data,
        crc,
        size: data.length
      });
    }

    /**
     * .zip dosya Blob'u üretir
     * @returns {Blob}
     */
    generateBlob() {
      const chunks = [];
      const centralDirChunks = [];
      let offset = 0;

      // Tarih/Saat Dönüşümü (DOS Format)
      const now = new Date();
      const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xFFFF;
      const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;

      for (const file of this.files) {
        const localHeader = new Uint8Array(30 + file.nameBytes.length);
        const view = new DataView(localHeader.buffer);

        // Local Header Signature: 0x04034b50
        view.setUint32(0, 0x04034b50, true);
        view.setUint16(4, 20, true); // Version needed
        view.setUint16(6, 0x0800, true); // General purpose flag (UTF-8 filename)
        view.setUint16(8, 0, true);  // Compression method (0 = Store)
        view.setUint16(10, dosTime, true);
        view.setUint16(12, dosDate, true);
        view.setUint32(14, file.crc, true);
        view.setUint32(18, file.size, true); // Compressed size
        view.setUint32(22, file.size, true); // Uncompressed size
        view.setUint16(26, file.nameBytes.length, true);
        view.setUint16(28, 0, true); // Extra field length

        localHeader.set(file.nameBytes, 30);

        chunks.push(localHeader);
        chunks.push(file.data);

        // Central Directory Header
        const cdHeader = new Uint8Array(46 + file.nameBytes.length);
        const cdView = new DataView(cdHeader.buffer);

        // CD Signature: 0x02014b50
        cdView.setUint32(0, 0x02014b50, true);
        cdView.setUint16(4, 20, true); // Version made by
        cdView.setUint16(6, 20, true); // Version needed
        cdView.setUint16(8, 0x0800, true); // General purpose flag (UTF-8)
        cdView.setUint16(10, 0, true); // Store
        cdView.setUint16(12, dosTime, true);
        cdView.setUint16(14, dosDate, true);
        cdView.setUint32(16, file.crc, true);
        cdView.setUint32(20, file.size, true);
        cdView.setUint32(24, file.size, true);
        cdView.setUint16(28, file.nameBytes.length, true);
        cdView.setUint16(30, 0, true); // Extra field len
        cdView.setUint16(32, 0, true); // Comment len
        cdView.setUint16(34, 0, true); // Disk start
        cdView.setUint16(36, 0, true); // Internal attrs
        cdView.setUint32(38, 0, true); // External attrs
        cdView.setUint32(42, offset, true); // Relative offset

        cdHeader.set(file.nameBytes, 46);
        centralDirChunks.push(cdHeader);

        offset += localHeader.length + file.size;
      }

      const cdOffset = offset;
      let cdSize = 0;
      for (const cdChunk of centralDirChunks) {
        chunks.push(cdChunk);
        cdSize += cdChunk.length;
      }

      // End of Central Directory (EOCD)
      const eocd = new Uint8Array(22);
      const eocdView = new DataView(eocd.buffer);

      // EOCD Signature: 0x06054b50
      eocdView.setUint32(0, 0x06054b50, true);
      eocdView.setUint16(4, 0, true); // Disk num
      eocdView.setUint16(6, 0, true); // CD disk num
      eocdView.setUint16(8, this.files.length, true); // Entries on disk
      eocdView.setUint16(10, this.files.length, true); // Total entries
      eocdView.setUint32(12, cdSize, true); // CD size
      eocdView.setUint32(16, cdOffset, true); // CD offset
      eocdView.setUint16(20, 0, true); // Comment length

      chunks.push(eocd);

      return new Blob(chunks, { type: 'application/zip' });
    }
  }

  window.ZipWriter = ZipWriter;
})(window);
