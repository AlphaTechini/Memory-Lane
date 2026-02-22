package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/memory-lane/rag-engine/internal/models"
	"github.com/memory-lane/rag-engine/internal/retrieval"
	"github.com/memory-lane/rag-engine/internal/session"
)

// Handler holds references to services and exposes HTTP handlers.
type Handler struct {
	identity  *retrieval.IdentityService
	memory    *retrieval.MemoryService
	session   *session.Processor
	startTime time.Time
	backend   string
}

// NewHandler creates a new API handler.
func NewHandler(
	identity *retrieval.IdentityService,
	memory *retrieval.MemoryService,
	sess *session.Processor,
	backend string,
) *Handler {
	return &Handler{
		identity:  identity,
		memory:    memory,
		session:   sess,
		startTime: time.Now(),
		backend:   backend,
	}
}

// Health returns service health information.
func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
	resp := models.HealthResponse{
		Status:         "healthy",
		StorageBackend: h.backend,
		Uptime:         time.Since(h.startTime).String(),
		Version:        "0.1.0",
	}
	writeJSON(w, http.StatusOK, resp)
}

// GetIdentity handles POST /identity/get
func (h *Handler) GetIdentity(w http.ResponseWriter, r *http.Request) {
	var req models.IdentityRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, models.IdentityResponse{
			Success: false, Error: "invalid request body",
		})
		return
	}

	fact, err := h.identity.Get(r.Context(), req.UserID, req.Key)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, models.IdentityResponse{
			Success: false, Error: err.Error(),
		})
		return
	}

	writeJSON(w, http.StatusOK, models.IdentityResponse{
		Success: true, Fact: fact,
	})
}

// SearchMemory handles POST /memory/search
func (h *Handler) SearchMemory(w http.ResponseWriter, r *http.Request) {
	var req models.MemorySearchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, models.MemorySearchResponse{
			Success: false, Error: "invalid request body",
		})
		return
	}

	results, err := h.memory.Search(r.Context(), req.UserID, req.Query, req.TopK)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, models.MemorySearchResponse{
			Success: false, Error: err.Error(),
		})
		return
	}
	if results == nil {
		results = []models.ScoredChunk{}
	}

	writeJSON(w, http.StatusOK, models.MemorySearchResponse{
		Success: true, Results: results,
	})
}

// StoreMemory handles POST /memory/store
func (h *Handler) StoreMemory(w http.ResponseWriter, r *http.Request) {
	var req models.MemoryStoreRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, models.MemoryStoreResponse{
			Success: false, Error: "invalid request body",
		})
		return
	}

	chunkID, err := h.memory.Store(
		r.Context(),
		req.UserID,
		req.Content,
		req.Source,
		req.SessionID,
		req.Importance,
	)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, models.MemoryStoreResponse{
			Success: false, Error: err.Error(),
		})
		return
	}

	writeJSON(w, http.StatusCreated, models.MemoryStoreResponse{
		Success: true, ChunkID: chunkID,
	})
}

// ProcessSession handles POST /session/process
func (h *Handler) ProcessSession(w http.ResponseWriter, r *http.Request) {
	var req models.SessionProcessRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, models.SessionProcessResponse{
			Success: false, Error: "invalid request body",
		})
		return
	}

	sessionID, err := h.session.Process(r.Context(), req.UserID, req.Messages)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, models.SessionProcessResponse{
			Success: false, Error: err.Error(),
		})
		return
	}

	writeJSON(w, http.StatusCreated, models.SessionProcessResponse{
		Success: true, SessionID: sessionID,
	})
}

// writeJSON is a small helper to write JSON responses.
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
