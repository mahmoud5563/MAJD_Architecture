// public/js/users.js

document.addEventListener('DOMContentLoaded', () => {
    const usersTableBody = document.getElementById('usersTableBody');
    const userSearchInput = document.getElementById('userSearch');
    const userRoleFilter = document.getElementById('userRoleFilter');
    const applyUserFiltersBtn = document.getElementById('applyUserFiltersBtn');
    const addUserBtn = document.getElementById('addUserBtn');

    // عناصر المودال
    const userModal = document.getElementById('userModal');
    const userModalTitle = document.getElementById('userModalTitle');
    const userForm = document.getElementById('userForm');
    const userIdInput = document.getElementById('userId');
    const usernameInput = document.getElementById('username');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const passwordHelpText = document.getElementById('passwordHelp');
    const roleSelect = document.getElementById('role');
    const saveUserBtn = document.getElementById('saveUserBtn');
    const closeButton = userModal ? userModal.querySelector('.close-button') : null;

    let currentSortColumn = null;
    let currentSortDirection = 'asc'; 

    // دالة لجلب وعرض المستخدمين
    async function fetchUsers() {
        const authToken = localStorage.getItem('authToken');
        const userRole = localStorage.getItem('userRole');

        // هذه الصفحة يجب أن تكون متاحة فقط للآدمن ومدير الحسابات الكبير
        if (!authToken || (userRole !== 'admin' && userRole !== 'account_manager')) {
            showToast('ليس لديك صلاحية لعرض هذه الصفحة.', 'error');
            window.location.href = 'dashboard.html'; 
            return;
        }

        // **السطر 39 الذي كان يسبب الخطأ**
        // تم التأكد من أن userSearchInput و userRoleFilter ليسا null قبل استخدام .value
        const searchTerm = userSearchInput ? userSearchInput.value : '';
        const roleFilter = userRoleFilter ? userRoleFilter.value : '';

        try {
            const response = await fetch(`https://6943-156-203-135-174.ngrok-free.app/api/users?search=${searchTerm}&role=${roleFilter}`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Failed to fetch users:', response.status, errorData.message);
                if (response.status === 401 || response.status === 403) {
                    showToast('ليس لديك صلاحية لعرض المستخدمين.', 'error');
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('userRole');
                    localStorage.removeItem('username');
                    localStorage.removeItem('userId'); // تأكد من إزالة userId أيضاً
                    window.location.href = 'index.html';
                } else {
                    showToast(errorData.message || 'فشل جلب المستخدمين. يرجى المحاولة مرة أخرى.', 'error');
                }
                return;
            }

            const users = await response.json();
            renderUsers(users); 
        } catch (error) {
            console.error('Error fetching users:', error);
            showToast('حدث خطأ أثناء جلب المستخدمين.', 'error');
        }
    }

    // دالة لرسم المستخدمين في الجدول
    function renderUsers(users) {
        if (!usersTableBody) return;
        usersTableBody.innerHTML = ''; 

        if (users.length === 0) {
            usersTableBody.innerHTML = '<tr><td colspan="4">لا توجد مستخدمون مطابقون.</td></tr>';
            return;
        }

        const currentUserRole = localStorage.getItem('userRole');
        const currentUserId = localStorage.getItem('userId'); 

        users.forEach(user => {
            const row = document.createElement('tr');
            let roleText = '';
            switch (user.role) {
                case 'admin': roleText = 'آدمن'; break;
                case 'account_manager': roleText = 'مدير حسابات'; break;
                case 'engineer': roleText = 'مهندس'; break;
                default: roleText = user.role;
            }

            // زر الحذف والتعديل يظهر فقط إذا كان المستخدم الحالي آدمن، أو إذا كان مدير حسابات ويعدل مهندس
            // ولا يمكن للمستخدم حذف أو تعديل حسابه الشخصي من هنا
            const canEditOrDelete = (currentUserRole === 'admin' || (currentUserRole === 'account_manager' && user.role === 'engineer'));
            const isSelf = (user._id === currentUserId); 

            row.innerHTML = `
                <td>${user.username}</td>
                <td>${user.email}</td>
                <td>${roleText}</td>
                <td class="actions">
                    ${canEditOrDelete && !isSelf ? `<button class="btn-action edit-user" data-id="${user._id}"><i class="fas fa-edit"></i> تعديل</button>` : ''}
                    ${canEditOrDelete && !isSelf && currentUserRole === 'admin' ? `<button class="btn-action delete-user" data-id="${user._id}"><i class="fas fa-trash-alt"></i> حذف</button>` : ''}
                    ${isSelf ? '<span class="text-muted">أنت (لا يمكن التعديل/الحذف من هنا)</span>' : ''}
                </td>
            `;
            usersTableBody.appendChild(row);
        });

        addUserActionListeners();
    }

    // دالة لإضافة مستمعي الأحداث لأزرار الإجراءات في الجدول
    function addUserActionListeners() {
        document.querySelectorAll('.edit-user').forEach(button => {
            button.addEventListener('click', async (e) => {
                const userId = e.currentTarget.dataset.id;
                await editUser(userId);
            });
        });

        document.querySelectorAll('.delete-user').forEach(button => {
            button.addEventListener('click', async (e) => {
                const userId = e.currentTarget.dataset.id;
                if (localStorage.getItem('userId') === userId) {
                    showToast('لا يمكنك حذف حسابك الشخصي!', 'error');
                    return;
                }
                if (confirm('هل أنت متأكد من حذف هذا المستخدم؟ لا يمكن التراجع عن هذا الإجراء.')) {
                    await deleteUser(userId);
                }
            });
        });
    }

    // دالة لفتح المودال لإضافة مستخدم جديد
    if (addUserBtn) {
        addUserBtn.addEventListener('click', () => {
            openUserModal();
        });
    }

    // دالة لفتح المودال لوضع بيانات مستخدم لتعديله
    async function editUser(userId) {
        const authToken = localStorage.getItem('authToken');
        try {
            const response = await fetch(`https://6943-156-203-135-174.ngrok-free.app/api/users/${userId}`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            if (response.ok) {
                const user = await response.json();
                openUserModal('edit', user);
            } else {
                const errorData = await response.json();
                console.error('Failed to fetch user for edit:', response.status, errorData.message);
                showToast('فشل جلب بيانات المستخدم للتعديل.', 'error');
            }
        } catch (error) {
            console.error('Error fetching user for edit:', error);
            showToast('حدث خطأ أثناء جلب بيانات المستخدم.', 'error');
        }
    }


    // دالة لفتح/ملء المودال (لإضافة أو تعديل)
    function openUserModal(mode = 'add', user = null) {
        if (userModal) {
            userModal.style.display = 'flex';
            userForm.reset(); 

            passwordInput.style.display = 'block';
            passwordInput.required = true; 
            passwordHelpText.style.display = 'none';

            if (mode === 'add') {
                userModalTitle.textContent = 'إضافة مستخدم جديد';
                saveUserBtn.textContent = 'حفظ المستخدم';
                userIdInput.value = '';
                passwordInput.value = ''; 
                roleSelect.value = 'engineer';
            } else { // mode === 'edit'
                userModalTitle.textContent = 'تعديل بيانات المستخدم';
                saveUserBtn.textContent = 'تحديث المستخدم';
                userIdInput.value = user._id;
                usernameInput.value = user.username;
                emailInput.value = user.email;
                roleSelect.value = user.role;

                passwordInput.style.display = 'block';
                passwordInput.required = false; 
                passwordInput.value = ''; 
                passwordHelpText.style.display = 'block';
            }
        }
    }

    // دالة لإغلاق المودال
    function closeUserModal() {
        if (userModal) {
            userModal.style.display = 'none';
        }
    }

    // مستمعي الأحداث للمودال
    if (closeButton) {
        closeButton.addEventListener('click', closeUserModal);
    }
    if (userModal) {
        window.addEventListener('click', (e) => {
            if (e.target === userModal) {
                closeUserModal();
            }
        });
    }

    // معالجة إرسال النموذج (إضافة/تعديل)
    if (userForm) {
        userForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const userId = userIdInput.value;
            const userData = {
                username: usernameInput.value,
                email: emailInput.value,
                role: roleSelect.value
            };

            if (passwordInput.value) {
                userData.password = passwordInput.value;
            }

            if (!userData.username || !userData.email || !userData.role) {
                showToast('الرجاء ملء اسم المستخدم، البريد الإلكتروني، والدور.', 'error');
                return;
            }
            if (!userId && !userData.password) { 
                showToast('الرجاء إدخال كلمة مرور للمستخدم الجديد.', 'error');
                return;
            }
            // ملاحظة: التحقق من طول كلمة المرور (minlength: 6) تم تعطيله مؤقتاً في User.js
            // إذا قمت بتفعيل التشفير لاحقاً، يجب إعادة هذا التحقق هنا أيضاً.

            const authToken = localStorage.getItem('authToken');
            let response;
            try {
                if (userId) { // تعديل
                    response = await fetch(`https://6943-156-203-135-174.ngrok-free.app/api/users/${userId}`, {
                        method: 'PUT', 
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${authToken}`
                        },
                        body: JSON.stringify(userData)
                    });
                } else { // إضافة
                    response = await fetch('https://6943-156-203-135-174.ngrok-free.app/api/register', { 
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${authToken}` 
                        },
                        body: JSON.stringify(userData)
                    });
                }

                if (response.ok) {
                    showToast(`تم ${userId ? 'تعديل' : 'إضافة'} المستخدم بنجاح!`, 'success');
                    closeUserModal();
                    fetchUsers(); 
                } else {
                    const errorData = await response.json();
                    console.error('Failed to save user:', response.status, errorData.message);
                    showToast(errorData.message || `فشل ${userId ? 'تعديل' : 'إضافة'} المستخدم.`, 'error');
                }
            } catch (error) {
                console.error(`Error ${userId ? 'updating' : 'adding'} user:`, error);
                showToast('حدث خطأ في الاتصال بالخادم.', 'error');
            }
        });
    }

    // دالة لحذف مستخدم
    async function deleteUser(userId) {
        const authToken = localStorage.getItem('authToken');
        try {
            const response = await fetch(`https://6943-156-203-135-174.ngrok-free.app/api/users/${userId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });

            if (response.ok) {
                showToast('تم حذف المستخدم بنجاح.', 'success');
                fetchUsers(); 
            } else {
                const errorData = await response.json();
                console.error('Failed to delete user:', response.status, errorData.message);
                showToast(errorData.message || 'فشل حذف المستخدم. ليس لديك صلاحية أو حدث خطأ.', 'error');
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            showToast('حدث خطأ أثناء حذف المستخدم.', 'error');
        }
    }

    // مستمعي الأحداث للفلترة والبحث
    if (applyUserFiltersBtn) {
        applyUserFiltersBtn.addEventListener('click', fetchUsers);
    }
    if (userSearchInput) {
        userSearchInput.addEventListener('input', () => {
            setTimeout(fetchUsers, 500);
        });
    }
    if (userRoleFilter) {
        userRoleFilter.addEventListener('change', fetchUsers);
    }

    // جلب المستخدمين عند تحميل الصفحة لأول مرة
    fetchUsers();

    // فرز الجدول
    const tableHeaders = document.querySelectorAll('.data-table th[data-sort]');
    tableHeaders.forEach(header => {
        header.addEventListener('click', (e) => {
            const column = e.currentTarget.dataset.sort;
            if (currentSortColumn === column) {
                currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                currentSortColumn = column;
                currentSortDirection = 'asc';
            }
            showToast(`سيتم الفرز حسب: ${column} (${currentSortDirection === 'asc' ? 'تصاعدي' : 'تنازلي'})`, 'info');
        });
    });
});
