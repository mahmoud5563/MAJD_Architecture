document.addEventListener('DOMContentLoaded', () => {
    // دالة عامة لإظهار رسائل التوست (Toast Notifications)
    window.showToast = function(message, type = 'info') {
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            document.body.appendChild(toastContainer);
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        toastContainer.appendChild(toast);

        // إظهار التوست
        setTimeout(() => {
            toast.classList.add('show');
        }, 100);

        // إخفاء التوست بعد 3 ثوانٍ ثم حذفه
        setTimeout(() => {
            toast.classList.remove('show');

            // إزالة العنصر بعد انتهاء تأثير الإخفاء
            setTimeout(() => {
                toast.remove();
            }, 300); // إذا عندك transition في CSS خليه نفس المدة
        }, 3000);
    };

    // NEW: Sidebar Toggle Logic
    const toggleSidebarBtn = document.querySelector('.toggle-sidebar-btn');
    const appContainer = document.querySelector('.app-container');

    if (toggleSidebarBtn && appContainer) {
        toggleSidebarBtn.addEventListener('click', () => {
            appContainer.classList.toggle('sidebar-open');
        });

        appContainer.addEventListener('click', (e) => {
            if (appContainer.classList.contains('sidebar-open') && 
                !e.target.closest('.sidebar') && 
                !e.target.closest('.toggle-sidebar-btn')) {
                appContainer.classList.remove('sidebar-open');
            }
        });
    }

    // Handle logout button clicks
    const logoutBtn = document.getElementById('logoutBtn');
    const logoutBtnDropdown = document.getElementById('logoutBtnDropdown');

    const handleLogout = () => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userRole');
        localStorage.removeItem('username');
        localStorage.removeItem('userId');
        window.location.href = 'index.html';
    };

    if (logoutBtn) logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        handleLogout();
    });

    if (logoutBtnDropdown) logoutBtnDropdown.addEventListener('click', (e) => {
        e.preventDefault();
        handleLogout();
    });
});

// Update username display in navbar
document.addEventListener('DOMContentLoaded', () => {
    const usernameDisplay = document.getElementById('usernameDisplay');
    if (usernameDisplay) {
        const storedUsername = localStorage.getItem('username');
        usernameDisplay.textContent = storedUsername || 'زائر';
    }
});
