package storage

import (
	"context"
	"fmt"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/memory-lane/rag-engine/internal/models"
)

const (
	identityTable = "IdentityCore"
	memoryTable   = "MemoryChunks"
	tokenTable    = "TokenIndex"
	reviewTable   = "ReviewQueue"
)

// DynamoStorage implements Storage using AWS DynamoDB.
type DynamoStorage struct {
	client *dynamodb.Client
}

// NewDynamoStorage creates a DynamoDB-backed storage.
// If endpoint is non-empty it is used (for DynamoDB Local).
func NewDynamoStorage(ctx context.Context, region, endpoint string) (*DynamoStorage, error) {
	opts := []func(*config.LoadOptions) error{
		config.WithRegion(region),
	}
	if endpoint != "" {
		opts = append(opts, config.WithEndpointResolverWithOptions(
			aws.EndpointResolverWithOptionsFunc(func(service, reg string, options ...interface{}) (aws.Endpoint, error) {
				return aws.Endpoint{URL: endpoint}, nil
			}),
		))
	}

	cfg, err := config.LoadDefaultConfig(ctx, opts...)
	if err != nil {
		return nil, fmt.Errorf("dynamo config: %w", err)
	}

	client := dynamodb.NewFromConfig(cfg)
	return &DynamoStorage{client: client}, nil
}

// --- Identity ---

func (s *DynamoStorage) GetIdentity(ctx context.Context, userID, key string) (*models.IdentityFact, error) {
	out, err := s.client.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(identityTable),
		Key: map[string]types.AttributeValue{
			"pk": &types.AttributeValueMemberS{Value: "user#" + userID},
			"sk": &types.AttributeValueMemberS{Value: "identity#" + key},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("dynamo get identity: %w", err)
	}
	if out.Item == nil {
		return nil, nil
	}

	var fact models.IdentityFact
	if err := attributevalue.UnmarshalMap(out.Item, &fact); err != nil {
		return nil, fmt.Errorf("dynamo unmarshal identity: %w", err)
	}
	fact.UserID = userID
	fact.Key = key
	return &fact, nil
}

func (s *DynamoStorage) SetIdentity(ctx context.Context, fact *models.IdentityFact) error {
	item, err := attributevalue.MarshalMap(fact)
	if err != nil {
		return fmt.Errorf("dynamo marshal identity: %w", err)
	}
	item["pk"] = &types.AttributeValueMemberS{Value: "user#" + fact.UserID}
	item["sk"] = &types.AttributeValueMemberS{Value: "identity#" + fact.Key}

	_, err = s.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(identityTable),
		Item:      item,
	})
	if err != nil {
		return fmt.Errorf("dynamo set identity: %w", err)
	}
	return nil
}

// --- Memory ---

func (s *DynamoStorage) StoreMemory(ctx context.Context, chunk *models.MemoryChunk) error {
	item, err := attributevalue.MarshalMap(chunk)
	if err != nil {
		return fmt.Errorf("dynamo marshal memory: %w", err)
	}
	item["pk"] = &types.AttributeValueMemberS{Value: "user#" + chunk.UserID}
	item["sk"] = &types.AttributeValueMemberS{Value: "memory#" + chunk.CreatedAt.Format(time.RFC3339Nano)}

	_, err = s.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(memoryTable),
		Item:      item,
	})
	if err != nil {
		return fmt.Errorf("dynamo store memory: %w", err)
	}
	return nil
}

func (s *DynamoStorage) SearchMemoryByTokens(ctx context.Context, userID string, tokens []string) ([]models.MemoryChunk, error) {
	// First, look up chunk IDs from the token index
	chunkIDs, err := s.LookupTokens(ctx, userID, tokens)
	if err != nil {
		return nil, err
	}
	if len(chunkIDs) == 0 {
		return nil, nil
	}

	// Batch get the chunks — for simplicity, query user's memories and filter
	out, err := s.client.Query(ctx, &dynamodb.QueryInput{
		TableName:              aws.String(memoryTable),
		KeyConditionExpression: aws.String("pk = :pk"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":pk": &types.AttributeValueMemberS{Value: "user#" + userID},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("dynamo query memory: %w", err)
	}

	chunkSet := make(map[string]bool, len(chunkIDs))
	for _, id := range chunkIDs {
		chunkSet[id] = true
	}

	var chunks []models.MemoryChunk
	for _, item := range out.Items {
		var chunk models.MemoryChunk
		if err := attributevalue.UnmarshalMap(item, &chunk); err != nil {
			continue
		}
		if chunkSet[chunk.ChunkID] {
			chunks = append(chunks, chunk)
		}
	}
	return chunks, nil
}

// --- Token Index ---

func (s *DynamoStorage) IndexTokens(ctx context.Context, entries []models.TokenEntry) error {
	for _, e := range entries {
		item, err := attributevalue.MarshalMap(e)
		if err != nil {
			return fmt.Errorf("dynamo marshal token: %w", err)
		}
		item["pk"] = &types.AttributeValueMemberS{Value: "token#" + e.Token}
		item["sk"] = &types.AttributeValueMemberS{Value: "memory#" + e.Timestamp.Format(time.RFC3339Nano)}

		_, err = s.client.PutItem(ctx, &dynamodb.PutItemInput{
			TableName: aws.String(tokenTable),
			Item:      item,
		})
		if err != nil {
			return fmt.Errorf("dynamo index token: %w", err)
		}
	}
	return nil
}

func (s *DynamoStorage) LookupTokens(ctx context.Context, userID string, tokens []string) ([]string, error) {
	chunkSet := make(map[string]bool)
	for _, t := range tokens {
		out, err := s.client.Query(ctx, &dynamodb.QueryInput{
			TableName:              aws.String(tokenTable),
			KeyConditionExpression: aws.String("pk = :pk"),
			FilterExpression:       aws.String("user_id = :uid"),
			ExpressionAttributeValues: map[string]types.AttributeValue{
				":pk":  &types.AttributeValueMemberS{Value: "token#" + t},
				":uid": &types.AttributeValueMemberS{Value: userID},
			},
		})
		if err != nil {
			return nil, fmt.Errorf("dynamo lookup token %q: %w", t, err)
		}
		for _, item := range out.Items {
			var entry models.TokenEntry
			if err := attributevalue.UnmarshalMap(item, &entry); err != nil {
				continue
			}
			chunkSet[entry.ChunkID] = true
		}
	}

	ids := make([]string, 0, len(chunkSet))
	for id := range chunkSet {
		ids = append(ids, id)
	}
	return ids, nil
}

// --- Review Queue ---

func (s *DynamoStorage) StoreReview(ctx context.Context, item *models.ReviewItem) error {
	item.CreatedAt = time.Now()
	av, err := attributevalue.MarshalMap(item)
	if err != nil {
		return fmt.Errorf("dynamo marshal review: %w", err)
	}
	av["pk"] = &types.AttributeValueMemberS{Value: "review#" + item.SessionID}

	_, err = s.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(reviewTable),
		Item:      av,
	})
	if err != nil {
		return fmt.Errorf("dynamo store review: %w", err)
	}
	return nil
}

func (s *DynamoStorage) GetReview(ctx context.Context, sessionID string) (*models.ReviewItem, error) {
	out, err := s.client.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(reviewTable),
		Key: map[string]types.AttributeValue{
			"pk": &types.AttributeValueMemberS{Value: "review#" + sessionID},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("dynamo get review: %w", err)
	}
	if out.Item == nil {
		return nil, nil
	}

	var review models.ReviewItem
	if err := attributevalue.UnmarshalMap(out.Item, &review); err != nil {
		return nil, fmt.Errorf("dynamo unmarshal review: %w", err)
	}
	return &review, nil
}

func (s *DynamoStorage) ListPendingReviews(ctx context.Context, userID string) ([]models.ReviewItem, error) {
	// Scan with filter — acceptable for review queue sizes
	out, err := s.client.Scan(ctx, &dynamodb.ScanInput{
		TableName:        aws.String(reviewTable),
		FilterExpression: aws.String("user_id = :uid AND #s = :status"),
		ExpressionAttributeNames: map[string]string{
			"#s": "status",
		},
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":uid":    &types.AttributeValueMemberS{Value: userID},
			":status": &types.AttributeValueMemberS{Value: string(models.ReviewPending)},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("dynamo list pending reviews: %w", err)
	}

	var items []models.ReviewItem
	for _, item := range out.Items {
		var review models.ReviewItem
		if err := attributevalue.UnmarshalMap(item, &review); err != nil {
			continue
		}
		items = append(items, review)
	}
	return items, nil
}

func (s *DynamoStorage) UpdateReviewStatus(ctx context.Context, sessionID string, status models.ReviewStatus) error {
	now := time.Now().Format(time.RFC3339)
	_, err := s.client.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName: aws.String(reviewTable),
		Key: map[string]types.AttributeValue{
			"pk": &types.AttributeValueMemberS{Value: "review#" + sessionID},
		},
		UpdateExpression: aws.String("SET #s = :status, reviewed_at = :rat"),
		ExpressionAttributeNames: map[string]string{
			"#s": "status",
		},
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":status": &types.AttributeValueMemberS{Value: string(status)},
			":rat":    &types.AttributeValueMemberS{Value: now},
		},
	})
	if err != nil {
		return fmt.Errorf("dynamo update review: %w", err)
	}
	return nil
}

// --- Health & Lifecycle ---

func (s *DynamoStorage) Ping(ctx context.Context) error {
	_, err := s.client.ListTables(ctx, &dynamodb.ListTablesInput{Limit: aws.Int32(1)})
	return err
}

func (s *DynamoStorage) BackendName() string {
	return "dynamodb"
}

func (s *DynamoStorage) Close(ctx context.Context) error {
	return nil // DynamoDB client doesn't need explicit close
}
