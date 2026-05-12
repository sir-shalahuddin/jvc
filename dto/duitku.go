package dto

type DuitkuCreateRequest struct {
	MerchantCode      string `json:"merchantCode"`
	PaymentAmount     int    `json:"paymentAmount"`
	MerchantOrderId   string `json:"merchantOrderId"`
	ProductDetails    string `json:"productDetails"`
	Email             string `json:"email"`
	PhoneNumber       string `json:"phoneNumber"`
	Signature         string `json:"signature"`
	CallbackUrl       string `json:"callbackUrl"`
	ReturnUrl         string `json:"returnUrl"`
	ExpiryPeriod      int    `json:"expiryPeriod"`
}

type DuitkuCreateResponse struct {
	MerchantCode    string `json:"merchantCode"`
	Reference       string `json:"reference"`
	PaymentUrl      string `json:"paymentUrl"`
	StatusCode      string `json:"statusCode"`
	StatusMessage   string `json:"statusMessage"`
}

type DuitkuCallbackRequest struct {
	MerchantCode      string `json:"merchantCode"`
	Amount            string `json:"amount"`
	MerchantOrderId   string `json:"merchantOrderId"`
	ProductDetail     string `json:"productDetail"`
	AdditionalParam   string `json:"additionalParam"`
	PaymentCode       string `json:"paymentCode"`
	ResultCode        string `json:"resultCode"`
	MerchantUserId    string `json:"merchantUserId"`
	Reference         string `json:"reference"`
	Signature         string `json:"signature"`
	PublisherOrderId  string `json:"publisherOrderId"`
	SpUserHash        string `json:"spUserHash"`
	SettlementDate    string `json:"settlementDate"`
	SettlementAmount  string `json:"settlementAmount"`
}
