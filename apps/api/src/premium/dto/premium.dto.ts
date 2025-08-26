import { IsString, IsNumber, IsNotEmpty, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CalculatePremiumDto {
  @ApiProperty({ example: 'POLICY_001' })
  @IsString()
  @IsNotEmpty()
  policy_id: string;

  @ApiProperty({ example: 50000, description: 'Current coverage amount' })
  @IsNumber()
  @Min(0)
  current_coverage: number;

  @ApiProperty({ example: 80000, description: 'New coverage amount (must be > current)' })
  @IsNumber()
  @Min(0)
  new_coverage: number;
}

export class PremiumResponseDto {
  @ApiProperty()
  policy_id: string;

  @ApiProperty()
  current_premium: number;

  @ApiProperty()
  new_premium: number;
}
