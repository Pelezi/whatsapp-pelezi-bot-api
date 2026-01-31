import { ApiProperty } from '@nestjs/swagger';

export class UserInput {
    @ApiProperty({ description: 'Email address', example: 'user@example.com', required: false })
    public readonly email?: string;

    @ApiProperty({ description: 'Password', example: 'password123', required: false })
    public readonly password?: string;

    @ApiProperty({ description: 'User role', example: 'admin', required: false })
    public readonly role?: string;
}

export class UserData {
    @ApiProperty({ description: 'User ID', example: 1 })
    public readonly id: number;

    @ApiProperty({ description: 'Email address', example: 'user@example.com', required: false })
    public readonly email?: string;

    @ApiProperty({ description: 'User role', example: 'admin' })
    public readonly role: string;
}

export class LoginInput {
    @ApiProperty({ description: 'Email address', example: 'user@example.com' })
    public readonly email: string;

    @ApiProperty({ description: 'Password', example: 'password123' })
    public readonly password: string;
}

export class LoginOutput {
    @ApiProperty({ description: 'JWT token', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
    public readonly token: string;

    @ApiProperty({ description: 'Refresh token', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
    public readonly refreshToken: string;

    @ApiProperty({ description: 'User data' })
    public readonly user: UserData;
}

export class RefreshTokenInput {
    @ApiProperty({ description: 'Refresh token', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
    public readonly refreshToken: string;
}