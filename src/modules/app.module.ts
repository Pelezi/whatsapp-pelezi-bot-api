import { Module } from '@nestjs/common';

import { CommonModule } from './common';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { ProjectModule } from './project/project.module';

@Module({
    imports: [
        CommonModule,
        AuthModule,
        UserModule,
        WhatsappModule,
        ProjectModule
    ]
})
export class ApplicationModule {}
