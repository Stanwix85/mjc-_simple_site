


function updateCartBadge(cartItems) {
    const cartBadge = document.getElementById('cart-badge');
    if(!cartBadge) {
        console.warn('Cart badge element not found. Make sure an element with id="cart-badge" exists.');
        return;
    }
       const totalQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);

    if (totalQuantity > 0) {
        cartBadge.textContent = totalQuantity;
        cartBadge.classList.remove('d-none'); // Show the badge (remove d-none)
    } else {
        cartBadge.textContent = ''; // Set to empty string when hidden, or '0' if you prefer
        cartBadge.classList.add('d-none'); // Hide the badge (add d-none)
    }
}

// 1. Initialize the cart badge on page load (KEEP THIS FOR ROBUSTNESS)
document.addEventListener('DOMContentLoaded', async () => {
    const initialCart = window.initialCartState || [];
    updateCartBadge(initialCart);
    // cart handling
const addToCartForms = document.querySelectorAll('.add-to-cart-form');

if (addToCartForms.length === 0) {
    console.warn("JS: no add to cart found with class 'add-to-cart-form. Check HTML" );
}
    addToCartForms.forEach(form => {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();

            const formData  = new FormData(form);
            const itemId = formData.get('itemId');
            const itemName = formData.get('itemName');
            const quantity = formData.get('quantity');

            console.log(`JS: Attempting to add itemId: ${itemId}, Item Name: ${itemName}, Quantity: ${quantity}`);
            console.log("JS: Preparing to make fetch request to /addToCart");
    

    try {
        const response = await fetch('/addToCart', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();

        if (response.ok && data.success) {
            updateCartBadge(data.cart);
            alert(`"${itemName}" added to your cart`);
        } else {
            console.error('Failed to load initial cart contents:', data.message);
            alert("Error adding item to cart:" + data.message)
        }
    } catch (error) {
        console.error('Network error loading initial cart contents:', error);
         alert("An unexpected error occurred. Please check your internet connection.");
    }    
})
    })
});

        // end of add to cart js
        // checkout and payment js
        const stripePublicKey = 'YOUR_STRIPE_PUBLIC_KEY'; // Replace with your actual public key

    // Check if Stripe is loaded and public key is available
    if (typeof Stripe === 'function' && stripePublicKey && stripePublicKey !== 'YOUR_STRIPE_PUBLIC_KEY') {
        const stripe = Stripe(stripePublicKey);
        const checkoutButton = document.getElementById('proceed-to-checkout-btn');

        if (checkoutButton) {
            console.log("JS: Attaching listener to Proceed to Checkout button.");
            checkoutButton.addEventListener('click', async () => {
                console.log("JS: Checkout button clicked.");
                try {
                    const response = await fetch('/create-checkout-session', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                    });

                    const session = await response.json();

                    if (session.id) {
                        console.log("JS: Redirecting to Stripe Checkout with sessionId:", session.id);
                        const result = await stripe.redirectToCheckout({
                            sessionId: session.id,
                        });

                        if (result.error) {
                            console.error('JS: Stripe redirect error:', result.error.message);
                            alert('Error during checkout: ' + result.error.message);
                        }
                    } else if (session.error) {
                        console.error('JS: Server error creating session:', session.error);
                        alert('Error processing checkout: ' + session.error);
                    } else {
                        console.error('JS: Unexpected response from /create-checkout-session:', session);
                        alert('An unexpected error occurred during checkout session creation.');
                    }
                } catch (error) {
                    console.error('JS: Network or unexpected error during checkout:', error);
                    alert('An unexpected error occurred during checkout.');
                }
            });
        } else {
            console.log("JS: 'proceed-to-checkout-btn' not found on this page.");
        }
    } else {
        console.warn("JS: Stripe.js not loaded or public key missing/default. Checkout functionality disabled.");
    };