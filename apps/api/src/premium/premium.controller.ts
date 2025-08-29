import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PremiumService } from './premium.service';
import { CalculatePremiumDto, PremiumResponseDto } from './dto/premium.dto';

@ApiTags('Premium')
@Controller('premium')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PremiumController {
  constructor(private premiumService: PremiumService) {}

  @Post()
  @ApiOperation({ summary: 'Calculate premium for coverage change' })
  @ApiResponse({ status: 200, description: 'Premium calculated', type: PremiumResponseDto })
  async calculatePremium(@Body() dto: CalculatePremiumDto): Promise<PremiumResponseDto> {
    return this.premiumService.calculatePremium(dto);
  }
}
