
                    // handling email verification 

    document.addEventListener('DOMContentLoaded', () => {
         const emailVerifyForm = document.getElementById('emailVerifyForm');
        const emailVerifyMessageDiv = document.getElementById('emailVerifyMessage');
        const memberEmailInput = document.getElementById('memberEmail');

         if (emailVerifyForm) {
        emailVerifyForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            console.log("js: Email Verify Form SUBMIT event fired!")
            emailVerifyMessageDiv.classList.add('d-none'); // Hide previous messages

            try { // Keep the whole process inside try-catch for robustness

            const formData = new FormData(emailVerifyForm);
            console.log("JS: FormData created. Contents:"); // <--- ADD THIS
            // Iterate over FormData to log its key-value pairs (for debugging only)
            for (let pair of formData.entries()) {
                console.log(pair[0]+ ': ' + pair[1]);
            }
            console.log("JS: Email to be sent:", formData.get('email')); // <--- ADD THIS: Verify email content

            console.log("JS: Attempting fetch to /verify-email..."); // <--- ADD THIS
            const response = await fetch('/verify-email', {
                method: 'POST',
                body: formData
            });
            console.log("JS: Fetch call completed. Response status:", response.status); // <--- ADD THIS

            const data = await response.json(); // This might throw an error if response is not valid JSON
            console.log("JS: Server response data:", data); // <--- ADD THIS

            if (response.ok && data.success) {
                emailVerifyMessageDiv.classList.remove('d-none', 'alert-danger');
                emailVerifyMessageDiv.classList.add('alert-success');
                emailVerifyMessageDiv.textContent = data.message;
                if (memberEmailInput) memberEmailInput.value = data.email || '';

                if (data.redirectUrl) {
                    setTimeout(() => {
                        window.location.href = data.redirectUrl;
                    }, 1500);
                }

            } else {
                emailVerifyMessageDiv.classList.remove('d-none', 'alert-success');
                emailVerifyMessageDiv.classList.add('alert-danger');
                emailVerifyMessageDiv.textContent = data.message || 'Verification failed. Please try again.';
            }

        } catch (error) {
            console.error('JS: Email verification FETCH or JSON parsing error:', error); // <--- MODIFY THIS LINE
            emailVerifyMessageDiv.classList.remove('d-none', 'alert-success');
            emailVerifyMessageDiv.classList.add('alert-danger');
            emailVerifyMessageDiv.textContent = 'An unexpected client-side error occurred during verification. Please try again.';
        }
    });
}

    // --- Handle the Guest Login Form ---
    const guestLoginForm = document.getElementById('guestLoginForm');
    if (guestLoginForm) {
        guestLoginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            emailVerifyMessageDiv.classList.add('d-none'); // Hide previous messages

            const formData = new FormData(guestLoginForm);
            const emailFromVerifyField = memberEmailInput ? memberEmailInput.value : '';
            if (emailFromVerifyField) {
                formData.set('email', emailFromVerifyField);
            }

            try {
                const response = await fetch('/guest-login', {
                    method: 'POST',
                    body: formData
                });
                const data = await response.json();

                if (response.ok && data.success) {
                    emailVerifyMessageDiv.classList.remove('d-none', 'alert-danger');
                    emailVerifyMessageDiv.classList.add('alert-success');
                    emailVerifyMessageDiv.textContent = data.message;
                    if (memberEmailInput) memberEmailInput.value = data.email || '';

                    if (data.redirectUrl) {
                        setTimeout(() => {
                            window.location.href = data.redirectUrl;
                        }, 1500);
                    }

                } else {
                    emailVerifyMessageDiv.classList.remove('d-none', 'alert-success');
                    emailVerifyMessageDiv.classList.add('alert-danger');
                    emailVerifyMessageDiv.textContent = data.message || 'Could not sign in as guest. Please try again.';
                }
            } catch (error) {
                console.error('Guest login error:', error);
                emailVerifyMessageDiv.classList.remove('d-none', 'alert-success');
                emailVerifyMessageDiv.classList.add('alert-danger');
                emailVerifyMessageDiv.textContent = 'An unexpected error occurred. Please try again.';
            }
        });
    }
});

