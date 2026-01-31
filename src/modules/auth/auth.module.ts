import { Module } from '@nestjs/common';
import { CommonModule } from '../common';
import { UserModule } from '../user/user.module';
import { AuthController } from './auth.controller';

@Module({
    imports: [CommonModule, UserModule],
    controllers: [AuthController]
})
export class AuthModule {}
