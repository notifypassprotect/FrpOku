const test = require('node:test');
const assert = require('node:assert/strict');

// Node.js test ortamı için hafif DOMParser / XMLSerializer simülasyonu
class MockElement {
  constructor(nodeName, attrs = {}) {
    this.nodeName = nodeName;
    this.nodeType = 1;
    this.attributes = new Map(Object.entries(attrs));
    this.childNodes = [];
    this.parentNode = null;
  }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  setAttribute(name, val) { this.attributes.set(name, String(val)); }
  appendChild(child) {
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }
  removeChild(child) {
    const idx = this.childNodes.indexOf(child);
    if (idx !== -1) {
      child.parentNode = null;
      this.childNodes.splice(idx, 1);
    }
    return child;
  }
  insertBefore(child, ref) {
    child.parentNode = this;
    const idx = this.childNodes.indexOf(ref);
    if (idx !== -1) this.childNodes.splice(idx, 0, child);
    else this.childNodes.push(child);
    return child;
  }
}

class MockDocument {
  constructor() {
    this.documentElement = null;
  }
  querySelector() { return null; }
  createElement(name) { return new MockElement(name); }
  getElementsByTagName(tag) {
    const list = [];
    function traverse(node) {
      if (!node) return;
      if (tag === '*' || node.nodeName.toLowerCase() === tag.toLowerCase()) list.push(node);
      (node.childNodes || []).forEach(traverse);
    }
    traverse(this.documentElement);
    return list;
  }
}

class MockDOMParser {
  parseFromString() {
    const doc = new MockDocument();
    const root = new MockElement('TfrxReport', { Version: '2022.2' });
    const page = new MockElement('TfrxReportPage', { Name: 'Page1' });
    const title = new MockElement('TfrxReportTitle', { Name: 'ReportTitle1' });
    const memoKeep = new MockElement('TfrxMemoView', { Name: 'MemoKeep', Text: 'Kalan Başlık' });
    const memoDelete = new MockElement('TfrxMemoView', { Name: 'MemoDelete', Text: 'Silinen Başlık' });

    title.appendChild(memoKeep);
    title.appendChild(memoDelete);
    page.appendChild(title);
    root.appendChild(page);
    doc.documentElement = root;
    return doc;
  }
}

class MockXMLSerializer {
  serializeToString(doc) {
    function serializeNode(node) {
      if (!node) return '';
      const attrs = Array.from(node.attributes.entries()).map(([k, v]) => `${k}="${v}"`).join(' ');
      const attrStr = attrs ? ` ${attrs}` : '';
      if (!node.childNodes || node.childNodes.length === 0) {
        return `<${node.nodeName}${attrStr}/>`;
      }
      const children = node.childNodes.map(serializeNode).join('');
      return `<${node.nodeName}${attrStr}>${children}</${node.nodeName}>`;
    }
    return serializeNode(doc.documentElement);
  }
}

global.DOMParser = MockDOMParser;
global.XMLSerializer = MockXMLSerializer;

const { createSessionAuth } = require('../lib/session_auth');
const { buildOwnedReportRow } = require('../lib/report_access');
const { buildUpdatedFrpXml } = require('../js/core/parser');

function invoke(middleware, token) {
  return new Promise(resolve => {
    const req = { headers: token ? { authorization: `Bearer ${token}` } : {} };
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(body) { resolve({ next: false, statusCode: this.statusCode, body, req }); }
    };
    middleware(req, res, () => resolve({ next: true, statusCode: 200, req }));
  });
}

test('yönetici başkasının raporunu güncellediğinde asıl rapor sahibinin bilgileri korunur', () => {
  const adminUser = { id: 'usr_admin', username: 'admin', full_name: 'Admin User', department: 'IT', role: 'admin' };
  const existingReport = {
    id: 'rep_123',
    user_id: 'usr_original',
    owner_name: 'Original Author',
    owner_username: 'original_user',
    owner_department: 'Muhasebe',
    version: 2
  };
  const updatedData = {
    id: 'rep_123',
    name: 'Güncellenen Rapor',
    userNote: 'Admin not ekledi'
  };

  const row = buildOwnedReportRow(updatedData, adminUser, { existing: existingReport });

  assert.equal(row.user_id, 'usr_original');
  assert.equal(row.owner_name, 'Original Author');
  assert.equal(row.owner_username, 'original_user');
  assert.equal(row.owner_department, 'Muhasebe');
  assert.equal(row.data.userId, 'usr_original');
});

test('parola değişikliği sonrası eski token geçersiz sayılır, yeni token onaylanır', async () => {
  const changeTimestamp = Date.now();
  const auth = createSessionAuth({
    secret: 'test-secure-secret-key-12345678',
    userLoader: async id => ({
      id,
      username: 'testuser',
      role: 'user',
      is_active: true,
      password_changed_at: new Date(changeTimestamp).toISOString()
    })
  });

  // Parola değişiminden 10 saniye önce üretilmiş eski token
  const oldToken = auth.signToken({
    id: 'usr_1',
    username: 'testuser',
    role: 'user',
    iat: changeTimestamp - 10_000
  });
  const oldResult = await invoke(auth.requireAuth, oldToken);
  assert.equal(oldResult.statusCode, 401, 'Eski token reddedilmeli');

  // Parola değişiminden sonra üretilmiş yeni token
  const freshToken = auth.signToken({
    id: 'usr_1',
    username: 'testuser',
    role: 'user',
    iat: changeTimestamp + 1000
  });
  const freshResult = await invoke(auth.requireAuth, freshToken);
  assert.equal(freshResult.statusCode, 200, 'Yeni token kabul edilmeli');
  assert.equal(freshResult.next, true);
});

test('tasarımda silinen bileşen XML çıktısından kaldırılır', () => {
  const sampleXml = `<?xml version="1.0" encoding="utf-8" standalone="no"?>
<TfrxReport Version="2022.2">
  <TfrxReportPage Name="Page1">
    <TfrxReportTitle Name="ReportTitle1" Top="0" Height="100">
      <TfrxMemoView Name="MemoKeep" Text="Kalan Başlık" Left="10" Top="10" Width="100" Height="20"/>
      <TfrxMemoView Name="MemoDelete" Text="Silinen Başlık" Left="120" Top="10" Width="100" Height="20"/>
    </TfrxReportTitle>
  </TfrxReportPage>
</TfrxReport>`;

  // Modelde yalnızca MemoKeep kalmış, MemoDelete silinmiş
  const fileModel = {
    rawXml: sampleXml,
    pages: [
      {
        name: 'Page1',
        type: 'TfrxReportPage',
        bands: [
          {
            name: 'ReportTitle1',
            type: 'TfrxReportTitle',
            components: [
              { name: 'MemoKeep', type: 'TfrxMemoView', text: 'Kalan Başlık Güncel' }
            ]
          }
        ]
      }
    ]
  };

  const updatedXml = buildUpdatedFrpXml(fileModel);
  assert.ok(updatedXml.includes('MemoKeep'), 'MemoKeep XML içinde bulunmalı');
  assert.ok(!updatedXml.includes('MemoDelete'), 'Silinen MemoDelete XML içinden kaldırılmış olmalı');
});
