import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import session from 'express-session';

// Prevent silent crashes from unhandled rejections / exceptions
process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled promise rejection:', reason);
  process.exit(1);
});
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught exception:', err);
  process.exit(1);
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Enforce check for weak/default secrets in production
  if (process.env.NODE_ENV === 'production') {
    const jwtSecret = process.env.JWT_SECRET;
    const gatewayToken = process.env.GATEWAY_API_TOKEN;
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminCookiePassword = process.env.ADMIN_COOKIE_PASSWORD;

    if (!jwtSecret || jwtSecret === 'supersecretjwtkey') {
      console.error('❌ CRITICAL SECURITY ERROR: Weak or missing JWT_SECRET in production!');
      process.exit(1);
    }
    if (!gatewayToken || gatewayToken === 'default-gateway-secret') {
      console.error('❌ CRITICAL SECURITY ERROR: Weak or missing GATEWAY_API_TOKEN in production!');
      process.exit(1);
    }
    if (!adminEmail || adminEmail === 'admin@setu.com') {
      console.error('❌ CRITICAL SECURITY ERROR: Weak or missing ADMIN_EMAIL in production!');
      process.exit(1);
    }
    if (!adminPassword || adminPassword === 'adminpassword123') {
      console.error('❌ CRITICAL SECURITY ERROR: Weak or missing ADMIN_PASSWORD in production!');
      process.exit(1);
    }
    if (!adminCookiePassword || adminCookiePassword === 'sessionsecretcookiekey1234567890') {
      console.error('❌ CRITICAL SECURITY ERROR: Weak or missing ADMIN_COOKIE_PASSWORD in production!');
      process.exit(1);
    }
  }

  // Enable global validation rules
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  // All traffic arrives via the gateway (same-origin).
  // CORS origin is the single public domain; keeps local dev working too.
  app.enableCors({
    origin: process.env.PUBLIC_DOMAIN ?? 'http://localhost:3000',
    credentials: true,
  });

  app.use(cookieParser());
  app.use(
    session({
      secret: process.env.ADMIN_COOKIE_PASSWORD || 'sessionsecretcookiekey1234567890',
      resave: false,
      saveUninitialized: false,
    }),
  );

  const port = process.env.PORT ?? 4000;
  // Bind to 0.0.0.0 so Docker networking and healthchecks can reach the server
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 API Server is running on port ${port}`);
}
bootstrap();

