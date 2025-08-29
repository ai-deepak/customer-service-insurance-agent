import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class PolicyDetailsDto {
  @IsString()
  @IsNotEmpty()
  user_id: string;
}

export class ClaimStatusDto {
  @IsString()
  @IsNotEmpty()
  claim_id: string;
}

export class SubmitClaimDto {
  @IsString()
  @IsNotEmpty()
  policy_id: string;

  @IsString()
  @IsNotEmpty()
  damage_description: string;

  @IsString()
  @IsNotEmpty()
  vehicle: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];
}

export class CalculatePremiumDto {
  @IsString()
  @IsNotEmpty()
  policy_id: string;

  @IsNumber()
  @Min(0)
  current_coverage: number;

  @IsNumber()
  @Min(0)
  new_coverage: number;
}

export class PolicyDetailsResponseDto {
  plan: string;
  collision_coverage: number;
  roadside_assistance: boolean;
  deductible: number;
  user_id: string;
  policy_id: string;
}

export class ClaimStatusResponseDto {
  claim_id: string;
  status: string;
  last_updated: string;
}

export class SubmitClaimResponseDto {
  claim_id: string;
  message: string;
}

export class CalculatePremiumResponseDto {
  policy_id: string;
  current_premium: number;
  new_premium: number;
}
