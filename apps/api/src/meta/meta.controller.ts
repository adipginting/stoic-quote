import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DatasetService } from '../dataset/dataset.service';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version } = require('../../package.json') as { version: string };

interface MetaDto {
  name: string;
  version: string;
  quoteCount: number;
  capabilities: {
    explain: boolean;
    images: boolean;
  };
  works: string[];
}

@ApiTags('meta')
@Controller()
export class MetaController {
  constructor(private readonly dataset: DatasetService) {}

  @Get('v2/meta')
  meta(): MetaDto {
    return {
      name: 'Stoic Quote API',
      version,
      quoteCount: this.dataset.size,
      capabilities: {
        explain: Boolean(process.env.DEEPSEEK_API_KEY),
        images: Boolean(process.env.UNSPLASH_ACCESS_KEY),
      },
      works: this.dataset.workSlugs,
    };
  }

  @Get('health')
  health(): { status: string } {
    return { status: 'ok' };
  }
}
