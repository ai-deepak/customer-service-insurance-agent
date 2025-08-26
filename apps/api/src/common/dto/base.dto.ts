import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

export class BaseResponse {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;
}

export class ErrorResponse extends BaseResponse {
  @ApiProperty()
  code: string;

  @ApiProperty()
  details?: any;
}
