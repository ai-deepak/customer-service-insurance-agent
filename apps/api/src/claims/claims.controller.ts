import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ClaimsService } from './claims.service';
import { GetClaimStatusDto, SubmitClaimDto, ClaimStatusResponseDto, SubmitClaimResponseDto } from './dto/claims.dto';

@ApiTags('Claims')
@Controller('claims')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ClaimsController {
  constructor(private claimsService: ClaimsService) {}

  @Get()
  @ApiOperation({ summary: 'Get claim status' })
  @ApiResponse({ status: 200, description: 'Claim status retrieved', type: ClaimStatusResponseDto })
  async getClaimStatus(@Query() query: GetClaimStatusDto): Promise<ClaimStatusResponseDto> {
    return this.claimsService.getClaimStatus(query);
  }

  @Post()
  @ApiOperation({ summary: 'Submit a new claim' })
  @ApiResponse({ status: 201, description: 'Claim submitted', type: SubmitClaimResponseDto })
  async submitClaim(@Body() dto: SubmitClaimDto): Promise<SubmitClaimResponseDto> {
    return this.claimsService.submitClaim(dto);
  }
}
