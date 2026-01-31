import { Module } from '@nestjs/common';
import { ProjectController } from './controller';
import { ProjectService } from './service';
import { CommonModule } from '../common';

@Module({
    imports: [CommonModule],
    controllers: [ProjectController],
    providers: [ProjectService],
    exports: [ProjectService],
})
export class ProjectModule {}
