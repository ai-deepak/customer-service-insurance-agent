import { IsString, IsOptional, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDocumentDto {
  @ApiProperty({ example: 'Insurance Policy FAQ' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'This document contains frequently asked questions about insurance policies.' })
  @IsString()
  content: string;

  @ApiProperty({ example: 'faq' })
  @IsString()
  source: string;

  @ApiProperty({ required: false, example: { category: 'policy', tags: ['faq', 'general'] } })
  @IsOptional()
  @IsObject()
  metadata?: any;
}

export class DocumentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  source: string;

  @ApiProperty()
  created_at: string;
}
