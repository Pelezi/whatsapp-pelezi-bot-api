import { Module } from '@nestjs/common';

import { CommonModule } from '../common';
import { NotificationModule } from '../notification';
import { WhatsappController, ConversationController } from './controller';
import { WhatsappService } from './service';

@Module({
    imports: [
        CommonModule,
        NotificationModule
    ],
    providers: [
        WhatsappService
    ],
    controllers: [
        WhatsappController,
        ConversationController
    ]
})
export class WhatsappModule { }
