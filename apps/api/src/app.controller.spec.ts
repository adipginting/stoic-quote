import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as path from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatasetService } from './dataset/dataset.service';

process.env.DATA_DIR = path.join(process.cwd(), 'test', 'fixtures');

describe('AppController (v1)', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, DatasetService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it('returns a formatted random quote', () => {
    const quote = appController.getStoicQuote();
    expect(quote).toMatch(/^".+" --.+, .+/);
    expect(quote.length).toBeGreaterThan(100);
  });

  it('rejects min or max of 100 or less with 400', () => {
    try {
      appController.getStoicQuote('50');
      fail('expected a 400');
    } catch (error) {
      expect((error as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
    }
  });

  it('returns 417 when no quote satisfies the bounds', () => {
    try {
      appController.getStoicQuote('100000');
      fail('expected a 417');
    } catch (error) {
      expect((error as HttpException).getStatus()).toBe(
        HttpStatus.EXPECTATION_FAILED,
      );
    }
  });

  it('returns a quote for each work endpoint', () => {
    expect(appController.getAureliusQuote()).toContain(
      'Marcus Aurelius, Meditations',
    );
    expect(appController.getSenecaQuote()).toContain('Seneca, Dialogues');
    expect(appController.getEpictetusDiscoursesQuote()).toContain(
      'Epictetus, Discourses',
    );
  });

  it('returns an Enchiridion quote from the epictetus-theenchiridion route', () => {
    expect(appController.getEpictetusTheEnchridionQuote()).toContain(
      'Epictetus, The Enchiridion',
    );
  });
});
