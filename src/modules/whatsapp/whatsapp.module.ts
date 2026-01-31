import { Module } from '@nestjs/common';

import { CommonModule } from '../common';
import { WhatsappController, ConversationController } from './controller';
import { WhatsappService } from './service';

@Module({
    imports: [
        CommonModule
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
