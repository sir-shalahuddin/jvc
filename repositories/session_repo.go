package repositories

import (
	"context"
	"retro-gcp/db"
	"retro-gcp/models"

	"cloud.google.com/go/firestore"
	"google.golang.org/api/iterator"
)

type SessionRepository struct{}

func (r *SessionRepository) Create(ctx context.Context, session models.Session) error {
	_, err := db.Client.Collection("sessions").Doc(session.ID).Set(ctx, session)
	return err
}

func (r *SessionRepository) GetByID(ctx context.Context, id string) (*models.Session, error) {
	doc, err := db.Client.Collection("sessions").Doc(id).Get(ctx)
	if err != nil {
		return nil, err
	}
	var s models.Session
	doc.DataTo(&s)
	return &s, nil
}

func (r *SessionRepository) GetAll(ctx context.Context) ([]models.Session, error) {
	iter := db.Client.Collection("sessions").OrderBy("created_at", firestore.Desc).Documents(ctx)
	var sessions []models.Session
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}
		var s models.Session
		doc.DataTo(&s)
		sessions = append(sessions, s)
	}
	return sessions, nil
}

func (r *SessionRepository) GetByOwner(ctx context.Context, email string) ([]models.Session, error) {
	iter := db.Client.Collection("sessions").Where("owner_email", "==", email).Documents(ctx)
	var sessions []models.Session
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}
		var s models.Session
		doc.DataTo(&s)
		sessions = append(sessions, s)
	}
	return sessions, nil
}

func (r *SessionRepository) UpdateName(ctx context.Context, id string, name string) error {
	_, err := db.Client.Collection("sessions").Doc(id).Update(ctx, []firestore.Update{
		{Path: "name", Value: name},
	})
	return err
}

func (r *SessionRepository) Delete(ctx context.Context, id string) error {
	_, err := db.Client.Collection("sessions").Doc(id).Delete(ctx)
	return err
}

func (r *SessionRepository) UpdatePhase(ctx context.Context, id string, phase string) error {
	_, err := db.Client.Collection("sessions").Doc(id).Update(ctx, []firestore.Update{
		{Path: "phase", Value: phase},
	})
	return err
}

// sessionSubcollections are the subcollections under sessions/{id}.
var sessionSubcollections = []string{"questions", "answers", "voters", "action_items"}

// batchDeleteLimit stays well under Firestore's 500 writes per batch.
const batchDeleteLimit = 400

// commitInBatches splits items into chunks of at most size and calls fn on each.
func commitInBatches[T any](items []T, size int, fn func([]T) error) error {
	for start := 0; start < len(items); start += size {
		end := start + size
		if end > len(items) {
			end = len(items)
		}
		if err := fn(items[start:end]); err != nil {
			return err
		}
	}
	return nil
}

// DeleteWithRelated deletes every subcollection document of the session in batched
// writes, then the session document itself. Clusters are not stored separately
// (they are cluster_tag on answers), so deleting answers removes them.
func (r *SessionRepository) DeleteWithRelated(ctx context.Context, id string) error {
	sess := db.Client.Collection("sessions").Doc(id)
	for _, sub := range sessionSubcollections {
		var refs []*firestore.DocumentRef
		iter := sess.Collection(sub).DocumentRefs(ctx)
		for {
			ref, err := iter.Next()
			if err == iterator.Done {
				break
			}
			if err != nil {
				return err
			}
			refs = append(refs, ref)
		}
		err := commitInBatches(refs, batchDeleteLimit, func(chunk []*firestore.DocumentRef) error {
			batch := db.Client.Batch()
			for _, ref := range chunk {
				batch.Delete(ref)
			}
			_, err := batch.Commit(ctx)
			return err
		})
		if err != nil {
			return err
		}
	}
	_, err := sess.Delete(ctx)
	return err
}
