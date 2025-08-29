import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ClaimStatusResponseDto, GetClaimStatusDto, SubmitClaimDto, SubmitClaimResponseDto } from './dto/claims.dto';

@Injectable()
export class ClaimsService {
  private readonly logger = new Logger(ClaimsService.name);

  // Mock data - replace with actual database calls
  private mockClaims = new Map([
    ['98765', { claim_id: '98765', status: 'In Progress', last_updated: new Date().toISOString() }],
    ['12345', { claim_id: '12345', status: 'Approved', last_updated: new Date().toISOString() }],
  ]);

  async getClaimStatus(dto: GetClaimStatusDto): Promise<ClaimStatusResponseDto> {
    const claim = this.mockClaims.get(dto.claim_id);
    if (!claim) {
      throw new NotFoundException(`Claim ${dto.claim_id} not found`);
    }
    
    this.logger.log(`Retrieved status for claim: ${dto.claim_id}`);
    return claim;
  }

  async submitClaim(dto: SubmitClaimDto): Promise<SubmitClaimResponseDto> {
    const claimId = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Mock claim submission
    this.mockClaims.set(claimId, {
      claim_id: claimId,
      status: 'Submitted',
      last_updated: new Date().toISOString(),
    });

    this.logger.log(`Submitted new claim: ${claimId} for policy: ${dto.policy_id}`);
    
    return {
      claim_id: claimId,
      message: 'Claim submitted successfully',
    };
  }
}
