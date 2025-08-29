import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, Length, Max, Min, Validate } from 'class-validator';
import { IsGreaterThanCurrentConstraint } from '../common/validators/coverage.validator';

export class CalculatePremiumDto {
  @ApiProperty({ example: 'POLICY_001' })
  @IsString()
  @IsNotEmpty()
  @Length(3, 20, { message: 'Policy ID must be between 3 and 20 characters' })
  policy_id: string;

  @ApiProperty({ example: 50000, description: 'Current coverage amount' })
  @IsNumber({}, { message: 'Current coverage must be a valid number' })
  @Min(1000, { message: 'Current coverage must be at least $1,000' })
  @Max(10000000, { message: 'Current coverage cannot exceed $10,000,000' })
  current_coverage: number;

  @ApiProperty({ example: 80000, description: 'New coverage amount (must be > current)' })
  @IsNumber({}, { message: 'New coverage must be a valid number' })
  @Min(1000, { message: 'New coverage must be at least $1,000' })
  @Max(10000000, { message: 'New coverage cannot exceed $10,000,000' })
  @Validate(IsGreaterThanCurrentConstraint)
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
