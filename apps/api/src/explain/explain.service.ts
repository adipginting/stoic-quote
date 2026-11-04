import {
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DatasetService } from '../dataset/dataset.service';
import { QuoteRecord } from '../dataset/dataset.types';
import { SQLITE_DB, SqliteDatabase } from '../db/database';

const PROMPT_VERSION = 1;

const SYSTEM_PROMPT =
  'You are a concise Stoic philosophy guide. Explain the following quote in 2-3 sentences of plain modern English, focusing on what it means and how it applies today. Do not use lists or headings.';

interface ExplanationRow {
  quote_id: string;
  model: string;
  prompt_version: number;
  text: string;
  created_at: string;
}

export interface ExplanationDto {
  quoteId: string;
  model: string;
  promptVersion: number;
  text: string;
  createdAt: string;
  cached: boolean;
}

@Injectable()
export class ExplainService {
  private thinkingFieldSupported = true;

  constructor(
    private readonly dataset: DatasetService,
    @Inject(SQLITE_DB) private readonly db: SqliteDatabase,
  ) {}

  async getExplanation(id: string): Promise<ExplanationDto> {
    const quote = this.dataset.byId(id);
    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    const model = process.env.DEEPSEEK_MODEL ?? 'deepseek-flash';
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Explanations are not configured: set DEEPSEEK_API_KEY.',
      );
    }

    const cached = this.db
      .prepare(
        `SELECT quote_id, model, prompt_version, text, created_at
         FROM explanations
         WHERE quote_id = ? AND model = ? AND prompt_version = ?`,
      )
      .get(id, model, PROMPT_VERSION) as ExplanationRow | undefined;

    if (cached) {
      return {
        quoteId: id,
        model: cached.model,
        promptVersion: cached.prompt_version,
        text: cached.text,
        createdAt: cached.created_at,
        cached: true,
      };
    }

    const text = await this.generate(quote, apiKey, model);
    const createdAt = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO explanations (quote_id, model, prompt_version, text, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(quote_id) DO UPDATE SET
           model = excluded.model,
           prompt_version = excluded.prompt_version,
           text = excluded.text,
           created_at = excluded.created_at`,
      )
      .run(id, model, PROMPT_VERSION, text, createdAt);

    return {
      quoteId: id,
      model,
      promptVersion: PROMPT_VERSION,
      text,
      createdAt,
      cached: false,
    };
  }

  private async generate(
    quote: QuoteRecord,
    apiKey: string,
    model: string,
  ): Promise<string> {
    const base = (
      process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com'
    ).replace(/\/+$/, '');
    const location = quote.section ? `, ${quote.section}` : '';
    const body: Record<string, unknown> = {
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Quote: "${quote.text}" — ${quote.author}, ${quote.work}${location}\n\nExplain it.`,
        },
      ],
      max_tokens: 400,
      temperature: 0.7,
    };
    if (this.thinkingFieldSupported) {
      body.thinking = { type: 'disabled' };
    }

    let response = await this.callDeepSeek(base, apiKey, body);
    if (!response.ok && this.thinkingFieldSupported) {
      const detail = await response.text().catch(() => '');
      if (
        response.status >= 400 &&
        response.status < 500 &&
        /thinking/i.test(detail)
      ) {
        this.thinkingFieldSupported = false;
        delete body.thinking;
        response = await this.callDeepSeek(base, apiKey, body);
      }
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new ServiceUnavailableException(
        `DeepSeek request failed (${response.status}): ${detail.slice(0, 200)}`,
      );
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = payload.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || text.trim().length === 0) {
      throw new ServiceUnavailableException(
        'DeepSeek returned an empty explanation',
      );
    }
    return text.trim();
  }

  private callDeepSeek(
    base: string,
    apiKey: string,
    body: Record<string, unknown>,
  ): Promise<Response> {
    return fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
  }
}
