import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, Inject } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { PrismaService } from '../provider';

export interface ApiKeyRequest extends FastifyRequest {
    project?: {
        id: number;
        name: string;
    };
}

@Injectable()
export class ApiKeyGuard implements CanActivate {

    constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

    public async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<ApiKeyRequest>();
        
        // Extract API key from header
        const apiKey = request.headers['x-api-key'] as string;
        
        if (!apiKey) {
            throw new HttpException('API Key é obrigatória', HttpStatus.UNAUTHORIZED);
        }

        // Validate API key against database
        const project = await this.prisma.project.findFirst({
            where: { externalApiKey: apiKey },
            select: { id: true, name: true }
        });

        if (!project) {
            throw new HttpException('API Key inválida', HttpStatus.UNAUTHORIZED);
        }

        // Attach project to request for later use
        request.project = project;

        return true;
    }
}
