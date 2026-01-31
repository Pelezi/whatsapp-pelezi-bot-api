import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsUrl } from 'class-validator';

export class UpdateProjectDto {
    @ApiProperty({ description: 'Project name', example: 'Church Management', required: false })
    @IsString()
    @IsOptional()
    name?: string;

    @ApiProperty({ description: 'Base API URL', example: 'https://api.example.com', required: false })
    @IsString()
    @IsOptional()
    @IsUrl()
    apiUrl?: string;

    @ApiProperty({ description: 'API route to check if user phone number exists in project', example: '/check-user', required: false })
    @IsString()
    @IsOptional()
    userNumbersApiUrl?: string;

    @ApiProperty({ description: 'API Key for authenticating with userNumbersApiUrl', example: 'your-api-key-here', required: false })
    @IsString()
    @IsOptional()
    apiKey?: string;
}
