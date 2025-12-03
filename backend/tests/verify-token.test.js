import request from 'supertest';
import server from '../src/index.js';

// Mock JWT middleware
jest.mock('../src/middleware/auth.js', () => ({
  authenticateToken: (req, res, next) => {
    const auth = req.headers['authorization'];
    if (auth === 'Bearer valid-token') {
      req.user = { id: 1 };
      return next();
    } else {
      res.status(401).json({ message: 'Unauthorized' });
    }
  },
  requireCaretaker: (req, res, next) => next()
}));

// Add a protected route for testing
server.get('/protected', (req, res) => {
  res.status(200).json({ message: 'ok' });
});

describe('Token verification', () => {
  it('returns 200 for valid token', async () => {
    const res = await request(server.server).get('/protected').set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'ok' });
  });

  it('returns 401 for invalid token', async () => {
    const res = await request(server.server).get('/protected').set('Authorization', 'Bearer invalid-token');
    expect(res.status).toBe(401);
  });
});
