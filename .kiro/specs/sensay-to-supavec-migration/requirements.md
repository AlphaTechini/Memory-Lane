# Requirements Document

## Introduction

The MemoryLane web application currently uses the Sensay API for creating AI replicas, managing training data, and handling contextual chats. This specification defines the requirements for migrating the backend from Sensay API to Supavec API while maintaining the same frontend experience and route structure. The migration aims to improve API reliability, reduce costs, and prepare for future Firestore client-side integration.

## Glossary

- **MemoryLane_Backend**: The Node.js + Fastify backend server that handles API requests and business logic
- **Sensay_API**: The current third-party API service used for replica creation and chat functionality
- **Supavec_API**: The new third-party API service that will replace Sensay for core functionality
- **Replica**: An AI personality model trained on user-provided data and capable of contextual conversations
- **Knowledge_Base**: The collection of training data (text, files, URLs) used to train a replica
- **Namespace**: A logical grouping mechanism in Supavec API that isolates data by user/organization
- **Caretaker**: A user role that can create and manage replicas and grant access to patients
- **Patient**: A user role that can only access replicas explicitly shared by their caretaker
- **Firestore_Client_SDK**: Google Firestore database client library for direct browser-to-database connections

## Requirements

### Requirement 1

**User Story:** As a caretaker, I want to create AI replicas using the new Supavec API, so that I can continue building personalized AI personalities with improved reliability.

#### Acceptance Criteria

1. WHEN a caretaker submits replica creation data through the existing `/api/replicas` endpoint, THE MemoryLane_Backend SHALL create the replica using Supavec_API instead of Sensay_API
2. WHEN replica creation is successful, THE MemoryLane_Backend SHALL store the Supavec file ID as the replica identifier in the local database
3. WHEN replica creation includes training data, THE MemoryLane_Backend SHALL upload the training content to Supavec_API using the uploadText function
4. THE MemoryLane_Backend SHALL maintain the same request/response format for the frontend to ensure no breaking changes
5. THE MemoryLane_Backend SHALL use the caretaker's user ID as the namespace in Supavec_API for data isolation

### Requirement 2

**User Story:** As a caretaker, I want to manage my replicas through existing endpoints, so that I can continue using the current interface without disruption.

#### Acceptance Criteria

1. WHEN a caretaker requests their replica list via `/api/user/replicas`, THE MemoryLane_Backend SHALL fetch replica data from Supavec_API using the listFiles function
2. WHEN replica reconciliation is triggered via `/api/replicas/reconcile`, THE MemoryLane_Backend SHALL synchronize local database state with Supavec_API remote state
3. WHEN a caretaker deletes a replica via `/api/replicas/:replicaId`, THE MemoryLane_Backend SHALL remove the replica from both Supavec_API and local database
4. THE MemoryLane_Backend SHALL preserve all existing replica metadata fields in the local database for backward compatibility
5. THE MemoryLane_Backend SHALL handle Supavec_API errors gracefully and provide meaningful error messages to the frontend

### Requirement 3

**User Story:** As a patient, I want to access shared replicas through the same interface, so that my user experience remains consistent during the migration.

#### Acceptance Criteria

1. WHEN a patient requests accessible replicas via `/api/user/accessible-replicas`, THE MemoryLane_Backend SHALL fetch replicas from the caretaker's Supavec namespace
2. WHEN a patient attempts to access a replica, THE MemoryLane_Backend SHALL validate access permissions using the existing whitelist mechanism
3. THE MemoryLane_Backend SHALL use the caretaker's user ID as the Supavec namespace when patients access shared replicas
4. THE MemoryLane_Backend SHALL maintain separate conversation histories for patients and caretakers in the local database
5. THE MemoryLane_Backend SHALL preserve all existing patient access control mechanisms during the migration

### Requirement 4

**User Story:** As any authenticated user, I want to chat with replicas using the new API, so that I can continue having conversations with improved response quality.

#### Acceptance Criteria

1. WHEN a user sends a chat message via `/api/replicas/:replicaId/chat`, THE MemoryLane_Backend SHALL use Supavec_API sendChatMessage function instead of Sensay_API
2. WHEN processing chat requests, THE MemoryLane_Backend SHALL pass the replica file ID to Supavec_API as a knowledge base reference
3. WHEN chat responses are received, THE MemoryLane_Backend SHALL save conversation history to the local database using existing Conversation model
4. THE MemoryLane_Backend SHALL maintain the same chat message format and conversation threading as the current implementation
5. THE MemoryLane_Backend SHALL handle streaming responses from Supavec_API if supported by the new service

### Requirement 5

**User Story:** As a caretaker, I want to train replicas with additional content, so that I can improve their knowledge and responses over time.

#### Acceptance Criteria

1. WHEN a caretaker adds training content via knowledge base endpoints, THE MemoryLane_Backend SHALL use Supavec_API uploadText function for text content
2. WHEN file uploads are processed, THE MemoryLane_Backend SHALL use Supavec_API uploadFile function with appropriate metadata
3. THE MemoryLane_Backend SHALL maintain existing knowledge base entry tracking in the local database for audit purposes
4. THE MemoryLane_Backend SHALL preserve the existing training workflow and status polling mechanisms where applicable
5. THE MemoryLane_Backend SHALL handle Supavec_API file management operations through the appropriate service functions

### Requirement 6

**User Story:** As a system administrator, I want the backend to support both APIs during transition, so that I can perform a gradual migration with rollback capability.

#### Acceptance Criteria

1. THE MemoryLane_Backend SHALL support configuration flags to enable/disable Sensay_API and Supavec_API independently
2. WHEN both APIs are enabled, THE MemoryLane_Backend SHALL prioritize Supavec_API for new operations while maintaining Sensay_API for legacy data
3. THE MemoryLane_Backend SHALL provide migration utilities to transfer existing Sensay replicas to Supavec format
4. THE MemoryLane_Backend SHALL log all API transitions and maintain audit trails for troubleshooting
5. THE MemoryLane_Backend SHALL validate API configurations on startup and provide clear error messages for misconfigurations

### Requirement 7

**User Story:** As a developer, I want the backend prepared for Firestore client SDK integration, so that future optimizations can be implemented efficiently.

#### Acceptance Criteria

1. THE MemoryLane_Backend SHALL expose secure endpoints for Firestore synchronization that validate user permissions
2. THE MemoryLane_Backend SHALL provide data transformation utilities to convert between local database format and Firestore document structure
3. THE MemoryLane_Backend SHALL implement namespace-aware data access patterns that align with Firestore security rules
4. THE MemoryLane_Backend SHALL maintain data consistency between Supavec_API state and local/Firestore state
5. THE MemoryLane_Backend SHALL document the client SDK integration patterns and provide example implementations

### Requirement 8

**User Story:** As a caretaker, I want email-based replica access control to continue working, so that I can manage patient permissions without changing my workflow.

#### Acceptance Criteria

1. THE MemoryLane_Backend SHALL preserve existing email whitelist functionality for replica access control
2. WHEN patients are granted access to replicas, THE MemoryLane_Backend SHALL maintain the association in the local database
3. THE MemoryLane_Backend SHALL validate patient access using both local whitelist and Supavec namespace permissions
4. THE MemoryLane_Backend SHALL support bulk patient email management through existing caretaker endpoints
5. THE MemoryLane_Backend SHALL ensure email-based access control works consistently across both local and Supavec data sources