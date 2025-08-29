import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ChatMessageDto, ChatResponseDto } from './dto/chat.dto';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly orchestratorUrl: string;

  constructor(private configService: ConfigService) {
    this.orchestratorUrl = this.configService.get<string>('ORCHESTRATOR_URL') || 'http://localhost:8001';
  }

  async processMessage(chatDto: ChatMessageDto, userRole: string): Promise<ChatResponseDto> {
    const startTime = Date.now();
    const sessionId = chatDto.session_id || 'n/a';
    
    this.logger.log(JSON.stringify({
      type: 'orchestrator_request_start',
      timestamp: new Date().toISOString(),
      sessionId,
      userRole,
      messageLength: chatDto.message?.length || 0,
      orchestratorUrl: this.orchestratorUrl,
    }));

    try {
      const response = await axios.post<ChatResponseDto>(`${this.orchestratorUrl}/route`, {
        message: chatDto.message,
        session_id: chatDto.session_id,
        user_role: userRole,
      });

      const duration = Date.now() - startTime;
      
      this.logger.log(JSON.stringify({
        type: 'orchestrator_request_success',
        timestamp: new Date().toISOString(),
        sessionId,
        userRole,
        duration_ms: duration,
        responseStatus: response.status,
        messagesCount: response.data?.messages?.length || 0,
        actionsCount: response.data?.actions?.length || 0,
        hasCards: Object.keys(response.data?.cards || {}).length > 0,
      }));

      return response.data;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      this.logger.error(JSON.stringify({
        type: 'orchestrator_request_error',
        timestamp: new Date().toISOString(),
        sessionId,
        userRole,
        duration_ms: duration,
        error: {
          message: error?.message || 'Unknown error',
          status: error?.response?.status,
          statusText: error?.response?.statusText,
          orchestratorUrl: this.orchestratorUrl,
        },
      }));
      
      throw error;
    }
  }
}
