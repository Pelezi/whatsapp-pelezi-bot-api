import { Injectable, Logger } from '@nestjs/common';

/**
 * Service responsible for managing and validating security-related configuration.
 * This service ensures that critical environment variables are properly set
 * before the application starts, preventing insecure defaults in production.
 */
@Injectable()
export class SecurityConfigService {
    private readonly logger = new Logger(SecurityConfigService.name);

    private _jwtSecret: string;
    private _jwtIssuer: string;
    private _bcryptSaltRounds: number;

    constructor() {
        this.validateAndLoadConfig();
    }

    /**
     * Validates that all required security environment variables are set.
     * Throws an error if any critical configuration is missing.
     */
    private validateAndLoadConfig(): void {
        const errors: string[] = [];

        // Validate JWT_SECRET
        if (!process.env.JWT_SECRET) {
            errors.push('A variável de ambiente JWT_SECRET é obrigatória, mas não está definida');
        } else if (process.env.JWT_SECRET === 'ThisMustBeChanged') {
            errors.push('JWT_SECRET não deve usar o valor padrão inseguro "ThisMustBeChanged"');
        } else if (process.env.JWT_SECRET.length < 32) {
            errors.push('JWT_SECRET deve ter pelo menos 32 caracteres para segurança');
        }
        this._jwtSecret = process.env.JWT_SECRET || '';

        // Validate JWT_ISSUER
        if (!process.env.JWT_ISSUER) {
            errors.push('A variável de ambiente JWT_ISSUER é obrigatória, mas não está definida');
        } else if (process.env.JWT_ISSUER === 'IssuerApplication') {
            errors.push('JWT_ISSUER não deve usar o valor padrão "IssuerApplication"');
        }
        this._jwtIssuer = process.env.JWT_ISSUER || '';

        // Validate BCRYPT_SALT_ROUNDS (optional, with safe default)
        const saltRoundsEnv = process.env.BCRYPT_SALT_ROUNDS;
        if (saltRoundsEnv) {
            const parsed = parseInt(saltRoundsEnv, 10);
            if (isNaN(parsed) || parsed < 8 || parsed > 15) {
                errors.push('BCRYPT_SALT_ROUNDS deve ser um número entre 8 e 15');
            } else {
                this._bcryptSaltRounds = parsed;
            }
        } else {
            this._bcryptSaltRounds = 10; // Safe default
        }

        // If there are validation errors, log them and throw
        if (errors.length > 0) {
            console.log('Falha na validação da configuração de segurança:');
            errors.forEach(error => console.log(`  - ${error}`));
            throw new Error(
                'Configuração crítica de segurança está ausente ou inválida. ' +
                'Por favor, verifique as variáveis de ambiente e reinicie a aplicação.'
            );
        }

        this.logger.log('Configuração de segurança validada com sucesso');
    }

    /**
     * Get the validated JWT secret.
     * This should only be used for JWT signing and verification.
     */
    get jwtSecret(): string {
        return this._jwtSecret;
    }

    /**
     * Get the validated JWT issuer.
     * This is used to identify the token issuer in JWT claims.
     */
    get jwtIssuer(): string {
        return this._jwtIssuer;
    }

    /**
     * Get the configured bcrypt salt rounds.
     * Higher values are more secure but slower.
     */
    get bcryptSaltRounds(): number {
        return this._bcryptSaltRounds;
    }

    /**
     * Get the JWT expiration time for access tokens.
     * Defaults to 24 hours if not configured.
     */
    get jwtExpiresIn(): string {
        return process.env.JWT_EXPIRES_IN || '24h';
    }

    /**
     * Get the JWT expiration time for password reset/invite tokens.
     * Defaults to 48 hours if not configured.
     */
    get jwtPasswordResetExpiresIn(): string {
        return process.env.JWT_PASSWORD_RESET_EXPIRES_IN || '48h';
    }
}
