import { Controller, Get, Post, Patch, Param, Body, Query, HttpStatus, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiParam, ApiQuery } from '@nestjs/swagger';
import { WhatsappService } from '../service';
import { FastifyRequest } from 'fastify';

@Controller('conversations')
@ApiTags('conversations')
export class ConversationController {

    public constructor(
        private readonly whatsappService: WhatsappService
    ) { }

    @Get()
    @ApiOperation({ 
        summary: 'Get all conversations',
        description: 'Retrieves all conversations with the last message for each'
    })
    @ApiResponse({ status: HttpStatus.OK, description: 'Conversations retrieved successfully' })
    public async getConversations(): Promise<any> {
        return this.whatsappService.getConversations();
    }

    @Get(':id/messages')
    @ApiOperation({ 
        summary: 'Get messages for a conversation',
        description: 'Retrieves all messages for a specific conversation'
    })
    @ApiParam({ name: 'id', description: 'Conversation ID' })
    @ApiResponse({ status: HttpStatus.OK, description: 'Messages retrieved successfully' })
    public async getMessages(@Param('id') conversationId: string): Promise<any> {
        return this.whatsappService.getMessages(conversationId);
    }

    @Post(':id/messages')
    @ApiOperation({ 
        summary: 'Send a message',
        description: 'Sends a text message in a conversation'
    })
    @ApiParam({ name: 'id', description: 'Conversation ID' })
    @ApiResponse({ status: HttpStatus.OK, description: 'Message sent successfully' })
    public async sendMessage(
        @Param('id') conversationId: string,
        @Body() body: { text: string; replyToId?: string }
    ): Promise<any> {
        return this.whatsappService.sendTextMessage(conversationId, body.text, body.replyToId);
    }

    @Post('inviteToChurch')
    @ApiOperation({ 
        summary: 'Send invite to church template',
        description: 'Sends an access_created template message to invite someone to church platform'
    })
    @ApiQuery({ name: 'to', description: 'Recipient phone number', required: true })
    @ApiQuery({ name: 'name', description: 'Recipient name', required: true })
    @ApiQuery({ name: 'platform', description: 'Platform name', required: true })
    @ApiQuery({ name: 'platformUrl', description: 'Platform URL', required: true })
    @ApiQuery({ name: 'login', description: 'Login credential', required: true })
    @ApiQuery({ name: 'password', description: 'Password credential', required: true })
    @ApiResponse({ status: HttpStatus.OK, description: 'Invite sent successfully' })
    public async inviteToChurch(
        @Req() request: FastifyRequest,
        @Query('to') to: string,
        @Query('name') name: string,
        @Query('platform') platform: string,
        @Query('platformUrl') platformUrl: string,
        @Query('login') login: string,
        @Query('password') password: string
    ): Promise<any> {
        const requestHost = request.headers.host || '';
        return this.whatsappService.inviteToChurch(to, name, platform, platformUrl, login, password, requestHost);
    }

    @Patch(':id/custom-name')
    @ApiOperation({ 
        summary: 'Update contact custom name',
        description: 'Updates the custom display name for a contact'
    })
    @ApiParam({ name: 'id', description: 'Contact ID' })
    @ApiResponse({ status: HttpStatus.OK, description: 'Custom name updated successfully' })
    public async updateCustomName(
        @Param('id') contactId: string,
        @Body() body: { customName: string }
    ): Promise<any> {
        return this.whatsappService.updateContactCustomName(contactId, body.customName);
    }

}
