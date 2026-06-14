import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for dashboard integration
  app.enableCors({
    origin: process.env.DASHBOARD_URL ?? 'http://127.0.0.1:3000',
    credentials: true,
  });

  app.use(cookieParser());

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  console.log(`API Server is running on: http://127.0.0.1:${port}`);
}
bootstrap();

