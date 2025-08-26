import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { CreateDocumentDto, DocumentResponseDto } from './dto/admin.dto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  private readonly orchestratorUrl: string;
  private readonly adminSecret: string;

  constructor(private configService: ConfigService) {
    this.orchestratorUrl = this.configService.get<string>('ORCHESTRATOR_URL');
    this.adminSecret = this.configService.get<string>('ADMIN_SHARED_SECRET');
  }

  async createDocument(dto: CreateDocumentDto): Promise<DocumentResponseDto> {
    try {
      // Call orchestrator ingestion endpoint
      await axios.post(`${this.orchestratorUrl}/ingest`, dto, {
        headers: {
          'X-Admin-Secret': this.adminSecret,
        },
      });

      this.logger.log(`Document created: ${dto.title}`);

      return {
        id: Date.now().toString(), // Mock ID
        title: dto.title,
        source: dto.source,
        created_at: new Date().toISOString(),
      };
    } catch (error: any) {
      this.logger.error(`Error creating document: ${error?.message ?? String(error)}`);
      throw error;
    }
  }

  async deleteDocument(id: string): Promise<void> {
    this.logger.log(`Document deleted: ${id}`);
    // Implement actual deletion logic
  }
}
