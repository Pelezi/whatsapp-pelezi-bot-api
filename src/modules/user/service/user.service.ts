import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common';
import { SecurityConfigService } from '../../config/service/security-config.service';
import * as UserData from '../model';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

interface RefreshTokenPayload {
    userId: number;
    type: string;
    iat?: number;
    exp?: number;
    iss?: string;
}

@Injectable()
export class UserService {

    constructor(
        private readonly prisma: PrismaService,
        private readonly securityConfig: SecurityConfigService,
    ) { }

    public async findAll() {
        return this.prisma.user.findMany({});
    }

    public async findById(userId: number) {
        return this.prisma.user.findUnique({
            where: { id: userId },
        });
    }

    public async create(body: UserData.UserInput) {
        try {
            // Hash password if provided
            const data: any = { ...body };
            if (data.password) {
                data.password = await bcrypt.hash(data.password, 10);
            }

            const user = await this.prisma.user.create({ data });

            return await this.prisma.user.findUnique({
                where: { id: user.id },
            });
        } catch (error: unknown) {
            throw new HttpException('Failed to create user', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    public async update(userId: number, data: UserData.UserInput) {
        try {
            // Hash password if provided
            const updateData: any = { ...data };
            if (updateData.password) {
                updateData.password = await bcrypt.hash(updateData.password, 10);
            }

            await this.prisma.user.update({
                where: { id: userId },
                data: updateData
            });

            return await this.prisma.user.findUnique({
                where: { id: userId }
            });
        } catch (err: any) {
            throw new HttpException(`Failed to update user: ${err.message}`, err.status || HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    public async delete(userId: number) {
        return this.prisma.user.delete({
            where: { id: userId },
        });
    }

    public async login(data: UserData.LoginInput): Promise<UserData.LoginOutput> {
        const user = await this.prisma.user.findUnique({
            where: { email: data.email }
        });

        if (!user) {
            throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);
        }

        if (!user.password) {
            throw new HttpException('User has no password set', HttpStatus.UNAUTHORIZED);
        }

        const isPasswordValid = await bcrypt.compare(data.password, user.password);

        if (!isPasswordValid) {
            throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);
        }

        const token = jwt.sign(
            {
                userId: user.id,
                email: user.email,
                role: user.role
            },
            this.securityConfig.jwtSecret,
            {
                expiresIn: this.securityConfig.jwtExpiresIn as string,
                issuer: this.securityConfig.jwtIssuer,
            } as jwt.SignOptions
        );

        // Generate refresh token (valid for 7 days)
        const refreshToken = jwt.sign(
            {
                userId: user.id,
                type: 'refresh'
            },
            this.securityConfig.jwtSecret,
            {
                expiresIn: '7d',
                issuer: this.securityConfig.jwtIssuer,
            } as jwt.SignOptions
        );

        // Store refresh token in database
        await this.prisma.user.update({
            where: { id: user.id },
            data: { refreshToken }
        });

        return {
            token,
            refreshToken,
            user: {
                id: user.id,
                email: user.email || undefined,
                role: user.role
            }
        };
    }

    public async refreshToken(refreshToken: string): Promise<{ token: string; refreshToken: string }> {
        try {
            // Verify refresh token
            const decoded = jwt.verify(refreshToken, this.securityConfig.jwtSecret, {
                algorithms: ['HS256'],
                issuer: this.securityConfig.jwtIssuer,
            });

            // Type guard to ensure payload is an object
            if (typeof decoded === 'string') {
                throw new HttpException('Invalid refresh token', HttpStatus.UNAUTHORIZED);
            }

            const payload = decoded as RefreshTokenPayload;

            if (payload.type !== 'refresh') {
                throw new HttpException('Invalid refresh token', HttpStatus.UNAUTHORIZED);
            }

            // Find user and verify refresh token matches
            const user = await this.prisma.user.findUnique({
                where: { id: payload.userId }
            });

            if (!user || user.refreshToken !== refreshToken) {
                throw new HttpException('Invalid refresh token', HttpStatus.UNAUTHORIZED);
            }

            // Generate new access token
            const newToken = jwt.sign(
                {
                    userId: user.id,
                    email: user.email,
                    role: user.role
                },
                this.securityConfig.jwtSecret,
                {
                    expiresIn: this.securityConfig.jwtExpiresIn as string,
                    issuer: this.securityConfig.jwtIssuer,
                } as jwt.SignOptions
            );

            // Generate new refresh token
            const newRefreshToken = jwt.sign(
                {
                    userId: user.id,
                    type: 'refresh'
                },
                this.securityConfig.jwtSecret,
                {
                    expiresIn: '7d',
                    issuer: this.securityConfig.jwtIssuer,
                } as jwt.SignOptions
            );

            // Update refresh token in database
            await this.prisma.user.update({
                where: { id: user.id },
                data: { refreshToken: newRefreshToken }
            });

            return {
                token: newToken,
                refreshToken: newRefreshToken
            };
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            throw new HttpException('refresh token inválido', HttpStatus.UNAUTHORIZED);
        }
    }

    public async logout(userId: number): Promise<void> {
        // Clear refresh token from database
        await this.prisma.user.update({
            where: { id: userId },
            data: { refreshToken: null }
        });
    }
}
