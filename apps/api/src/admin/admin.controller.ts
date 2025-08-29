import { Controller, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/dto/base.dto';
import { AdminService } from './admin.service';
import { CreateDocumentDto, DocumentResponseDto } from './dto/admin.dto';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Post('docs')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new document (Admin only)' })
  @ApiResponse({ status: 201, description: 'Document created', type: DocumentResponseDto })
  async createDocument(@Body() dto: CreateDocumentDto): Promise<DocumentResponseDto> {
    return this.adminService.createDocument(dto);
  }

  @Delete('docs/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a document (Admin only)' })
  @ApiResponse({ status: 200, description: 'Document deleted' })
  async deleteDocument(@Param('id') id: string): Promise<void> {
    return this.adminService.deleteDocument(id);
  }
}
