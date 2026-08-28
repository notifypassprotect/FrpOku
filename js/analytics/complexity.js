/**
 * FrpOku - SQL Karmaşıklık ve Statik Anti-Pattern Analiz Motoru
 * Oracle / PLSQL uyumlu ileri düzey kurallar ve performans önerileri
 */

(function () {
  'use strict';

  function getSqlComplexity(rawSql) {
    if (!rawSql || !rawSql.trim()) {
      return emptyResult();
    }

    let sql = rawSql;
    const fbIdx = sql.search(/(?:--|\/\*)\s*PROVIDER\s*=\s*FIREBIRD/i);
    if (fbIdx !== -1) {
      sql = sql.slice(0, fbIdx);
    }

    if (!sql.trim()) {
      return emptyResult();
    }

    const cleanSql = sql
      .replace(/--[^\n]*/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    const upper = cleanSql.toUpperCase();
    const lines = sql.split('\n').length;

    // 1. Temel Sayımlar
    const innerJoinCount = (upper.match(/\bINNER\s+JOIN\b/g) || []).length;
    const leftJoinCount  = (upper.match(/\bLEFT\s+(?:OUTER\s+)?JOIN\b/g) || []).length;
    const rightJoinCount = (upper.match(/\bRIGHT\s+(?:OUTER\s+)?JOIN\b/g) || []).length;
    const fullJoinCount  = (upper.match(/\bFULL\s+(?:OUTER\s+)?JOIN\b/g) || []).length;
    const crossJoinCount = (upper.match(/\bCROSS\s+JOIN\b/g) || []).length;
    const totalJoins     = (upper.match(/\bJOIN\b/g) || []).length;

    const selectCount    = (upper.match(/\bSELECT\b/g) || []).length;
    const subqCount      = Math.max(0, selectCount - 1);
    const caseCount      = (upper.match(/\bCASE\b/g) || []).length;
    const unionCount     = (upper.match(/\bUNION\b/g) || []).length;
    const unionAllCount  = (upper.match(/\bUNION\s+ALL\b/g) || []).length;
    const unionPureCount = Math.max(0, unionCount - unionAllCount);
    const andOrCount     = (upper.match(/\b(AND|OR)\b/g) || []).length;
    const orCount        = (upper.match(/\bOR\b/g) || []).length;
    const paramMatches   = sql.match(/:[a-zA-Z_]\w*/g) || [];
    const paramCount     = new Set(paramMatches).size;
    const distinctCount  = (upper.match(/\bDISTINCT\b/g) || []).length;
    const groupCount     = (upper.match(/\bGROUP\s+BY\b/g) || []).length;
    const havingCount    = (upper.match(/\bHAVING\b/g) || []).length;
    const orderCount     = (upper.match(/\bORDER\s+BY\b/g) || []).length;
    const windowCount    = (upper.match(/\bOVER\s*\(/g) || []).length;

    const cteNames = [];
    const cteRx = /(?:\bWITH\b|,)\s*([a-zA-Z0-9_]+)\s+AS\s*\(/gi;
    let cm;
    while ((cm = cteRx.exec(cleanSql)) !== null) {
      if (cm[1] && !cteNames.includes(cm[1].toUpperCase())) {
        cteNames.push(cm[1].toUpperCase());
      }
    }
    const cteCount = cteNames.length;

    const existsCount    = (upper.match(/\bEXISTS\s*\(/g) || []).length;
    const inSubqCount    = (upper.match(/\bIN\s*\(\s*SELECT\b/g) || []).length;
    const notInSubqCount = (upper.match(/\bNOT\s+IN\s*\(\s*SELECT\b/g) || []).length;

    // 2. Anti-Pattern ve Risk Analizleri
    const warnings = [];
    const recommendations = [];

    // ON 1 = 1 Kukla JOIN
    const dummyJoinMatch = sql.match(/((?:LEFT\s+(?:OUTER\s+)?|RIGHT\s+(?:OUTER\s+)?|INNER\s+|FULL\s+(?:OUTER\s+)?|CROSS\s+)?JOIN\s+([a-zA-Z0-9_\$#.]+)(?:\s+(?:AS\s+)?([a-zA-Z0-9_]+))?\s+ON\s+1\s*=\s*1)/i);
    if (dummyJoinMatch) {
      const actualClause = dummyJoinMatch[1].trim();
      const tblName = dummyJoinMatch[2] || 'bagli_tablo';
      const alias = dummyJoinMatch[3] || tblName;
      warnings.push({
        type: 'danger',
        category: 'join',
        categoryLabel: 'Kukla JOIN (ON 1=1)',
        title: 'ON 1 = 1 Kukla Bağlantı (Kartezyen Çarpım Riski)',
        text: `'${tblName}' tablosu gerçek bir anahtar yerine 'ON 1=1' ile bağlanmış.`
      });
      recommendations.push({
        category: 'join',
        title: `Tabloyu '${alias}.id' İlişkisi ile Bağlayın`,
        desc: `Yapay 'ON 1=1' yerine iki tablonun ortak ilişki alanını doğrudan ON koşuluna yazın.`,
        before: actualClause,
        after: actualClause.replace(/ON\s+1\s*=\s*1/i, `ON ana_tablo.id = ${alias}.ref_id`)
      });
    }

    // CROSS JOIN Riski
    const crossMatch = sql.match(/([a-zA-Z0-9_\$#.]+\s+CROSS\s+JOIN\s+[a-zA-Z0-9_\$#.]+)/i);
    if (crossJoinCount > 0) {
      const crossSnippet = crossMatch ? crossMatch[1].trim() : 'FROM tablo1 CROSS JOIN tablo2';
      warnings.push({
        type: 'danger',
        category: 'join',
        categoryLabel: 'CROSS JOIN',
        title: `CROSS JOIN Kullanımı (${crossJoinCount} adet)`,
        text: 'Tablolar koşulsuz olarak birbiriyle çarpılıyor.'
      });
      recommendations.push({
        category: 'join',
        title: 'CROSS JOIN Yerine Koşullu INNER veya LEFT JOIN Kullanın',
        desc: 'Tabloları ilişkili kolonlar üzerinden bağlayın.',
        before: crossSnippet,
        after: crossSnippet.replace(/CROSS\s+JOIN/i, 'INNER JOIN') + ' ON ana.id = bagli.id'
      });
    }

    // SELECT Kolonunda Skalar Alt Sorgu (N+1 Riski)
    const selectFromMatch = cleanSql.match(/\bSELECT\b([\s\S]+?)\bFROM\b/i);
    if (selectFromMatch) {
      const selectColsText = selectFromMatch[1];
      const scalarSelectMatch = selectColsText.match(/(\(\s*SELECT\b[\s\S]+?\bFROM\b[\s\S]+?\))/i);
      if (scalarSelectMatch) {
        const scalarSnippet = scalarSelectMatch[1].trim();
        const subFromMatch = scalarSnippet.match(/\bFROM\s+([a-zA-Z0-9_\$#.]+)(?:\s+(?:AS\s+)?([a-zA-Z0-9_]+))?/i);
        const subWhereMatch = scalarSnippet.match(/\bWHERE\s+([^\)]+)/i);
        const subTbl = subFromMatch ? (subFromMatch[2] || subFromMatch[1]) : 'sub';
        const subCond = subWhereMatch ? subWhereMatch[1].trim() : `${subTbl}.ref_id = ana.id`;

        warnings.push({
          type: 'warning',
          category: 'subquery',
          categoryLabel: 'N+1 Skalar Alt Sorgu',
          title: 'SELECT Kolonunda Skalar Alt Sorgu (N+1 Döngüsü)',
          text: `SELECT listesinde yer alan alt sorgu her bir satır için ayrı ayrı çalıştırılır.`
        });
        recommendations.push({
          category: 'subquery',
          title: 'Skalar Alt Sorguyu Tek Seferlik LEFT JOIN ile Çözün',
          desc: 'Alt tablodaki verileri tek seferde bağlayın.',
          before: scalarSnippet,
          after: `LEFT JOIN (\n  SELECT ref_id, MIN(kolon) as deger\n  FROM ${subFromMatch ? subFromMatch[1] : 'alt_tablo'}\n  GROUP BY ref_id\n) ${subTbl} ON ${subCond}`
        });
      }
    }

    // WHERE Fonksiyon İndeks İptali
    const indexBreakingMatch = sql.match(/(\b(?:TRUNC|TO_DATE|TO_CHAR|UPPER|LOWER|SUBSTR|NVL|COALESCE|ROUND|INSTR|LPAD|TRIM)\s*\(\s*([a-zA-Z0-9_.]+)\s*\)\s*(?:=|>=|<=|>|<|LIKE|BETWEEN|IN\b)[^\n;\r]{1,90})/i);
    if (indexBreakingMatch) {
      const rawExpr = indexBreakingMatch[1].trim();
      const colName = indexBreakingMatch[2];
      warnings.push({
        type: 'danger',
        category: 'index',
        categoryLabel: 'B-Tree İndeks İptali',
        title: 'Kolonda Fonksiyon Kullanımı (Arama İndeksi İptal Edildi)',
        text: `WHERE şartında '${colName}' kolonu fonksiyona sarıldığı için B-Tree indeksi iptal olur.`
      });
      recommendations.push({
        category: 'index',
        title: `'${colName}' Kolonunu Fonksiyonsuz (Sargable) Olarak Filtreleyin`,
        desc: `Dönüşümü parametre tarafında yapın.`,
        before: rawExpr,
        after: `${colName} = :parametre`
      });
    }

    // Çok Katmanlı / Ağır Alt Sorgular (Derived Tables / Inline Views in FROM / JOIN)
    const inlineViewsCount = (cleanSql.match(/\b(?:FROM|JOIN)\s*\(\s*SELECT\b/gi) || []).length;
    if (inlineViewsCount > 0) {
      warnings.push({
        type: 'warning',
        category: 'inline_views',
        categoryLabel: 'İç İçe Inline Görünüm',
        title: `FROM / JOIN İçinde Türetilmiş Alt Sorgu (${inlineViewsCount} Adet Inline View)`,
        text: `Sorgu gövdesinde ${inlineViewsCount} adet iç içe türetilmiş tablo (Derived Table / Inline View) bulunuyor. Bu durum CBO optimizasyon planını karmaşıklaştırabilir ve TEMP/PGA bellek kullanımını artırabilir.`
      });
      recommendations.push({
        category: 'inline_views',
        title: 'Inline Alt Sorguları WITH (CTE) İfadesine Taşıyın',
        desc: 'İç içe alt sorguları WITH tab_adi AS (...) bloğu ile tanımlayarak SQL okunabilirliğini artırın ve optimizer\'ın ara tabloları daha net değerlendirmesini sağlayın.',
        before: 'FROM (\n  SELECT ...\n) aa LEFT JOIN (\n  SELECT ...\n) kk',
        after: 'WITH aa AS (\n  SELECT ...\n),\nkk AS (\n  SELECT ...\n)\nSELECT ... FROM aa LEFT JOIN kk ...'
      });
    }

    // TABLE() Fonksiyonu ile JOIN Bağlantısı
    const tableFuncMatch = cleanSql.match(/\b(?:FROM|JOIN)\s+TABLE\s*\(\s*([a-zA-Z0-9_\$#.]+)\s*\(/i);
    if (tableFuncMatch) {
      const funcName = tableFuncMatch[1];
      warnings.push({
        type: 'warning',
        category: 'table_func',
        categoryLabel: 'TABLE() Fonksiyonu',
        title: `TABLE(${funcName}) Pipelined / Fonksiyonel JOIN`,
        text: `'TABLE(${funcName}(...))' kullanımı veritabanı optimizer'ı (CBO) için kardinalite tahminini zorlaştırabilir. Fonksiyon büyük veri döndürüyorsa sorgu süresi uzayabilir.`
      });
      recommendations.push({
        category: 'table_func',
        title: 'Fonksiyon Kardinalitesini veya Filtre İndekslerini Doğrulayın',
        desc: 'Table fonksiyonunun giriş parametrelerinin indekslendiğinden ve mümkünse CARDINALITY hinti kullanıldığından emin olun.',
        before: tableFuncMatch[0],
        after: `/*+ CARDINALITY(s 100) */ ${tableFuncMatch[0]}`
      });
    }

    // NOT IN Kullanımı (Olası NULL Riski)
    const notInMatch = cleanSql.match(/\b([a-zA-Z0-9_\$#.]+)\s+NOT\s+IN\s*\(([^\)]+)\)/i);
    if (notInMatch) {
      const colName = notInMatch[1];
      warnings.push({
        type: 'warning',
        category: 'not_in',
        categoryLabel: 'NOT IN Riski',
        title: `'${colName} NOT IN (...)' Filtresi`,
        text: `NOT IN listesinde veya alt sorgusunda NULL değer bulunması durumunda SQL hiçbir satır döndürmez (Three-Valued Logic). Ayrıca NOT IN indeks kullanımını kısıtlayabilir.`
      });
      recommendations.push({
        category: 'not_in',
        title: `'NOT IN' Yerine 'NOT EXISTS' veya Açık IS NOT NULL Kullanın`,
        desc: 'Null güvenliği ve daha iyi indeks performansı için NOT EXISTS tercih edilir.',
        before: notInMatch[0],
        after: `NOT EXISTS (SELECT 1 FROM ... WHERE ...)`
      });
    }

    // EXISTS Alt Sorgusu
    if (existsCount > 0) {
      warnings.push({
        type: 'info',
        category: 'exists',
        categoryLabel: 'Korelasyonlu EXISTS',
        title: `Korelasyonlu EXISTS Alt Sorgusu (${existsCount} adet)`,
        text: `EXISTS ifadesi ana sorgu satırları için hızlı doğrulama sağlar. Bağlantı kolonlarının (örn: depo_id, malzeme_id, tarihi) kompozit B-Tree indeksle desteklendiğinden emin olun.`
      });
    }

    // ── GENİŞ GROUP BY LİSTESİ ANALİZİ (HER BLOK AYRI AYRI PARSE EDİLİR) ──
    let maxGroupByCols = 0;
    let worstGroupBySnippet = '';
    const groupByRegex = /\bGROUP\s+BY\s+([\s\S]+?)(?=\bHAVING\b|\bORDER\s+BY\b|\bUNION\b|\bFETCH\b|\bLIMIT\b|\bOFFSET\b|\)|\;|$)/gi;
    let gbm;
    while ((gbm = groupByRegex.exec(cleanSql)) !== null) {
      const rawClause = gbm[1].trim();
      let depth = 0;
      let colCount = 0;
      let currentChunk = '';
      for (let i = 0; i < rawClause.length; i++) {
        const char = rawClause[i];
        if (char === '(') depth++;
        else if (char === ')') depth = Math.max(0, depth - 1);
        else if (char === ',' && depth === 0) {
          if (currentChunk.trim()) colCount++;
          currentChunk = '';
          continue;
        }
        currentChunk += char;
      }
      if (currentChunk.trim()) colCount++;
      if (colCount > maxGroupByCols) {
        maxGroupByCols = colCount;
        worstGroupBySnippet = rawClause.replace(/\s+/g, ' ').slice(0, 90);
      }
    }

    if (maxGroupByCols >= 8) {
      warnings.push({
        type: 'warning',
        category: 'groupby',
        categoryLabel: 'Ağır GROUP BY',
        title: `Geniş GROUP BY Listesi (${maxGroupByCols} Kolon)`,
        text: `Sorgudaki bir gruplama bloğunda ${maxGroupByCols} adet kolon üzerinden gruplama yapılıyor ('${worstGroupBySnippet}...'). Bu durum veritabanında yüksek TEMP tablespace ve PGA sıralama belleği tüketebilir.`
      });
    }

    // Puanlama Hesabı (0 - 100)
    // Karmaşıklık Skoru: Yapısal büyüklüğü ve kod yoğunluğunu ölçer
    let rawScore = (totalJoins * 3.5) + (subqCount * 5) + (unionCount * 4) + (caseCount * 2) + (andOrCount * 0.4) + (paramCount * 1.5) + (cteCount * 2) + (lines * 0.08);
    let score = Math.max(0, Math.min(100, Math.round(rawScore)));

    // Sağlık Skoru: Performans ve temiz SQL kurallarına uygunluğu ölçer (100 = Kusursuz)
    const structuralDeduction = Math.min(40, Math.round(score * 0.35));
    const dangerDeduction = warnings.filter(w => w.type === 'danger').length * 15;
    const warningDeduction = warnings.filter(w => w.type === 'warning').length * 8;
    let healthScore = Math.max(10, Math.min(100, 100 - structuralDeduction - dangerDeduction - warningDeduction));

    let level = 'Basit (Hafif)', color = '#10b981', grade = 'A+';
    if (healthScore >= 88 && score <= 20) {
      level = 'Basit (Hafif & Temiz)'; color = '#10b981'; grade = 'A+';
    } else if (healthScore >= 75 && score <= 40) {
      level = 'Orta Düzey (İyi)'; color = '#3b82f6'; grade = 'A';
    } else if (healthScore >= 60 && score <= 65) {
      level = 'Karmaşık (Orta Yük)'; color = '#f59e0b'; grade = 'B';
    } else if (healthScore >= 45 && score <= 80) {
      level = 'Çok Karmaşık (Yüksek Yük)'; color = '#f97316'; grade = 'C';
    } else {
      level = 'Aşırı Karmaşık (Kritik Risk)'; color = '#ef4444'; grade = 'D';
    }

    const scoreExplanation = `Karmaşıklık Puanı (${score}/100), sorgunun yapısal büyüklüğünü temsil eder: ${totalJoins} Tablo Bağlantısı (JOIN), ${subqCount} Alt Sorgu (Subquery), ${unionCount} UNION kümesi, ${andOrCount} Mantıksal Koşul (AND/OR) ve ${lines} satır SQL kodu içeriyor.`;
    const healthExplanation = `Sağlık Notu (${healthScore}/100), sorgunun optimizasyon kalitesini ölçer: Tespit edilen ${warnings.length} adet potansiyel performans/indeks riski ve yapısal yükten puan kırılarak hesaplanmıştır.`;

    return {
      score,
      healthScore,
      level,
      color,
      grade,
      scoreExplanation,
      healthExplanation,
      details: {
        totalJoins, innerJoinCount, leftJoinCount, rightJoinCount, fullJoinCount, crossJoinCount,
        subqCount, caseCount, unionCount, unionAllCount, unionPureCount,
        andOrCount, orCount, paramCount, distinctCount,
        orderCount, groupCount, havingCount, windowCount, cteCount, cteNames,
        existsCount, inSubqCount, notInSubqCount, lines, maxGroupByCols
      },
      warnings,
      recommendations
    };
  }

  function emptyResult() {
    return {
      score: 0,
      healthScore: 100,
      level: 'Basit (Hafif)',
      color: '#10b981',
      grade: 'A+',
      details: {
        totalJoins: 0, innerJoinCount: 0, leftJoinCount: 0, rightJoinCount: 0, fullJoinCount: 0, crossJoinCount: 0,
        subqCount: 0, caseCount: 0, unionCount: 0, unionAllCount: 0, unionPureCount: 0,
        andOrCount: 0, orCount: 0, paramCount: 0, distinctCount: 0,
        orderCount: 0, groupCount: 0, havingCount: 0, windowCount: 0, cteCount: 0, cteNames: [],
        existsCount: 0, inSubqCount: 0, notInSubqCount: 0, lines: 0
      },
      recommendations: [],
      warnings: []
    };
  }

  window.FrpComplexity = {
    getSqlComplexity
  };
})();
