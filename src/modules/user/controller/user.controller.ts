import { Controller, Get, Post, Body, Param, Delete, Put, HttpException, HttpStatus, UseGuards, SetMetadata } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { UserService } from '../service/user.service';
import * as UserData from '../model';
import { JwtAuthGuard } from '../../common/security';

// Custom decorator to mark routes as public
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

@Controller('users')
@ApiTags('usuarios')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserController {
    constructor(
        private readonly service: UserService,
    ) {}

    @Get(':userId')
    @ApiOperation({ summary: 'Buscar usuario por ID' })
    @ApiResponse({ status: 200, description: 'Dados do usuario' })
    @ApiResponse({ status: 404, description: 'Usuario não encontrado' })
    public async getById(@Param('userId') userIdParam: string) {
        const userId = Number(userIdParam);
        const user = await this.service.findById(userId);
        if (!user) throw new HttpException('Usuario não encontrado', HttpStatus.NOT_FOUND);
        return user;
    }

    @Get('')
    @ApiOperation({ summary: 'Listar todos os usuarios' })
    @ApiResponse({ status: 200, description: 'Lista de usuarios' })
    public async listAll() {
        return this.service.findAll();
    }

    @Post('')
    @Public()
    @ApiOperation({ summary: 'Criar usuario' })
    @ApiBody({ type: UserData.UserInput })
    @ApiResponse({ status: 201, description: 'Usuario criado' })
    public async create(
        @Body() body: UserData.UserInput
    ) {
        return this.service.create(body);
    }

    @Delete(':userId')
    @ApiOperation({ summary: 'Remover usuario' })
    @ApiResponse({ status: 200, description: 'Usuario removido' })
    public async remove(
        @Param('userId') userIdParam: string
    ) {
        const userId = Number(userIdParam);
        const user = await this.service.findById(userId);
        
        if (!user) {
            throw new HttpException('Usuario não encontrado', HttpStatus.NOT_FOUND);
        }
        
        return this.service.delete(userId);
    }

    @Put(':userId')
    @ApiOperation({ summary: 'Atualizar usuario' })
    @ApiResponse({ status: 200, description: 'Usuario atualizado' })
    public async update(
        @Param('userId') userIdParam: string, 
        @Body() body: UserData.UserInput
    ) {
        const userId = Number(userIdParam);
        const user = await this.service.findById(userId);
        
        if (!user) {
            throw new HttpException('Usuario não encontrado', HttpStatus.NOT_FOUND);
        }
        
        return this.service.update(userId, body);
    }

}
