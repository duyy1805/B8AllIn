function safeIdentifier(value, label='identifier') {
  if (!/^[A-Za-z0-9_]+$/.test(String(value || ''))) {
    throw new Error(`Unsafe SQL ${label}: ${value}`);
  }
  return `[${value}]`;
}
module.exports = { safeIdentifier };
