import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DatasetService } from '../dataset/dataset.service';
import { QuoteDto, toQuoteDto } from '../dataset/dataset.types';
import { SQLITE_DB, SqliteDatabase } from '../db/database';

interface FavouriteRow {
  quote_id: string;
}

export interface FavouritesDto {
  ids: string[];
  quotes: QuoteDto[];
}

@Injectable()
export class FavouritesService {
  constructor(
    private readonly dataset: DatasetService,
    @Inject(SQLITE_DB) private readonly db: SqliteDatabase,
  ) {}

  list(visitorId: string): FavouritesDto {
    const rows = this.db
      .prepare(
        `SELECT quote_id FROM favourites
         WHERE visitor_id = ?
         ORDER BY created_at DESC, rowid DESC`,
      )
      .all(visitorId) as FavouriteRow[];

    const ids = rows.map((row) => row.quote_id);
    const quotes = ids
      .map((id) => this.dataset.byId(id))
      .filter((quote) => quote !== undefined)
      .map((quote) => toQuoteDto(quote));

    return { ids, quotes };
  }

  add(visitorId: string, quoteId: string): { quoteId: string } {
    const quote = this.dataset.byId(quoteId);
    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    this.db
      .prepare(
        `INSERT OR IGNORE INTO favourites (visitor_id, quote_id, created_at)
         VALUES (?, ?, ?)`,
      )
      .run(visitorId, quoteId, new Date().toISOString());

    return { quoteId };
  }

  remove(visitorId: string, quoteId: string): void {
    this.db
      .prepare('DELETE FROM favourites WHERE visitor_id = ? AND quote_id = ?')
      .run(visitorId, quoteId);
  }
}
