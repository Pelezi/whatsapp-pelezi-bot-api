import { FastifyRequest } from 'fastify';
import * as jwt from 'jsonwebtoken';
import { UnauthorizedException } from '@nestjs/common';

interface TokenPayload {
    userId: number;
    email?: string;
    iat?: number;
    exp?: number;
    iss?: string;
}

/**
 * Extracts and validates JWT token from the request.
 * Performs comprehensive validation including signature, expiration, and issuer.
 * 
 * @param request - The Fastify request object
 * @returns Token payload if valid, null otherwise
 */
export function extractTokenPayload(request: FastifyRequest): { userId: number } | null {

    const header = request.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return null;
    }

    const [, tokenChunk] = header.split(' ');
    if (!tokenChunk) {
        return null;
    }

    try {

        const env = process.env;
        
        // Verify token signature, expiration, and issuer
        const payload = jwt.verify(tokenChunk, `${env.JWT_SECRET}`, {
            algorithms: ['HS256'],
            issuer: env.JWT_ISSUER,
            // jwt.verify automatically checks expiration (exp claim)
            // Setting clockTolerance to handle small time differences
            clockTolerance: 30 // 30 seconds tolerance
        });

        if (typeof payload === 'string') {
            return null;
        }

        const tokenPayload = payload as TokenPayload;

        // Explicit validation of required claims
        if (!tokenPayload.userId || typeof tokenPayload.userId !== 'number') {
            throw new UnauthorizedException('token inválido: o campo userId está ausente ou inválido');
        }

        // Explicit expiration check (redundant with jwt.verify but more explicit)
        if (tokenPayload.exp) {
            const currentTimestamp = Math.floor(Date.now() / 1000);
            if (currentTimestamp > tokenPayload.exp) {
                throw new UnauthorizedException('token expirado');
            }
        }

        // Validate issuer matches expected value
        if (tokenPayload.iss && tokenPayload.iss !== env.JWT_ISSUER) {
            throw new UnauthorizedException('issuer do token inválido');
        }

        return {
            userId: tokenPayload.userId
        };

    }
    catch (err: unknown) {
        // Log specific JWT errors for debugging (in production, consider using a logger)
        if (err instanceof jwt.TokenExpiredError) {
            // Token has expired
            return null;
        } else if (err instanceof jwt.JsonWebTokenError) {
            // Invalid token (signature, malformed, etc.)
            return null;
        } else if (err instanceof jwt.NotBeforeError) {
            // Token not yet valid
            return null;
        }
        
        // For any other error, return null
        return null;
    }
}
