# Implementation Plan

- [x] 1. Set up enhanced Supavec service and configuration





  - Create enhanced Supavec service functions for replica management
  - Add configuration management for migration settings
  - Implement namespace-aware operations using user IDs
  - _Requirements: 1.1, 1.5, 6.1_

- [x] 1.1 Enhance Supavec service with replica-specific functions


  - Add createReplicaFromTrainingData function to supavecService.js
  - Add getReplicaById and updateReplicaMetadata functions
  - Add enhanced chat functions with streaming support
  - _Requirements: 1.1, 4.1, 4.5_

- [x] 1.2 Create migration configuration management


  - Add migration config object to handle API switching
  - Create environment variable validation for both APIs
  - Add configuration validation on server startup
  - _Requirements: 6.1, 6.5_

- [x] 1.3 Implement namespace management utilities


  - Add validateNamespaceAccess function for security
  - Create listNamespaceFiles with filtering capabilities
  - Add namespace-to-userId mapping utilities
  - _Requirements: 1.5, 3.3, 7.3_

- [x] 2. Create API abstraction layer





  - Build unified interface that can route to either Sensay or Supavec.
  - If you get the project structure by now remove every implementation of Sensay api
  - Implement configuration-based API selection
  - Add error handling and fallback mechanisms
  - _Requirements: 6.1, 6.2, 6.4_

- [x] 2.1 Build replica abstraction service


  - Create replicaAbstractionService.js with unified interface
  - Implement createReplica function that routes to appropriate API
  - Add listUserReplicas with dual API support
  - _Requirements: 1.1, 2.1, 6.2_

- [x] 2.2 Implement chat abstraction with fallback


  - Create sendChatMessage function with API routing logic
  - Add error handling with Sensay fallback capability
  - Implement conversation context preservation across APIs
  - _Requirements: 4.1, 4.4, 6.2_

- [x] 2.3 Add training content abstraction


  - Create uploadTrainingContent function for both APIs
  - Implement file upload routing based on configuration
  - Add training status tracking across API sources
  - _Requirements: 5.1, 5.2, 5.4_

- [x] 3. Update replica routes to use abstraction layer





  - Modify existing replica endpoints to use new abstraction service
  - Ensure backward compatibility with existing request/response formats
  - Add migration status tracking to route responses
  - _Requirements: 1.4, 2.4, 6.4_

- [x] 3.1 Update replica creation endpoint


  - Modify POST /api/replicas to use replicaAbstractionService
  - Ensure Supavec namespace is set to user ID
  - Preserve existing request/response format for frontend
  - _Requirements: 1.1, 1.2, 1.4_

- [x] 3.2 Update replica listing endpoints


  - Modify GET /api/user/replicas to use abstraction layer
  - Update GET /api/user/accessible-replicas for patient access
  - Ensure proper namespace filtering for patient users
  - _Requirements: 2.1, 3.1, 3.3_

- [x] 3.3 Update replica management endpoints


  - Modify DELETE /api/replicas/:replicaId to use abstraction
  - Update POST /api/replicas/reconcile with dual API support
  - Add migration status to replica metadata responses
  - _Requirements: 2.2, 2.5, 6.4_

- [-] 4. Update chat routes to use Supavec API



  - Modify chat endpoints to use new abstraction layer
  - Ensure conversation history preservation
  - Add proper error handling for API transitions

  - _Requirements: 4.1, 4.3, 4.4_

- [x] 4.1 Update main chat endpoint

  - Modify POST /api/replicas/:replicaId/chat to use abstraction
  - Ensure proper namespace resolution for patient access
  - Preserve existing conversation threading and storage
  - _Requirements: 4.1, 4.2, 4.3_


- [x] 4.2 Update conversation history endpoints





  - Modify conversation listing endpoints to work with new API
  - Ensure proper user isolation and access control
  - Add API source tracking to conversation metadata
  - _Requirements: 4.3, 4.4, 3.4_

- [ ] 4.3 Add streaming support for Supavec chat
  - Implement streaming response handling if supported by Supavec
  - Add fallback to regular responses if streaming fails
  - Ensure proper error handling for streaming connections
  - _Requirements: 4.5_

- [ ] 5. Implement data migration service
  - Create migration utilities to transfer Sensay data to Supavec
  - Add data integrity validation and rollback capabilities
  - Implement bulk migration tools for administrators
  - _Requirements: 6.3, 6.4_

- [ ] 5.1 Create migration service foundation
  - Create migrationService.js with core migration functions
  - Add migrateSensayReplicaToSupavec function
  - Implement data transformation utilities between API formats
  - _Requirements: 6.3_

- [ ] 5.2 Add bulk migration capabilities
  - Create bulkMigrateUserReplicas function for admin use
  - Add migration progress tracking and reporting
  - Implement rollback mechanisms for failed migrations
  - _Requirements: 6.3, 6.4_

- [ ] 5.3 Add migration validation tools
  - Create validateMigrationIntegrity function
  - Add data consistency checks between APIs
  - Implement migration audit logging
  - _Requirements: 6.4_

- [ ] 6. Update database models for migration support
  - Enhance replica and conversation models with migration fields
  - Add API source tracking and migration status
  - Ensure backward compatibility with existing data
  - _Requirements: 2.4, 6.4_

- [ ] 6.1 Update replica model schema
  - Add apiSource, migrationStatus, and supavecNamespace fields
  - Add sensayReplicaId field for legacy compatibility
  - Add migrationLog array for audit trail
  - _Requirements: 2.4, 6.4_

- [ ] 6.2 Update conversation model schema
  - Add apiSource field to track which API was used
  - Add Firestore sync preparation fields
  - Ensure proper indexing for performance
  - _Requirements: 4.3, 7.1_

- [ ] 6.3 Create database migration scripts
  - Write scripts to update existing records with new fields
  - Add data validation for schema changes
  - Create rollback scripts for schema changes
  - _Requirements: 6.4_

- [ ] 7. Implement enhanced error handling




  - Create standardized error mapping between APIs
  - Add comprehensive logging for troubleshooting
  - Implement graceful degradation strategies
  - _Requirements: 2.5


- [x] 7.1 Create error mapping utilities

  - Add standardized error codes for both APIs
  - Create error transformation functions
  - Implement user-friendly error messages
  - _Requirements: 2.5_

- [x] 7.2 Add comprehensive logging


  - Implement structured logging for all API calls
  - Create performance metrics collection
  - _Requirements: 6.4_

- [x] 7.3 Implement fallback strategies


  - Add automatic retry logic for temporary failures
  - Create Sensay fallback for critical operations
  - Add circuit breaker pattern for API reliability

- [-] 8. Prepare Firestore sync layer


  - Create Firestore sync service for future client SDK integration
  - Add secure endpoints for data synchronization
  - Implement data transformation utilities
  - _Requirements: 7.1, 7.2, 7.4_


- [x] 8.1 Create Firestore sync service

  - Create firestoreSyncService.js with sync functions
  - Add syncReplicaToFirestore and syncConversationToFirestore
  - Implement validateFirestoreAccess for security
  - _Requirements: 7.1, 7.3_


- [x] 8.2 Add data transformation utilities

  - Create transformLocalToFirestoreFormat function
  - Add transformFirestoreToLocalFormat function
  - Implement data validation for Firestore documents
  - _Requirements: 7.2_


- [ ] 8.3 Create Firestore security documentation








  - Document security rules for client SDK access
  - Create example client SDK integration patterns
  - Add namespace-aware access control documentation
  - _Requirements: 7.3, 7.5_

- [x] 9. Preserve email-based access control





  - Ensure existing whitelist functionality continues working
  - Update patient access validation for Supavec namespaces
  - Maintain bulk email management capabilities
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 9.1 Update access control validation


  - Modify validatePatientCaretakerRelationship middleware
  - Add Supavec namespace validation to access checks
  - Ensure email whitelist works with new API structure
  - _Requirements: 8.1, 8.3_


- [x] 9.2 Update bulk email management

  - Modify POST /api/caretaker/add-patient-email endpoint
  - Ensure email associations work with Supavec replicas
  - Add validation for cross-namespace access attempts
  - _Requirements: 8.4, 8.5_


- [x] 9.3 Test patient access workflows

  - Validate patient can access only whitelisted replicas
  - Test caretaker can manage patient permissions
  - Ensure proper namespace isolation between users
  - _Requirements: 8.2, 8.5_

- [ ]* 10. Add comprehensive testing
  - Create unit tests for all new services and functions
  - Add integration tests for complete workflows
  - Implement migration testing with data validation
  - _Requirements: All requirements validation_

- [ ]* 10.1 Create unit tests for services
  - Write tests for enhanced supavecService functions
  - Add tests for replicaAbstractionService routing logic
  - Create tests for migrationService data transformations
  - _Requirements: 1.1, 2.1, 5.1_

- [ ]* 10.2 Add integration tests for workflows
  - Test complete replica creation workflow with Supavec
  - Add tests for chat functionality with conversation persistence
  - Test patient access control with new namespace system
  - _Requirements: 1.1, 4.1, 3.1_

- [ ]* 10.3 Create migration testing suite
  - Test data migration from Sensay to Supavec format
  - Add data integrity validation tests
  - Test rollback scenarios and error recovery
  - _Requirements: 6.3, 6.4_

- [ ] 11. Update configuration and deployment





  - Add environment variables for Supavec API configuration
  - Update deployment scripts with new dependencies
  - Add health checks for both API services
  - _Requirements: 6.1, 6.5_

- [x] 11.1 Add Supavec configuration


  - Add SUPAVEC_API_KEY and related environment variables
  - Update config validation to check both API configurations
  - Add migration mode configuration options
  - _Requirements: 6.1, 6.5_


- [x] 11.2 Update health check endpoints

  - Add Supavec API connectivity to health checks
  - Create separate health endpoints for each API service
  - Add migration status to health check responses
  - _Requirements: 6.5_


- [x] 11.3 Create deployment documentation

  - Document environment variable requirements
  - Add migration deployment procedures
  - Create rollback procedures for failed deployments
  - _Requirements: 6.4_

- [x] 12. Remove all Prisma dependencies and references




  - Remove Prisma schema files and migration directories
  - Update all code references from Prisma to MongoDB/Mongoose
  - Remove Prisma from package configuration and build scripts
  - Update documentation to reflect MongoDB-only architecture
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_





- [ ] 12.1 Remove Prisma files and directories
  - Delete backend/prisma/schema.prisma file
  - Delete backend/prisma/migrations/ directory
  - Remove Prisma configuration from project structure




  - _Requirements: 9.1_

- [ ] 12.2 Update code references to use MongoDB
  - Replace Prisma client calls in test files with Mongoose equivalents




  - Update databaseConfig references from prisma to mongoose
  - Ensure all database operations use Mongoose models
  - _Requirements: 9.2_

- [ ] 12.3 Remove Prisma from build and deployment
  - Remove Prisma dependencies from package.json



  - Remove Prisma from pnpm-workspace.yaml
  - Remove "npx prisma db push" from fly.toml release command
  - Remove "npx prisma generate" from Dockerfile
  - Remove DATABASE_URL and Prisma-related env vars from .env.example
  - _Requirements: 9.3, 9.4_

- [ ] 12.4 Update documentation
  - Remove Prisma references from README.md
  - Update architecture diagrams to show MongoDB only
  - Remove Prisma setup instructions
  - Update deployment guides to remove Prisma steps
  - _Requirements: 9.5_