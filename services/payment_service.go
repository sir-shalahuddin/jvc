package services

import (
	"bytes"
	"context"
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"retro-gcp/config"
	"retro-gcp/db"
	"retro-gcp/dto"
	"retro-gcp/models"
	"time"

	"cloud.google.com/go/firestore"
)

type ITransactionRepository interface {
	Create(ctx context.Context, t models.Transaction) error
	GetByID(ctx context.Context, id string) (*models.Transaction, error)
}

type PaymentService struct {
	TransactionRepo ITransactionRepository
	UserRepo        IUserRepository
}

func (s *PaymentService) CreateDuitkuPayment(ctx context.Context, email string, product models.Product) (*dto.DuitkuCreateResponse, error) {
	// Use a shorter ID (max 20 chars) using milliseconds
	merchantOrderId := fmt.Sprintf("R%d", time.Now().UnixNano()/1e6)
	
	// signature = md5(merchantCode + merchantOrderId + paymentAmount + apiKey)
	signatureStr := fmt.Sprintf("%s%s%d%s", 
		config.AppConfig.DuitkuMerchantCode, 
		merchantOrderId, 
		product.Price, 
		config.AppConfig.DuitkuAPIKey,
	)
	hash := md5.Sum([]byte(signatureStr))
	signature := hex.EncodeToString(hash[:])

	reqBody := dto.DuitkuCreateRequest{
		MerchantCode:    config.AppConfig.DuitkuMerchantCode,
		PaymentAmount:   product.Price,
		MerchantOrderId: merchantOrderId,
		ProductDetails:  product.Name,
		Email:           email,
		Signature:       signature,
		CallbackUrl:     "https://jvc.hanya.click/api/payment/callback",
		ReturnUrl:       "https://jvc.hanya.click/",
		ExpiryPeriod:    1440,
	}

	jsonData, _ := json.Marshal(reqBody)
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Post("https://sandbox.duitku.com/webapi/api/merchant/v2/inquiry", "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result dto.DuitkuCreateResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	if result.StatusCode != "00" {
		log.Printf("Duitku Inquiry Error: Code=%s, Message=%s", result.StatusCode, result.StatusMessage)
		return nil, fmt.Errorf("duitku error: %s", result.StatusMessage)
	}

	// Create pending transaction in database
	err = s.TransactionRepo.Create(ctx, models.Transaction{
		TransactionID: merchantOrderId,
		SupporterName: email,
		Quantity:      product.Quantity,
		Price:         product.Price,
		Status:        "pending",
		CreatedAt:     time.Now(),
	})
	if err != nil {
		return nil, err
	}

	return &result, nil
}

func (s *PaymentService) ProcessDuitkuCallback(ctx context.Context, req dto.DuitkuCallbackRequest) error {
	// Verify signature
	// signature = md5(merchantCode + amount + merchantOrderId + apiKey)
	signatureStr := fmt.Sprintf("%s%s%s%s", 
		req.MerchantCode, 
		req.Amount, 
		req.MerchantOrderId, 
		config.AppConfig.DuitkuAPIKey,
	)
	hash := md5.Sum([]byte(signatureStr))
	expectedSignature := hex.EncodeToString(hash[:])

	if req.Signature != expectedSignature {
		return fmt.Errorf("invalid signature")
	}

	if req.ResultCode != "00" {
		return fmt.Errorf("payment failed with result code %s", req.ResultCode)
	}

	// Update transaction and user quota
	return db.Client.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		txRef := db.Client.Collection("transactions").Doc(req.MerchantOrderId)
		doc, err := tx.Get(txRef)
		if err != nil {
			return err
		}
		var transaction models.Transaction
		doc.DataTo(&transaction)

		if transaction.Status == "claimed" {
			return nil // Already processed
		}

		userRef := db.Client.Collection("users").Doc(transaction.SupporterName)
		
		err = tx.Update(txRef, []firestore.Update{
			{Path: "status", Value: "claimed"},
			{Path: "claimed_at", Value: time.Now()},
		})
		if err != nil {
			return err
		}

		return tx.Update(userRef, []firestore.Update{
			{Path: "session_quota", Value: firestore.Increment(transaction.Quantity)},
		})
	})
}

func (s *PaymentService) ClaimTopup(ctx context.Context, email string, transactionID string) error {
	// In a real TDD with Firestore Transaction, it's hard to mock without abstracting the transaction logic.
	// For this exercise, we'll keep the firestore.Transaction call but use the interface where possible.
	
	return db.Client.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		txRef := db.Client.Collection("transactions").Doc(transactionID)
		doc, err := tx.Get(txRef)
		if err != nil {
			return err
		}
		var transaction models.Transaction
		doc.DataTo(&transaction)

		if transaction.Status == "claimed" {
			return fmt.Errorf("already claimed")
		}

		userRef := db.Client.Collection("users").Doc(email)
		
		err = tx.Update(txRef, []firestore.Update{
			{Path: "status", Value: "claimed"},
			{Path: "claimed_by", Value: email},
			{Path: "claimed_at", Value: time.Now()},
		})
		if err != nil {
			return err
		}

		return tx.Update(userRef, []firestore.Update{
			{Path: "session_quota", Value: firestore.Increment(transaction.Quantity)},
		})
	})
}
