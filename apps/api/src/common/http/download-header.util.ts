const WINDOWS_RESERVED_NAMES = new Set([
  'con',
  'prn',
  'aux',
  'nul',
  'com1',
  'com2',
  'com3',
  'com4',
  'com5',
  'com6',
  'com7',
  'com8',
  'com9',
  'lpt1',
  'lpt2',
  'lpt3',
  'lpt4',
  'lpt5',
  'lpt6',
  'lpt7',
  'lpt8',
  'lpt9'
]);

export function normalizeStoredFileName(fileName: string, fallbackBase = 'attachment') {
  const cleaned = (fileName || '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/:"*?<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);

  const normalized = cleaned || fallbackBase;
  const nameParts = normalized.split('.');
  const baseName = (nameParts.shift() || fallbackBase).trim() || fallbackBase;
  const extension = nameParts.length ? `.${nameParts.join('.')}` : '';
  const safeBase = WINDOWS_RESERVED_NAMES.has(baseName.toLowerCase()) ? `${fallbackBase}-${baseName}` : baseName;

  return `${safeBase}${extension}`.slice(0, 180);
}

export function buildAttachmentContentDisposition(fileName: string) {
  const safeName = normalizeStoredFileName(fileName, 'download');
  const asciiFallback = safeName.replace(/[^\x20-\x7E]+/g, '_').replace(/"/g, '');
  const encoded = encodeURIComponent(safeName)
    .replace(/['()]/g, escape)
    .replace(/\*/g, '%2A');

  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}
