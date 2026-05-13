package handlers

import (
	"encoding/json"
	"fmt"
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
		ProductID     string `json:"product_id"`
		PaymentMethod string `json:"payment_method"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Hardcoded products
	products := map[string]models.Product{
		"single":  {ID: "single", Name: "Trial Session", Description: "2 Session Credits", Price: 10000, Quantity: 2},
		"starter": {ID: "starter", Name: "Starter Pack", Description: "5 Session Credits", Price: 25000, Quantity: 5},
		"pro":     {ID: "pro", Name: "Professional Pack", Description: "20 Session Credits", Price: 75000, Quantity: 20},
		"ent":     {ID: "ent", Name: "Enterprise Pack", Description: "Unlimited Sessions (Annual)", Price: 500000, Quantity: 9999},
	}

	product, ok := products[req.ProductID]
	if !ok {
		http.Error(w, "Product not found", http.StatusNotFound)
		return
	}

	resp, err := PaymentServ.CreateDuitkuPayment(r.Context(), email, product, req.PaymentMethod)
	if err != nil {
		log.Printf("Payment Create Error: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(resp)
}

func GetPaymentMethodsHandler(w http.ResponseWriter, r *http.Request) {
	amountStr := r.URL.Query().Get("amount")
	if amountStr == "" {
		http.Error(w, "Amount required", http.StatusBadRequest)
		return
	}
	var amount int
	fmt.Sscanf(amountStr, "%d", &amount)

	methods, err := PaymentServ.GetPaymentMethods(r.Context(), amount)
	if err != nil {
		log.Printf("GetPaymentMethods Error: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(methods)
}

func PaymentCallbackHandler(w http.ResponseWriter, r *http.Request) {
	log.Printf("Callback received: Method=%s, URL=%s", r.Method, r.URL.String())
	
	if err := r.ParseForm(); err != nil {
		log.Printf("Parse form error: %v", err)
		http.Error(w, "Parse form error", http.StatusBadRequest)
		return
	}

	log.Printf("Callback Form Data: %+v", r.Form)

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

func CheckPaymentStatusHandler(w http.ResponseWriter, r *http.Request) {
	orderID := r.URL.Query().Get("order_id")
	if orderID == "" {
		http.Error(w, "Order ID required", http.StatusBadRequest)
		return
	}

	tx, err := PaymentServ.TransactionRepo.GetByID(r.Context(), orderID)
	if err != nil {
		http.Error(w, "Transaction not found", http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{
		"status": tx.Status,
	})
}
