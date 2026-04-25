package subscriptions

import "time"

// Subscription mirrors a subscriptions row.
type Subscription struct {
	ID             string
	ProductID      string
	InvestorUserID string
	AmountMinor    int64
	Currency       string
	Status         string
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

// SubscriptionInput is the create payload the handler accepts.
type SubscriptionInput struct {
	ProductID      string
	InvestorUserID string
	AmountMinor    int64
	Currency       string
}
