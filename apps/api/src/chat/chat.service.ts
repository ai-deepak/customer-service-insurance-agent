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
    try {
      const response = await axios.post<ChatResponseDto>(`${this.orchestratorUrl}/route`, {
        message: chatDto.message,
        session_id: chatDto.session_id,
        user_role: userRole,
      });

      this.logger.log(`Chat processed for session: ${chatDto.session_id ?? 'n/a'}`);
      return response.data;
    } catch (error: any) {
      this.logger.error(`Error processing chat: ${error?.message ?? String(error)}`);
      this.logger.error(`Orchestrator URL: ${this.orchestratorUrl}`);
      this.logger.error(`Full error:`, error);
      throw error;
    }
  }
}
