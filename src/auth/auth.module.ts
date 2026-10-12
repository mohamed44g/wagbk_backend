import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { RoleGuard } from '../common/auth/role.guard';

@Global()
@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'development-only-secret'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '10d') as never,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, RoleGuard],
  exports: [JwtModule, JwtAuthGuard, RoleGuard],
})
export class AuthModule {}
