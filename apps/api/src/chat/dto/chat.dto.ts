import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChatMessageDto {
  @ApiProperty({ example: 'Tell me about my insurance policy' })
  @IsString()
  message: string;

  @ApiProperty({ required: false, example: 'session-123' })
  @IsOptional()
  @IsString()
  session_id?: string;
}

export class ChatResponseDto {
  @ApiProperty()
  messages: Array<{ from: string; text: string }>;

  @ApiProperty({ required: false })
  actions?: Array<{
    type: string;
    id: string;
    summary: string;
    payload: any;
  }>;

  @ApiProperty({ required: false })
  cards?: any;

  @ApiProperty({ required: false })
  state?: any;
}
