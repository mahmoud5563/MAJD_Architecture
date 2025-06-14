// public/js/auth.js

// دالة showToast مفترض انها موجودة في utils.js
// تأكد من تضمين utils.js في جميع صفحات HTML التي تستخدم هذه الدالة (مثل index.html و dashboard.html وغيرها)

// دالة تسجيل الدخول
async function loginUser(email, password) {
    try {
        // تأكد من البورت والعنوان الصحيح للـ Backend
        const response = await fetch('https://6943-156-203-135-174.ngrok-free.app/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (response.ok) {
            // حفظ التوكن، الدور، واسم المستخدم في Local Storage
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('userRole', data.role);
            localStorage.setItem('username', data.username);
            localStorage.setItem('userId', data._id); // حفظ الـ userId أيضاً

            showToast('تم تسجيل الدخول بنجاح!', 'success');
            window.location.href = 'dashboard.html'; // التوجيه لصفحة الداشبورد
        } else {
            // عرض رسالة الخطأ من الـ Backend أو رسالة افتراضية
            showToast(data.message || 'فشل تسجيل الدخول. يرجى التحقق من بياناتك.', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('حدث خطأ في الاتصال بالخادم. يرجى المحاولة لاحقاً.', 'error');
    }
}

// دالة تسجيل الخروج
function logoutUser() {
    // حذف البيانات من Local Storage
    localStorage.removeItem('authToken');
    localStorage.removeItem('userRole');
    localStorage.removeItem('username');
    localStorage.removeItem('userId'); // إزالة الـ userId أيضاً
    
    showToast('تم تسجيل الخروج.', 'info');
    window.location.href = 'index.html'; // العودة لصفحة تسجيل الدخول
}

// دالة التحقق من الصلاحيات وتعديل الـ UI
function checkAuthAndRole() {
    const authToken = localStorage.getItem('authToken');
    const userRole = localStorage.getItem('userRole');
    const currentPath = window.location.pathname;

    // 1. إدارة الوصول لصفحة تسجيل الدخول:
    // لو مفيش توكن (يعني مش مسجل دخول) وفتح أي صفحة غير index.html، حوله لـ index.html
    if (!authToken) {
        if (currentPath !== '/' && !currentPath.includes('index.html')) {
            window.location.href = 'index.html';
        }
        return; // لو مفيش توكن، خلاص مفيش داعي نكمل
    }

    // 2. إظهار وإخفاء عناصر الشريط الجانبي بناءً على دور المستخدم (باستخدام الفئات الجديدة):
    const sidebarItems = {
        dashboard: document.querySelector('.sidebar-item-dashboard'),
        addProject: document.querySelector('.sidebar-item-add-project'),
        projects: document.querySelector('.sidebar-item-projects'),
        clients: document.querySelector('.sidebar-item-clients'),
        contractors: document.querySelector('.sidebar-item-contractors'),
        users: document.querySelector('.sidebar-item-users'),
        settings: document.querySelector('.sidebar-item-settings')
    };

    // إخفاء جميع عناصر الشريط الجانبي المحددة بالـ class الخاص بها كإعداد افتراضي
    for (const key in sidebarItems) {
        if (sidebarItems[key]) {
            sidebarItems[key].style.display = 'none';
        }
    }

    // ثم إظهارها بناءً على الدور المطلوب
    if (userRole === 'admin') {
        // الآدمن يرى كل شيء
        for (const key in sidebarItems) {
            if (sidebarItems[key]) {
                sidebarItems[key].style.display = 'list-item';
            }
        }
    } else if (userRole === 'account_manager') {
        // مدير الحسابات يرى معظم العناصر
        if (sidebarItems.dashboard) sidebarItems.dashboard.style.display = 'list-item';
        if (sidebarItems.addProject) sidebarItems.addProject.style.display = 'list-item';
        if (sidebarItems.projects) sidebarItems.projects.style.display = 'list-item';
        if (sidebarItems.clients) sidebarItems.clients.style.display = 'list-item';
        if (sidebarItems.contractors) sidebarItems.contractors.style.display = 'list-item';
        if (sidebarItems.users) sidebarItems.users.style.display = 'list-item';
        if (sidebarItems.settings) sidebarItems.settings.style.display = 'list-item';
    } else if (userRole === 'engineer') {
        // المهندس يرى فقط المشاريع والإعدادات
        if (sidebarItems.projects) sidebarItems.projects.style.display = 'list-item';
        if (sidebarItems.settings) sidebarItems.settings.style.display = 'list-item';
        // باقي العناصر ستظل مخفية
    }


    // 3. إدارة صلاحية المستخدم على الأزرار/العناصر الأخرى في الواجهة (باستخدام data-access-role):
    const elementsWithRoleRestriction = document.querySelectorAll('[data-access-role]');
    elementsWithRoleRestriction.forEach(el => {
        const requiredRoles = el.dataset.accessRole.split(',');
        if (requiredRoles.includes(userRole)) {
            el.style.display = ''; // Show element (أو استعادته للـ display الافتراضي)
        } else {
            el.style.display = 'none'; // Hide element
        }
    });

    // 4. إعادة توجيه المستخدمين إذا حاولوا الوصول لصفحات غير مصرح لهم بها:
    if (userRole === 'engineer') {
        // إعادة توجيه المهندس من صفحات لا يجب أن يصل إليها (أو أن تظهر في شريطه الجانبي)
        // يجب أن يتم توجيهه لصفحة المشاريع كصفحة افتراضية له
        const engineerAllowedPaths = [
            '/projects.html',
            '/settings.html',
            // هذه الملفات JS يتم تضمينها في الصفحات، لا يجب إعادة توجيهها إذا تم الوصول إليها مباشرة
            '/js/main.js', 
            '/js/auth.js',
            '/js/utils.js',
            '/js/projects.js',
            '/js/settings.js',
            '/js/project-details.js', // المهندس يحتاج هذا الملف حتى لو لا يمكنه العرض المباشر
            '/js/edit-project.js' // المهندس يحتاج هذا الملف للتعديل
        ].map(p => p.toLowerCase()); // تحويل المسارات إلى حروف صغيرة للمقارنة

        let currentPathLower = currentPath.toLowerCase();
        // لإزالة أي استعلامات (query parameters) من المسار
        if (currentPathLower.includes('?')) {
            currentPathLower = currentPathLower.split('?')[0];
        }

        // لو كان المسار هو الروت '/'، اعتبره 'dashboard.html' أو صفحة تسجيل الدخول حسب وجود التوكن
        if (currentPathLower === '/') {
            if (authToken) {
                currentPathLower = '/dashboard.html'; // سيتم إعادة توجيه المهندس منها لـ projects.html
            } else {
                currentPathLower = '/index.html';
            }
        }

        // في حال استخدام project-details.html (سواء بـ id أو بدونه)، يجب أن يتم إعادته لـ projects.html
        if (currentPathLower.includes('project-details.html')) {
             showToast('ليس لديك صلاحية لعرض تفاصيل هذا المشروع.', 'error');
             window.location.href = 'projects.html';
             return;
        }
        
        // التحقق من أن المسار الحالي مسموح به للمهندس
        if (!engineerAllowedPaths.some(allowedPath => currentPathLower.includes(allowedPath))) {
            showToast('ليس لديك صلاحية لعرض هذه الصفحة.', 'error');
            window.location.href = 'projects.html';
            return;
        }

    }

    // إعادة توجيه المستخدمين الآخرين لصفحات معينة إذا كانت صلاحياتهم لا تسمح
    if (currentPath.includes('users.html') && userRole !== 'admin' && userRole !== 'account_manager') {
        showToast('ليس لديك صلاحية لعرض هذه الصفحة.', 'error');
        window.location.href = 'dashboard.html'; // توجيه افتراضي لغير المصرح لهم
        return;
    }
    // ملاحظة: إذا كان مدير الحسابات يجب ألا يرى الآدمن في صفحة المستخدمين، فهذا يتم التحكم فيه من Backend (userRoutes.js)

    // عرض اسم المستخدم في الـ Navbar (في كل الصفحات بعد تسجيل الدخول)
    const usernameDisplay = document.getElementById('usernameDisplay');
    if (usernameDisplay) {
        const username = localStorage.getItem('username');
        if (username) {
            usernameDisplay.textContent = username;
        } else {
            usernameDisplay.textContent = 'زائر';
        }
    }
}

// هذا الكود سينفذ بمجرد تحميل أي صفحة HTML
document.addEventListener('DOMContentLoaded', () => {
    // ربط نموذج تسجيل الدخول (في صفحة index.html)
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            loginUser(email, password);
        });
    }

    // ربط أزرار تسجيل الخروج (موجودة في الـ navbar في معظم الصفحات)
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logoutUser);
    }
    const logoutBtnDropdown = document.getElementById('logoutBtnDropdown');
    if (logoutBtnDropdown) {
        logoutBtnDropdown.addEventListener('click', logoutUser);
    }

    // استدعاء دالة التحقق من الصلاحيات بمجرد تحميل الصفحة
    checkAuthAndRole();
});
