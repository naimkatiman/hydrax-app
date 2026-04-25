// Package products owns workflow-svc's product domain: types and the
// repository over the products table. No HTTP, no JSON tags, no
// validation — handlers translate at the edge.
package products

import "time"

// Product is one row of the products table.
type Product struct {
	ID             string
	TenantID       string
	Code           string
	Name           string
	ProductType    string
	Status         string
	RailsProductID *string
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

// ProductInput is the caller-supplied data needed to insert a product.
// id, status, rails_product_id, created_at, updated_at all come from
// the database.
type ProductInput struct {
	TenantID    string
	Code        string
	Name        string
	ProductType string
}
