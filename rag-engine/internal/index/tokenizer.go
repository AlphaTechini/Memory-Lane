package index

import (
	"strings"
	"unicode"
)

// stopWords is a set of common English words to exclude from tokenization.
var stopWords = map[string]bool{
	"a": true, "an": true, "the": true, "and": true, "or": true,
	"but": true, "in": true, "on": true, "at": true, "to": true,
	"for": true, "of": true, "with": true, "by": true, "from": true,
	"is": true, "it": true, "as": true, "was": true, "are": true,
	"be": true, "been": true, "being": true, "have": true, "has": true,
	"had": true, "do": true, "does": true, "did": true, "will": true,
	"would": true, "could": true, "should": true, "may": true, "might": true,
	"shall": true, "can": true, "that": true, "this": true, "these": true,
	"those": true, "i": true, "me": true, "my": true, "we": true,
	"our": true, "you": true, "your": true, "he": true, "she": true,
	"his": true, "her": true, "they": true, "them": true, "their": true,
	"what": true, "which": true, "who": true, "whom": true, "when": true,
	"where": true, "why": true, "how": true, "not": true, "no": true,
	"so": true, "if": true, "then": true, "than": true, "too": true,
	"very": true, "just": true, "about": true, "up": true, "out": true,
	"all": true, "also": true, "into": true, "over": true, "after": true,
}

// Tokenize splits text into lowercase keywords, removing stop words and
// non-alphanumeric characters. Returns unique tokens.
func Tokenize(text string) []string {
	// Lowercase and split on non-alphanumeric boundaries
	words := strings.FieldsFunc(strings.ToLower(text), func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsDigit(r)
	})

	seen := make(map[string]bool, len(words))
	tokens := make([]string, 0, len(words))

	for _, w := range words {
		if len(w) < 2 {
			continue // skip single-char tokens
		}
		if stopWords[w] {
			continue
		}
		if seen[w] {
			continue
		}
		seen[w] = true
		tokens = append(tokens, w)
	}

	return tokens
}

// TokenOverlap computes the fraction of queryTokens that appear in chunkTokens.
// Returns a value between 0.0 and 1.0.
func TokenOverlap(queryTokens, chunkTokens []string) float64 {
	if len(queryTokens) == 0 {
		return 0
	}

	chunkSet := make(map[string]bool, len(chunkTokens))
	for _, t := range chunkTokens {
		chunkSet[t] = true
	}

	matches := 0
	for _, qt := range queryTokens {
		if chunkSet[qt] {
			matches++
		}
	}

	return float64(matches) / float64(len(queryTokens))
}
