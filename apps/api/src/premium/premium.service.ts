import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { CalculatePremiumDto, PremiumResponseDto } from './dto/premium.dto';

@Injectable()
export class PremiumService {
  private readonly logger = new Logger(PremiumService.name);

  // Mock premium calculation - replace with actual business logic
  private mockPremiums = new Map([
    ['POLICY_001', { current_coverage: 50000, current_premium: 500 }],
    ['POLICY_002', { current_coverage: 30000, current_premium: 400 }],
    ['POLICY_003', { current_coverage: 100000, current_premium: 800 }],
  ]);

  async calculatePremium(dto: CalculatePremiumDto): Promise<PremiumResponseDto> {
    // Validate that new coverage is greater than current
    if (dto.new_coverage <= dto.current_coverage) {
      throw new BadRequestException('New coverage must be greater than current coverage');
    }

    const policy = this.mockPremiums.get(dto.policy_id);
    if (!policy) {
      throw new BadRequestException(`Policy ${dto.policy_id} not found`);
    }

    // Simple premium calculation based on coverage ratio
    const coverageRatio = dto.new_coverage / policy.current_coverage;
    const newPremium = Math.round(policy.current_premium * coverageRatio);

    this.logger.log(`Premium calculated for policy ${dto.policy_id}: ${policy.current_premium} -> ${newPremium}`);

    return {
      policy_id: dto.policy_id,
      current_premium: policy.current_premium,
      new_premium: newPremium,
    };
  }
}
