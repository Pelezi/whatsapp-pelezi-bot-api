import { Injectable } from '@nestjs/common';
import { LoggerService } from '../common/provider';
import { PrismaService } from '../common';
import * as webpush from 'web-push';

export interface NotificationPayload {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    tag?: string;
    data?: any;
}

@Injectable()
export class NotificationService {
    private isConfigured = false;

    public constructor(
        private readonly logger: LoggerService,
        private readonly prisma: PrismaService
    ) {
        this.initializeWebPush();
    }

    private initializeWebPush(): void {
        const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
        const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

        if (!vapidPublicKey || !vapidPrivateKey) {
            this.logger.error('Push notifications are NOT configured. Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY in environment variables.');
            this.logger.error('To enable push notifications, generate VAPID keys with: npx web-push generate-vapid-keys');
            this.logger.error('Then add VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY to your .env file');
            this.isConfigured = false;
            return;
        }

        try {
            webpush.setVapidDetails(
                'mailto:alessandro@pelezi.com',
                vapidPublicKey,
                vapidPrivateKey
            );
            this.isConfigured = true;
            this.logger.error('Push notifications configured successfully');
        } catch (error) {
            this.logger.error(`Failed to configure push notifications: ${error.message}`);
            this.isConfigured = false;
        }
    }

    /**
     * Get VAPID public key for client subscription
     */
    public getPublicKey(): string {
        if (!this.isConfigured) {
            throw new Error('Push notifications not configured. Please set VAPID keys in environment variables.');
        }
        return process.env.VAPID_PUBLIC_KEY!;
    }

    /**
     * Subscribe a user to push notifications
     */
    public async subscribe(userId: number, subscription: PushSubscriptionJSON, userAgent?: string): Promise<any> {
        try {
            if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
                throw new Error('Invalid subscription object');
            }

            const existingSubscription = await this.prisma.pushSubscription.findUnique({
                where: { endpoint: subscription.endpoint },
            });

            if (existingSubscription) {
                // Update existing subscription
                return await this.prisma.pushSubscription.update({
                    where: { endpoint: subscription.endpoint },
                    data: {
                        userId,
                        p256dh: subscription.keys.p256dh,
                        auth: subscription.keys.auth,
                        userAgent: userAgent || existingSubscription.userAgent,
                    },
                });
            } else {
                // Create new subscription
                return await this.prisma.pushSubscription.create({
                    data: {
                        userId,
                        endpoint: subscription.endpoint,
                        p256dh: subscription.keys.p256dh,
                        auth: subscription.keys.auth,
                        userAgent,
                    },
                });
            }
        } catch (error) {
            this.logger.error(`Error subscribing to push notifications: ${error.message}`);
            throw error;
        }
    }

    /**
     * Unsubscribe a user from push notifications
     */
    public async unsubscribe(endpoint: string): Promise<void> {
        try {
            await this.prisma.pushSubscription.delete({
                where: { endpoint },
            });
        } catch (error) {
            this.logger.error(`Error unsubscribing from push notifications: ${error.message}`);
            throw error;
        }
    }

    /**
     * Send notification to a specific user
     */
    public async sendToUser(userId: number, payload: NotificationPayload): Promise<void> {
        if (!this.isConfigured) {
            return;
        }

        try {
            const subscriptions = await this.prisma.pushSubscription.findMany({
                where: { userId },
            });

            const notificationPayload = JSON.stringify(payload);

            const sendPromises = subscriptions.map(async (subscription) => {
                try {
                    const pushSubscription = {
                        endpoint: subscription.endpoint,
                        keys: {
                            p256dh: subscription.p256dh,
                            auth: subscription.auth,
                        },
                    };

                    await webpush.sendNotification(pushSubscription, notificationPayload);
                } catch (error) {
                    const statusCode = error.statusCode || 'unknown';
                    const body = error.body || 'no body';
                    this.logger.error(`Error sending notification to subscription ${subscription.id}: Status ${statusCode}, Message: ${error.message}, Body: ${body}`);
                    
                    // Remove invalid subscriptions (410 Gone, 404 Not Found)
                    if (error.statusCode === 410 || error.statusCode === 404) {
                        this.logger.error(`Removing invalid subscription ${subscription.id} (status ${error.statusCode})`);
                        await this.prisma.pushSubscription.delete({
                            where: { id: subscription.id },
                        });
                    }
                }
            });

            await Promise.all(sendPromises);
        } catch (error) {
            this.logger.error(`Error sending notification to user ${userId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Send notification to all users
     */
    public async sendToAll(payload: NotificationPayload): Promise<void> {
        if (!this.isConfigured) {
            return;
        }

        try {
            const subscriptions = await this.prisma.pushSubscription.findMany();

            const notificationPayload = JSON.stringify(payload);

            const sendPromises = subscriptions.map(async (subscription) => {
                try {
                    const pushSubscription = {
                        endpoint: subscription.endpoint,
                        keys: {
                            p256dh: subscription.p256dh,
                            auth: subscription.auth,
                        },
                    };

                    await webpush.sendNotification(pushSubscription, notificationPayload);
                } catch (error) {
                    const statusCode = error.statusCode || 'unknown';
                    const body = error.body || 'no body';
                    this.logger.error(`Error sending notification to subscription ${subscription.id}: Status ${statusCode}, Message: ${error.message}, Body: ${body}`);
                    
                    // Remove invalid subscriptions
                    if (error.statusCode === 410 || error.statusCode === 404) {
                        this.logger.error(`Removing invalid subscription ${subscription.id} (status ${error.statusCode})`);
                        await this.prisma.pushSubscription.delete({
                            where: { id: subscription.id },
                        });
                    }
                }
            });

            await Promise.all(sendPromises);
        } catch (error) {
            this.logger.error(`Error sending notification to all users: ${error.message}`);
            throw error;
        }
    }

    /**
     * Send notification for new message received
     */
    public async notifyNewMessage(contactName: string, messageText: string, conversationId: string): Promise<void> {
        if (!this.isConfigured) {
            return;
        }

        const payload: NotificationPayload = {
            title: `Nova mensagem de ${contactName}`,
            body: messageText.length > 100 ? messageText.substring(0, 100) + '...' : messageText,
            icon: '/notification-icon-192x192.png',
            badge: '/notification-badge-72x72.png',
            tag: `message-${conversationId}-${Date.now()}`,
            data: {
                url: `/chat`,
                conversationId,
            },
        };

        await this.sendToAll(payload);
    }

    /**
     * Send notification for message sent
     */
    public async notifyMessageSent(contactName: string, messageText: string, conversationId: string): Promise<void> {
        if (!this.isConfigured) {
            return;
        }

        const payload: NotificationPayload = {
            title: `Mensagem enviada para ${contactName}`,
            body: messageText.length > 100 ? messageText.substring(0, 100) + '...' : messageText,
            icon: '/notification-icon-192x192.png',
            badge: '/notification-badge-72x72.png',
            tag: `sent-${conversationId}-${Date.now()}`,
            data: {
                url: `/chat`,
                conversationId,
            },
        };

        await this.sendToAll(payload);
    }
}
