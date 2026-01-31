import { Module } from '@nestjs/common';
import { CommonModule } from '../common';
import { SecurityConfigService } from './service/security-config.service';

@Module({
    imports: [CommonModule],
    controllers: [],
    providers: [SecurityConfigService],
    exports: [SecurityConfigService]
})
export class ConfigModule {}
