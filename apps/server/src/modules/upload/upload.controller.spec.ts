import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { CloudinaryService } from './cloudinary.service';
import { SupabaseStorageService } from './supabase-storage.service';

/** Dựng một tệp GLB tối thiểu mang siêu dữ liệu VRM như thật. */
function vrmFile(meta: Record<string, unknown>, size?: number): Express.Multer.File {
  const text = Buffer.from(JSON.stringify({ extensions: { VRMC_vrm: { meta } } }), 'utf-8');
  const padded = Buffer.alloc(Math.ceil(text.length / 4) * 4, 0x20);
  text.copy(padded);

  const buffer = Buffer.alloc(20 + padded.length);
  buffer.writeUInt32LE(0x46546c67, 0);
  buffer.writeUInt32LE(2, 4);
  buffer.writeUInt32LE(buffer.length, 8);
  buffer.writeUInt32LE(padded.length, 12);
  buffer.writeUInt32LE(0x4e4f534a, 16);
  padded.copy(buffer, 20);

  return {
    buffer,
    size: size ?? buffer.length,
    originalname: 'model.vrm',
    mimetype: 'application/octet-stream',
  } as Express.Multer.File;
}

const LICENSED = { name: 'livenova_model', authors: ['Thydynh'], commercialUsage: 'corporation' };

describe('UploadController — VRM', () => {
  let controller: UploadController;
  let uploadFile: jest.Mock;
  let supabaseUpload: jest.Mock;
  let isConfigured: jest.Mock;

  beforeEach(() => {
    uploadFile = jest.fn().mockResolvedValue({
      secure_url: 'https://res.cloudinary.com/demo/raw/upload/model.vrm',
      public_id: 'model',
      bytes: 1234,
    });
    supabaseUpload = jest.fn().mockResolvedValue({
      url: 'https://proj.supabase.co/storage/v1/object/public/vrm-models/vrm/abc.vrm',
      path: 'vrm/abc.vrm',
      bytes: 22_240_600,
    });
    // Mặc định coi như chưa cấu hình Supabase, để các phép thử sẵn có vẫn đi
    // qua đúng nhánh Cloudinary mà chúng được viết ra để kiểm.
    isConfigured = jest.fn().mockReturnValue(false);

    controller = new UploadController(
      { uploadFile } as unknown as CloudinaryService,
      { isConfigured, upload: supabaseUpload } as unknown as SupabaseStorageService,
    );
  });

  describe('licensing', () => {
    it('accepts a model a corporation may use, and returns its terms', async () => {
      const result = await controller.uploadVrm(vrmFile(LICENSED));

      expect(result.url).toBe('https://res.cloudinary.com/demo/raw/upload/model.vrm');
      expect(result.meta.name).toBe('livenova_model');
      expect(result.meta.creditRequired).toBe(true);
    });

    it('refuses a model that forbids commercial use', async () => {
      // This is the case the repo previously guarded with a .gitignore line and
      // a comment. A file picker opened to users does not read comments.
      await expect(
        controller.uploadVrm(vrmFile({ ...LICENSED, commercialUsage: 'personalNonProfit' })),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(uploadFile).not.toHaveBeenCalled();
    });

    it('refuses a personal-profit-only model', async () => {
      await expect(
        controller.uploadVrm(vrmFile({ ...LICENSED, commercialUsage: 'personalProfit' })),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses a model that declares nothing', async () => {
      await expect(controller.uploadVrm(vrmFile({ name: 'silent' }))).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('stores nothing when it refuses', async () => {
      await controller
        .uploadVrm(vrmFile({ ...LICENSED, commercialUsage: 'personalNonProfit' }))
        .catch(() => undefined);
      expect(uploadFile).not.toHaveBeenCalled();
    });
  });

  describe('file shape', () => {
    it('rejects a file that is not a GLB, whatever its name claims', async () => {
      const notVrm = {
        buffer: Buffer.from('<html>nope</html>'),
        size: 17,
        originalname: 'model.vrm',
        mimetype: 'application/octet-stream',
      } as Express.Multer.File;

      await expect(controller.uploadVrm(notVrm)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an oversized file', async () => {
      await expect(
        controller.uploadVrm(vrmFile(LICENSED, 80 * 1024 * 1024)),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a missing file', async () => {
      await expect(
        controller.uploadVrm(undefined as unknown as Express.Multer.File),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('storage', () => {
    it('sends VRM as a raw upload so nothing transcodes it', async () => {
      // Under resource_type auto, Cloudinary recognises a 3D model and may
      // convert it — and this project's own model sets modification: prohibited.
      await controller.uploadVrm(vrmFile(LICENSED));

      expect(uploadFile).toHaveBeenCalledWith(
        expect.anything(),
        'livenova/vrm',
        expect.objectContaining({ resourceType: 'raw' }),
      );
    });

    it('demands remote storage in production', async () => {
      // In production the API and the web app are different machines. The disk
      // fallback writes to the API's filesystem and returns a relative path,
      // which the browser resolves against the web domain and gets a 404 —
      // while the UI reports success. A dead link behind a green tick is worse
      // than an error, so the endpoint refuses to take that path.
      const previous = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        await controller.uploadVrm(vrmFile(LICENSED));
        expect(uploadFile).toHaveBeenCalledWith(
          expect.anything(),
          'livenova/vrm',
          expect.objectContaining({ requireRemote: true }),
        );
      } finally {
        process.env.NODE_ENV = previous;
      }
    });

    it('allows the disk fallback in development, where it actually resolves', async () => {
      const previous = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      try {
        await controller.uploadVrm(vrmFile(LICENSED));
        expect(uploadFile).toHaveBeenCalledWith(
          expect.anything(),
          'livenova/vrm',
          expect.objectContaining({ requireRemote: false }),
        );
      } finally {
        process.env.NODE_ENV = previous;
      }
    });

    it('surfaces a storage outage instead of inventing a URL', async () => {
      uploadFile.mockRejectedValueOnce(
        new ServiceUnavailableException('Máy chủ chưa cấu hình kho lưu trữ đám mây'),
      );

      await expect(controller.uploadVrm(vrmFile(LICENSED))).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });


  describe('Supabase Storage', () => {
    beforeEach(() => isConfigured.mockReturnValue(true));

    it('prefers Supabase over Cloudinary for VRM', async () => {
      // Cloudinary's free plan caps raw files at 10MB while a real character
      // model runs 15–25MB, so this is not a preference — it is the difference
      // between the feature working and not.
      const result = await controller.uploadVrm(vrmFile(LICENSED));

      expect(supabaseUpload).toHaveBeenCalled();
      expect(uploadFile).not.toHaveBeenCalled();
      expect(result.url).toBe(
        'https://proj.supabase.co/storage/v1/object/public/vrm-models/vrm/abc.vrm',
      );
      expect(result.bytes).toBe(22_240_600);
    });

    it('stores the file under a vrm folder with a .vrm extension', async () => {
      await controller.uploadVrm(vrmFile(LICENSED));

      expect(supabaseUpload).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({ folder: 'vrm', extension: '.vrm' }),
      );
    });

    it('still refuses a badly licensed model before touching storage', async () => {
      await expect(
        controller.uploadVrm(vrmFile({ ...LICENSED, commercialUsage: 'personalNonProfit' })),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(supabaseUpload).not.toHaveBeenCalled();
    });

    it('surfaces a Supabase outage rather than silently using Cloudinary', async () => {
      // Falling through would hit the 10MB raw cap and fail anyway, but with an
      // error naming the wrong service — sending the reader to the wrong logs.
      supabaseUpload.mockRejectedValueOnce(
        new ServiceUnavailableException('Không lưu được tệp lên Supabase Storage'),
      );

      await expect(controller.uploadVrm(vrmFile(LICENSED))).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      expect(uploadFile).not.toHaveBeenCalled();
    });

    it('falls back to Cloudinary only when Supabase is unconfigured', async () => {
      isConfigured.mockReturnValue(false);

      await controller.uploadVrm(vrmFile(LICENSED));

      expect(uploadFile).toHaveBeenCalled();
      expect(supabaseUpload).not.toHaveBeenCalled();
    });
  });
});
