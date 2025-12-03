import request from 'supertest';
import server from '../src/index.js';
import User from '../src/models/User.js';
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

describe('Frontend → Backend Google Auth', () => {
  afterAll(async () => {
    // Clean up test user from Firestore
    await User.deleteMany({ email: 'test@example.com' });
    await databaseConfig.disconnect();
  });

  it('POST /auth/google inserts user and returns JWT', async () => {
    const res = await request(server.server)
      .post('/auth/google')
      .send({ idToken: 'fake-token' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    // Check Firestore for user
    const user = await User.findByEmail('test@example.com');
    expect(user).not.toBeNull();
    expect(user.email).toBe('test@example.com');
  });
});
