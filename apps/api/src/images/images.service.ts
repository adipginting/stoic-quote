import {
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DatasetService } from '../dataset/dataset.service';
import { SQLITE_DB, SqliteDatabase } from '../db/database';
import { TAG_QUERIES } from './tag-queries';

interface ImageRow {
  quote_id: string;
  query: string;
  photo_id: string;
  payload: string;
  fetched_at: string;
}

interface UnsplashPhoto {
  id: string;
  color: string | null;
  alt_description: string | null;
  urls: { raw: string };
  links: { html: string };
  user: {
    name: string;
    username: string;
    links: { html: string };
  };
}

export interface ImageDto {
  quoteId: string;
  query: string;
  url: string;
  thumbUrl: string;
  ogUrl: string;
  color: string | null;
  alt: string;
  photographer: {
    name: string;
    username: string;
    profileUrl: string;
  };
  unsplashUrl: string;
}

@Injectable()
export class ImagesService {
  constructor(
    private readonly dataset: DatasetService,
    @Inject(SQLITE_DB) private readonly db: SqliteDatabase,
  ) {}

  async getImage(id: string): Promise<ImageDto> {
    const quote = this.dataset.byId(id);
    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    const accessKey = process.env.UNSPLASH_ACCESS_KEY;
    if (!accessKey) {
      throw new NotFoundException({ reason: 'not_configured' });
    }

    const cached = this.db
      .prepare(
        `SELECT quote_id, query, photo_id, payload, fetched_at
         FROM images WHERE quote_id = ?`,
      )
      .get(id) as ImageRow | undefined;
    if (cached) {
      return JSON.parse(cached.payload) as ImageDto;
    }

    const tag = quote.tags[0];
    const query = tag ? TAG_QUERIES[tag] ?? tag : 'stoic philosophy';
    const photo = await this.searchUnsplash(query, accessKey);
    if (!photo) {
      throw new NotFoundException({ reason: 'no_result' });
    }

    const payload: ImageDto = {
      quoteId: id,
      query,
      url: this.withParams(photo.urls.raw, 'auto=format&fit=max&w=1600&q=80'),
      thumbUrl: this.withParams(
        photo.urls.raw,
        'auto=format&fit=max&w=480&q=80',
      ),
      ogUrl: this.withParams(
        photo.urls.raw,
        'auto=format&fit=crop&w=1200&h=630&q=80',
      ),
      color: photo.color ?? null,
      alt: photo.alt_description ?? `Photo related to: ${tag}`,
      photographer: {
        name: photo.user.name,
        username: photo.user.username,
        profileUrl: photo.user.links.html,
      },
      unsplashUrl: photo.links.html,
    };

    this.db
      .prepare(
        `INSERT OR REPLACE INTO images (quote_id, query, photo_id, payload, fetched_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        query,
        photo.id,
        JSON.stringify(payload),
        new Date().toISOString(),
      );

    return payload;
  }

  private async searchUnsplash(
    query: string,
    accessKey: string,
  ): Promise<UnsplashPhoto | undefined> {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
      query,
    )}&per_page=1&orientation=landscape&content_filter=high`;
    const response = await fetch(url, {
      headers: { authorization: `Client-ID ${accessKey}` },
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Unsplash request failed (${response.status})`,
      );
    }
    const payload = (await response.json()) as { results?: UnsplashPhoto[] };
    return payload.results?.[0];
  }

  private withParams(base: string, params: string): string {
    return `${base}${base.includes('?') ? '&' : '?'}${params}`;
  }
}
