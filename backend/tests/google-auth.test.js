import { jest } from '@jest/globals';

// Mock Google verification service
const mockVerifyIdToken = jest.fn();

// Simulate the Google Auth utility
async function verifyGoogleToken(idToken) {
  if (!idToken) throw new Error('No token');
  return mockVerifyIdToken(idToken);
}

describe('Google Auth Utility', () => {
  afterEach(() => jest.clearAllMocks());

  it('resolves user object on success', async () => {
    const fakeUser = { email: 'test@example.com', name: 'Test User', picture: 'pic.jpg' };
    mockVerifyIdToken.mockResolvedValueOnce(fakeUser);
    const result = await verifyGoogleToken('valid-token');
    expect(result).toEqual(fakeUser);
    expect(mockVerifyIdToken).toHaveBeenCalledWith('valid-token');
  });

  it('throws error on failure', async () => {
    mockVerifyIdToken.mockRejectedValueOnce(new Error('Invalid token'));
    await expect(verifyGoogleToken('bad-token')).rejects.toThrow('Invalid token');
  });
});
