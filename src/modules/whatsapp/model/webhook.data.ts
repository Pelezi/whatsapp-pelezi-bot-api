import { ApiProperty } from '@nestjs/swagger';

export class WebhookData {

    @ApiProperty({ description: 'Webhook verification mode', example: 'subscribe' })
    public readonly mode: string;

    @ApiProperty({ description: 'Webhook challenge string', example: 'challenge_string' })
    public readonly challenge: string;

    @ApiProperty({ description: 'Webhook verification token', example: 'token' })
    public readonly token: string;

    public constructor(mode: string, challenge: string, token: string) {
        this.mode = mode;
        this.challenge = challenge;
        this.token = token;
    }

}
