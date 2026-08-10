import {
  describeCommercialUse,
  isCommercialUseAllowed,
  parseVrmMeta,
  type VrmModelMeta,
} from './model-meta';

/** Dựng một file GLB tối thiểu có chunk JSON như thật. */
function buildGlb(json: unknown, options: { magic?: number; chunkType?: number; jsonLength?: number } = {}) {
  const text = new TextEncoder().encode(JSON.stringify(json));
  // Chunk JSON của GLB phải là bội số của 4, đệm bằng dấu cách.
  const padded = new Uint8Array(Math.ceil(text.length / 4) * 4).fill(0x20);
  padded.set(text);

  const total = 12 + 8 + padded.length;
  const buf = new Uint8Array(total);
  const view = new DataView(buf.buffer);
  view.setUint32(0, options.magic ?? 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, options.jsonLength ?? padded.length, true);
  view.setUint32(16, options.chunkType ?? 0x4e4f534a, true);
  buf.set(padded, 20);
  return buf;
}

const vrm1 = (meta: Record<string, unknown>) =>
  buildGlb({ extensions: { VRMC_vrm: { specVersion: '1.0', meta } } });

const vrm0 = (meta: Record<string, unknown>) =>
  buildGlb({ extensions: { VRM: { meta } } });

function unwrap(result: ReturnType<typeof parseVrmMeta>): VrmModelMeta {
  if (!result.ok) throw new Error(`expected a parse, got ${result.reason}`);
  return result.meta;
}

describe('parseVrmMeta', () => {
  describe('VRM 1.0', () => {
    it('reads the licence a corporation may use', () => {
      const meta = unwrap(
        parseVrmMeta(
          vrm1({
            name: 'livenova_model',
            authors: ['Thydynh'],
            licenseUrl: 'https://vrm.dev/licenses/1.0/',
            commercialUsage: 'corporation',
            creditNotation: 'required',
            allowRedistribution: false,
            modification: 'prohibited',
          }),
        ),
      );

      expect(meta).toEqual({
        specVersion: '1.0',
        name: 'livenova_model',
        authors: ['Thydynh'],
        licenseUrl: 'https://vrm.dev/licenses/1.0/',
        commercialUse: 'allowed',
        creditRequired: true,
        allowRedistribution: false,
        allowModification: false,
      });
      expect(isCommercialUseAllowed(meta)).toBe(true);
    });

    it('separates personal profit from corporate use', () => {
      // The streamer uploading is already earning on a commercial platform, so
      // "personal" was crossed before the file picker opened.
      const meta = unwrap(parseVrmMeta(vrm1({ commercialUsage: 'personalProfit' })));
      expect(meta.commercialUse).toBe('personal-only');
      expect(isCommercialUseAllowed(meta)).toBe(false);
    });

    it('rejects a non-profit-only licence', () => {
      const meta = unwrap(parseVrmMeta(vrm1({ commercialUsage: 'personalNonProfit' })));
      expect(meta.commercialUse).toBe('disallowed');
      expect(isCommercialUseAllowed(meta)).toBe(false);
    });

    it('never reads a missing declaration as permission', () => {
      const meta = unwrap(parseVrmMeta(vrm1({ name: 'no licence field' })));
      expect(meta.commercialUse).toBe('unknown');
      expect(isCommercialUseAllowed(meta)).toBe(false);
    });

    it('only drops the credit requirement on an explicit waiver', () => {
      expect(unwrap(parseVrmMeta(vrm1({ creditNotation: 'unnecessary' }))).creditRequired).toBe(false);
      expect(unwrap(parseVrmMeta(vrm1({ creditNotation: 'required' }))).creditRequired).toBe(true);
      expect(unwrap(parseVrmMeta(vrm1({}))).creditRequired).toBe(true);
    });

    it('accepts a single author written as a bare string', () => {
      expect(unwrap(parseVrmMeta(vrm1({ authors: 'Solo' }))).authors).toEqual(['Solo']);
      expect(unwrap(parseVrmMeta(vrm1({ authors: ['A', '', 7, 'B'] }))).authors).toEqual(['A', 'B']);
    });
  });

  describe('VRM 0.x', () => {
    it('reads the spec’s own misspelling of commercialUssageName', () => {
      const meta = unwrap(parseVrmMeta(vrm0({ title: 'Old', author: 'Someone', commercialUssageName: 'Allow' })));
      expect(meta.specVersion).toBe('0');
      expect(meta.commercialUse).toBe('allowed');
      expect(meta.authors).toEqual(['Someone']);
    });

    it('also reads the corrected spelling some exporters emit', () => {
      expect(unwrap(parseVrmMeta(vrm0({ commercialUsageName: 'Allow' }))).commercialUse).toBe('allowed');
    });

    it('rejects Disallow — the case that kept the bundled test model out of git', () => {
      const meta = unwrap(parseVrmMeta(vrm0({ commercialUssageName: 'Disallow' })));
      expect(isCommercialUseAllowed(meta)).toBe(false);
    });

    it('assumes credit is required, since 0.x cannot waive it', () => {
      expect(unwrap(parseVrmMeta(vrm0({}))).creditRequired).toBe(true);
    });
  });

  describe('malformed input', () => {
    it('rejects a file that is not GLB at all', () => {
      // Checked by bytes, not by extension or Content-Type: browsers send
      // application/octet-stream for .vrm, so both of those are just claims.
      expect(parseVrmMeta(new TextEncoder().encode('<html>nope</html>'))).toEqual({
        ok: false,
        reason: 'not-glb',
      });
    });

    it('rejects a wrong magic number', () => {
      expect(parseVrmMeta(buildGlb({}, { magic: 0x12345678 })).ok).toBe(false);
    });

    it('rejects a first chunk that is not JSON', () => {
      expect(parseVrmMeta(buildGlb({}, { chunkType: 0x004e4942 })).ok).toBe(false);
    });

    it('rejects a file too short to hold a header', () => {
      // Valid signature, then nothing — a download that was cut off, as opposed
      // to a file that was never a VRM.
      const stub = new Uint8Array(8);
      new DataView(stub.buffer).setUint32(0, 0x46546c67, true);
      expect(parseVrmMeta(stub)).toEqual({ ok: false, reason: 'truncated' });

      expect(parseVrmMeta(new Uint8Array(2))).toEqual({ ok: false, reason: 'truncated' });
    });

    it('refuses a declared chunk length larger than the file', () => {
      // The length field lives inside the uploaded file, so it is attacker
      // data: without this a 40-byte file could ask the server for 4GB.
      expect(parseVrmMeta(buildGlb({}, { jsonLength: 0xfffffff0 }))).toEqual({
        ok: false,
        reason: 'truncated',
      });
    });

    it('reports unparseable JSON distinctly from a non-VRM glTF', () => {
      const broken = buildGlb({});
      // Corrupt the opening brace of the JSON chunk.
      broken[20] = 0x7b;
      broken[21] = 0x7b;
      expect(parseVrmMeta(broken).ok).toBe(false);

      expect(parseVrmMeta(buildGlb({ meshes: [] }))).toEqual({ ok: false, reason: 'not-vrm' });
      expect(parseVrmMeta(buildGlb({ extensions: { KHR_lights_punctual: {} } }))).toEqual({
        ok: false,
        reason: 'not-vrm',
      });
    });
  });

  describe('describeCommercialUse', () => {
    it('explains every outcome so a rejection is actionable', () => {
      (['allowed', 'personal-only', 'disallowed', 'unknown'] as const).forEach((use) => {
        expect(describeCommercialUse(use).length).toBeGreaterThan(10);
      });
    });
  });
});
