package retrieval

import (
	"context"
	"fmt"
	"sort"
	"time"

	"github.com/memory-lane/rag-engine/internal/index"
	"github.com/memory-lane/rag-engine/internal/models"
	"github.com/memory-lane/rag-engine/internal/storage"
)

// MemoryService handles memory storage, retrieval, and scoring.
type MemoryService struct {
	store storage.Storage
}

// NewMemoryService creates a new memory service.
func NewMemoryService(store storage.Storage) *MemoryService {
	return &MemoryService{store: store}
}

// Store persists a memory chunk and indexes its tokens.
func (s *MemoryService) Store(ctx context.Context, userID, content, source, sessionID string, importance float64) (string, error) {
	if userID == "" || content == "" {
		return "", fmt.Errorf("user_id and content are required")
	}

	tokens := index.Tokenize(content)
	now := time.Now()
	chunkID := fmt.Sprintf("%s-%d", userID, now.UnixNano())

	chunk := &models.MemoryChunk{
		UserID:     userID,
		ChunkID:    chunkID,
		Content:    content,
		Tokens:     tokens,
		Importance: importance,
		Source:     source,
		SessionID:  sessionID,
		CreatedAt:  now,
	}

	if err := s.store.StoreMemory(ctx, chunk); err != nil {
		return "", err
	}

	// Build token index entries
	entries := make([]models.TokenEntry, len(tokens))
	for i, t := range tokens {
		entries[i] = models.TokenEntry{
			Token:     t,
			UserID:    userID,
			ChunkID:   chunkID,
			Timestamp: now,
		}
	}
	if err := s.store.IndexTokens(ctx, entries); err != nil {
		return "", fmt.Errorf("index tokens: %w", err)
	}

	return chunkID, nil
}

// Search finds the most relevant memory chunks for a query.
// Scoring: score = overlap * 0.7 + importance * 0.3
func (s *MemoryService) Search(ctx context.Context, userID, query string, topK int) ([]models.ScoredChunk, error) {
	if userID == "" || query == "" {
		return nil, fmt.Errorf("user_id and query are required")
	}
	if topK <= 0 {
		topK = 3
	}

	queryTokens := index.Tokenize(query)
	if len(queryTokens) == 0 {
		return nil, nil
	}

	// Fetch candidate chunks
	chunks, err := s.store.SearchMemoryByTokens(ctx, userID, queryTokens)
	if err != nil {
		return nil, err
	}
	if len(chunks) == 0 {
		return nil, nil
	}

	// Score each chunk
	scored := make([]models.ScoredChunk, len(chunks))
	for i, c := range chunks {
		overlap := index.TokenOverlap(queryTokens, c.Tokens)
		score := overlap*0.7 + c.Importance*0.3
		scored[i] = models.ScoredChunk{Chunk: c, Score: score}
	}

	// Sort by score descending
	sort.Slice(scored, func(i, j int) bool {
		return scored[i].Score > scored[j].Score
	})

	// Trim to topK
	if len(scored) > topK {
		scored = scored[:topK]
	}

	return scored, nil
}
