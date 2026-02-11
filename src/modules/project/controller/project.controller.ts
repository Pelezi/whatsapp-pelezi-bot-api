import { Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ProjectService } from '../service';
import { CreateProjectDto, UpdateProjectDto } from '../model';

@ApiTags('Projects')
@Controller('projects')
export class ProjectController {

    public constructor(
        private readonly projectService: ProjectService
    ) {}

    @Post()
    @ApiOperation({ summary: 'Create a new project' })
    @ApiResponse({ status: 201, description: 'Project created successfully' })
    public async create(@Body() createProjectDto: CreateProjectDto): Promise<any> {
        return this.projectService.create(createProjectDto);
    }

    @Get()
    @ApiOperation({ summary: 'Get all projects' })
    @ApiResponse({ status: 200, description: 'List of projects' })
    public async findAll(): Promise<any[]> {
        return this.projectService.findAll();
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a project by ID' })
    @ApiResponse({ status: 200, description: 'Project found' })
    @ApiResponse({ status: 404, description: 'Project not found' })
    public async findOne(@Param('id', ParseIntPipe) id: number): Promise<any> {
        return this.projectService.findOne(id);
    }

    @Put(':id')
    @ApiOperation({ summary: 'Update a project' })
    @ApiResponse({ status: 200, description: 'Project updated successfully' })
    @ApiResponse({ status: 404, description: 'Project not found' })
    public async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() updateProjectDto: UpdateProjectDto
    ): Promise<any> {
        return this.projectService.update(id, updateProjectDto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete a project' })
    @ApiResponse({ status: 204, description: 'Project deleted successfully' })
    @ApiResponse({ status: 404, description: 'Project not found' })
    public async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
        return this.projectService.remove(id);
    }

    @Post(':id/api-key/generate')
    @ApiOperation({ summary: 'Generate a new API key for the project' })
    @ApiResponse({ status: 200, description: 'API key generated successfully' })
    @ApiResponse({ status: 404, description: 'Project not found' })
    public async generateApiKey(@Param('id', ParseIntPipe) id: number): Promise<{ apiKey: string }> {
        return this.projectService.generateApiKey(id);
    }

    @Delete(':id/api-key')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Revoke the API key for the project' })
    @ApiResponse({ status: 204, description: 'API key revoked successfully' })
    @ApiResponse({ status: 404, description: 'Project not found' })
    public async revokeApiKey(@Param('id', ParseIntPipe) id: number): Promise<void> {
        return this.projectService.revokeApiKey(id);
    }
}
