import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

const DATA_DIR = path.join(process.cwd(), 'test', 'fixtures');
const SQLITE_PATH = path.join(os.tmpdir(), `stoic-e2e-${process.pid}.db`);
const VISITOR_ID = 'e2e-visitor-1234';

process.env.DATA_DIR = DATA_DIR;
process.env.SQLITE_PATH = SQLITE_PATH;
delete process.env.DEEPSEEK_API_KEY;
delete process.env.UNSPLASH_ACCESS_KEY;

describe('Stoic Quote API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    removeDatabaseFiles();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    removeDatabaseFiles();
  });

  const server = () => app.getHttpServer();

  function removeDatabaseFiles(): void {
    for (const suffix of ['', '-wal', '-shm']) {
      fs.rmSync(`${SQLITE_PATH}${suffix}`, { force: true });
    }
  }

  describe('meta', () => {
    it('/health (GET) returns ok', () => {
      return request(server())
        .get('/health')
        .expect(200)
        .expect({ status: 'ok' });
    });

    it('/v2/meta (GET) describes the API', async () => {
      const response = await request(server()).get('/v2/meta').expect(200);
      expect(response.body.name).toBe('Stoic Quote API');
      expect(typeof response.body.version).toBe('string');
      expect(response.body.quoteCount).toBe(10);
      expect(response.body.capabilities).toEqual({
        explain: false,
        images: false,
      });
      expect(response.body.works).toEqual(
        expect.arrayContaining([
          'meditations',
          'dialogues',
          'enchiridion',
          'discourses',
        ]),
      );
    });
  });

  describe('v2 quotes', () => {
    it('/v2/quotes/random (GET) returns the quote shape', async () => {
      const response = await request(server())
        .get('/v2/quotes/random')
        .expect(200);
      expect(Object.keys(response.body).sort()).toEqual([
        'author',
        'id',
        'section',
        'tags',
        'text',
        'translation',
        'work',
      ]);
    });

    it('/v2/quotes/random (GET) filters by tag', async () => {
      const response = await request(server())
        .get('/v2/quotes/random?tag=death')
        .expect(200);
      expect(response.body.tags).toContain('death');
    });

    it('/v2/quotes/random (GET) filters by work', async () => {
      const response = await request(server())
        .get('/v2/quotes/random?work=enchiridion')
        .expect(200);
      expect(response.body.work).toBe('The Enchiridion');
    });

    it('/v2/quotes/random (GET) filters by length', async () => {
      const response = await request(server())
        .get('/v2/quotes/random?tag=time&minLength=100&maxLength=115')
        .expect(200);
      expect(response.body.tags).toContain('time');
      expect(response.body.text.length).toBeGreaterThanOrEqual(100);
      expect(response.body.text.length).toBeLessThanOrEqual(115);
    });

    it('/v2/quotes/random (GET) returns 404 when nothing matches', () => {
      return request(server())
        .get('/v2/quotes/random?tag=not-a-real-tag')
        .expect(404);
    });

    it('/v2/quotes/daily (GET) is deterministic for a date', async () => {
      const first = await request(server())
        .get('/v2/quotes/daily?date=2026-09-11')
        .expect(200);
      const second = await request(server())
        .get('/v2/quotes/daily?date=2026-09-11')
        .expect(200);
      expect(first.body.id).toBe(second.body.id);

      const other = await request(server())
        .get('/v2/quotes/daily?date=2026-09-12')
        .expect(200);
      expect(typeof other.body.id).toBe('string');
    });

    it('/v2/quotes/daily (GET) rejects an invalid date', () => {
      return request(server())
        .get('/v2/quotes/daily?date=11-09-2026')
        .expect(400);
    });

    it('/v2/quotes/:id (GET) returns a quote or 404', async () => {
      const response = await request(server())
        .get('/v2/quotes/meditations-2-1')
        .expect(200);
      expect(response.body.id).toBe('meditations-2-1');

      await request(server()).get('/v2/quotes/does-not-exist').expect(404);
    });
  });

  describe('favourites', () => {
    it('runs a POST/GET/DELETE roundtrip', async () => {
      await request(server())
        .get('/v2/favourites')
        .set('x-visitor-id', VISITOR_ID)
        .expect(200)
        .expect({ ids: [], quotes: [] });

      await request(server())
        .post('/v2/favourites')
        .set('x-visitor-id', VISITOR_ID)
        .send({ quoteId: 'meditations-2-1' })
        .expect(201)
        .expect({ quoteId: 'meditations-2-1' });

      await request(server())
        .post('/v2/favourites')
        .set('x-visitor-id', VISITOR_ID)
        .send({ quoteId: 'meditations-2-1' })
        .expect(201);

      await request(server())
        .post('/v2/favourites')
        .set('x-visitor-id', VISITOR_ID)
        .send({ quoteId: 'does-not-exist' })
        .expect(404);

      const list = await request(server())
        .get('/v2/favourites')
        .set('x-visitor-id', VISITOR_ID)
        .expect(200);
      expect(list.body.ids).toEqual(['meditations-2-1']);
      expect(list.body.quotes).toHaveLength(1);
      expect(list.body.quotes[0].id).toBe('meditations-2-1');

      await request(server())
        .delete('/v2/favourites/meditations-2-1')
        .set('x-visitor-id', VISITOR_ID)
        .expect(204);

      const empty = await request(server())
        .get('/v2/favourites')
        .set('x-visitor-id', VISITOR_ID)
        .expect(200);
      expect(empty.body.ids).toEqual([]);
    });

    it('requires a valid x-visitor-id header', async () => {
      await request(server()).get('/v2/favourites').expect(400);
      await request(server())
        .get('/v2/favourites')
        .set('x-visitor-id', 'short')
        .expect(400);
    });
  });

  describe('explanation', () => {
    it('/v2/quotes/:id/explanation (GET) returns 503 without a key', () => {
      return request(server())
        .get('/v2/quotes/meditations-2-1/explanation')
        .expect(503);
    });

    it('/v2/quotes/:id/explanation (GET) returns 404 for an unknown quote', () => {
      return request(server())
        .get('/v2/quotes/does-not-exist/explanation')
        .expect(404);
    });
  });

  describe('images', () => {
    it('/v2/quotes/:id/image (GET) returns not_configured without a key', async () => {
      const response = await request(server())
        .get('/v2/quotes/meditations-2-1/image')
        .expect(404);
      expect(response.body).toEqual({ reason: 'not_configured' });
    });

    it('/v2/quotes/:id/image (GET) returns 404 for an unknown quote', () => {
      return request(server())
        .get('/v2/quotes/does-not-exist/image')
        .expect(404);
    });
  });

  describe('v1 freeze', () => {
    it('/ (GET) returns a formatted quote', async () => {
      const response = await request(server()).get('/').expect(200);
      expect(response.text).toMatch(/^".+" --.+, .+/);
    });

    it('/epictetus-theenchiridion (GET) returns an Enchiridion quote', async () => {
      const response = await request(server())
        .get('/epictetus-theenchiridion')
        .expect(200);
      expect(response.text).toContain('Epictetus, The Enchiridion');
    });

    it('/ (GET) rejects min <= 100 with 400', () => {
      return request(server()).get('/?min=50').expect(400);
    });

    it('/ (GET) returns 417 when nothing satisfies the bounds', () => {
      return request(server()).get('/?min=100000').expect(417);
    });
  });
});
