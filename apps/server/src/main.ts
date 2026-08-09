import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { loadEnv } from './common/config/env';
import { RedisService } from './common/redis/redis.service';
import { RedisIoAdapter } from './common/redis/redis-io.adapter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // C-05 — validate the environment before anything else boots. A missing or
  // weak secret aborts startup rather than silently degrading.
  const env = loadEnv();

  const app = await NestFactory.create(AppModule);

  // Security headers (Audit §13.1). helmet already emits X-Frame-Options,
  // X-Content-Type-Options and Referrer-Policy, so the hand-rolled middleware
  // that duplicated them has been removed.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          frameAncestors: ["'none'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
        },
      },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      hsts: env.isProduction
        ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
        : false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // M-06 — explicit origins only. `origin: '*'` with credentials is rejected by
  // browsers anyway, and loadEnv() refuses to start production without a list.
  app.enableCors({
    origin: env.corsOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Before `listen`, because gateways are constructed during startup and the
  // adapter has to be in place when they are.
  const redisAdapter = new RedisIoAdapter(app, app.get(RedisService));
  const clustered = await redisAdapter.connect();
  app.useWebSocketAdapter(redisAdapter);

  app.enableShutdownHooks();

  await app.listen(env.port);
  logger.log(`NestJS server listening on port ${env.port} [${env.nodeEnv}]`);
  logger.log(`CORS origins: ${env.corsOrigins.join(', ') || '(none)'}`);
  // What actually happened, not what was configured. A REDIS_URL that is set
  // but unreachable degrades to single-instance behaviour, and during an
  // incident "configured" is the wrong thing to read in the logs — it sends you
  // looking at the wrong layer while overlays sit frozen.
  logger.log(
    clustered
      ? `Realtime: Redis adapter dang hoat dong — instance ${env.instanceId}`
      : `Realtime: MOT instance (khong noi duoc Redis)${
          env.redisUrl ? ' — REDIS_URL co dat nhung khong ket noi duoc' : ''
        }`,
  );
}

bootstrap();
