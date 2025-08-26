import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class GetClaimStatusDto {
  @ApiProperty({ example: '98765', description: 'Claim ID (alphanumeric, max 10 chars)' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Za-z0-9]{1,10}$/, { message: 'Claim ID must be alphanumeric and 1-10 characters' })
  claim_id: string;
}

export class SubmitClaimDto {
  @ApiProperty({ example: 'POLICY_001' })
  @IsString()
  @IsNotEmpty()
  policy_id: string;

  @ApiProperty({ example: 'Vehicle damage from collision', minLength: 10 })
  @IsString()
  @MinLength(10, { message: 'Damage description must be at least 10 characters' })
  damage_description: string;

  @ApiProperty({ example: 'Toyota Camry 2020' })
  @IsString()
  @IsNotEmpty()
  vehicle: string;

  @ApiProperty({ required: false, type: [String], isArray: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];
}

export class ClaimStatusResponseDto {
  @ApiProperty()
  claim_id: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  last_updated: string;
}

export class SubmitClaimResponseDto {
  @ApiProperty()
  claim_id: string;

  @ApiProperty()
  message: string;
}
