package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"retro-gcp/dto"
	"retro-gcp/models"
	"retro-gcp/services"
)

var PaymentServ *services.PaymentService

func CreatePaymentHandler(w http.ResponseWriter, r *http.Request) {
	email := GetUserFromRequest(r)
	if email == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		ProductID string `json:"product_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Hardcoded products
	products := map[string]models.Product{
		"starter": {ID: "starter", Name: "Starter Pack", Description: "5 Session Credits", Price: 25000, Quantity: 5},
		"pro":     {ID: "pro", Name: "Professional Pack", Description: "20 Session Credits", Price: 75000, Quantity: 20},
		"ent":     {ID: "ent", Name: "Enterprise Pack", Description: "Unlimited Sessions (Annual)", Price: 500000, Quantity: 9999},
	}

	product, ok := products[req.ProductID]
	if !ok {
		http.Error(w, "Product not found", http.StatusNotFound)
		return
	}

	resp, err := PaymentServ.CreateDuitkuPayment(r.Context(), email, product)
	if err != nil {
		log.Printf("Payment Create Error: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(resp)
}

func PaymentCallbackHandler(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Error(w, "Parse form error", http.StatusBadRequest)
		return
	}

	req := dto.DuitkuCallbackRequest{
		MerchantCode:     r.FormValue("merchantCode"),
		Amount:           r.FormValue("amount"),
		MerchantOrderId:  r.FormValue("merchantOrderId"),
		ProductDetail:    r.FormValue("productDetail"),
		AdditionalParam:  r.FormValue("additionalParam"),
		PaymentCode:      r.FormValue("paymentCode"),
		ResultCode:       r.FormValue("resultCode"),
		MerchantUserId:   r.FormValue("merchantUserId"),
		Reference:        r.FormValue("reference"),
		Signature:        r.FormValue("signature"),
		PublisherOrderId: r.FormValue("publisherOrderId"),
		SpUserHash:       r.FormValue("spUserHash"),
		SettlementDate:   r.FormValue("settlementDate"),
		SettlementAmount: r.FormValue("settlementAmount"),
	}

	err := PaymentServ.ProcessDuitkuCallback(r.Context(), req)
	if err != nil {
		log.Printf("Callback Error: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte("OK"))
}
