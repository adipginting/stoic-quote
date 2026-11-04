import { Injectable } from '@nestjs/common';
import { DatasetService } from './dataset/dataset.service';
import { QuoteRecord } from './dataset/dataset.types';

type WorkMatcher = (quote: QuoteRecord) => boolean;

const WORK_MATCHERS: Record<string, WorkMatcher> = {
  aurelius: (quote) =>
    /aurelius/i.test(quote.author) ||
    /meditation/i.test(quote.work) ||
    /meditation/i.test(quote.workSlug),
  seneca: (quote) => /seneca/i.test(quote.author),
  'epictetus-theenchiridion': (quote) =>
    /enchiridion/i.test(quote.work) || /enchiridion/i.test(quote.workSlug),
  'epictetus-discourses': (quote) =>
    /discourse/i.test(quote.work) || /discourse/i.test(quote.workSlug),
};

@Injectable()
export class AppService {
  constructor(private readonly dataset: DatasetService) {}

  randomQuoteForWork(
    work: string,
    min?: string,
    max?: string,
  ): QuoteRecord | undefined {
    const matcher = WORK_MATCHERS[work];
    if (!matcher) {
      return undefined;
    }

    const candidates = this.dataset.all.filter(
      (quote) => matcher(quote) && this.fits(quote.text.length, min, max),
    );
    if (candidates.length === 0) {
      return undefined;
    }
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  formatQuote(quote: QuoteRecord): string {
    const section = quote.section ? `, ${quote.section}` : '';
    return `"${quote.text}" --${quote.author}, ${quote.work}${section}`;
  }

  private fits(length: number, min?: string, max?: string): boolean {
    if (min || max) {
      if (length <= 100) {
        return false;
      }
      if (min && !(length >= Number(min))) {
        return false;
      }
      if (max && !(length <= Number(max))) {
        return false;
      }
      return true;
    }
    return length >= 100;
  }
}
