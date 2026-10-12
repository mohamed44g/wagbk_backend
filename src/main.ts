import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  console.log('Starting HTTP application...');
  const app = await NestFactory.create(AppModule);
  console.log('Nest application created');
  app.setGlobalPrefix('api/v1');
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Center Homework Management API')
    .setDescription(
      'REST API for teachers, students, homework, grading, and My Mistakes.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  console.log('Starting HTTP listener...');
  await app.listen(Number(process.env.PORT ?? 5000));
  console.log(`HTTP API listening on ${await app.getUrl()}`);
}
bootstrap().catch((error: unknown) => {
  console.error('Application startup failed:', error);
  process.exitCode = 1;
});
