// ملف لوظائف مساعدة عامة مثل إظهار رسائل الإشعارات (Toasts)
function showToast(message, type = 'info', duration = 3000) {
    const toastContainer = document.getElementById('toastContainer') || createToastContainer();

    const toast = document.createElement('div');
    toast.classList.add('toast');
    toast.classList.add(type); // 'success', 'error', 'info'

    let icon = '';
    if (type === 'success') {
        icon = '<i class="fas fa-check-circle"></i>';
    } else if (type === 'error') {
        icon = '<i class="fas fa-times-circle"></i>';
    } else {
        icon = '<i class="fas fa-info-circle"></i>';
    }

    toast.innerHTML = `${icon} <span>${message}</span>`;
    toastContainer.appendChild(toast);

    // Remove toast after duration
    setTimeout(() => {
        toast.style.opacity = '0'; // Start fade out
        toast.style.transform = 'translateX(100%)'; // Slide out
        setTimeout(() => toast.remove(), 500); // Remove from DOM after transition
    }, duration);
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toastContainer';
    container.classList.add('toast-container');
    document.body.appendChild(container);
    return container;
}