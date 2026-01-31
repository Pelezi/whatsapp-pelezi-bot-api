import { ApiProperty } from '@nestjs/swagger';

export class CreateProjectDto {
    @ApiProperty({ description: 'Project name', example: 'Church Management' })
    name: string;

    @ApiProperty({ description: 'Base API URL', example: 'https://api.example.com' })
    apiUrl: string | null;

    @ApiProperty({ description: 'API route to check if user phone number exists in project', example: '/check-user' })
    userNumbersApiUrl: string | null;

    @ApiProperty({ description: 'API Key for authenticating with userNumbersApiUrl', example: 'your-api-key-here', required: false })
    apiKey: string | null;
}
