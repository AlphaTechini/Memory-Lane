import request from 'supertest';
import server from '../src/index.js';
import databaseConfig from '../src/config/database.js';

// Mock Google verification
jest.mock('../src/firebase.js', () => ({
  auth: () => ({
    verifyIdToken: jest.fn().mockResolvedValue({
      uid: 'google-uid',
      email: 'test@example.com',
      name: 'Test User'
    })
  })
}));

// Add a protected route for testing
server.get('/protected', async (req, reply) => {
  return reply.send({ message: 'ok' });
});

describe('Full integration chain', () => {
  let token;

  afterAll(async () => {
    // Clean up test user from DB
    await databaseConfig.prisma.user.deleteMany({ where: { email: 'test@example.com' } });
    await databaseConfig.prisma.$disconnect();
  });

  it('POST /auth/google returns JWT and inserts user', async () => {
    const res = await request(server.server)
      .post('/auth/google')
      .send({ idToken: 'fake-token' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    token = res.body.token;
    // Check DB for user
    const user = await databaseConfig.prisma.user.findUnique({ where: { email: 'test@example.com' } });
    expect(user).not.toBeNull();
  });

  it('uses JWT to access /protected', async () => {
    const res = await request(server.server)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'ok' });
  });
});
