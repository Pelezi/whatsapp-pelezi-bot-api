import { Controller, Get, Post, Delete, Body, HttpStatus, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { FastifyRequest } from 'fastify';

@Controller('notifications')
@ApiTags('notifications')
export class NotificationController {

    public constructor(
        private readonly notificationService: NotificationService
    ) { }

    @Get('vapid-public-key')
    @ApiOperation({ 
        summary: 'Get VAPID public key',
        description: 'Returns the VAPID public key for push notification subscription'
    })
    @ApiResponse({ status: HttpStatus.OK, description: 'VAPID public key retrieved successfully' })
    public async getVapidPublicKey(): Promise<{ publicKey: string }> {
        return {
            publicKey: this.notificationService.getPublicKey(),
        };
    }

    @Post('subscribe')
    @ApiOperation({ 
        summary: 'Subscribe to push notifications',
        description: 'Subscribes the current user to push notifications'
    })
    @ApiResponse({ status: HttpStatus.OK, description: 'Subscription successful' })
    public async subscribe(
        @Req() request: FastifyRequest,
        @Body() body: { subscription: PushSubscriptionJSON; userId: number }
    ): Promise<any> {
        const userAgent = request.headers['user-agent'];
        return this.notificationService.subscribe(body.userId, body.subscription, userAgent);
    }

    @Delete('unsubscribe')
    @ApiOperation({ 
        summary: 'Unsubscribe from push notifications',
        description: 'Unsubscribes the current user from push notifications'
    })
    @ApiResponse({ status: HttpStatus.OK, description: 'Unsubscription successful' })
    public async unsubscribe(@Body() body: { endpoint: string }): Promise<{ message: string }> {
        await this.notificationService.unsubscribe(body.endpoint);
        return { message: 'Unsubscribed successfully' };
    }

    @Post('test')
    @ApiOperation({ 
        summary: 'Send test notification',
        description: 'Sends a test notification to all subscribed users'
    })
    @ApiResponse({ status: HttpStatus.OK, description: 'Test notification sent' })
    public async sendTestNotification(@Body() body?: { userId?: number }): Promise<{ message: string }> {
        const payload = {
            title: 'Teste de Notificação',
            body: 'Esta é uma notificação de teste do sistema WhatsApp Bot!',
            icon: '/icon-192x192.png',
            badge: '/badge-72x72.png',
            data: {
                url: '/chat',
            },
        };

        if (body?.userId) {
            await this.notificationService.sendToUser(body.userId, payload);
        } else {
            await this.notificationService.sendToAll(payload);
        }

        return { message: 'Test notification sent' };
    }
}
