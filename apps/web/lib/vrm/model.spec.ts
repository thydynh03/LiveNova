import { isUsingLocalDevModel, LOCAL_DEV_MODEL_URL, resolveVrmModelUrl } from './model';

/**
 * `process.env.NEXT_PUBLIC_*` được Next.js thay thẳng vào mã lúc build, nhưng
 * dưới Jest nó vẫn là truy cập thật vào `process.env`, nên ghi đè được.
 */
describe('resolveVrmModelUrl', () => {
  const original = process.env.NEXT_PUBLIC_VRM_MODEL_URL;

  afterEach(() => {
    process.env.NEXT_PUBLIC_VRM_MODEL_URL = original;
  });

  it('uses the configured URL when one is set', () => {
    process.env.NEXT_PUBLIC_VRM_MODEL_URL = 'https://cdn.example.com/avatar.vrm';
    expect(resolveVrmModelUrl()).toBe('https://cdn.example.com/avatar.vrm');
    expect(isUsingLocalDevModel()).toBe(false);
  });

  it('trims surrounding whitespace', () => {
    // A trailing newline pasted into a Vercel environment variable would
    // otherwise become part of the request path and 404.
    process.env.NEXT_PUBLIC_VRM_MODEL_URL = '  https://cdn.example.com/a.vrm\n';
    expect(resolveVrmModelUrl()).toBe('https://cdn.example.com/a.vrm');
  });

  it('falls back to the local dev model when unset or blank', () => {
    delete process.env.NEXT_PUBLIC_VRM_MODEL_URL;
    expect(resolveVrmModelUrl()).toBe(LOCAL_DEV_MODEL_URL);
    expect(isUsingLocalDevModel()).toBe(true);

    process.env.NEXT_PUBLIC_VRM_MODEL_URL = '   ';
    expect(resolveVrmModelUrl()).toBe(LOCAL_DEV_MODEL_URL);
    expect(isUsingLocalDevModel()).toBe(true);
  });
});
