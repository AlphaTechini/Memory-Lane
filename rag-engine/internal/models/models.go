package models

import "time"

// IdentityFact represents a structured identity data point for a user.
// Examples: children names, birthdate, favourite color.
type IdentityFact struct {
	UserID    string    `json:"user_id" bson:"user_id"`
	Key       string    `json:"key" bson:"key"`
	Value     any       `json:"value" bson:"value"`
	Version   int       `json:"version" bson:"version"`
	Immutable bool      `json:"immutable" bson:"immutable"`
	UpdatedAt time.Time `json:"updated_at" bson:"updated_at"`
}

// MemoryChunk represents a single piece of long-term memory.
type MemoryChunk struct {
	UserID     string    `json:"user_id" bson:"user_id"`
	ChunkID    string    `json:"chunk_id" bson:"chunk_id"`
	Content    string    `json:"content" bson:"content"`
	Tokens     []string  `json:"tokens" bson:"tokens"`
	Importance float64   `json:"importance" bson:"importance"` // 0.0 – 1.0
	Source     string    `json:"source" bson:"source"`         // "conversation", "file", "manual"
	SessionID  string    `json:"session_id" bson:"session_id"`
	CreatedAt  time.Time `json:"created_at" bson:"created_at"`
}

// TokenEntry maps a single token to the memory chunks it appears in.
type TokenEntry struct {
	Token     string    `json:"token" bson:"token"`
	UserID    string    `json:"user_id" bson:"user_id"`
	ChunkID   string    `json:"chunk_id" bson:"chunk_id"`
	Timestamp time.Time `json:"timestamp" bson:"timestamp"`
}

// ReviewStatus enumerates the lifecycle of a review item.
type ReviewStatus string

const (
	ReviewPending  ReviewStatus = "pending"
	ReviewApproved ReviewStatus = "approved"
	ReviewRejected ReviewStatus = "rejected"
)

// ReviewItem is a proposed set of changes waiting for caretaker approval.
type ReviewItem struct {
	SessionID              string              `json:"session_id" bson:"session_id"`
	UserID                 string              `json:"user_id" bson:"user_id"`
	Status                 ReviewStatus        `json:"status" bson:"status"`
	ProposedIdentityUpdates []IdentityProposal `json:"proposed_identity_updates" bson:"proposed_identity_updates"`
	ProposedMemories       []MemoryProposal    `json:"proposed_memories" bson:"proposed_memories"`
	CreatedAt              time.Time           `json:"created_at" bson:"created_at"`
	ReviewedAt             *time.Time          `json:"reviewed_at,omitempty" bson:"reviewed_at,omitempty"`
}

// IdentityProposal is one proposed identity fact change inside a review.
type IdentityProposal struct {
	Key        string  `json:"key" bson:"key"`
	Value      any     `json:"value" bson:"value"`
	Confidence float64 `json:"confidence" bson:"confidence"` // 0.0 – 1.0
}

// MemoryProposal is one proposed memory chunk inside a review.
type MemoryProposal struct {
	Content    string  `json:"content" bson:"content"`
	Importance float64 `json:"importance" bson:"importance"`
	Source     string  `json:"source" bson:"source"`
}

// SessionTranscript is the input to session processing.
type SessionTranscript struct {
	UserID   string           `json:"user_id"`
	Messages []TranscriptLine `json:"messages"`
}

// TranscriptLine is a single message in a conversation transcript.
type TranscriptLine struct {
	Role    string `json:"role"` // "user" or "assistant"
	Content string `json:"content"`
}

// --- API request / response types ---

// IdentityRequest is the JSON body for POST /identity/get.
type IdentityRequest struct {
	UserID string `json:"user_id"`
	Key    string `json:"key"`
}

// IdentityResponse wraps the result of an identity lookup.
type IdentityResponse struct {
	Success bool          `json:"success"`
	Fact    *IdentityFact `json:"fact,omitempty"`
	Error   string        `json:"error,omitempty"`
}

// MemorySearchRequest is the JSON body for POST /memory/search.
type MemorySearchRequest struct {
	UserID string `json:"user_id"`
	Query  string `json:"query"`
	TopK   int    `json:"top_k"`
}

// ScoredChunk pairs a memory chunk with its relevance score.
type ScoredChunk struct {
	Chunk MemoryChunk `json:"chunk"`
	Score float64     `json:"score"`
}

// MemorySearchResponse wraps search results.
type MemorySearchResponse struct {
	Success bool          `json:"success"`
	Results []ScoredChunk `json:"results"`
	Error   string        `json:"error,omitempty"`
}

// MemoryStoreRequest is the JSON body for POST /memory/store.
type MemoryStoreRequest struct {
	UserID     string  `json:"user_id"`
	Content    string  `json:"content"`
	Importance float64 `json:"importance"`
	Source     string  `json:"source"`
	SessionID  string  `json:"session_id"`
}

// MemoryStoreResponse wraps the result of a memory store.
type MemoryStoreResponse struct {
	Success bool   `json:"success"`
	ChunkID string `json:"chunk_id,omitempty"`
	Error   string `json:"error,omitempty"`
}

// SessionProcessRequest is the JSON body for POST /session/process.
type SessionProcessRequest struct {
	UserID   string           `json:"user_id"`
	Messages []TranscriptLine `json:"messages"`
}

// SessionProcessResponse wraps the result of session processing.
type SessionProcessResponse struct {
	Success   bool   `json:"success"`
	SessionID string `json:"session_id,omitempty"`
	Error     string `json:"error,omitempty"`
}

// HealthResponse is the JSON body returned by GET /health.
type HealthResponse struct {
	Status         string `json:"status"`
	StorageBackend string `json:"storage_backend"`
	Uptime         string `json:"uptime"`
	Version        string `json:"version"`
}
