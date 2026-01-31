import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { extractTokenPayload } from './security-utils';
import { AuthenticatedRequest } from '../types/authenticated-request.interface';

@Injectable()
export class JwtAuthGuard implements CanActivate {

    constructor(private reflector: Reflector) {}

    public canActivate(context: ExecutionContext): boolean {
        // Check if route is marked as public
        const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
            context.getHandler(),
            context.getClass(),
        ]);

        if (isPublic) {
            return true;
        }

        const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
        
        const tokenPayload = extractTokenPayload(request);
        
        if (!tokenPayload) {
            throw new HttpException('Token inválido ou expirado', HttpStatus.UNAUTHORIZED);
        }

        // Attach user to request for later use
        request.user = {
            id: tokenPayload.userId
        };

        return true;
    }
}
