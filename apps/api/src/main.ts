import './otel';
import { NestFactory } from '@nestjs/core';
import { Logger, LoggerErrorInterceptor } from 'nestjs-pino';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.useGlobalInterceptors(new LoggerErrorInterceptor());

  app.enableCors({
    origin: true,
    allowedHeaders: ['Content-Type', 'x-visitor-id'],
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  });
  app.enableShutdownHooks();

  const doc = new DocumentBuilder()
    .setTitle('Stoic Quote API')
    .setDescription(
      "Simple API end points to get random quotes from Stoicism's four classic books",
    )
    .setVersion('0.0.1')
    .build();
  const conf = SwaggerModule.createDocument(app, doc);
  SwaggerModule.setup('api-doc', app, conf);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
