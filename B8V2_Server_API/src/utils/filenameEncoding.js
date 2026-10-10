const WINDOWS_1252_BYTES = new Map([
  ['\u20ac', 0x80], ['\u201a', 0x82], ['\u0192', 0x83], ['\u201e', 0x84],
  ['\u2026', 0x85], ['\u2020', 0x86], ['\u2021', 0x87], ['\u02c6', 0x88],
  ['\u2030', 0x89], ['\u0160', 0x8a], ['\u2039', 0x8b], ['\u0152', 0x8c],
  ['\u017d', 0x8e], ['\u2018', 0x91], ['\u2019', 0x92], ['\u201c', 0x93],
  ['\u201d', 0x94], ['\u2022', 0x95], ['\u2013', 0x96], ['\u2014', 0x97],
  ['\u02dc', 0x98], ['\u2122', 0x99], ['\u0161', 0x9a], ['\u203a', 0x9b],
  ['\u0153', 0x9c], ['\u017e', 0x9e], ['\u0178', 0x9f]
]);

const MOJIBAKE_MARKERS = /(?:Ã|Â|Ä|Æ|â|ð|á[\u0080-\u00bf»]|\uFFFD)/;

function bytesFromLatin1OrWindows1252(value) {
  const bytes = [];
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint <= 0xff) bytes.push(codePoint);
    else if (WINDOWS_1252_BYTES.has(character)) bytes.push(WINDOWS_1252_BYTES.get(character));
    else return null;
  }
  return Buffer.from(bytes);
}

function normalizeFilenameEncoding(value) {
  if (typeof value !== 'string' || !MOJIBAKE_MARKERS.test(value)) return value;
  const bytes = bytesFromLatin1OrWindows1252(value);
  if (!bytes) return value;
  const decoded = bytes.toString('utf8');
  if (!decoded || decoded.includes('\uFFFD')) return value;
  return decoded.normalize('NFC');
}

function normalizeFileRecord(record) {
  if (!record || typeof record !== 'object' || !record.OriginalName) return record;
  return { ...record, OriginalName: normalizeFilenameEncoding(record.OriginalName) };
}

function normalizeFileRecords(records) {
  return (records || []).map(normalizeFileRecord);
}

module.exports = { normalizeFilenameEncoding, normalizeFileRecord, normalizeFileRecords };
