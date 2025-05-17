document.addEventListener('DOMContentLoaded', function() {
    function getFlashMessages() {
        const messages = localStorage.getItem('flash_messages');
        if (!messages) {
            return { success: [], error: [] };
        }
        try {
            const parsed = JSON.parse(messages);
            localStorage.removeItem('flash_messages');
            return parsed;
        } catch (e) {
            console.error('Error parsing flash messages:', e);
            localStorage.removeItem('flash_messages');
            return { success: [], error: [] };
        }
    }

    function setFlashMessage(type, message) {
        const messages = getFlashMessages();
        messages[type].push(message);
        localStorage.setItem('flash_messages', JSON.stringify(messages));
        
        if (type === 'success') {
            displaySuccessMessage(message);
        } else if (type === 'error') {
            displayErrorMessage(message);
        }
    }
    
    function displaySuccessMessage(message) {
        FuiToast.success(message, {
            duration: 3000,
            isClose: true,
            style: {
                color: '#000',
            },
        });
    }
    
    function displayErrorMessage(message) {
        FuiToast.error(message, {
            duration: 3000,
            isClose: true,
            style: {
                color: '#000',
            },
        });
    }

    const flashMessages = getFlashMessages();
    
    if (flashMessages.success && flashMessages.success.length > 0) {
        flashMessages.success.forEach(message => {
            displaySuccessMessage(message);
        });
    }
    if (flashMessages.error && flashMessages.error.length > 0) {
        flashMessages.error.forEach(message => {
            displayErrorMessage(message);
        });
    }
    
    const successMessage = document.querySelector('meta[name="success-message"]');
    if (successMessage && successMessage.getAttribute('content')) {
        displaySuccessMessage(successMessage.getAttribute('content'));
    }
    
    const errorMessage = document.querySelector('meta[name="error-message"]');
    if (errorMessage && errorMessage.getAttribute('content')) {
        displayErrorMessage(errorMessage.getAttribute('content'));
    }

    window.flashMessage = {
        success: (message) => setFlashMessage('success', message),
        error: (message) => setFlashMessage('error', message)
    };
});
