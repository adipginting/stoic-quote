export interface QuoteRecord {
  id: string;
  text: string;
  author: string;
  work: string;
  workSlug: string;
  section: string | null;
  translation: string;
  tags: string[];
}

export interface Dataset {
  minLength: number;
  maxLength: number;
  sources: Record<string, string>;
  counts: Record<string, number>;
  quotes: QuoteRecord[];
}

export interface QuoteFilters {
  tag?: string;
  work?: string;
  author?: string;
  minLength?: number;
  maxLength?: number;
}

export interface QuoteDto {
  id: string;
  text: string;
  author: string;
  work: string;
  section: string | null;
  translation: string;
  tags: string[];
}

export function toQuoteDto(quote: QuoteRecord): QuoteDto {
  return {
    id: quote.id,
    text: quote.text,
    author: quote.author,
    work: quote.work,
    section: quote.section,
    translation: quote.translation,
    tags: quote.tags,
  };
}
