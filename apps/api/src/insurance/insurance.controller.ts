import { Body, Controller, Get, HttpException, HttpStatus, Post, Query } from '@nestjs/common';
import {
    CalculatePremiumDto,
    CalculatePremiumResponseDto,
    ClaimStatusDto,
    ClaimStatusResponseDto,
    PolicyDetailsDto,
    PolicyDetailsResponseDto,
    SubmitClaimDto,
    SubmitClaimResponseDto,
} from './dto/insurance.dto';
import { InsuranceService } from './insurance.service';

@Controller('insurance')
export class InsuranceController {
  constructor(private readonly insuranceService: InsuranceService) {}

  @Get('policy')
  async getPolicyDetails(@Query() query: PolicyDetailsDto): Promise<PolicyDetailsResponseDto> {
    try {
      return await this.insuranceService.getPolicyDetails(query.user_id);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get policy details',
        HttpStatus.NOT_FOUND
      );
    }
  }

  @Get('claims')
  async getClaimStatus(@Query() query: ClaimStatusDto): Promise<ClaimStatusResponseDto> {
    try {
      return await this.insuranceService.getClaimStatus(query.claim_id);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get claim status',
        HttpStatus.NOT_FOUND
      );
    }
  }

  @Post('claims')
  async submitClaim(@Body() body: SubmitClaimDto): Promise<SubmitClaimResponseDto> {
    try {
      return await this.insuranceService.submitClaim(body);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to submit claim',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Post('premium')
  async calculatePremium(@Body() body: CalculatePremiumDto): Promise<CalculatePremiumResponseDto> {
    try {
      // Validate that new coverage is greater than current coverage
      if (body.new_coverage <= body.current_coverage) {
        throw new HttpException(
          'New coverage must be greater than current coverage',
          HttpStatus.BAD_REQUEST
        );
      }

      return await this.insuranceService.calculatePremium(body);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error.message || 'Failed to calculate premium',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Get('policies')
  async getAllPolicies() {
    try {
      return await this.insuranceService.getAllPolicies();
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get policies',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('claims/all')
  async getAllClaims() {
    try {
      return await this.insuranceService.getAllClaims();
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get claims',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
