import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ExplanationDto, ExplainService } from './explain.service';

@ApiTags('explanation')
@Controller('v2/quotes')
export class ExplainController {
  constructor(private readonly explainService: ExplainService) {}

  @Get(':id/explanation')
  getExplanation(@Param('id') id: string): Promise<ExplanationDto> {
    return this.explainService.getExplanation(id);
  }
}
