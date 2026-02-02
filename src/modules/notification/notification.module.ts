import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { CommonModule } from '../common';

@Module({
    imports: [CommonModule],
    controllers: [NotificationController],
    providers: [NotificationService],
    exports: [NotificationService],
})
export class NotificationModule { }
