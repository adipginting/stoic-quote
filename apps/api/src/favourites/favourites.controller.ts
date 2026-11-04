import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { FavouritesDto, FavouritesService } from './favourites.service';
import { VisitorId } from './visitor-id.decorator';

@ApiTags('favourites')
@ApiHeader({
  name: 'x-visitor-id',
  required: true,
  description: 'Anonymous visitor identifier (8-64 chars: A-Z a-z 0-9 _ -)',
})
@Controller('v2/favourites')
export class FavouritesController {
  constructor(private readonly favouritesService: FavouritesService) {}

  @Get()
  list(@VisitorId() visitorId: string): FavouritesDto {
    return this.favouritesService.list(visitorId);
  }

  @Post()
  add(
    @VisitorId() visitorId: string,
    @Body('quoteId') quoteId: string,
  ): { quoteId: string } {
    return this.favouritesService.add(visitorId, quoteId);
  }

  @Delete(':quoteId')
  @HttpCode(204)
  remove(
    @VisitorId() visitorId: string,
    @Param('quoteId') quoteId: string,
  ): void {
    this.favouritesService.remove(visitorId, quoteId);
  }
}
