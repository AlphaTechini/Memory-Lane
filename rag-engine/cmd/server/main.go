package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/memory-lane/rag-engine/internal/api"
	"github.com/memory-lane/rag-engine/internal/retrieval"
	"github.com/memory-lane/rag-engine/internal/session"
	"github.com/memory-lane/rag-engine/internal/storage"
)

func main() {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// --- Determine storage backend ---
	store, err := initStorage(ctx)
	if err != nil {
		log.Fatalf("❌ Failed to initialise storage: %v", err)
	}
	defer store.Close(ctx)

	log.Printf("✅ Storage backend: %s", store.BackendName())

	// --- Build services ---
	identitySvc := retrieval.NewIdentityService(store)
	memorySvc := retrieval.NewMemoryService(store)
	groqKey := os.Getenv("GROQ_API_KEY")
	sessionProc := session.NewProcessor(store, groqKey)

	if groqKey != "" {
		log.Println("🧠 Groq API key detected — LLM extraction enabled")
	} else {
		log.Println("⚠️  No GROQ_API_KEY — using simple rule-based extraction")
	}

	// --- HTTP router ---
	handler := api.NewHandler(identitySvc, memorySvc, sessionProc, store.BackendName())

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", handler.Health)
	mux.HandleFunc("POST /identity/get", handler.GetIdentity)
	mux.HandleFunc("POST /memory/search", handler.SearchMemory)
	mux.HandleFunc("POST /memory/store", handler.StoreMemory)
	mux.HandleFunc("POST /session/process", handler.ProcessSession)

	// --- Start server ---
	port := os.Getenv("RAG_ENGINE_PORT")
	if port == "" {
		port = "8081"
	}

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      withLogging(mux),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Graceful shutdown
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh
		log.Println("🛑 Shutting down...")
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer shutdownCancel()
		if err := srv.Shutdown(shutdownCtx); err != nil {
			log.Printf("Shutdown error: %v", err)
		}
		cancel()
	}()

	log.Printf("🚀 RAG Engine listening on :%s", port)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Server error: %v", err)
	}
}

// initStorage picks the right backend based on environment variables.
func initStorage(ctx context.Context) (storage.Storage, error) {
	awsKey := os.Getenv("AWS_ACCESS_KEY_ID")
	awsSecret := os.Getenv("AWS_SECRET_ACCESS_KEY")
	awsRegion := os.Getenv("AWS_REGION")

	if awsKey != "" && awsSecret != "" && awsRegion != "" {
		endpoint := os.Getenv("DYNAMODB_ENDPOINT") // e.g. http://localhost:8000 for local
		log.Println("📦 DynamoDB credentials detected — using DynamoDB backend")
		return storage.NewDynamoStorage(ctx, awsRegion, endpoint)
	}

	mongoURI := os.Getenv("MONGODB_URL")
	if mongoURI == "" {
		mongoURI = "mongodb://localhost:27017/sensay"
	}
	log.Printf("🍃 Using MongoDB backend (%s)", mongoURI)
	return storage.NewMongoStorage(ctx, mongoURI)
}

// withLogging wraps an http.Handler with basic request logging.
func withLogging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		wrapped := &statusWriter{ResponseWriter: w, status: 200}
		next.ServeHTTP(wrapped, r)

		// Skip noisy health checks
		if r.URL.Path == "/health" {
			return
		}
		log.Printf("%s %s %d %s", r.Method, r.URL.Path, wrapped.status, time.Since(start))
	})
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (sw *statusWriter) WriteHeader(code int) {
	sw.status = code
	sw.ResponseWriter.WriteHeader(code)
}

func init() {
	// Load .env file if present (simple key=value, no quotes handling needed)
	data, err := os.ReadFile(".env")
	if err != nil {
		return // no .env file, that's fine
	}
	for _, line := range splitLines(string(data)) {
		line = trimSpace(line)
		if line == "" || line[0] == '#' {
			continue
		}
		if idx := indexOf(line, '='); idx > 0 {
			key := trimSpace(line[:idx])
			val := trimSpace(line[idx+1:])
			if os.Getenv(key) == "" { // don't override existing env
				os.Setenv(key, val)
			}
		}
	}
}

// Simple string helpers to avoid importing strings just for init
func splitLines(s string) []string {
	var lines []string
	start := 0
	for i := 0; i < len(s); i++ {
		if s[i] == '\n' {
			line := s[start:i]
			if len(line) > 0 && line[len(line)-1] == '\r' {
				line = line[:len(line)-1]
			}
			lines = append(lines, line)
			start = i + 1
		}
	}
	if start < len(s) {
		lines = append(lines, s[start:])
	}
	return lines
}

func trimSpace(s string) string {
	i := 0
	for i < len(s) && (s[i] == ' ' || s[i] == '\t') {
		i++
	}
	j := len(s)
	for j > i && (s[j-1] == ' ' || s[j-1] == '\t') {
		j--
	}
	return s[i:j]
}

func indexOf(s string, b byte) int {
	for i := 0; i < len(s); i++ {
		if s[i] == b {
			return i
		}
	}
	return -1
}

// Ensure fmt is used
var _ = fmt.Sprintf
