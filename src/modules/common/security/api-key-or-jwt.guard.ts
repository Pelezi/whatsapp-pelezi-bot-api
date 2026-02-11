import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FastifyRequest } from 'fastify';
import { PrismaService } from '../provider';
import { extractTokenPayload } from './security-utils';

export interface ApiKeyOrJwtRequest extends FastifyRequest {
    project?: {
        id: number;
        name: string;
    };
    user?: {
        id: number;
    };
}

@Injectable()
export class ApiKeyOrJwtGuard implements CanActivate {

    constructor(
        @Inject(PrismaService) private readonly prisma: PrismaService,
        private readonly reflector: Reflector
    ) {}

    public async canActivate(context: ExecutionContext): Promise<boolean> {
        // Check if route is marked as public
        const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
            context.getHandler(),
            context.getClass(),
        ]);

        if (isPublic) {
            return true;
        }

        const request = context.switchToHttp().getRequest<ApiKeyOrJwtRequest>();
        
        // Try API Key authentication first
        const apiKey = request.headers['x-api-key'] as string;
        
        if (apiKey) {
            // Validate API key against database
            const project = await this.prisma.project.findFirst({
                where: { externalApiKey: apiKey },
                select: { id: true, name: true }
            });

            if (project) {
                // Attach project to request for later use
                request.project = project;
                return true;
            }
            // If API key is provided but invalid, throw error
            throw new HttpException('API Key inválida', HttpStatus.UNAUTHORIZED);
        }

        // If no API key, try JWT authentication
        const tokenPayload = extractTokenPayload(request);
        
        if (tokenPayload) {
            // Attach user to request for later use
            request.user = {
                id: tokenPayload.userId
            };
            return true;
        }

        // Neither API key nor valid JWT token found
        throw new HttpException('Autenticação necessária: forneça API Key (X-API-Key header) ou Bearer Token', HttpStatus.UNAUTHORIZED);
    }
}
