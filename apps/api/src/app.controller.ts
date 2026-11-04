import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

const WORKS = [
  'aurelius',
  'seneca',
  'epictetus-theenchiridion',
  'epictetus-discourses',
];

@ApiTags('v1')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getStoicQuote(
    @Query('min') min?: string,
    @Query('max') max?: string,
  ): string {
    if ((min && Number(min) <= 100) || (max && Number(max) <= 100)) {
      throw new HttpException(
        'The requested quote must be more than 100 characters.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const work = WORKS[Math.floor(Math.random() * WORKS.length)];
    return this.randomQuote(work, min, max);
  }

  @Get('aurelius')
  getAureliusQuote(): string {
    return this.randomQuote('aurelius');
  }

  @Get('seneca')
  getSenecaQuote(): string {
    return this.randomQuote('seneca');
  }

  @Get('epictetus-theenchiridion')
  getEpictetusTheEnchridionQuote(): string {
    return this.randomQuote('epictetus-theenchiridion');
  }

  @Get('epictetus-discourses')
  getEpictetusDiscoursesQuote(): string {
    return this.randomQuote('epictetus-discourses');
  }

  private randomQuote(work: string, min?: string, max?: string): string {
    const quote = this.appService.randomQuoteForWork(work, min, max);
    if (quote) {
      return this.appService.formatQuote(quote);
    }
    throw new HttpException(
      'Please try again or change the request parameter',
      HttpStatus.EXPECTATION_FAILED,
    );
  }
}
