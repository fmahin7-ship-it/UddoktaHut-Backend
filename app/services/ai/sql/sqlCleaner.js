const stripMarkdownFromSql = (content) =>
  content
    .replace(/```sql/gi, "")
    .replace(/```/g, "")
    .trim();

const extractSelectStatement = (sqlContent) => {
  const match = sqlContent.match(/SELECT[\s\S]*?(?:;|$)/i);
  if (!match) {
    return null;
  }

  return match[0].trim().replace(/;$/, "").replace(/```/g, "").trim();
};

export { stripMarkdownFromSql, extractSelectStatement };
