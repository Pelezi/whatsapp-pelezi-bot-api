import { Module } from '@nestjs/common';
import { CommonModule } from '../common';
import { UserController } from './controller/user.controller';
import { UserService } from './service/user.service';
import { ConfigModule } from '../config/config.module';

@Module({
    imports: [CommonModule, ConfigModule],
    controllers: [UserController],
    providers: [UserService],
    exports: [UserService]
})
export class UserModule {}
