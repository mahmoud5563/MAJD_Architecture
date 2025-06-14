// public/js/utils.js

/**
 * Displays a toast notification.
 * @param {string} message - The message to display.
 * @param {string} type - 'success', 'error', 'info'.
 */
function showToast(message, type) {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        // إذا لم يكن هناك container، قم بإنشائه (اختياري، يفضل وضعه في HTML)
        const body = document.querySelector('body');
        const newToastContainer = document.createElement('div');
        newToastContainer.id = 'toast-container';
        newToastContainer.style.position = 'fixed';
        newToastContainer.style.bottom = '20px';
        newToastContainer.style.left = '50%';
        newToastContainer.style.transform = 'translateX(-50%)';
        newToastContainer.style.zIndex = '1000';
        newToastContainer.style.display = 'flex';
        newToastContainer.style.flexDirection = 'column';
        newToastContainer.style.gap = '10px';
        newToastContainer.style.alignItems = 'center';
        body.appendChild(newToastContainer);
        toastContainer = newToastContainer;
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toast.style.padding = '10px 20px';
    toast.style.borderRadius = '5px';
    toast.style.color = 'white';
    toast.style.backgroundColor = (type === 'success') ? '#4CAF50' : (type === 'error') ? '#f44336' : '#2196F3';
    toast.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.5s ease-in-out';

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '1';
    }, 100);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.addEventListener('transitionend', () => toast.remove());
    }, 3000);
}

/**
 * Formats a number as currency (EGP).
 * @param {number} num - The number to format.
 * @returns {string} Formatted currency string.
 */
function formatNumber(num) {
    if (isNaN(num) || num === null) {
        return '0.00 EGP';
    }
    return `${parseFloat(num).toFixed(2)} EGP`;
}

/**
 * Shows a loader element.
 * @param {string} elementId - The ID of the loader element to show.
 */
function showLoader(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = 'block';
        // يمكنك إضافة محتوى اللودر هنا إذا لم يكن موجودًا في HTML
        if (!element.querySelector('.loader')) {
            element.innerHTML = '<div class="loader"></div>';
        }
    }
}

/**
 * Hides a loader element.
 * @param {string} elementId - The ID of the loader element to hide.
 */
function hideLoader(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = 'none';
    }
}

/**
 * Displays a message in a specified container.
 * @param {string} messageText - The text of the message.
 * @param {string} type - The type of message ('success', 'error', 'info').
 * @param {string} containerId - The ID of the container element to display the message in.
 */
function showMessage(messageText, type, containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `<div class="message ${type}">${messageText}</div>`;
        container.style.display = 'block';
    }
}

/**
 * Hides a message container.
 * @param {string} containerId - The ID of the container element to hide.
 */
function hideMessage(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.style.display = 'none';
        container.innerHTML = ''; // Clear content
    }
}
