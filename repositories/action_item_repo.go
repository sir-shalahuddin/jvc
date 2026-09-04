package repositories

import (
	"context"
	"retro-gcp/db"
	"retro-gcp/models"
	"sync"

	"cloud.google.com/go/firestore"
	"google.golang.org/api/iterator"
)

type IActionItemRepository interface {
	Create(ctx context.Context, sessionID string, item models.ActionItem) error
	GetBySession(ctx context.Context, sessionID string) ([]models.ActionItem, error)
	Toggle(ctx context.Context, sessionID string, itemID string, completed bool) error
	Delete(ctx context.Context, sessionID string, itemID string) error
}

type ActionItemRepository struct {
	mu    sync.RWMutex
	cache map[string][]models.ActionItem
}

func (r *ActionItemRepository) Create(ctx context.Context, sessionID string, item models.ActionItem) error {
	r.mu.Lock()
	if r.cache == nil {
		r.cache = make(map[string][]models.ActionItem)
	}
	r.cache[sessionID] = append(r.cache[sessionID], item)
	r.mu.Unlock()

	if db.Client == nil {
		return nil
	}

	_, err := db.Client.Collection("sessions").Doc(sessionID).Collection("action_items").Doc(item.ID).Set(ctx, item)
	return err
}

func (r *ActionItemRepository) GetBySession(ctx context.Context, sessionID string) ([]models.ActionItem, error) {
	if db.Client == nil {
		r.mu.RLock()
		defer r.mu.RUnlock()
		if r.cache == nil {
			return []models.ActionItem{}, nil
		}
		items := r.cache[sessionID]
		res := make([]models.ActionItem, len(items))
		copy(res, items)
		return res, nil
	}

	iter := db.Client.Collection("sessions").Doc(sessionID).Collection("action_items").OrderBy("created_at", firestore.Asc).Documents(ctx)
	var items []models.ActionItem
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}
		var it models.ActionItem
		doc.DataTo(&it)
		items = append(items, it)
	}

	r.mu.Lock()
	if r.cache == nil {
		r.cache = make(map[string][]models.ActionItem)
	}
	r.cache[sessionID] = items
	r.mu.Unlock()

	return items, nil
}

func (r *ActionItemRepository) Toggle(ctx context.Context, sessionID string, itemID string, completed bool) error {
	r.mu.Lock()
	if r.cache != nil {
		if items, ok := r.cache[sessionID]; ok {
			for i := range items {
				if items[i].ID == itemID {
					items[i].Completed = completed
					break
				}
			}
		}
	}
	r.mu.Unlock()

	if db.Client == nil {
		return nil
	}

	_, err := db.Client.Collection("sessions").Doc(sessionID).Collection("action_items").Doc(itemID).Update(ctx, []firestore.Update{
		{Path: "completed", Value: completed},
	})
	return err
}

func (r *ActionItemRepository) Delete(ctx context.Context, sessionID string, itemID string) error {
	r.mu.Lock()
	if r.cache != nil {
		if items, ok := r.cache[sessionID]; ok {
			var filtered []models.ActionItem
			for _, it := range items {
				if it.ID != itemID {
					filtered = append(filtered, it)
				}
			}
			r.cache[sessionID] = filtered
		}
	}
	r.mu.Unlock()

	if db.Client == nil {
		return nil
	}

	_, err := db.Client.Collection("sessions").Doc(sessionID).Collection("action_items").Doc(itemID).Delete(ctx)
	return err
}
