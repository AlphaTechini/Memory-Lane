package session

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/memory-lane/rag-engine/internal/models"
	"github.com/memory-lane/rag-engine/internal/storage"
)

// Processor handles conversation session processing.
// When Groq is configured, it calls the LLM for structured extraction.
// Until then, it uses a simple rule-based extractor.
type Processor struct {
	store   storage.Storage
	groqKey string // empty = stub mode
}

// NewProcessor creates a session processor.
func NewProcessor(store storage.Storage, groqKey string) *Processor {
	return &Processor{store: store, groqKey: groqKey}
}

// Process takes a conversation transcript, extracts proposed identity updates
// and memory chunks, and stores them in the review queue for caretaker approval.
func (p *Processor) Process(ctx context.Context, userID string, messages []models.TranscriptLine) (string, error) {
	if userID == "" || len(messages) == 0 {
		return "", fmt.Errorf("user_id and messages are required")
	}

	sessionID := fmt.Sprintf("session-%s-%d", userID, time.Now().UnixNano())

	var identityProposals []models.IdentityProposal
	var memoryProposals []models.MemoryProposal

	if p.groqKey != "" {
		// TODO: Call Groq extraction prompt when API key is available
		// For now, fall through to simple extraction
		identityProposals, memoryProposals = p.simpleExtract(messages)
	} else {
		identityProposals, memoryProposals = p.simpleExtract(messages)
	}

	review := &models.ReviewItem{
		SessionID:               sessionID,
		UserID:                  userID,
		Status:                  models.ReviewPending,
		ProposedIdentityUpdates: identityProposals,
		ProposedMemories:        memoryProposals,
		CreatedAt:               time.Now(),
	}

	if err := p.store.StoreReview(ctx, review); err != nil {
		return "", fmt.Errorf("store review: %w", err)
	}

	return sessionID, nil
}

// simpleExtract does rule-based extraction from a transcript.
// This is a placeholder until Groq-powered extraction is wired up.
func (p *Processor) simpleExtract(messages []models.TranscriptLine) ([]models.IdentityProposal, []models.MemoryProposal) {
	var identities []models.IdentityProposal
	var memories []models.MemoryProposal

	for _, msg := range messages {
		if msg.Role != "user" {
			continue
		}

		content := strings.TrimSpace(msg.Content)
		if len(content) < 10 {
			continue // skip trivial messages
		}

		// Simple heuristic: if a user message is a statement (not a question),
		// treat it as a potential memory
		if !strings.HasSuffix(content, "?") {
			memories = append(memories, models.MemoryProposal{
				Content:    content,
				Importance: 0.5,
				Source:     "conversation",
			})
		}

		// Very simple identity extraction: look for "my X is Y" patterns
		lower := strings.ToLower(content)
		if strings.Contains(lower, "my name is") {
			parts := strings.SplitN(lower, "my name is", 2)
			if len(parts) == 2 {
				name := strings.TrimSpace(parts[1])
				name = strings.TrimRight(name, ".,!?")
				identities = append(identities, models.IdentityProposal{
					Key:        "name",
					Value:      name,
					Confidence: 0.8,
				})
			}
		}
	}

	return identities, memories
}
