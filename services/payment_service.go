package services

import (
	"bytes"
	"context"
	"crypto/md5"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
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
	merchantOrderId := fmt.Sprintf("R%d", time.Now().UnixNano()/1e6)
	timestamp := time.Now().UnixNano() / 1e6 // milliseconds
	
	// signature = sha256(merchantCode + timestamp + apiKey)
	signatureStr := fmt.Sprintf("%s%d%s", 
		config.AppConfig.DuitkuMerchantCode, 
		timestamp,
		config.AppConfig.DuitkuAPIKey,
	)
	hash := sha256.Sum256([]byte(signatureStr))
	signature := hex.EncodeToString(hash[:])

	reqBody := dto.DuitkuCreateRequest{
		MerchantCode:    config.AppConfig.DuitkuMerchantCode,
		PaymentAmount:   product.Price,
		MerchantOrderId: merchantOrderId,
		ProductDetails:  product.Name,
		Email:           email,
		ItemDetails: []dto.DuitkuItem{
			{Name: product.Name, Price: product.Price, Quantity: 1},
		},
		CallbackUrl:  "https://jvc.hanya.click/api/payment/callback",
		ReturnUrl:    "https://jvc.hanya.click/",
		ExpiryPeriod: 1440,
	}

	jsonData, _ := json.Marshal(reqBody)
	client := &http.Client{Timeout: 10 * time.Second}
	
	req, err := http.NewRequestWithContext(ctx, "POST", "https://api-sandbox.duitku.com/api/merchant/createInvoice", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("x-duitku-signature", signature)
	req.Header.Set("x-duitku-timestamp", fmt.Sprintf("%d", timestamp))
	req.Header.Set("x-duitku-merchantcode", config.AppConfig.DuitkuMerchantCode)

	resp, err := client.Do(req)
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
	// Duitku amount might come as "25000.00", but signature uses "25000"
	amountStr := req.Amount
	if dotIndex := strings.Index(amountStr, "."); dotIndex != -1 {
		amountStr = amountStr[:dotIndex]
	}

	// signature = md5(merchantCode + amount + merchantOrderId + apiKey)
	signatureStr := fmt.Sprintf("%s%s%s%s", 
		req.MerchantCode, 
		amountStr, 
		req.MerchantOrderId, 
		config.AppConfig.DuitkuAPIKey,
	)
	hash := md5.Sum([]byte(signatureStr))
	expectedSignature := hex.EncodeToString(hash[:])

	log.Printf("Duitku Callback: OrderId=%s, Amount=%s, Signature=%s, Expected=%s", 
		req.MerchantOrderId, req.Amount, req.Signature, expectedSignature)

	if req.Signature != expectedSignature {
		return fmt.Errorf("invalid signature: got %s, expected %s", req.Signature, expectedSignature)
	}

	if req.ResultCode != "00" {
		log.Printf("Duitku Callback received with non-success code: %s (OrderId: %s)", req.ResultCode, req.MerchantOrderId)
		return nil // Return nil so handler sends 200 OK to Duitku
	}

	// Update transaction and user quota
	err := db.Client.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		txRef := db.Client.Collection("transactions").Doc(req.MerchantOrderId)
		doc, err := tx.Get(txRef)
		if err != nil {
			log.Printf("Transaction record not found: %s", req.MerchantOrderId)
			return err
		}
		var transaction models.Transaction
		if err := doc.DataTo(&transaction); err != nil {
			return err
		}

		if transaction.Status == "claimed" {
			log.Printf("Transaction already claimed: %s", req.MerchantOrderId)
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

		log.Printf("Incrementing quota for %s by %d", transaction.SupporterName, transaction.Quantity)
		return tx.Update(userRef, []firestore.Update{
			{Path: "session_quota", Value: firestore.Increment(transaction.Quantity)},
		})
	})

	if err != nil {
		log.Printf("Transaction update failed: %v", err)
	}
	return err
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
