package retrieval

import (
	"context"
	"fmt"

	"github.com/memory-lane/rag-engine/internal/models"
	"github.com/memory-lane/rag-engine/internal/storage"
)

// IdentityService handles deterministic identity lookups.
type IdentityService struct {
	store storage.Storage
}

// NewIdentityService creates a new identity service.
func NewIdentityService(store storage.Storage) *IdentityService {
	return &IdentityService{store: store}
}

// Get retrieves a single identity fact for a user.
// Returns nil (not an error) when the key doesn't exist.
func (s *IdentityService) Get(ctx context.Context, userID, key string) (*models.IdentityFact, error) {
	if userID == "" || key == "" {
		return nil, fmt.Errorf("user_id and key are required")
	}
	return s.store.GetIdentity(ctx, userID, key)
}

// Set creates or updates an identity fact with version bumping.
func (s *IdentityService) Set(ctx context.Context, fact *models.IdentityFact) error {
	if fact.UserID == "" || fact.Key == "" {
		return fmt.Errorf("user_id and key are required")
	}

	// Check for immutability
	existing, err := s.store.GetIdentity(ctx, fact.UserID, fact.Key)
	if err != nil {
		return err
	}
	if existing != nil && existing.Immutable {
		return fmt.Errorf("identity key %q is immutable and cannot be updated", fact.Key)
	}

	// Bump version
	if existing != nil {
		fact.Version = existing.Version + 1
	} else {
		fact.Version = 1
	}

	return s.store.SetIdentity(ctx, fact)
}
