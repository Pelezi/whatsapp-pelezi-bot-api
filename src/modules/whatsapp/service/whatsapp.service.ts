import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { LoggerService } from '../../common/provider';
import { PrismaService } from '../../common';
import { WhatsAppApiHelper, FileStorageHelper } from '../helpers';
import { $Enums } from '../../../generated/prisma/client';
import { NotificationService } from '../../notification';
import axios from 'axios';

@Injectable()
export class WhatsappService {

    private whatsappApi: WhatsAppApiHelper;
    private fileStorage: FileStorageHelper;

    public constructor(
        private readonly logger: LoggerService,
        private readonly prisma: PrismaService,
        private readonly notificationService: NotificationService
    ) {
        this.whatsappApi = new WhatsAppApiHelper();
        this.fileStorage = new FileStorageHelper();
    }

    /**
     * Check which projects contain this phone number
     * 
     * @param phoneNumber WhatsApp phone number
     * @returns Array of project IDs where the number exists
     */
    private async checkContactInProjects(phoneNumber: string): Promise<number[]> {
        try {
            const projects = await this.prisma.project.findMany();
            const projectIds: number[] = [];

            for (const project of projects) {
                try {
                    // Skip if both apiUrl and userNumbersApiUrl are not configured
                    if (!project.apiUrl || !project.userNumbersApiUrl) {
                        continue;
                    }

                    const headers: any = {};
                    if (project.apiKey) {
                        headers['X-API-KEY'] = project.apiKey;
                    }

                    // Combine base URL with route
                    const baseUrl = project.apiUrl.replace(/\/$/, '');
                    const route = project.userNumbersApiUrl.startsWith('/') 
                        ? project.userNumbersApiUrl 
                        : `/${project.userNumbersApiUrl}`;
                    const fullUrl = `${baseUrl}${route}`;

                    const response = await axios.get(fullUrl, {
                        params: { phone: phoneNumber },
                        timeout: 63000,
                        headers,
                    });

                    if (response.data === true || response.data?.exists === true) {
                        projectIds.push(project.id);
                    }
                } catch (error) {
                    console.log(`Erro buscando a api do projeto ${project.name}: ${error.message}`);
                }
            }

            return projectIds;
        } catch (error) {
            console.log(`Erro buscando contato nos projetos: ${error}`);
            return [];
        }
    }

    /**
     * Handle project selection by contact
     * 
     * @param contact Contact object
     * @param projectIds Available project IDs
     * @param conversationId Optional conversation ID for sending messages
     */
    private async handleProjectSelection(contact: any, projectIds: number[], conversationId?: string): Promise<void> {
        try {
            if (projectIds.length === 0) {
                // Contact not in any project - clear project association
                await this.prisma.contact.update({
                    where: { id: contact.id },
                    data: {
                        projectId: null,
                        pendingProjectSelection: false,
                        availableProjectIds: null,
                    },
                });
                return;
            }

            if (projectIds.length === 1) {
                // Automatically select the only project
                await this.prisma.contact.update({
                    where: { id: contact.id },
                    data: {
                        projectId: projectIds[0],
                        pendingProjectSelection: false,
                        availableProjectIds: null,
                    },
                });

                // Send message informing which project was detected
                const detectedProject = await this.prisma.project.findUnique({
                    where: { id: projectIds[0] },
                });

                if (detectedProject && conversationId) {
                    const detectedText = `✅ Número encontrado! Você foi detectado no projeto: *${detectedProject.name}*`;
                    const detectedMsg = await this.whatsappApi.sendTextMessage(contact.waId, detectedText);
                    await this.saveOutboundMessage(conversationId, contact.id, detectedText, detectedMsg?.messages?.[0]?.id);
                }

                return;
            }

            // Multiple projects - ask user to choose
            const projects = await this.prisma.project.findMany({
                where: { id: { in: projectIds } },
            });

            let message = 'Você está cadastrado em múltiplos projetos. Por favor, escolha sobre qual projeto deseja falar:\n\n';
            projects.forEach((project) => {
                message += `${project.id} - ${project.name}\n`;
            });
            message += '\nDigite o número do projeto que deseja discutir.';

            // Send the selection message
            const sentMessage = await this.whatsappApi.sendTextMessage(contact.waId, message);

            // Get or create conversation for saving the outbound message
            let conversation;
            if (conversationId) {
                conversation = await this.prisma.conversation.findUnique({
                    where: { id: conversationId },
                });
            }
            
            if (!conversation) {
                conversation = await this.prisma.conversation.upsert({
                    where: { contactId: contact.id },
                    update: { lastMessageAt: new Date() },
                    create: {
                        contactId: contact.id,
                        lastMessageAt: new Date(),
                        unreadCount: 0,
                    },
                });
            }

            // Save the outbound message
            await this.saveOutboundMessage(conversation.id, contact.id, message, sentMessage?.messages?.[0]?.id);

            // Update contact to pending selection state
            await this.prisma.contact.update({
                where: { id: contact.id },
                data: {
                    pendingProjectSelection: true,
                    availableProjectIds: projectIds.join(','),
                    projectId: null,
                },
            });
        } catch (error) {
            console.log(`Error handling project selection: ${error}`);
        }
    }

    /**
     * Find contact with Brazilian number variations (with/without the 9th digit)
     * Brazilian mobile numbers: 55 (country) + 11 (area code) + 9XXXXXXXX or 8XXXXXXXX
     * 
     * @param waId WhatsApp ID to search for
     * @returns Contact if found, null otherwise
     */
    private async findContactWithBrVariations(waId: string): Promise<any | null> {
        // First, try to find the exact match
        let contact = await this.prisma.contact.findUnique({
            where: { waId },
        });

        if (contact) {
            return contact;
        }

        // Check if it's a Brazilian number (starts with 55)
        if (!waId.startsWith('55')) {
            return null;
        }

        // Generate the alternative number
        // Brazilian mobile numbers: 55 + area code (2 digits) + number (8 or 9 digits)
        // Format: 55 11 9XXXXXXXX (with 9) or 55 11 8XXXXXXXX (without 9)
        let alternativeNumber: string;

        // Extract area code (2 digits after country code)
        const areaCode = waId.substring(2, 4);
        const restOfNumber = waId.substring(4);

        // Check if the number has 9 digits and starts with 9
        if (restOfNumber.length === 9 && restOfNumber.startsWith('9')) {
            // Remove the 9 to get the old format
            alternativeNumber = `55${areaCode}${restOfNumber.substring(1)}`;
        }
        // Check if the number has 8 digits (old format)
        else if (restOfNumber.length === 8) {
            // Add 9 to get the new format
            alternativeNumber = `55${areaCode}9${restOfNumber}`;
        } else {
            // Not a standard Brazilian mobile number format
            return null;
        }

        // Search for the alternative number
        contact = await this.prisma.contact.findUnique({
            where: { waId: alternativeNumber },
        });

        return contact;
    }

    /**
     * Verify webhook token and mode
     *
     * @param mode Webhook mode
     * @param token Webhook token
     * @returns True if verification is successful
     */
    public verifyWebhook(mode: string, token: string): boolean {
        const WHATSAPP_WEBHOOK_VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

        if (!WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
            console.log('WHATSAPP_WEBHOOK_VERIFY_TOKEN environment variable is not set');
            return false;
        }

        if (mode === 'subscribe' && token === WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
            this.logger.info('WhatsApp webhook verified successfully');
            return true;
        }

        console.log('WhatsApp webhook verification failed: invalid token or mode');
        return false;
    }

    /**
     * Process incoming webhook event
     *
     * @param body Webhook event body
     */
    public async processWebhookEvent(body: any): Promise<void> {
        this.logger.info('WhatsApp webhook received: ' + JSON.stringify(body));

        const entry = body.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;

        if (!value) {
            return;
        }

        // Handle incoming messages
        if (value.messages) {
            await this.handleIncomingMessage(value);
        }

        // Handle status updates
        if (value.statuses) {
            await this.handleStatusUpdate(value);
        }
    }

    /**
     * Handle incoming message from webhook
     */
    private async handleIncomingMessage(value: any): Promise<void> {
        try {
            const message = value.messages[0];
            const contact = value.contacts[0];

            // Check for existing contact with Brazilian number variations (with/without 9)
            let dbContact = await this.findContactWithBrVariations(contact.wa_id);

            // If no existing contact found, create a new one
            if (!dbContact) {
                dbContact = await this.prisma.contact.create({
                    data: {
                        waId: contact.wa_id,
                        name: contact.profile?.name,
                    },
                });
            } else {
                // Update the name if it changed
                if (contact.profile?.name && contact.profile.name !== dbContact.name) {
                    dbContact = await this.prisma.contact.update({
                        where: { id: dbContact.id },
                        data: { name: contact.profile.name },
                    });
                }
            }

            // Get or create conversation (should always exist for message history)
            const conversation = await this.prisma.conversation.upsert({
                where: { contactId: dbContact.id },
                update: {
                    lastMessageAt: new Date(parseInt(message.timestamp) * 1000),
                    unreadCount: { increment: 1 },
                },
                create: {
                    contactId: dbContact.id,
                    lastMessageAt: new Date(parseInt(message.timestamp) * 1000),
                    unreadCount: 1,
                },
            });

            // Check if this is the first message from this contact
            const existingMessagesCount = await this.prisma.message.count({
                where: { contactId: dbContact.id },
            });

            const isFirstMessage = existingMessagesCount === 0;

            // Send welcome messages for first-time contacts
            if (isFirstMessage) {
                // First welcome message
                const welcomeText = `Olá! Você está falando com o Bot de WhatsApp de Alessandro. 👋`;
                const welcomeMsg = await this.whatsappApi.sendTextMessage(contact.wa_id, welcomeText);
                await this.saveOutboundMessage(conversation.id, dbContact.id, welcomeText, welcomeMsg?.messages?.[0]?.id);

                // Second message about checking registration
                const checkingText = `Estamos conferindo se o seu número está cadastrado em algum projeto para direcioná-lo corretamente...`;
                const checkingMsg = await this.whatsappApi.sendTextMessage(contact.wa_id, checkingText);
                await this.saveOutboundMessage(conversation.id, dbContact.id, checkingText, checkingMsg?.messages?.[0]?.id);
            }

            // Handle project selection logic
            const messageText = message.type === 'text' ? message.text.body.trim() : '';

            // Check if user sent "0" to reset project selection
            if (messageText === '0') {
                const projectIds = await this.checkContactInProjects(contact.wa_id);
                await this.handleProjectSelection(dbContact, projectIds, conversation.id);

                // Still save the message before returning
                await this.saveIncomingMessage(message, conversation.id, dbContact.id);
                return;
            }

            // If contact is pending project selection, handle their choice
            if (dbContact.pendingProjectSelection && messageText) {
                const availableIds = dbContact.availableProjectIds?.split(',').map(Number) || [];
                const selectedProjectId = parseInt(messageText);

                if (availableIds.includes(selectedProjectId)) {
                    // Valid selection - set the project
                    await this.prisma.contact.update({
                        where: { id: dbContact.id },
                        data: {
                            projectId: selectedProjectId,
                            pendingProjectSelection: false,
                            availableProjectIds: null,
                        },
                    });

                    const selectedProject = await this.prisma.project.findUnique({
                        where: { id: selectedProjectId },
                    });

                    const confirmationText = `Perfeito! Agora vamos falar sobre o projeto: ${selectedProject?.name}. Como posso ajudá-lo?`;
                    const sentMessage = await this.whatsappApi.sendTextMessage(
                        contact.wa_id,
                        confirmationText
                    );

                    // Save the outbound message
                    await this.saveOutboundMessage(conversation.id, dbContact.id, confirmationText, sentMessage?.messages?.[0]?.id);

                    // Still save the message before returning
                    await this.saveIncomingMessage(message, conversation.id, dbContact.id);
                    return;
                } else {
                    // Invalid selection - ask again
                    const errorText = `Opção inválida. Por favor, escolha um dos números listados.`;
                    const sentMessage = await this.whatsappApi.sendTextMessage(
                        contact.wa_id,
                        errorText
                    );

                    // Save the outbound message
                    await this.saveOutboundMessage(conversation.id, dbContact.id, errorText, sentMessage?.messages?.[0]?.id);

                    // Still save the message before returning
                    await this.saveIncomingMessage(message, conversation.id, dbContact.id);
                    return;
                }
            }

            // If contact doesn't have a project assigned, check projects
            if (!dbContact.projectId) {
                const projectIds = await this.checkContactInProjects(contact.wa_id);
                await this.handleProjectSelection(dbContact, projectIds, conversation.id);

                // If still no project after selection (not in any project), notify
                const updatedContact = await this.prisma.contact.findUnique({
                    where: { id: dbContact.id },
                });

                if (!updatedContact?.projectId && !updatedContact?.pendingProjectSelection) {
                    const notRegisteredText = `Desculpe, você não está cadastrado em nenhum projeto no momento.`;
                    const sentMessage = await this.whatsappApi.sendTextMessage(
                        contact.wa_id,
                        notRegisteredText
                    );

                    // Save the outbound message
                    await this.saveOutboundMessage(conversation.id, dbContact.id, notRegisteredText, sentMessage?.messages?.[0]?.id);

                    // Still save the message before returning
                    await this.saveIncomingMessage(message, conversation.id, dbContact.id);
                    return;
                }

                // If now pending selection, the message was sent
                if (updatedContact?.pendingProjectSelection) {
                    // Still save the message before returning
                    await this.saveIncomingMessage(message, conversation.id, dbContact.id);
                    return;
                }

                // Update dbContact reference with the newly assigned project
                dbContact = updatedContact;
            }

            // Save the regular message
            await this.saveIncomingMessage(message, conversation.id, dbContact.id);

            // Send push notification for new message
            try {
                const contactDisplayName = dbContact.customName || dbContact.name || dbContact.waId;
                const messageBody = message.type === 'text' 
                    ? message.text.body 
                    : `Nova mensagem (${message.type})`;
                await this.notificationService.notifyNewMessage(
                    contactDisplayName,
                    messageBody,
                    conversation.id
                );
            } catch (error) {
                console.log('Error sending push notification:', error.message);
            }

            this.logger.info(`Saved ${message.type} message from ${contact.profile?.name || contact.wa_id}`);
        } catch (error) {
            console.log('Error handling incoming message:', error);
            throw new HttpException('Error handling incoming message', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Save incoming message to database
     */
    private async saveIncomingMessage(message: any, conversationId: string, contactId: string): Promise<void> {
        // Process message based on type
        const messageData: any = {
            id: message.id,
            conversationId: conversationId,
            contactId: contactId,
            type: this.mapMessageType(message.type),
            direction: $Enums.Direction.INBOUND,
            timestamp: BigInt(parseInt(message.timestamp) * 1000),
            status: $Enums.MessageStatus.DELIVERED,
        };

        // Handle context (reply to another message)
        if (message.context?.id) {
            messageData.replyToId = message.context.id;
        }

        // Handle different message types
        switch (message.type) {
            case 'text':
                messageData.textBody = message.text.body;
                break;

            case 'image':
                messageData.caption = message.image.caption;
                messageData.mediaId = message.image.id;
                messageData.mediaMimeType = message.image.mime_type;
                messageData.mediaLocalPath = await this.downloadAndSaveMedia(
                    message.image.id,
                    message.image.mime_type
                );
                break;

            case 'video':
                messageData.caption = message.video.caption;
                messageData.mediaId = message.video.id;
                messageData.mediaMimeType = message.video.mime_type;
                messageData.mediaLocalPath = await this.downloadAndSaveMedia(
                    message.video.id,
                    message.video.mime_type
                );
                break;

            case 'audio':
                messageData.mediaId = message.audio.id;
                messageData.mediaMimeType = message.audio.mime_type;
                messageData.isVoice = message.audio.voice;
                messageData.mediaLocalPath = await this.downloadAndSaveMedia(
                    message.audio.id,
                    message.audio.mime_type
                );
                break;

            case 'sticker':
                messageData.mediaId = message.sticker.id;
                messageData.mediaMimeType = message.sticker.mime_type;
                messageData.isAnimated = message.sticker.animated;
                messageData.mediaLocalPath = await this.downloadAndSaveMedia(
                    message.sticker.id,
                    message.sticker.mime_type
                );
                break;

            case 'document':
                messageData.mediaId = message.document.id;
                messageData.mediaMimeType = message.document.mime_type;
                messageData.mediaFilename = message.document.filename;
                messageData.mediaLocalPath = await this.downloadAndSaveMedia(
                    message.document.id,
                    message.document.mime_type,
                    message.document.filename
                );
                break;

            case 'location':
                messageData.latitude = message.location.latitude;
                messageData.longitude = message.location.longitude;
                break;

            case 'reaction':
                messageData.reactionEmoji = message.reaction.emoji;
                messageData.replyToId = message.reaction.message_id;
                break;

            case 'unsupported':
                // Just save as unsupported
                break;
        }

        // Save message to database
        await this.prisma.message.create({ data: messageData });
    }

    /**
     * Save outbound text message to database
     */
    private async saveOutboundMessage(conversationId: string, contactId: string, textBody: string, wamid?: string): Promise<void> {
        const messageData: any = {
            id: wamid || `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            conversationId: conversationId,
            contactId: contactId,
            type: $Enums.MessageType.TEXT,
            direction: $Enums.Direction.OUTBOUND,
            timestamp: BigInt(Date.now()),
            status: $Enums.MessageStatus.SENT,
            textBody: textBody,
        };

        await this.prisma.message.create({ data: messageData });
    }

    /**
     * Handle status update from webhook
     */
    private async handleStatusUpdate(value: any): Promise<void> {
        try {
            const status = value.statuses[0];

            const updateData: any = {
                status: this.mapStatus(status.status),
            };

            if (status.status === 'sent') {
                updateData.sentAt = new Date(parseInt(status.timestamp) * 1000);
            } else if (status.status === 'delivered') {
                updateData.deliveredAt = new Date(parseInt(status.timestamp) * 1000);
            } else if (status.status === 'read') {
                updateData.readAt = new Date(parseInt(status.timestamp) * 1000);
            } else if (status.status === 'failed') {
                updateData.failedAt = new Date(parseInt(status.timestamp) * 1000);
                updateData.status = $Enums.MessageStatus.FAILED;
            }

            // Update message status
            await this.prisma.message.update({
                where: { id: status.id },
                data: updateData,
            });

            console.log(`Updated message ${status.id} to status: ${status.status}`);
        } catch (error) {
            console.log('Error handling status update:', error);
            throw new HttpException('Error handling status update', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Download and save media from WhatsApp
     */
    private async downloadAndSaveMedia(
        mediaId: string,
        mimeType: string,
        filename?: string
    ): Promise<string> {
        try {
            const buffer = await this.whatsappApi.downloadMedia(mediaId);
            const localPath = await this.fileStorage.saveMediaFile(buffer, mimeType, filename);
            return localPath;
        } catch (error) {
            console.log('Error downloading media:', error);
            throw new HttpException('Error downloading media', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Map WhatsApp message type to database enum
     */
    private mapMessageType(type: string): $Enums.MessageType {
        const typeMap: Record<string, $Enums.MessageType> = {
            text: $Enums.MessageType.TEXT,
            image: $Enums.MessageType.IMAGE,
            video: $Enums.MessageType.VIDEO,
            audio: $Enums.MessageType.AUDIO,
            sticker: $Enums.MessageType.STICKER,
            document: $Enums.MessageType.DOCUMENT,
            location: $Enums.MessageType.LOCATION,
            reaction: $Enums.MessageType.REACTION,
            unsupported: $Enums.MessageType.UNSUPPORTED,
        };
        return typeMap[type] || $Enums.MessageType.UNSUPPORTED;
    }

    /**
     * Map WhatsApp status to database enum
     */
    private mapStatus(status: string): $Enums.MessageStatus {
        const statusMap: Record<string, $Enums.MessageStatus> = {
            sent: $Enums.MessageStatus.SENT,
            delivered: $Enums.MessageStatus.DELIVERED,
            read: $Enums.MessageStatus.READ,
            failed: $Enums.MessageStatus.FAILED,
        };
        return statusMap[status] || $Enums.MessageStatus.SENT;
    }

    /**
     * Send text message
     */
    public async sendTextMessage(conversationId: string, text: string, replyToId?: string): Promise<any> {
        try {
            // Get conversation to find recipient
            const conversation = await this.prisma.conversation.findUnique({
                where: { id: conversationId },
                include: { contact: true },
            });

            if (!conversation) {
                throw new Error('Conversation not found');
            }

            // Send via WhatsApp API
            const response = await this.whatsappApi.sendTextMessage(conversation.contact.waId, text, replyToId);

            const messageId = response.messages[0].id;

            // Save to database
            const message = await this.prisma.message.create({
                data: {
                    id: messageId,
                    conversationId,
                    contactId: conversation.contactId,
                    type: $Enums.MessageType.TEXT,
                    direction: $Enums.Direction.OUTBOUND,
                    timestamp: BigInt(Date.now()),
                    textBody: text,
                    status: $Enums.MessageStatus.SENT,
                    sentAt: new Date(),
                    replyToId: replyToId || null,
                },
            });

            // Update conversation
            await this.prisma.conversation.update({
                where: { id: conversationId },
                data: { lastMessageAt: new Date() },
            });

            // Convert BigInt to string for JSON serialization
            return {
                ...message,
                timestamp: message.timestamp.toString(),
            };
        } catch (error) {
            console.log('Error sending message:', error);
            throw new HttpException('Error sending message', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Get all conversations
     */
    public async getConversations(): Promise<any[]> {
        const conversations = await this.prisma.conversation.findMany({
            include: {
                contact: true,
                messages: {
                    orderBy: { timestamp: 'desc' },
                    take: 1,
                },
            },
            orderBy: { lastMessageAt: 'desc' },
        });

        // For each conversation, find the last inbound message or last outbound template
        const conversationsWithWindow = await Promise.all(
            conversations.map(async (conv) => {
                // Find last inbound message OR last outbound template message
                const lastRelevantMessage = await this.prisma.message.findFirst({
                    where: {
                        conversationId: conv.id,
                        OR: [
                            { direction: 'INBOUND' },
                            {
                                direction: 'OUTBOUND',
                                templateHeader: { not: null },
                            },
                        ],
                    },
                    orderBy: { timestamp: 'desc' },
                });

                // Calculate if we're within 24h window
                let isWithin24Hours = false;
                let lastRelevantMessageTime: Date | null = null;
                
                if (lastRelevantMessage) {
                    lastRelevantMessageTime = new Date(Number(lastRelevantMessage.timestamp) * 1000);
                    const now = new Date();
                    const hoursSince = (now.getTime() - lastRelevantMessageTime.getTime()) / (1000 * 60 * 60);
                    isWithin24Hours = hoursSince < 24;
                }

                return {
                    ...conv,
                    isWithin24Hours,
                    lastRelevantMessageTime: lastRelevantMessageTime?.toISOString() || null,
                    messages: conv.messages.map(msg => ({
                        ...msg,
                        timestamp: msg.timestamp.toString(),
                    })),
                };
            })
        );

        // Convert BigInt to string for JSON serialization
        return conversationsWithWindow;
    }

    /**
     * Get messages for a conversation
     */
    public async getMessages(conversationId: string): Promise<any[]> {
        // Mark messages as read
        await this.prisma.conversation.update({
            where: { id: conversationId },
            data: { unreadCount: 0 },
        });

        const messages = await this.prisma.message.findMany({
            where: { conversationId },
            orderBy: { timestamp: 'asc' },
            include: {
                contact: true,
                replyTo: {
                    include: {
                        contact: true,
                    },
                },
            },
        });

        // Convert BigInt to string for JSON serialization
        return messages.map(msg => ({
            ...msg,
            timestamp: msg.timestamp.toString(),
            replyTo: msg.replyTo ? {
                ...msg.replyTo,
                timestamp: msg.replyTo.timestamp.toString(),
            } : null,
        }));
    }

    /**
     * Send invite to church template message
     */
    public async inviteToChurch(
        to: string,
        name: string,
        platform: string,
        platformUrl: string,
        login: string,
        password: string,
        requestHost: string
    ): Promise<any> {
        try {
            const components = [
                {
                    type: 'header',
                    parameters: [
                        {
                            type: 'text',
                            parameter_name: 'name',
                            text: name,
                        },
                    ],
                },
                {
                    type: 'body',
                    parameters: [
                        {
                            type: 'text',
                            parameter_name: 'platform',
                            text: platform,
                        },
                        {
                            type: 'text',
                            parameter_name: 'platform_url',
                            text: platformUrl,
                        },
                        {
                            type: 'text',
                            parameter_name: 'login',
                            text: login,
                        },
                        {
                            type: 'text',
                            parameter_name: 'password',
                            text: password,
                        },
                    ],
                },
            ];

            const response = await this.whatsappApi.sendTemplateMessage(
                to,
                'access_created',
                'en',
                components
            );

            // Create the formatted message text
            const messageText = `Bem vindo ${name}
                Olá, seu acesso à plataforma ${platform} foi criado.
                Você pode estar acessando através desse link:
                ${platformUrl}
                Com o seguinte acesso:
                ${login}
                Senha: ${password}

                Por favor mude a sua senha após o primeiro acesso.
                Plataforma feita por Alessandro Cardoso`;

            // Check for existing contact with Brazilian number variations (with/without 9)
            let dbContact = await this.findContactWithBrVariations(to);

            // Find project that matches the request host
            let matchingProject = null;
            try {
                // Remove port from host if present (e.g., "example.com:3000" -> "example.com")
                const hostname = requestHost.split(':')[0];
                
                // Find project where apiUrl contains the request hostname
                const projects = await this.prisma.project.findMany({
                    where: {
                        apiUrl: {
                            contains: hostname,
                        },
                    },
                });

                if (projects.length > 0) {
                    matchingProject = projects[0];
                }
            } catch (error) {
                console.log('Error matching project by request host:', error.message);
            }

            // If no existing contact found, create a new one with custom name and project
            if (!dbContact) {
                dbContact = await this.prisma.contact.create({
                    data: {
                        waId: to,
                        customName: name, // Set custom name from invite
                        ...(matchingProject && { projectId: matchingProject.id }),
                    },
                });
            } else {
                // Update custom name and project if contact exists
                dbContact = await this.prisma.contact.update({
                    where: { id: dbContact.id },
                    data: { 
                        customName: name,
                        ...(matchingProject && { projectId: matchingProject.id }),
                    },
                });
            }

            // Get or create conversation
            const conversation = await this.prisma.conversation.upsert({
                where: { contactId: dbContact.id },
                update: {
                    lastMessageAt: new Date(),
                },
                create: {
                    contactId: dbContact.id,
                    lastMessageAt: new Date(),
                    unreadCount: 0,
                },
            });

            // Save message to database
            const messageId = response.messages[0].id;
            await this.prisma.message.create({
                data: {
                    id: messageId,
                    conversationId: conversation.id,
                    contactId: dbContact.id,
                    type: $Enums.MessageType.TEXT,
                    direction: $Enums.Direction.OUTBOUND,
                    timestamp: BigInt(Date.now()),
                    textBody: messageText,
                    templateHeader: `Bem vindo ${name}`,
                    templateFooter: 'Plataforma feita por Alessandro Cardoso',
                    status: $Enums.MessageStatus.SENT,
                    sentAt: new Date(),
                },
            });


            return response;
        } catch (error) {
            console.log('Error sending invite to church:', error);
            throw new HttpException('Error sending invite', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Send password reset template message
     */
    public async passwordReset(
        to: string,
        name: string,
        platformName: string,
        passwordResetUrl: string,
        requestHost: string
    ): Promise<any> {
        try {
            const components = [
                {
                    type: 'header',
                    parameters: [
                        {
                            type: 'text',
                            parameter_name: 'platform_name',
                            text: platformName,
                        },
                    ],
                },
                {
                    type: 'body',
                    parameters: [
                        {
                            type: 'text',
                            parameter_name: 'name',
                            text: name,
                        },
                        {
                            type: 'text',
                            parameter_name: 'password_reset_url',
                            text: passwordResetUrl,
                        },
                    ],
                },
            ];

            const response = await this.whatsappApi.sendTemplateMessage(
                to,
                'password_reset_url',
                'pt_BR',
                components
            );

            // Create the formatted message text
            const messageText = `Olá ${name}
Segue o link para redefinição de senha da sua conta:
${passwordResetUrl}
Se você não solicitou redefinição de senha, desconsidere essa mensagem.`;

            // Check for existing contact with Brazilian number variations (with/without 9)
            let dbContact = await this.findContactWithBrVariations(to);

            // Find project that matches the request host
            let matchingProject = null;
            try {
                // Remove port from host if present (e.g., "example.com:3000" -> "example.com")
                const hostname = requestHost.split(':')[0];
                
                // Find project where apiUrl contains the request hostname
                const projects = await this.prisma.project.findMany({
                    where: {
                        apiUrl: {
                            contains: hostname,
                        },
                    },
                });

                if (projects.length > 0) {
                    matchingProject = projects[0];
                }
            } catch (error) {
                console.log('Error matching project by request host:', error.message);
            }

            // If no existing contact found, create a new one with custom name and project
            if (!dbContact) {
                dbContact = await this.prisma.contact.create({
                    data: {
                        waId: to,
                        name: name,
                        customName: name,
                        projectId: matchingProject?.id || null,
                    },
                });
            } else {
                // Update existing contact with custom name and project if not set
                await this.prisma.contact.update({
                    where: { id: dbContact.id },
                    data: {
                        customName: name,
                        projectId: dbContact.projectId || matchingProject?.id || null,
                    },
                });
            }

            // Get or create conversation
            const conversation = await this.prisma.conversation.upsert({
                where: { contactId: dbContact.id },
                update: {
                    lastMessageAt: new Date(),
                },
                create: {
                    contactId: dbContact.id,
                    lastMessageAt: new Date(),
                    unreadCount: 0,
                },
            });

            // Save message to database
            const messageId = response.messages[0].id;
            await this.prisma.message.create({
                data: {
                    id: messageId,
                    conversationId: conversation.id,
                    contactId: dbContact.id,
                    type: $Enums.MessageType.TEXT,
                    direction: $Enums.Direction.OUTBOUND,
                    timestamp: BigInt(Date.now()),
                    textBody: messageText,
                    templateHeader: `Redefinição de senha ${platformName}`,
                    templateFooter: 'Plataforma feita por Alessandro Cardoso',
                    status: $Enums.MessageStatus.SENT,
                    sentAt: new Date(),
                },
            });

            return response;
        } catch (error) {
            console.log('Error sending password reset:', error);
            throw new HttpException('Error sending password reset', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Update contact custom name
     */
    public async updateContactCustomName(contactId: string, customName: string): Promise<any> {
        try {
            const contact = await this.prisma.contact.update({
                where: { id: contactId },
                data: { customName },
            });

            return contact;
        } catch (error) {
            console.log('Error updating custom name:', error);
            throw new HttpException('Error updating custom name', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

}
