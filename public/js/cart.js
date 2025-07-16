
    document.addEventListener('DOMContentLoaded', () => {
        const cartList = document.querySelector('.list-group');
        const cartTotalPriceDisplay = document.getElementById('cart-total-price');

        // Function to calculate and update the overall cart total display
        function updateOverallCartTotal() {
            let currentTotal = 0;
            // Iterate over currently existing item subtotal displays
            document.querySelectorAll('.item-subtotal-display').forEach(subtotalSpan => {
                const value = parseFloat(subtotalSpan.textContent);
                if (!isNaN(value)) {
                    currentTotal += value;
                }
            });
            if (cartTotalPriceDisplay) {
                cartTotalPriceDisplay.textContent = currentTotal.toFixed(2);
            }
            // The updateCartBadge function call for overall total is handled after API responses.
        }

        // --- Quantity Change Logic ---
        cartList.addEventListener('click', async (event) => {
            const target = event.target;
            const isIncreaseBtn = target.classList.contains('increase-quantity');
            const isDecreaseBtn = target.classList.contains('decrease-quantity');

            // Only proceed if an increase or decrease button was clicked
            if (isIncreaseBtn || isDecreaseBtn) {
                const itemId = target.dataset.itemId;
                // Get parent elements for this specific item once
                const listItem = target.closest('li.list-group-item');
                const quantityDisplay = listItem ? listItem.querySelector('.quantity-display') : null;
                const subtotalDisplay = listItem ? listItem.querySelector('.item-subtotal-display') : null;
                const itemControlsDiv = listItem ? listItem.querySelector('.item-controls') : null;
                const deleteBtn = listItem ? listItem.querySelector('.delete-item-btn') : null;

                // Critical check: Ensure all necessary elements exist before proceeding
                if (!listItem || !quantityDisplay || !subtotalDisplay || !itemControlsDiv) {
                    console.error(`CART PAGE JS: Required UI elements for item ID ${itemId} not found. Aborting quantity update.`);
                    return;
                }

                const currentQuantity = parseInt(quantityDisplay.textContent, 10);
                const changeType = isIncreaseBtn ? 'increase' : 'decrease';

                // Client-side validation to prevent unnecessary requests
                if (isIncreaseBtn && currentQuantity >= 8) {
                    console.log(`CART PAGE JS: Quantity limit (8) reached for item ${itemId}. No action taken.`);
                    return;
                }
                if (isDecreaseBtn && currentQuantity <= 0) { // Can't decrease below 0
                    console.log(`CART PAGE JS: Quantity already 0 for item ${itemId}. No action taken.`);
                    return;
                }

                // Disable all interactive elements for this item BEFORE making the fetch request
                itemControlsDiv.querySelectorAll('button').forEach(btn => btn.disabled = true);
                if (deleteBtn) deleteBtn.disabled = true;

                try {
                    const response = await fetch('/updateCartQuantity', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ itemId, changeType })
                    });
                    
                    const data = await response.json();

                    // --- SUCCESS PATH: Server reported success (response.ok AND data.success are true) ---
                    if (response.ok && data.success) {
                        console.log(`CART PAGE JS: Quantity updated for ${itemId}. New quantity: ${data.newQuantity}`);

                        if (data.newQuantity === 0) {
                            // If server confirmed quantity is now 0, remove the list item
                            listItem.remove();
                            console.log(`CART PAGE JS: Item ${itemId} successfully removed from DOM (quantity became 0).`);
                        } else {
                            // Update UI with new quantity and subtotal from server
                            quantityDisplay.textContent = data.newQuantity;
                            subtotalDisplay.textContent = data.newSubtotal.toFixed(2);
                            
                            // Re-enable/disable +/- buttons based on *new* quantity from server
                            const increaseBtnElement = itemControlsDiv.querySelector('.increase-quantity');
                            const decreaseBtnElement = itemControlsDiv.querySelector('.decrease-quantity');
                            if (increaseBtnElement) increaseBtnElement.disabled = data.newQuantity >= 8;
                            if (decreaseBtnElement) decreaseBtnElement.disabled = data.newQuantity <= 1;
                            
                            // Re-enable delete button as item still exists
                            if (deleteBtn) deleteBtn.disabled = false;
                            console.log(`CART PAGE JS: UI updated for ${itemId}. Buttons managed.`);
                        }

                        // These actions always happen on successful response, regardless of newQuantity
                        updateOverallCartTotal(); // Recalculate overall cart total
                        if (typeof updateCartBadge === 'function') {
                            updateCartBadge(data.cart);
                        }

                        // Handle empty cart state if it becomes empty after update (e.g., last item became 0)
                        if (data.cart.length === 0) {
                            const mainContainer = document.querySelector('main.container');
                            if (mainContainer) {
                                mainContainer.innerHTML = `
                                    <div class="alert alert-info text-center" role="alert">
                                        Your cart is empty. Start adding some tickets!
                                    </div>`;
                                console.log("CART PAGE JS: Cart is now empty. Displayed empty cart message.");
                            }
                        }

                    } else { // --- ERROR PATH 1: Server reported an error (response.ok is false OR data.success is false) ---
                        console.error("CART PAGE JS: Server reported error updating quantity:", data.message || "Unknown error.");
                        alert("Error updating quantity: " + (data.message || "Please try again."));
                        
                        // Re-enable/re-set state for specific buttons of this item to their state *before* the failed request
                        const increaseBtnElement = itemControlsDiv.querySelector('.increase-quantity');
                        const decreaseBtnElement = itemControlsDiv.querySelector('.decrease-quantity');

                        if (increaseBtnElement) increaseBtnElement.disabled = currentQuantity >= 8;
                        if (decreaseBtnElement) decreaseBtnElement.disabled = currentQuantity <= 1;
                        if (deleteBtn) deleteBtn.disabled = false; // Always re-enable delete on failure
                    }

                } catch (error) { // --- ERROR PATH 2: Network error or unexpected client-side error during fetch ---
                    console.error("CART PAGE JS: Network or unexpected error during quantity update:", error);
                    alert("An unexpected error occurred. Please check your internet connection and try again.");
                    
                    // Re-enable/re-set state for specific buttons of this item to their state *before* the failed request
                    const increaseBtnElement = itemControlsDiv.querySelector('.increase-quantity');
                    const decreaseBtnElement = itemControlsDiv.querySelector('.decrease-quantity');

                    if (increaseBtnElement) increaseBtnElement.disabled = currentQuantity >= 8;
                    if (decreaseBtnElement) decreaseBtnElement.disabled = currentQuantity <= 1;
                    if (deleteBtn) deleteBtn.disabled = false; // Always re-enable delete on failure
                }
            } // Closes `if (isIncreaseBtn || isDecreaseBtn)`
        }); // Closes first `cartList.addEventListener` (for quantity changes)

        // --- Delete Item Logic ---
        cartList.addEventListener('click', async (event) => {
            const target = event.target;
            if (target.classList.contains('delete-item-btn')) {
                const itemId = target.dataset.itemId;
                const listItem = target.closest('li.list-group-item'); // Get the parent li
                if (!listItem) {
                    console.error(`CART PAGE JS: List item for ${itemId} not found for deletion. Aborting.`);
                    return;
                }
                console.log(`CART PAGE JS: Attempting to delete item ID: ${itemId}`);

                if (!confirm('Are you sure you want to remove this item from your cart?')) {
                    return; // User cancelled
                }

                // Disable buttons on this item's row before fetch
                listItem.querySelectorAll('button').forEach(btn => btn.disabled = true);
                const quantityInput = listItem.querySelector('input[type="number"]'); // Fixed typo: 'imput' to 'input'
                if (quantityInput) quantityInput.disabled = true;

                try {
                    const response = await fetch('/deleteCartItem', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ itemId })
                    });
                    const data = await response.json();

                    if (response.ok && data.success) {
                        console.log(`CART PAGE JS: Item ${itemId} successfully deleted.`);
                        listItem.remove(); // Remove the item's <li> from the DOM
                        updateOverallCartTotal(); // Recalculate total

                        if (typeof updateCartBadge === 'function') {
                            updateCartBadge(data.cart);
                        }

                        // If cart becomes empty, show the "Your cart is empty" message
                        if (data.cart.length === 0) {
                            const mainContainer = document.querySelector('main.container');
                            if (mainContainer) {
                                mainContainer.innerHTML = `
                                    <div class="alert alert-info text-center" role="alert">
                                        Your cart is empty. Start adding some tickets!
                                    </div>`;
                            }
                        }

                    } else { // Server reported error deleting item
                        console.error("CART PAGE JS: Server reported error deleting item:", data.message);
                        alert("Error deleting item: " + data.message);
                        // Re-enable buttons on failure
                        listItem.querySelectorAll('button').forEach(btn => btn.disabled = false);
                        if (quantityInput) quantityInput.disabled = false;
                    }
                } catch (error) { // Network error during item deletion
                    console.error("CART PAGE JS: Network or unexpected error during item deletion:", error);
                    alert("An unexpected error occurred. Please try again.");
                    // Re-enable buttons on network error
                    listItem.querySelectorAll('button').forEach(btn => btn.disabled = false);
                    if (quantityInput) quantityInput.disabled = false;
                }
            }
        }); // Closes second `cartList.addEventListener` (for delete item)

    }); // Closes `DOMContentLoaded`