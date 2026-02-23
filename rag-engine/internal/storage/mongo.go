package storage

import (
	"context"
	"crypto/tls"
	"fmt"
	"strings"
	"time"

	"github.com/memory-lane/rag-engine/internal/models"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

const (
	dbName             = "sensay"
	identityCollection = "identity_core"
	memoryCollection   = "memory_chunks"
	tokenCollection    = "token_index"
	reviewCollection   = "review_queue"
)

// MongoStorage implements Storage using MongoDB.
type MongoStorage struct {
	client *mongo.Client
	db     *mongo.Database
}

// NewMongoStorage connects to MongoDB and returns a ready storage backend.
func NewMongoStorage(ctx context.Context, uri string) (*MongoStorage, error) {
	// Add retryWrites and connection timeout if not already specified
	connectCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	clientOpts := options.Client().ApplyURI(uri).
		SetConnectTimeout(10 * time.Second).
		SetServerSelectionTimeout(10 * time.Second)

	// For Atlas SRV connections on Windows, Go's TLS stack can fail with
	// "tls: internal error" due to certificate chain issues. Use a custom
	// TLS config as a workaround.
	if strings.Contains(uri, "mongodb+srv") || strings.Contains(uri, "tls=true") {
		tlsCfg := &tls.Config{
			MinVersion: tls.VersionTLS12,
		}
		clientOpts.SetTLSConfig(tlsCfg)
	}

	client, err := mongo.Connect(clientOpts)
	if err != nil {
		return nil, fmt.Errorf("mongo connect: %w", err)
	}

	// Verify connection
	if err := client.Ping(connectCtx, nil); err != nil {
		return nil, fmt.Errorf("mongo ping: %w", err)
	}

	// Extract database name from URI, default to "sensay"
	dbNameToUse := dbName
	if idx := strings.LastIndex(uri, "/"); idx > 0 {
		candidate := uri[idx+1:]
		// Remove query parameters
		if qmark := strings.Index(candidate, "?"); qmark > 0 {
			candidate = candidate[:qmark]
		}
		if candidate != "" && !strings.Contains(candidate, ":") {
			dbNameToUse = candidate
		}
	}

	db := client.Database(dbNameToUse)
	s := &MongoStorage{client: client, db: db}

	// Create indexes
	if err := s.ensureIndexes(ctx); err != nil {
		return nil, fmt.Errorf("mongo indexes: %w", err)
	}

	return s, nil
}

func (s *MongoStorage) ensureIndexes(ctx context.Context) error {
	// IdentityCore: compound index on user_id + key (unique)
	_, err := s.db.Collection(identityCollection).Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "user_id", Value: 1}, {Key: "key", Value: 1}},
		Options: options.Index().SetUnique(true),
	})
	if err != nil {
		return err
	}

	// MemoryChunks: compound index on user_id + replica_id + chunk_id
	_, err = s.db.Collection(memoryCollection).Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "user_id", Value: 1}, {Key: "replica_id", Value: 1}}},
		{Keys: bson.D{{Key: "user_id", Value: 1}, {Key: "chunk_id", Value: 1}}, Options: options.Index().SetUnique(true)},
	})
	if err != nil {
		return err
	}

	// TokenIndex: compound on user_id + replica_id + token
	_, err = s.db.Collection(tokenCollection).Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{{Key: "user_id", Value: 1}, {Key: "replica_id", Value: 1}, {Key: "token", Value: 1}},
	})
	if err != nil {
		return err
	}

	// ReviewQueue: index on user_id + status
	_, err = s.db.Collection(reviewCollection).Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{{Key: "user_id", Value: 1}, {Key: "status", Value: 1}},
	})
	return err
}

// --- Identity ---

func (s *MongoStorage) GetIdentity(ctx context.Context, userID, key string) (*models.IdentityFact, error) {
	var fact models.IdentityFact
	filter := bson.M{"user_id": userID, "key": key}
	err := s.db.Collection(identityCollection).FindOne(ctx, filter).Decode(&fact)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil // not found
		}
		return nil, fmt.Errorf("get identity: %w", err)
	}
	return &fact, nil
}

func (s *MongoStorage) SetIdentity(ctx context.Context, fact *models.IdentityFact) error {
	filter := bson.M{"user_id": fact.UserID, "key": fact.Key}
	update := bson.M{"$set": fact}
	opts := options.UpdateOne().SetUpsert(true)
	_, err := s.db.Collection(identityCollection).UpdateOne(ctx, filter, update, opts)
	if err != nil {
		return fmt.Errorf("set identity: %w", err)
	}
	return nil
}

// --- Memory ---

func (s *MongoStorage) StoreMemory(ctx context.Context, chunk *models.MemoryChunk) error {
	_, err := s.db.Collection(memoryCollection).InsertOne(ctx, chunk)
	if err != nil {
		return fmt.Errorf("store memory: %w", err)
	}
	return nil
}

func (s *MongoStorage) SearchMemoryByTokens(ctx context.Context, userID, replicaID string, tokens []string) ([]models.MemoryChunk, error) {
	if len(tokens) == 0 {
		return nil, nil
	}

	// Build filter scoped to user + replica
	filter := bson.M{
		"user_id": userID,
		"tokens":  bson.M{"$in": tokens},
	}
	if replicaID != "" {
		filter["replica_id"] = replicaID
	}

	cursor, err := s.db.Collection(memoryCollection).Find(ctx, filter)
	if err != nil {
		return nil, fmt.Errorf("search memory: %w", err)
	}
	defer cursor.Close(ctx)

	var chunks []models.MemoryChunk
	if err := cursor.All(ctx, &chunks); err != nil {
		return nil, fmt.Errorf("decode memory chunks: %w", err)
	}
	return chunks, nil
}

// --- Token Index ---

func (s *MongoStorage) IndexTokens(ctx context.Context, entries []models.TokenEntry) error {
	if len(entries) == 0 {
		return nil
	}
	docs := make([]interface{}, len(entries))
	for i, e := range entries {
		docs[i] = e
	}
	_, err := s.db.Collection(tokenCollection).InsertMany(ctx, docs)
	if err != nil {
		return fmt.Errorf("index tokens: %w", err)
	}
	return nil
}

func (s *MongoStorage) LookupTokens(ctx context.Context, userID, replicaID string, tokens []string) ([]string, error) {
	if len(tokens) == 0 {
		return nil, nil
	}
	filter := bson.M{
		"user_id": userID,
		"token":   bson.M{"$in": tokens},
	}
	if replicaID != "" {
		filter["replica_id"] = replicaID
	}
	cursor, err := s.db.Collection(tokenCollection).Find(ctx, filter)
	if err != nil {
		return nil, fmt.Errorf("lookup tokens: %w", err)
	}
	defer cursor.Close(ctx)

	chunkSet := make(map[string]bool)
	for cursor.Next(ctx) {
		var entry models.TokenEntry
		if err := cursor.Decode(&entry); err != nil {
			continue
		}
		chunkSet[entry.ChunkID] = true
	}

	ids := make([]string, 0, len(chunkSet))
	for id := range chunkSet {
		ids = append(ids, id)
	}
	return ids, nil
}

// --- Review Queue ---

func (s *MongoStorage) StoreReview(ctx context.Context, item *models.ReviewItem) error {
	item.CreatedAt = time.Now()
	_, err := s.db.Collection(reviewCollection).InsertOne(ctx, item)
	if err != nil {
		return fmt.Errorf("store review: %w", err)
	}
	return nil
}

func (s *MongoStorage) GetReview(ctx context.Context, sessionID string) (*models.ReviewItem, error) {
	var item models.ReviewItem
	filter := bson.M{"session_id": sessionID}
	err := s.db.Collection(reviewCollection).FindOne(ctx, filter).Decode(&item)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil
		}
		return nil, fmt.Errorf("get review: %w", err)
	}
	return &item, nil
}

func (s *MongoStorage) ListPendingReviews(ctx context.Context, userID string) ([]models.ReviewItem, error) {
	filter := bson.M{"user_id": userID, "status": models.ReviewPending}
	cursor, err := s.db.Collection(reviewCollection).Find(ctx, filter)
	if err != nil {
		return nil, fmt.Errorf("list pending reviews: %w", err)
	}
	defer cursor.Close(ctx)

	var items []models.ReviewItem
	if err := cursor.All(ctx, &items); err != nil {
		return nil, fmt.Errorf("decode reviews: %w", err)
	}
	return items, nil
}

func (s *MongoStorage) UpdateReviewStatus(ctx context.Context, sessionID string, status models.ReviewStatus) error {
	now := time.Now()
	filter := bson.M{"session_id": sessionID}
	update := bson.M{"$set": bson.M{"status": status, "reviewed_at": now}}
	_, err := s.db.Collection(reviewCollection).UpdateOne(ctx, filter, update)
	if err != nil {
		return fmt.Errorf("update review status: %w", err)
	}
	return nil
}

// --- Health & Lifecycle ---

func (s *MongoStorage) Ping(ctx context.Context) error {
	return s.client.Ping(ctx, nil)
}

func (s *MongoStorage) BackendName() string {
	return "mongodb"
}

func (s *MongoStorage) Close(ctx context.Context) error {
	return s.client.Disconnect(ctx)
}
