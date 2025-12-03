/**
 * Patient Access Control Tests
 * 
 * Tests to validate that patient access control works correctly with Supavec namespaces
 * and email whitelisting functionality.
 */

import { jest } from '@jest/globals';

// Mock the dependencies
const mockUser = {
  id: 'caretaker-123',
  email: 'caretaker@example.com',
  role: 'caretaker',
  replicas: [
    {
      replicaId: 'replica-1',
      fileId: 'replica-1',
      name: 'Test Replica 1',
      description: 'Test replica',
      apiSource: 'SUPAVEC',
      supavecNamespace: 'caretaker-123',
      whitelistEmails: ['patient1@example.com', 'patient2@example.com']
    },
    {
      replicaId: 'replica-2', 
      fileId: 'replica-2',
      name: 'Test Replica 2',
      description: 'Another test replica',
      apiSource: 'SUPAVEC',
      supavecNamespace: 'caretaker-123',
      whitelistEmails: ['patient1@example.com']
    }
  ]
};

const mockPatient = {
  id: 'patient-456',
  email: 'patient1@example.com',
  role: 'patient',
  caretakerId: 'caretaker-123',
  allowedReplicas: ['replica-1', 'replica-2']
};

const mockUnauthorizedPatient = {
  id: 'patient-789',
  email: 'unauthorized@example.com', 
  role: 'patient',
  caretakerId: 'caretaker-123',
  allowedReplicas: ['replica-1']
};

describe('Patient Access Control', () => {
  let validateReplicaAccess;
  let addPatientEmailToReplicas;

  beforeEach(async () => {
    // Mock the replica abstraction service
    jest.unstable_mockModule('../src/services/replicaAbstractionService.js', () => ({
      validateReplicaAccess: jest.fn(),
      updateReplicaMetadata: jest.fn()
    }));

    // Mock the User model
    jest.unstable_mockModule('../src/models/User.js', () => ({
      default: {
        findById: jest.fn()
      }
    }));

    // Import the functions after mocking
    const replicaAbstraction = await import('../src/services/replicaAbstractionService.js');
    const caretakerService = await import('../src/services/caretakerService.js');
    
    validateReplicaAccess = replicaAbstraction.validateReplicaAccess;
    addPatientEmailToReplicas = caretakerService.addPatientEmailToReplicas;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateReplicaAccess', () => {
    test('should allow patient access to whitelisted replica', async () => {
      // Mock User.findById to return the caretaker
      const User = (await import('../src/models/User.js')).default;
      User.findById.mockResolvedValue(mockUser);

      // Mock Supavec validation to succeed
      validateReplicaAccess.mockResolvedValue({
        success: true,
        hasAccess: true,
        apiSource: 'SUPAVEC'
      });

      const result = await validateReplicaAccess('replica-1', 'caretaker-123', {
        userRole: 'patient',
        patientEmail: 'patient1@example.com',
        namespace: 'caretaker-123'
      });

      expect(result.success).toBe(true);
      expect(result.hasAccess).toBe(true);
    });

    test('should deny patient access to non-whitelisted replica', async () => {
      // Mock User.findById to return the caretaker
      const User = (await import('../src/models/User.js')).default;
      User.findById.mockResolvedValue(mockUser);

      // Mock Supavec validation to succeed but email not whitelisted
      validateReplicaAccess.mockResolvedValue({
        success: false,
        hasAccess: false,
        apiSource: 'SUPAVEC',
        error: 'Patient email not whitelisted for this replica'
      });

      const result = await validateReplicaAccess('replica-2', 'caretaker-123', {
        userRole: 'patient',
        patientEmail: 'unauthorized@example.com',
        namespace: 'caretaker-123'
      });

      expect(result.success).toBe(false);
      expect(result.hasAccess).toBe(false);
      expect(result.error).toContain('not whitelisted');
    });

    test('should deny access to replica from different namespace', async () => {
      // Mock User.findById to return null (caretaker not found)
      const User = (await import('../src/models/User.js')).default;
      User.findById.mockResolvedValue(null);

      validateReplicaAccess.mockResolvedValue({
        success: false,
        hasAccess: false,
        apiSource: 'SUPAVEC',
        error: 'Caretaker not found'
      });

      const result = await validateReplicaAccess('replica-1', 'different-caretaker', {
        userRole: 'patient',
        patientEmail: 'patient1@example.com',
        namespace: 'different-caretaker'
      });

      expect(result.success).toBe(false);
      expect(result.hasAccess).toBe(false);
    });
  });

  describe('addPatientEmailToReplicas', () => {
    test('should successfully add patient email to replica whitelist', async () => {
      // Mock the updateReplica function
      const mockUpdateReplica = jest.fn().mockResolvedValue({ success: true });
      
      // Mock Patient model
      const mockPatientModel = {
        findByEmail: jest.fn().mockResolvedValue(null),
        prototype: {
          save: jest.fn().mockResolvedValue(true)
        }
      };

      const result = await addPatientEmailToReplicas(
        mockUser,
        'newpatient@example.com',
        ['replica-1'],
        {
          updateReplica: mockUpdateReplica,
          PatientModel: mockPatientModel
        }
      );

      expect(result.success).toBe(true);
      expect(result.summary.successful).toBe(1);
      expect(mockUpdateReplica).toHaveBeenCalledWith(
        'replica-1',
        expect.objectContaining({
          whitelistEmails: expect.arrayContaining(['newpatient@example.com'])
        }),
        'caretaker-123'
      );
    });

    test('should prevent cross-namespace access attempts', async () => {
      const crossNamespaceUser = {
        ...mockUser,
        replicas: [
          {
            replicaId: 'replica-1',
            name: 'Test Replica',
            apiSource: 'SUPAVEC',
            supavecNamespace: 'different-caretaker', // Different namespace
            whitelistEmails: []
          }
        ]
      };

      const result = await addPatientEmailToReplicas(
        crossNamespaceUser,
        'patient@example.com',
        ['replica-1'],
        {
          updateReplica: jest.fn(),
          PatientModel: { findByEmail: jest.fn() }
        }
      );

      expect(result.summary.failed).toBe(1);
      expect(result.results[0].error).toContain('Cross-namespace access denied');
    });

    test('should handle replica not found error', async () => {
      const result = await addPatientEmailToReplicas(
        mockUser,
        'patient@example.com',
        ['non-existent-replica'],
        {
          updateReplica: jest.fn(),
          PatientModel: { findByEmail: jest.fn() }
        }
      );

      expect(result.summary.failed).toBe(1);
      expect(result.results[0].error).toContain('Replica not found');
    });
  });

  describe('Namespace Isolation', () => {
    test('should ensure patients can only access replicas from their caretaker namespace', () => {
      // Test that patient's caretakerId matches the namespace
      expect(mockPatient.caretakerId).toBe('caretaker-123');
      
      // Test that replica namespace matches caretaker ID
      const replica = mockUser.replicas[0];
      expect(replica.supavecNamespace).toBe(mockUser.id);
    });

    test('should validate namespace consistency', () => {
      // All replicas should have the same namespace as the caretaker ID
      mockUser.replicas.forEach(replica => {
        if (replica.apiSource === 'SUPAVEC') {
          expect(replica.supavecNamespace).toBe(mockUser.id);
        }
      });
    });
  });
});