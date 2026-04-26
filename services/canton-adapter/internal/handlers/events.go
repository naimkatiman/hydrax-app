package handlers

import (
	"bytes"
	"net/http"
	"strconv"

	"github.com/naimkatiman/hydrax-app/services/canton-adapter/internal/ledger"
)

// ListEventsResponseBody is the JSON shape GET /v1/events returns.
type ListEventsResponseBody struct {
	Events     []ledger.Event `json:"events"`
	NextOffset uint64         `json:"next_offset"`
}

// ListEvents exposes Ledger.EventsAfter over HTTP.
//
// Query params:
//   - after: integer >= 0 (default 0). Returns events with Offset > after.
//   - party: optional. When set, filters to events whose payload mentions
//     the party as a substring. The mock keeps the match loose by design;
//     a real Canton adapter would filter on declared signatories/observers.
func ListEvents(l *ledger.Ledger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		afterStr := r.URL.Query().Get("after")
		var after uint64
		if afterStr != "" {
			n, err := strconv.ParseInt(afterStr, 10, 64)
			if err != nil || n < 0 {
				respondError(w, http.StatusBadRequest, "bad_after", "after must be a non-negative integer")
				return
			}
			after = uint64(n)
		}

		events, next := l.EventsAfter(after)

		if party := r.URL.Query().Get("party"); party != "" {
			needle := []byte(party)
			filtered := make([]ledger.Event, 0, len(events))
			for _, e := range events {
				if bytes.Contains(e.PayloadJSON, needle) {
					filtered = append(filtered, e)
				}
			}
			events = filtered
		}

		if events == nil {
			events = []ledger.Event{}
		}

		respondJSON(w, http.StatusOK, ListEventsResponseBody{
			Events:     events,
			NextOffset: next,
		})
	}
}
