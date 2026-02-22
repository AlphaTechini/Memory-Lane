package storage

import (
	"context"

	"github.com/memory-lane/rag-engine/internal/models"
)

// Storage defines the interface for all persistence operations.
// Both MongoDB and DynamoDB backends implement this interface.
type Storage interface {
	// Identity operations
	GetIdentity(ctx context.Context, userID, key string) (*models.IdentityFact, error)
	SetIdentity(ctx context.Context, fact *models.IdentityFact) error

	// Memory operations
	StoreMemory(ctx context.Context, chunk *models.MemoryChunk) error
	SearchMemoryByTokens(ctx context.Context, userID string, tokens []string) ([]models.MemoryChunk, error)

	// Token index operations
	IndexTokens(ctx context.Context, entries []models.TokenEntry) error
	LookupTokens(ctx context.Context, userID string, tokens []string) ([]string, error) // returns chunk IDs

	// Review queue operations
	StoreReview(ctx context.Context, item *models.ReviewItem) error
	GetReview(ctx context.Context, sessionID string) (*models.ReviewItem, error)
	ListPendingReviews(ctx context.Context, userID string) ([]models.ReviewItem, error)
	UpdateReviewStatus(ctx context.Context, sessionID string, status models.ReviewStatus) error

	// Health
	Ping(ctx context.Context) error
	BackendName() string

	// Cleanup
	Close(ctx context.Context) error
}
