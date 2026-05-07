package db

import (
	"context"
	"log"
	"retro-gcp/config"

	"cloud.google.com/go/firestore"
)

var Client *firestore.Client

func InitFirestore() error {
	ctx := context.Background()
	var err error
	Client, err = firestore.NewClient(ctx, config.AppConfig.GCPProjectID)
	if err != nil {
		return err
	}
	log.Printf("Firestore initialized for project: %s", config.AppConfig.GCPProjectID)
	return nil
}

func CloseFirestore() {
	if Client != nil {
		Client.Close()
	}
}
