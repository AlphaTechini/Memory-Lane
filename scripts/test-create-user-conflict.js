import * as sensayService from '../src/services/sensayService.js';

// Quick mock: override sensayApi inside the module to simulate a 409 from POST and a successful GET
const originalSensayApi = sensayService.__sensayApi || null;

// We'll monkeypatch by directly setting sensayApi on the module if exposed; if not, we'll simulate by calling createSensayUser wrapper
(async () => {
  console.log('\nRunning quick conflict-handling smoke test...');

  // Simulate the createSensayUser throwing an axios-like error with response.status=409 and data containing an id
  const conflictError = new Error('Conflict');
  conflictError.response = { status: 409, data: { id: 'existing-user-123', message: 'already exists' } };

  // Use the service's test hooks to simulate the 409/create conflict and GET
  sensayService.setTestOverrideCreate(async () => ({ conflict: true, error: { id: 'existing-user-123' } }));
  sensayService.setTestOverrideGet(async (id) => ({ success: true, id, email: 'found@example.com', name: 'Found User' }));

  try {
    const res = await sensayService.ensureSensayUser({ email: 'test@example.com', name: 'Test' });
    console.log('ensureSensayUser result:', res);
  } catch (err) {
    console.error('Test failed:', err);
  } finally {
  sensayService.clearTestOverrides();
  }
})();
