// ==========================================================================
// Retro - Checkout Logic
// ==========================================================================

const products = {
    "single": { name: "Trial Session", price: 10000, desc: "2 Session Credits" },
    "starter": { name: "Starter Pack", price: 25000, desc: "5 Session Credits" },
    "pro": { name: "Professional Pack", price: 75000, desc: "20 Session Credits" },
    "ent": { name: "Enterprise Pack", price: 500000, desc: "Unlimited Sessions" }
};

const urlParams = new URLSearchParams(window.location.search);
let productId = urlParams.get('product_id') || 'single';
let product = products[productId];
let selectedMethod = null;

async function loadMethods(amount) {
    try {
        const res = await fetch(`/api/payment/methods?amount=${amount}`);
        const methods = await res.json();
        
        const container = document.getElementById('methodsContainer');
        const loader = document.getElementById('loader');
        if (!container || !loader) return;

        const disabledMethods = ['VC', 'IR']; 

        container.innerHTML = methods
            .filter(m => !disabledMethods.includes(m.paymentMethod))
            .map(m => `
                <div class="method-item" onclick="selectMethod('${m.paymentMethod}', this)">
                    <img src="${m.paymentImage}" alt="${m.paymentName}" class="method-img">
                    <div class="method-name">${m.paymentName}</div>
                </div>
            `).join('');
        
        loader.style.display = 'none';
        container.style.display = 'grid';
    } catch (e) {
        console.error("Failed to load methods", e);
    }
}

function selectMethod(id, el) {
    selectedMethod = id;
    document.querySelectorAll('.method-item').forEach(i => i.classList.remove('selected'));
    el.classList.add('selected');
    const payBtn = document.getElementById('payBtn');
    if (payBtn) payBtn.disabled = false;
}

async function handlePayment() {
    if (!selectedMethod) return;
    
    const btn = document.getElementById('payBtn');
    if (!btn) return;
    const originalText = btn.innerText;
    btn.innerText = "Generating Invoice...";
    btn.disabled = true;

    try {
        const response = await fetch('/api/payment/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                product_id: productId,
                payment_method: selectedMethod
            })
        });
        const data = await response.json();
        
        if (data.statusCode === "00") {
            if (data.vaNumber) {
                showVAInstruction(data);
                startPolling(data.merchantOrderId);
            } else if (data.qrString) {
                showQRInstruction(data);
                startPolling(data.merchantOrderId);
            } else if (data.paymentUrl) {
                window.location.href = data.paymentUrl;
            }
        } else {
            alert(data.statusMessage || "Payment failed to initialize");
            btn.innerText = originalText;
            btn.disabled = false;
        }
    } catch (e) {
        console.error(e);
        alert("System error. Please try again.");
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

function showVAInstruction(data) {
    const grid = document.querySelector('.checkout-grid');
    if (grid) grid.style.gridTemplateColumns = "1fr";
    const methodsCard = document.getElementById('methodsCard');
    const summaryCard = document.getElementById('summaryCard');
    if (methodsCard) methodsCard.style.display = 'none';
    if (summaryCard) summaryCard.style.display = 'none';
    
    const card = document.getElementById('instructionCard');
    if (!card) return;
    card.style.display = 'block';
    card.style.maxWidth = "600px";
    card.style.margin = "0 auto";

    const exactAmount = data.amount ? parseInt(data.amount, 10) : product.price;

    const instructionEl = document.getElementById('instructionContent');
    if (instructionEl) {
        instructionEl.innerHTML = `
            <div style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 0.5rem; font-family: 'JetBrains Mono', monospace;">Virtual Account Number</div>
            <div style="font-size: 1.8rem; font-weight: 900; color: var(--primary); letter-spacing: 1px; margin-bottom: 1.5rem; word-break: break-all; font-family: 'JetBrains Mono', monospace;">${data.vaNumber}</div>

            <div style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 0.5rem; font-family: 'JetBrains Mono', monospace;">Total Amount (Termasuk Fee)</div>
            <div style="font-size: 1.5rem; font-weight: 800; color: var(--text); margin-bottom: 2rem; font-family: 'JetBrains Mono', monospace;">Rp ${exactAmount.toLocaleString('id-ID')}</div>
            
            <div style="text-align: left; background: var(--bg-base); padding: 1.5rem; border-radius: var(--radius); border: 3px solid var(--border-color); box-shadow: 3px 3px 0px var(--border-color);">
                <h4 style="margin-bottom: 1rem; font-family: 'Playfair Display', serif; font-weight: 900;">Payment Steps:</h4>
                <ol style="padding-left: 1.25rem; font-size: 0.9rem; line-height: 1.8; font-family: 'JetBrains Mono', monospace;">
                    <li>Copy the Virtual Account number above.</li>
                    <li>Log in to your banking app or ATM.</li>
                    <li>Select <b>Transfer</b> &rsaquo; <b>Virtual Account</b>.</li>
                    <li>Paste the number and enter the exact amount (<strong>Rp ${exactAmount.toLocaleString('id-ID')}</strong>).</li>
                    <li>Complete the transaction. Your credits will be added automatically.</li>
                </ol>
            </div>
        `;
    }
}

function startPolling(orderId) {
    if (!orderId) return;
    const card = document.getElementById('instructionCard');
    if (!card) return;
    const pollDiv = document.createElement('div');
    pollDiv.innerHTML = `<div style="margin-top: 2rem; padding: 1rem; background: var(--bg-card); border-radius: var(--radius); border: 3px solid var(--border-color); box-shadow: 3px 3px 0px var(--border-color); color: var(--primary); display: flex; align-items: center; justify-content: center; gap: 10px; font-weight: 800; font-family: 'JetBrains Mono', monospace;">
        <div class="spinner" style="width: 20px; height: 20px; border: 2px solid var(--primary); border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        Waiting for payment...
    </div>`;
    card.insertBefore(pollDiv, card.querySelector('.btn-ghost'));

    const style = document.createElement('style');
    style.innerHTML = `@keyframes spin { to { transform: rotate(360deg); } }`;
    document.head.appendChild(style);

    const interval = setInterval(async () => {
        try {
            const res = await fetch(`/api/payment/status?order_id=${orderId}`);
            const statusData = await res.json();
            if (statusData.status === "claimed" || statusData.status === "paid") {
                clearInterval(interval);
                pollDiv.innerHTML = `<div style="margin-top: 2rem; padding: 1rem; background: #10b981; border-radius: var(--radius); border: 3px solid var(--border-color); box-shadow: 3px 3px 0px var(--border-color); color: white; display: flex; align-items: center; justify-content: center; gap: 10px; font-weight: bold; font-family: 'JetBrains Mono', monospace;">
                    ✓ Payment Successful! Redirecting...
                </div>`;
                setTimeout(() => window.location.href = "/", 2000);
            }
        } catch (e) {}
    }, 3000);
}

function showQRInstruction(data) {
    const grid = document.querySelector('.checkout-grid');
    if (grid) grid.style.gridTemplateColumns = "1fr";
    const methodsCard = document.getElementById('methodsCard');
    const summaryCard = document.getElementById('summaryCard');
    if (methodsCard) methodsCard.style.display = 'none';
    if (summaryCard) summaryCard.style.display = 'none';
    
    const card = document.getElementById('instructionCard');
    if (!card) return;
    card.style.display = 'block';
    card.style.maxWidth = "600px";
    card.style.margin = "0 auto";

    const exactAmount = data.amount ? parseInt(data.amount, 10) : product.price;
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(data.qrString)}`;

    const instructionEl = document.getElementById('instructionContent');
    if (instructionEl) {
        instructionEl.innerHTML = `
            <div style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 0.5rem; font-family: 'JetBrains Mono', monospace;">Scan QR Code (QRIS)</div>
            <div style="margin: 2rem auto; text-align: center; background: white; padding: 1.5rem; border-radius: var(--radius); width: fit-content; border: 3px solid var(--border-color); box-shadow: 4px 4px 0px var(--border-color);">
                <img src="${qrImageUrl}" alt="QRIS" style="width: 250px; height: 250px; display: block;">
            </div>

            <div style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 0.5rem; font-family: 'JetBrains Mono', monospace;">Total Amount (Termasuk Fee)</div>
            <div style="font-size: 1.5rem; font-weight: 800; color: var(--text); margin-bottom: 2rem; font-family: 'JetBrains Mono', monospace;">Rp ${exactAmount.toLocaleString('id-ID')}</div>
            
            <div style="text-align: left; background: var(--bg-base); padding: 1.5rem; border-radius: var(--radius); border: 3px solid var(--border-color); box-shadow: 3px 3px 0px var(--border-color);">
                <h4 style="margin-bottom: 1rem; font-family: 'Playfair Display', serif; font-weight: 900;">Payment Steps:</h4>
                <ol style="padding-left: 1.25rem; font-size: 0.9rem; line-height: 1.8; font-family: 'JetBrains Mono', monospace;">
                    <li>Open your banking or e-wallet app (OVO, GoPay, Dana, BCA, dll).</li>
                    <li>Select the <b>Scan QRIS</b> option.</li>
                    <li>Scan the QR code shown above.</li>
                    <li>Verify the exact amount (<strong>Rp ${exactAmount.toLocaleString('id-ID')}</strong>) and complete the payment.</li>
                </ol>
            </div>
        `;
    }
}

window.selectMethod = selectMethod;
window.handlePayment = handlePayment;

document.addEventListener('DOMContentLoaded', () => {
    if (urlParams.get('status') === 'success') {
        const grid = document.querySelector('.checkout-grid');
        if (grid) {
            grid.innerHTML = `
                <div class="card" style="grid-column: 1 / -1; text-align: center; padding: 4rem 2rem;">
                    <div style="width: 80px; height: 80px; background: #10b981; border-radius: var(--radius); border: 3px solid var(--border-color); box-shadow: 4px 4px 0px var(--border-color); display: flex; align-items: center; justify-content: center; color: white; margin: 0 auto 2rem;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                    <h2 style="font-size: 2rem; margin-bottom: 1rem;">Payment Successful!</h2>
                    <p style="color: var(--text-muted); margin-bottom: 2rem;">Your transaction is complete. The credits should be added to your account shortly.</p>
                    <a href="/" class="btn btn-primary" style="padding: 1rem 3rem;">Go to Dashboard</a>
                </div>
            `;
        }
    } else if (product) {
        const prodNameEl = document.getElementById('prodName');
        const prodPriceEl = document.getElementById('prodPrice');
        const prodDescEl = document.getElementById('prodDesc');
        const totalPriceEl = document.getElementById('totalPrice');
        if (prodNameEl) prodNameEl.innerText = product.name;
        if (prodPriceEl) prodPriceEl.innerText = `Rp ${product.price.toLocaleString()}`;
        if (prodDescEl) prodDescEl.innerText = product.desc;
        if (totalPriceEl) totalPriceEl.innerText = `Rp ${product.price.toLocaleString()}`;
        loadMethods(product.price);
    }
});
