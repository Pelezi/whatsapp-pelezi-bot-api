import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UserService } from '../user/service/user.service';
import { LoginInput, RefreshTokenInput } from '../user/model';
import { JwtAuthGuard } from '../common/security';
import { AuthenticatedRequest } from '../common/types/authenticated-request.interface';

@Controller('auth')
@ApiTags('auth')
export class AuthController {
    constructor(
        private readonly userService: UserService,
    ) {}

    @Post('login')
    @ApiOperation({ summary: 'Login de usuário' })
    @ApiBody({ type: LoginInput })
    @ApiResponse({ status: 200, description: 'Retorna token JWT e dados do usuário' })
    public async login(@Body() body: LoginInput) {
        const res = await this.userService.login(body);
        return res;
    }

    @Post('refresh')
    @ApiOperation({ summary: 'Atualizar token de acesso usando refresh token' })
    @ApiBody({ type: RefreshTokenInput })
    @ApiResponse({ status: 200, description: 'Retorna novo token JWT e refresh token' })
    public async refresh(@Body() body: RefreshTokenInput) {
        return this.userService.refreshToken(body.refreshToken);
    }

    @Post('logout')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Logout de usuário' })
    @ApiResponse({ status: 200, description: 'Usuário deslogado com sucesso' })
    public async logout(@Req() request: AuthenticatedRequest) {
        await this.userService.logout(request.user!.id);
        return { message: 'Logout realizado com sucesso' };
    }
}
