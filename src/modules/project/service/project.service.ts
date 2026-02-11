import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common';
import { CreateProjectDto, UpdateProjectDto } from '../model';
import { randomBytes } from 'crypto';

@Injectable()
export class ProjectService {

    public constructor(
        private readonly prisma: PrismaService
    ) {}

    /**
     * Create a new project
     */
    public async create(createProjectDto: CreateProjectDto): Promise<any> {
        return this.prisma.project.create({
            data: {
                name: createProjectDto.name,
                apiUrl: createProjectDto.apiUrl,
                userNumbersApiUrl: createProjectDto.userNumbersApiUrl,
                apiKey: createProjectDto.apiKey,
            },
        });
    }

    /**
     * Get all projects
     */
    public async findAll(): Promise<any[]> {
        return this.prisma.project.findMany({
            include: {
                _count: {
                    select: { contacts: true },
                },
            },
            orderBy: { id: 'asc' },
        });
    }

    /**
     * Get a single project by ID
     */
    public async findOne(id: number): Promise<any> {
        const project = await this.prisma.project.findUnique({
            where: { id },
            include: {
                _count: {
                    select: { contacts: true },
                },
            },
        });

        if (!project) {
            throw new NotFoundException(`Project with ID ${id} not found`);
        }

        return project;
    }

    /**
     * Update a project
     */
    public async update(id: number, updateProjectDto: UpdateProjectDto): Promise<any> {
        // Check if project exists
        await this.findOne(id);

        return this.prisma.project.update({
            where: { id },
            data: {
                ...(updateProjectDto.name && { name: updateProjectDto.name }),
                ...(updateProjectDto.apiUrl !== undefined && { apiUrl: updateProjectDto.apiUrl }),
                ...(updateProjectDto.userNumbersApiUrl && { userNumbersApiUrl: updateProjectDto.userNumbersApiUrl }),
                ...(updateProjectDto.apiKey !== undefined && { apiKey: updateProjectDto.apiKey }),
            },
        });
    }

    /**
     * Delete a project
     */
    public async remove(id: number): Promise<void> {
        // Check if project exists
        await this.findOne(id);

        await this.prisma.project.delete({
            where: { id },
        });
    }

    /**
     * Generate a new API key for external APIs to authenticate with this API
     */
    public async generateApiKey(id: number): Promise<{ apiKey: string }> {
        // Check if project exists
        await this.findOne(id);

        // Generate a secure random API key (32 bytes = 64 hex characters)
        const apiKey = randomBytes(32).toString('hex');

        await this.prisma.project.update({
            where: { id },
            data: { externalApiKey: apiKey },
        });

        return { apiKey };
    }

    /**
     * Revoke (delete) the external API key for the project
     */
    public async revokeApiKey(id: number): Promise<void> {
        // Check if project exists
        await this.findOne(id);

        await this.prisma.project.update({
            where: { id },
            data: { externalApiKey: null },
        });
    }
}
