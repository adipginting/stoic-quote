import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { Dataset, QuoteFilters, QuoteRecord } from './dataset.types';

const REQUIRED_STRING_FIELDS: Array<keyof QuoteRecord> = [
  'id',
  'text',
  'author',
  'work',
  'workSlug',
  'translation',
];

@Injectable()
export class DatasetService {
  private readonly logger = new Logger(DatasetService.name);
  private readonly data: Dataset;
  private readonly quotesById: Map<string, QuoteRecord>;

  constructor() {
    const dir = process.env.DATA_DIR ?? path.join(process.cwd(), 'data');
    const file = path.join(dir, 'quotes.json');
    this.data = this.load(file);
    this.quotesById = new Map(
      this.data.quotes.map((quote) => [quote.id, quote]),
    );
    this.logger.log(`Loaded ${this.data.quotes.length} quotes from ${file}`);
  }

  get size(): number {
    return this.data.quotes.length;
  }

  get minLength(): number {
    return this.data.minLength;
  }

  get maxLength(): number {
    return this.data.maxLength;
  }

  get workSlugs(): string[] {
    return [...new Set(this.data.quotes.map((quote) => quote.workSlug))];
  }

  get all(): readonly QuoteRecord[] {
    return this.data.quotes;
  }

  byId(id: string): QuoteRecord | undefined {
    return this.quotesById.get(id);
  }

  random(filters: QuoteFilters = {}): QuoteRecord | undefined {
    const matches = this.data.quotes.filter((quote) => {
      if (filters.tag !== undefined && !quote.tags.includes(filters.tag)) {
        return false;
      }
      if (filters.work !== undefined && quote.workSlug !== filters.work) {
        return false;
      }
      if (
        filters.author !== undefined &&
        quote.author.toLowerCase() !== filters.author.toLowerCase()
      ) {
        return false;
      }
      if (
        filters.minLength !== undefined &&
        quote.text.length < filters.minLength
      ) {
        return false;
      }
      if (
        filters.maxLength !== undefined &&
        quote.text.length > filters.maxLength
      ) {
        return false;
      }
      return true;
    });

    if (matches.length === 0) {
      return undefined;
    }
    return matches[Math.floor(Math.random() * matches.length)];
  }

  daily(date: string): QuoteRecord {
    const index = this.hash(date) % this.data.quotes.length;
    return this.data.quotes[index];
  }

  private hash(value: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
  }

  private load(file: string): Dataset {
    if (!fs.existsSync(file)) {
      throw new Error(
        `Dataset not found at ${file}. Set DATA_DIR to the directory containing quotes.json.`,
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
      throw new Error(
        `Dataset at ${file} is not valid JSON: ${(error as Error).message}`,
      );
    }

    return this.validate(parsed, file);
  }

  private validate(value: unknown, file: string): Dataset {
    const fail = (reason: string): never => {
      throw new Error(`Invalid dataset at ${file}: ${reason}`);
    };

    if (typeof value !== 'object' || value === null) {
      return fail('expected a JSON object');
    }

    const data = value as Partial<Dataset>;
    if (typeof data.minLength !== 'number') {
      return fail('"minLength" must be a number');
    }
    if (typeof data.maxLength !== 'number') {
      return fail('"maxLength" must be a number');
    }
    if (!Array.isArray(data.quotes)) {
      return fail('"quotes" must be an array');
    }
    if (data.quotes.length === 0) {
      return fail('"quotes" must not be empty');
    }
    if (typeof data.sources !== 'object' || data.sources === null) {
      return fail('"sources" must be an object');
    }
    if (typeof data.counts !== 'object' || data.counts === null) {
      return fail('"counts" must be an object');
    }

    data.quotes.forEach((quote, index) => {
      if (typeof quote !== 'object' || quote === null) {
        return fail(`quotes[${index}] must be an object`);
      }
      const record = quote as Partial<QuoteRecord>;
      for (const field of REQUIRED_STRING_FIELDS) {
        if (typeof record[field] !== 'string' || record[field].length === 0) {
          return fail(`quotes[${index}].${field} must be a non-empty string`);
        }
      }
      if (record.section !== null && typeof record.section !== 'string') {
        return fail(`quotes[${index}].section must be a string or null`);
      }
      if (
        !Array.isArray(record.tags) ||
        record.tags.some((tag) => typeof tag !== 'string')
      ) {
        return fail(`quotes[${index}].tags must be an array of strings`);
      }
    });

    return data as Dataset;
  }
}
