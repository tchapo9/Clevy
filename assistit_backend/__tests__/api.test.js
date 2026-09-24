const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change_moi_en_production';

// Mock pg avant d'importer les routes
jest.mock('pg', () => {
  const query = jest.fn();
  return {
    Pool: jest.fn(() => ({ query })),
    __getQueryMock: query,
  };
});

// Mock MinIO pour éviter les connexions
jest.mock('minio', () => ({
  Client: jest.fn(() => ({
    bucketExists: jest.fn().mockResolvedValue(true),
    makeBucket: jest.fn(),
    setBucketPolicy: jest.fn(),
    putObject: jest.fn(),
    removeObject: jest.fn(),
  })),
}));

const queryMock = jest.requireMock('pg').__getQueryMock;

const ticketsRouter = require('../routes/tickets');
const chatRouter = require('../routes/chat');
const interventionsRouter = require('../routes/interventions');

const app = express();
app.use(express.json());
app.use('/api/tickets', ticketsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/interventions', interventionsRouter);

const makeToken = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

beforeEach(() => {
  queryMock.mockReset();
});

describe('Auth (tickets)', () => {
  test('GET /api/tickets sans token → 401', async () => {
    const res = await request(app).get('/api/tickets');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Token manquant');
  });

  test('GET /api/tickets avec token invalide → 401', async () => {
    const res = await request(app)
      .get('/api/tickets')
      .set('Authorization', 'Bearer fake-token');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Token invalide ou expiré');
  });

  test('GET /api/tickets avec token client valide → 200', async () => {
    queryMock.mockResolvedValue({ rows: [] });
    const token = makeToken({ id: 1, role: 'client', nom: 'Test' });
    const res = await request(app)
      .get('/api/tickets')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('POST /api/tickets', () => {
  test('sans catégorie/description → 400', async () => {
    const token = makeToken({ id: 1, role: 'client' });
    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${token}`)
      .send({ categorie: '', description: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Catégorie et description requises');
  });

  test('rôle technicien → 403 (réservé aux clients)', async () => {
    const token = makeToken({ id: 2, role: 'technicien' });
    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${token}`)
      .send({ categorie: 'Logiciel', description: 'Bug' });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Accès réservé aux clients');
  });

  test('création valide → 201', async () => {
    const ticket = {
      id: 10,
      client_id: 1,
      categorie: 'Logiciel',
      description: 'Bug critique',
      status: 'en_attente',
    };
    queryMock.mockResolvedValue({ rows: [ticket] });

    const token = makeToken({ id: 1, role: 'client' });
    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${token}`)
      .send({ categorie: 'Logiciel', description: 'Bug critique' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(ticket);
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO tickets'),
      [1, 'Logiciel', 'Bug critique'],
    );
  });
});

describe('POST /api/tickets/:id/accept', () => {
  test('client ne peut pas accepter → 403', async () => {
    const token = makeToken({ id: 1, role: 'client' });
    const res = await request(app)
      .post('/api/tickets/1/accept')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Seuls les techniciens peuvent accepter');
  });

  test('technicien accepte un ticket en attente → 200', async () => {
    const ticket = { id: 1, status: 'en_cours', technicien_id: 2 };
    queryMock.mockResolvedValue({ rows: [ticket] });

    const token = makeToken({ id: 2, role: 'technicien', nom: 'Tech' });
    const res = await request(app)
      .post('/api/tickets/1/accept')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('en_cours');
  });

  test('ticket déjà pris → 404', async () => {
    queryMock.mockResolvedValue({ rows: [] });
    const token = makeToken({ id: 2, role: 'technicien' });
    const res = await request(app)
      .post('/api/tickets/1/accept')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('Chat', () => {
  test('GET messages sans token → 401', async () => {
    const res = await request(app).get('/api/chat/1');
    expect(res.status).toBe(401);
  });

  test('POST message vide → 400', async () => {
    const token = makeToken({ id: 1, role: 'client', nom: 'Test' });
    const res = await request(app)
      .post('/api/chat/1')
      .set('Authorization', `Bearer ${token}`)
      .send({ contenu: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Message vide');
  });

  test('POST message valide → 201', async () => {
    const msg = { id: 1, ticket_id: 1, expediteur_id: 1, contenu: 'Bonjour' };
    queryMock.mockResolvedValue({ rows: [msg] });

    const token = makeToken({ id: 1, role: 'client', nom: 'Test' });
    const res = await request(app)
      .post('/api/chat/1')
      .set('Authorization', `Bearer ${token}`)
      .send({ contenu: 'Bonjour' });

    expect(res.status).toBe(201);
    expect(res.body.contenu).toBe('Bonjour');
    expect(res.body.expediteur_nom).toBe('Test');
  });
});

describe('Interventions', () => {
  test('stats réservé aux techniciens → 403', async () => {
    const token = makeToken({ id: 1, role: 'client' });
    const res = await request(app)
      .get('/api/interventions/stats')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Réservé aux techniciens');
  });

  test('GET historique technicien → 200', async () => {
    queryMock.mockResolvedValue({ rows: [] });
    const token = makeToken({ id: 2, role: 'technicien' });
    const res = await request(app)
      .get('/api/interventions')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('POST start intervention → 201', async () => {
    const intervention = { id: 5, ticket_id: 1, type: 'chat', date_debut: new Date().toISOString() };
    queryMock.mockResolvedValue({ rows: [intervention] });

    const token = makeToken({ id: 2, role: 'technicien' });
    const res = await request(app)
      .post('/api/interventions/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ ticket_id: 1, type: 'chat' });

    expect(res.status).toBe(201);
    expect(res.body.type).toBe('chat');
  });
});
