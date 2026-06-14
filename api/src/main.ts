import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';

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
  const app = await NestFactory.create(AppModule);

  // Enable CORS for dashboard integration
  app.enableCors({
    origin: process.env.DASHBOARD_URL ?? 'http://127.0.0.1:3000',
    credentials: true,
  });

  app.use(cookieParser());

  const port = process.env.PORT ?? 4000;
  // Bind to 0.0.0.0 so Docker networking and healthchecks can reach the server
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 API Server is running on port ${port}`);
}
bootstrap();

