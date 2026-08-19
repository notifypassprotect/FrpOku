function extractSqlCommentsList(sql) {
  if (!sql) return [];
  const comments = [];
  const text = String(sql);

  text.replace(/--[^\n]*/g, match => {
    comments.push(match.replace(/^--\s*/, '').trim());
    return match;
  });

  text.replace(/\/\*[\s\S]*?\*\//g, match => {
    comments.push(match.replace(/^\/\*+/, '').replace(/\*+\/$/, '').trim());
    return match;
  });

  return comments.filter(Boolean);
}

window.extractSqlCommentsList = extractSqlCommentsList;