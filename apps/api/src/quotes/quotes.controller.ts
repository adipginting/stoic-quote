import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DatasetService } from '../dataset/dataset.service';
import { QuoteDto, toQuoteDto } from '../dataset/dataset.types';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

@ApiTags('quotes')
@Controller('v2/quotes')
export class QuotesController {
  constructor(private readonly dataset: DatasetService) {}

  @Get('random')
  random(
    @Query('tag') tag?: string,
    @Query('work') work?: string,
    @Query('minLength') minLength?: string,
    @Query('maxLength') maxLength?: string,
  ): QuoteDto {
    const quote = this.dataset.random({
      tag: tag || undefined,
      work: work || undefined,
      minLength: this.toNumber(minLength),
      maxLength: this.toNumber(maxLength),
    });
    if (!quote) {
      throw new NotFoundException('No quote matches the given filters');
    }
    return toQuoteDto(quote);
  }

  @Get('daily')
  daily(@Query('date') date?: string): QuoteDto {
    const value = date ?? new Date().toISOString().slice(0, 10);
    if (!this.isValidDate(value)) {
      throw new BadRequestException(
        'date must be a valid date in YYYY-MM-DD format',
      );
    }
    return toQuoteDto(this.dataset.daily(value));
  }

  @Get(':id')
  byId(@Param('id') id: string): QuoteDto {
    const quote = this.dataset.byId(id);
    if (!quote) {
      throw new NotFoundException('Quote not found');
    }
    return toQuoteDto(quote);
  }

  private toNumber(value?: string): number | undefined {
    if (value === undefined || value === '') {
      return undefined;
    }
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  private isValidDate(value: string): boolean {
    if (!DATE_PATTERN.test(value)) {
      return false;
    }
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return (
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }
}
