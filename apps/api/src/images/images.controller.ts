import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ImageDto, ImagesService } from './images.service';

@ApiTags('images')
@Controller('v2/quotes')
export class ImagesController {
  constructor(private readonly imagesService: ImagesService) {}

  @Get(':id/image')
  getImage(@Param('id') id: string): Promise<ImageDto> {
    return this.imagesService.getImage(id);
  }
}
