import { ServiceUnavailableException } from '@nestjs/common';
import { SupabaseStorageService } from './supabase-storage.service';

/**
 * Ghi lại từng lệnh gọi HTTP để khẳng định *cách* service nói chuyện với
 * Supabase, không chỉ việc nó trả về gì. Ba thứ đáng kiểm: khoá không rò ra
 * ngoài, bucket được tạo công khai, và đường dẫn không đoán được.
 */
function mockFetch(handlers: ((url: string, init?: RequestInit) => Response | null)[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn = jest.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    for (const handler of handlers) {
      const res = handler(url, init);
      if (res) return res;
    }
    return new Response('not handled', { status: 500 });
  });
  (global as unknown as { fetch: unknown }).fetch = fn;
  return calls;
}

const ok = (body: unknown = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

describe('SupabaseStorageService', () => {
  let service: SupabaseStorageService;
  const env = { ...process.env };

  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://proj.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    delete process.env.SUPABASE_SECRET_KEY;
    delete process.env.SUPABASE_VRM_BUCKET;
    service = new SupabaseStorageService();
  });

  afterEach(() => {
    process.env = { ...env };
    jest.restoreAllMocks();
  });

  describe('isConfigured', () => {
    it('needs both the URL and the service role key', () => {
      expect(service.isConfigured()).toBe(true);

      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      expect(new SupabaseStorageService().isConfigured()).toBe(false);

      process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
      delete process.env.SUPABASE_URL;
      expect(new SupabaseStorageService().isConfigured()).toBe(false);
    });

    it('accepts either generation of secret key', () => {
      // Supabase is migrating: the dashboard now issues sb_secret_… keys while
      // service_role JWTs sit under a legacy tab. Whoever is configuring the
      // server should not have to work out which generation this code was
      // written against.
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      process.env.SUPABASE_SECRET_KEY = 'sb_secret_abc';
      expect(new SupabaseStorageService().isConfigured()).toBe(true);
    });

    it('prefers the newer secret key when both are present', async () => {
      process.env.SUPABASE_SECRET_KEY = 'sb_secret_new';
      const calls = mockFetch([() => ok()]);

      await new SupabaseStorageService().upload(Buffer.from('a'), { extension: '.vrm' });

      const headers = calls[calls.length - 1].init?.headers as Record<string, string>;
      expect(headers.authorization).toBe('Bearer sb_secret_new');
    });

    it('does not accept the publishable key as a substitute', () => {
      // The publishable key cannot write past Row Level Security, so treating it
      // as configuration would produce uploads that fail at the last step.
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_abc';
      expect(new SupabaseStorageService().isConfigured()).toBe(false);
    });
  });

  describe('upload', () => {
    it('returns a public URL under the bucket', async () => {
      mockFetch([(url) => (url.includes('/bucket/') ? ok() : ok())]);

      const result = await service.upload(Buffer.from('abc'), { extension: '.vrm', folder: 'vrm' });

      expect(result.url).toMatch(
        /^https:\/\/proj\.supabase\.co\/storage\/v1\/object\/public\/vrm-models\/vrm\/[0-9a-f-]{36}\.vrm$/,
      );
      expect(result.bytes).toBe(3);
    });

    it('gives the object an unguessable name', async () => {
      // The bucket is public, and many VRM licences forbid redistribution — so
      // the path must not be something a stranger can enumerate.
      mockFetch([() => ok()]);

      const a = await service.upload(Buffer.from('a'), { extension: '.vrm' });
      const b = await service.upload(Buffer.from('a'), { extension: '.vrm' });

      expect(a.path).not.toBe(b.path);
      expect(a.path).toMatch(/[0-9a-f-]{36}\.vrm$/);
    });

    it('authenticates with the service role key and never puts it in the URL', async () => {
      const calls = mockFetch([() => ok()]);

      await service.upload(Buffer.from('abc'), { extension: '.vrm' });

      const upload = calls[calls.length - 1];
      const headers = upload.init?.headers as Record<string, string>;
      expect(headers.authorization).toBe('Bearer service-role-key');
      expect(headers.apikey).toBe('service-role-key');
      // A key in a query string ends up in proxy logs and browser history.
      expect(upload.url).not.toContain('service-role-key');
    });

    it('refuses to overwrite an existing object', async () => {
      const calls = mockFetch([() => ok()]);

      await service.upload(Buffer.from('abc'), { extension: '.vrm' });

      const headers = calls[calls.length - 1].init?.headers as Record<string, string>;
      expect(headers['x-upsert']).toBe('false');
    });

    it('honours SUPABASE_VRM_BUCKET so environments do not share a bucket', async () => {
      process.env.SUPABASE_VRM_BUCKET = 'vrm-staging';
      mockFetch([() => ok()]);

      const result = await service.upload(Buffer.from('abc'), { extension: '.vrm' });

      expect(result.url).toContain('/public/vrm-staging/');
    });

    it('explains what to configure when it cannot run at all', async () => {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      await expect(
        new SupabaseStorageService().upload(Buffer.from('a'), { extension: '.vrm' }),
      ).rejects.toThrow(/SUPABASE_SECRET_KEY/);
    });

    it('reports the upload failure instead of returning a URL to nothing', async () => {
      mockFetch([
        (url) => (url.includes('/bucket') ? ok() : null),
        () => new Response(JSON.stringify({ message: 'Payload too large' }), { status: 413 }),
      ]);

      await expect(
        service.upload(Buffer.from('abc'), { extension: '.vrm' }),
      ).rejects.toThrow(/413.*Payload too large/);
    });

    it('copes with a non-JSON error from a proxy in front of Supabase', async () => {
      mockFetch([
        (url) => (url.includes('/bucket') ? ok() : null),
        () => new Response('<html>502 Bad Gateway</html>', { status: 502 }),
      ]);

      await expect(service.upload(Buffer.from('abc'), { extension: '.vrm' })).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });

  describe('bucket setup', () => {
    it('creates a public bucket when it is missing', async () => {
      // Public because OBS has no session. A signed URL would expire mid-stream
      // and the character would vanish from the stage.
      const calls = mockFetch([
        (url, init) =>
          url.endsWith('/bucket/vrm-models') && init?.method === undefined
            ? new Response('not found', { status: 404 })
            : null,
        () => ok(),
      ]);

      await service.upload(Buffer.from('abc'), { extension: '.vrm' });

      const create = calls.find((c) => c.url.endsWith('/storage/v1/bucket') && c.init?.method === 'POST');
      expect(create).toBeDefined();
      expect(JSON.parse(create!.init!.body as string)).toMatchObject({
        name: 'vrm-models',
        public: true,
      });
    });

    it('does not try to create a bucket that already exists', async () => {
      const calls = mockFetch([() => ok()]);

      await service.upload(Buffer.from('abc'), { extension: '.vrm' });

      expect(
        calls.filter((c) => c.url.endsWith('/storage/v1/bucket') && c.init?.method === 'POST'),
      ).toHaveLength(0);
    });

    it('checks the bucket once, not on every upload', async () => {
      const calls = mockFetch([() => ok()]);

      await service.upload(Buffer.from('a'), { extension: '.vrm' });
      await service.upload(Buffer.from('b'), { extension: '.vrm' });

      expect(calls.filter((c) => c.url.includes('/storage/v1/bucket/'))).toHaveLength(1);
    });

    it('treats a concurrent creation as success', async () => {
      // Two workers starting together both see 404 and both try to create it.
      // The loser gets 409, and the outcome it wanted has still been reached.
      mockFetch([
        (url, init) =>
          url.endsWith('/bucket/vrm-models') && init?.method === undefined
            ? new Response('not found', { status: 404 })
            : null,
        (url, init) =>
          url.endsWith('/storage/v1/bucket') && init?.method === 'POST'
            ? new Response(JSON.stringify({ message: 'already exists' }), { status: 409 })
            : null,
        () => ok(),
      ]);

      await expect(service.upload(Buffer.from('abc'), { extension: '.vrm' })).resolves.toMatchObject({
        bytes: 3,
      });
    });

    it('fails loudly when the bucket cannot be created', async () => {
      mockFetch([
        (url, init) =>
          url.endsWith('/bucket/vrm-models') && init?.method === undefined
            ? new Response('not found', { status: 404 })
            : null,
        (url, init) =>
          url.endsWith('/storage/v1/bucket') && init?.method === 'POST'
            ? new Response(JSON.stringify({ message: 'permission denied' }), { status: 403 })
            : null,
        () => ok(),
      ]);

      await expect(service.upload(Buffer.from('abc'), { extension: '.vrm' })).rejects.toThrow(
        /permission denied/,
      );
    });
  });
});
