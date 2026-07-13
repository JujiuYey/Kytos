/**
 * Prepend the two directive lines (size / resolution) to a prompt body,
 * stripping any existing ones first. The shape matches what `scripts/draw.py`
 * reads, so app-written mds and hand-written mds are interchangeable.
 */
export function syncDirectives(raw: string, size: string, resolution: string): string {
  const sizeLine = `<!-- size: ${size} -->`;
  const resolutionLine = `<!-- resolution: ${resolution} -->`;
  const updated = raw
    .replace(/^<!--\s*size\s*:\s*\S+?\s*-->\s*/m, '')
    .replace(/^<!--\s*resolution\s*:\s*\S+?\s*-->\s*/m, '');
  return `${sizeLine}\n${resolutionLine}\n\n${updated.replace(/^\n+/, '')}`;
}

const NAME_PREFIX_RE = /^(\d{2})-/;

/**
 * Suggest the next available card name in `category`. Scans `NN-` prefixed
 * names, returns `{max + 1}` zero-padded to two digits + a trailing dash,
 * so the user just appends the suffix. Returns `00-` for empty categories.
 */
export function nextCardName(existingNames: string[]): string {
  let max = -1;
  for (const name of existingNames) {
    const match = NAME_PREFIX_RE.exec(name);
    if (!match) {
      continue;
    }
    const n = Number.parseInt(match[1] ?? '', 10);
    if (Number.isFinite(n) && n > max) {
      max = n;
    }
  }
  const next = Math.max(0, max + 1);
  return `${String(next).padStart(2, '0')}-`;
}
