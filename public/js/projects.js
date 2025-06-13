// public/js/projects.js

document.addEventListener('DOMContentLoaded', () => {
    const projectsTableBody = document.getElementById('projectsTableBody');
    const projectSearchInput = document.getElementById('projectSearch');
    const projectStatusFilter = document.getElementById('projectStatusFilter');
    const applyFiltersBtn = document.getElementById('applyFiltersBtn');
    const transactionModal = document.getElementById('transactionModal');
    const closeButton = transactionModal ? transactionModal.querySelector('.close-button') : null;
    const tabButtons = transactionModal ? transactionModal.querySelectorAll('.tab-button') : null;
    const expenseFormTab = transactionModal ? document.getElementById('expenseFormTab') : null;
    const incomeFormTab = transactionModal ? document.getElementById('incomeFormTab') : null;
    const currentProjectNameSpan = document.getElementById('currentProjectName');

    let currentProjectId = null;
    let currentSortColumn = null; // لتخزين عمود الفرز الحالي
    let currentSortDirection = 'asc'; // لتخزين اتجاه الفرز الحالي


    // دالة لجلب وعرض المشاريع
    async function fetchProjects() {
        const authToken = localStorage.getItem('authToken');
        const userRole = localStorage.getItem('userRole'); // جلب دور المستخدم
        const userId = localStorage.getItem('userId');     // جلب ID المستخدم

        if (!authToken) {
            window.location.href = 'index.html';
            return;
        }

        const searchTerm = projectSearchInput.value;
        const statusFilter = projectStatusFilter.value;

        // بناء URL الاستعلام
        let queryParams = new URLSearchParams();
        if (searchTerm) {
            queryParams.append('search', searchTerm);
        }
        if (statusFilter && statusFilter !== 'all') {
            queryParams.append('status', statusFilter);
        }

        // إذا كان المستخدم مهندس، أضف engineerId للفلترة
        if (userRole === 'engineer' && userId) {
            queryParams.append('engineerId', userId);
        }

        try {
            const response = await fetch(`https://7500-156-203-135-174.ngrok-free.app/api/projects?${queryParams.toString()}`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Failed to fetch projects:', response.status, errorData.message);
                if (response.status === 401 || response.status === 403) {
                    showToast('ليس لديك صلاحية لعرض المشاريع.', 'error');
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('userRole');
                    localStorage.removeItem('username');
                    localStorage.removeItem('userId');
                    window.location.href = 'index.html';
                } else {
                    showToast(errorData.message || 'فشل جلب المشاريع. يرجى المحاولة مرة أخرى.', 'error');
                }
                return;
            }

            const projects = await response.json();
            renderProjects(projects);
        } catch (error) {
            console.error('Error fetching projects:', error);
            showToast('حدث خطأ أثناء جلب المشاريع.', 'error');
        }
    }

    // دالة لرسم المشاريع في الجدول
    function renderProjects(projects) {
        if (!projectsTableBody) return;
        projectsTableBody.innerHTML = '';

        if (projects.length === 0) {
            projectsTableBody.innerHTML = '<tr><td colspan="6">لا توجد مشاريع مطابقة.</td></tr>';
            return;
        }

        const currentUserRole = localStorage.getItem('userRole');

        projects.forEach(project => {
            const row = document.createElement('tr');
            const statusClass = project.status === 'ongoing' ? 'status-ongoing' :
                                project.status === 'completed' ? 'status-completed' :
                                'status-pending';
            const statusText = project.status === 'ongoing' ? 'جارية' :
                                project.status === 'completed' ? 'منتهية' :
                                'معلقة';

            // معالجة التاريخ: التحقق من وجود التاريخ وتنسيقه بشكل صحيح
            const startDateFormatted = project.startDate ? new Date(project.startDate).toLocaleDateString('ar-EG') : 'غير محدد';
            const endDateFormatted = project.endDate ? new Date(project.endDate).toLocaleDateString('ar-EG') : 'غير محدد';
            
            // التأكد من وجود العنوان
            const projectAddress = project.address || 'غير محدد';

            let actionsHtml = '';

            // زر عرض (View): متاح للآدمن ومدير الحسابات فقط
            if (currentUserRole === 'admin' || currentUserRole === 'account_manager') {
                actionsHtml += `<button class="btn-action view-project" data-id="${project._id}"><i class="fas fa-eye"></i> عرض</button>`;
            }

            // زر تعديل (Edit): متاح للآدمن ومدير الحسابات والمهندس
            if (currentUserRole === 'admin' || currentUserRole === 'account_manager' || currentUserRole === 'engineer') {
                actionsHtml += `<button class="btn-action edit-project" data-id="${project._id}"><i class="fas fa-edit"></i> تعديل</button>`;
            }

            // زر حذف (Delete): متاح للآدمن ومدير الحسابات فقط
            if (currentUserRole === 'admin' || currentUserRole === 'account_manager') {
                actionsHtml += `<button class="btn-action delete-project" data-id="${project._id}"><i class="fas fa-trash-alt"></i> حذف</button>`;
            }

            // زر إضافة مصروف/إيراد (Add Transaction): متاح للآدمن ومدير الحسابات والمهندس
            if (currentUserRole === 'admin' || currentUserRole === 'account_manager' || currentUserRole === 'engineer') {
                 actionsHtml += `<button class="btn-action add-transaction" data-id="${project._id}" data-project-name="${project.name}"><i class="fas fa-plus"></i> مصروف/إيراد</button>`;
            }


            row.innerHTML = `
                <td>${project.name}</td>
                <td>${projectAddress}</td>
                <td>${startDateFormatted}</td>
                <td>${endDateFormatted}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td class="actions">
                    ${actionsHtml}
                </td>
            `;
            projectsTableBody.appendChild(row);
        });

        addProjectActionListeners();
    }

    // دالة لإضافة مستمعي الأحداث لأزرار الإجراءات في الجدول
    function addProjectActionListeners() {
        document.querySelectorAll('.view-project').forEach(button => {
            button.addEventListener('click', (e) => {
                const projectId = e.currentTarget.dataset.id;
                // توجيه المستخدم لصفحة تفاصيل المشروع الجديدة
                window.location.href = `project-details.html?id=${projectId}`;
            });
        });

        document.querySelectorAll('.edit-project').forEach(button => {
            button.addEventListener('click', (e) => {
                const projectId = e.currentTarget.dataset.id;
                window.location.href = `edit-project.html?id=${projectId}`;
            });
        });

        document.querySelectorAll('.delete-project').forEach(button => {
            button.addEventListener('click', async (e) => {
                const projectId = e.currentTarget.dataset.id;
                if (confirm('هل أنت متأكد من حذف هذا المشروع؟')) {
                    await deleteProject(projectId);
                }
            });
        });

        document.querySelectorAll('.add-transaction').forEach(button => {
            button.addEventListener('click', (e) => {
                currentProjectId = e.currentTarget.dataset.id;
                const projectName = e.currentTarget.dataset.projectName;
                if (currentProjectNameSpan) {
                    currentProjectNameSpan.textContent = projectName;
                }
                openTransactionModal();
            });
        });
    }

    // دالة لحذف مشروع
    async function deleteProject(projectId) {
        const authToken = localStorage.getItem('authToken');
        try {
            const response = await fetch(`https://7500-156-203-135-174.ngrok-free.app/api/projects/${projectId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });

            if (response.ok) {
                    showToast('تم حذف المشروع بنجاح.', 'success');
                fetchProjects();
            } else {
                const errorData = await response.json();
                console.error('Failed to delete project:', response.status, errorData.message);
                showToast(errorData.message || 'فشل حذف المشروع. ليس لديك صلاحية أو حدث خطأ.', 'error');
            }
        } catch (error) {
            console.error('Error deleting project:', error);
            showToast('حدث خطأ أثناء حذف المشروع.', 'error');
        }
    }

    // دالة لفتح نافذة إضافة مصروف/إيراد (مكررة ولكن للتأكد من وجودها في مشاريع.js)
    function openTransactionModal() {
        if (transactionModal) {
            transactionModal.style.display = 'flex';
            // تأكد من أن التبويب الأول (مصروف) هو النشط افتراضياً
            if (expenseFormTab) expenseFormTab.classList.add('active');
            if (incomeFormTab) incomeFormTab.classList.remove('active');
            if (tabButtons) {
                tabButtons.forEach(btn => {
                    if (btn.dataset.tab === 'expense') btn.classList.add('active');
                    else btn.classList.remove('active');
                });
            }
            // جلب المقاولين والتصنيفات لملء القوائم المنسدلة
            fetchVendorsAndCategories();
        }
    }

    // دالة لإغلاق نافذة إضافة مصروف/إيراد
    function closeTransactionModal() {
        if (transactionModal) {
            transactionModal.style.display = 'none';
            // تفريغ حقول النموذج
            document.getElementById('expenseAmount').value = '';
            document.getElementById('expenseDescription').value = '';
            document.getElementById('expenseDate').value = '';
            document.getElementById('expenseAttachment').value = '';
            document.getElementById('expenseVendor').value = '';
            document.getElementById('expenseCategory').value = '';

            document.getElementById('incomeAmount').value = '';
            document.getElementById('incomeDescription').value = '';
            document.getElementById('incomeDate').value = '';
            document.getElementById('incomePaymentMethod').value = 'cash';
            currentProjectId = null;
        }
    }

    // مستمعي الأحداث للنافذة المنبثقة
    if (closeButton) {
        closeButton.addEventListener('click', closeTransactionModal);
    }
    if (transactionModal) {
        window.addEventListener('click', (e) => {
            if (e.target === transactionModal) {
                closeTransactionModal();
            }
        });
    }

    // منطق التبديل بين ألسنة المصروف والإيراد
    if (tabButtons) {
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tab = button.dataset.tab;

                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');

                // تم تحديث ID التبويبات في HTML أيضاً
                const expenseFormDiv = document.getElementById('expenseForm');
                const incomeFormDiv = document.getElementById('incomeForm');

                if (expenseFormDiv) expenseFormDiv.style.display = 'none';
                if (incomeFormDiv) incomeFormDiv.style.display = 'none';

                if (tab === 'expense' && expenseFormDiv) expenseFormDiv.style.display = 'block';
                if (tab === 'income' && incomeFormDiv) incomeFormDiv.style.display = 'block';
            });
        });
    }

    // دالة لجلب المقاولين والتصنيفات لملء القوائم المنسدلة
    async function fetchVendorsAndCategories() {
        const authToken = localStorage.getItem('authToken');
        try {
            // جلب المقاولين
            const vendorsResponse = await fetch('https://7500-156-203-135-174.ngrok-free.app/api/contractors', {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            const vendors = await vendorsResponse.json();
            const expenseVendorSelect = document.getElementById('expenseVendor');
            expenseVendorSelect.innerHTML = '<option value="">اختر مقاول</option>';
            vendors.forEach(vendor => {
                const option = document.createElement('option');
                option.value = vendor._id;
                option.textContent = vendor.name;
                expenseVendorSelect.appendChild(option);
            });

            // جلب التصنيفات
            const categoriesResponse = await fetch('https://7500-156-203-135-174.ngrok-free.app/api/categories', {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            const categories = await categoriesResponse.json();
            const expenseCategorySelect = document.getElementById('expenseCategory');
            expenseCategorySelect.innerHTML = '<option value="">اختر تصنيف</option>';
            categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category._id;
                option.textContent = category.name;
                expenseCategorySelect.appendChild(option);
            });

        } catch (error) {
            console.error('Error fetching vendors or categories:', error);
            showToast('فشل جلب بيانات المقاولين والتصنيفات.', 'error');
        }
    }


    // مستمع لزر "حفظ المصروف"
    const saveExpenseBtn = document.getElementById('saveExpenseBtn');
    if (saveExpenseBtn) {
        saveExpenseBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const amount = document.getElementById('expenseAmount').value;
            const description = document.getElementById('expenseDescription').value;
            const date = document.getElementById('expenseDate').value;
            // attachment (للتوضيح: التعامل مع رفع الملفات يتطلب مكتبة multer في Backend)
            // const attachment = document.getElementById('expenseAttachment').files[0];
            const vendorId = document.getElementById('expenseVendor').value;
            const categoryId = document.getElementById('expenseCategory').value;

            if (!amount || !description || !date || !vendorId || !categoryId) {
                showToast('جميع حقول المصروفات مطلوبة.', 'error');
                return;
            }
            if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
                showToast('المبلغ يجب أن يكون رقماً موجباً.', 'error');
                return;
            }


            const expenseData = {
                projectId: currentProjectId,
                amount: parseFloat(amount), // تأكد من تحويلها لرقم
                description,
                date,
                vendorId,
                categoryId,
                // attachment: attachment ? attachment.name : '' // مؤقتاً لحين التعامل مع الملفات
            };

            const authToken = localStorage.getItem('authToken');
            try {
                const response = await fetch('https://7500-156-203-135-174.ngrok-free.app/api/expenses', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify(expenseData)
                });

                if (response.ok) {
                    showToast('تم حفظ المصروف بنجاح!', 'success');
                    closeTransactionModal();
                    fetchProjects(); // إعادة تحميل المشاريع لتحديث الإحصائيات (إذا تم حسابها)
                } else {
                    const errorData = await response.json();
                    console.error('Failed to save expense:', response.status, errorData.message);
                    showToast(errorData.message || 'فشل حفظ المصروف.', 'error');
                }
            } catch (error) {
                console.error('Error saving expense:', error);
                showToast('حدث خطأ في الاتصال بالخادم أثناء حفظ المصروف.', 'error');
            }
        });
    }

    // مستمع لزر "حفظ الإيراد"
    const saveIncomeBtn = document.getElementById('saveIncomeBtn');
    if (saveIncomeBtn) {
        saveIncomeBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const amount = document.getElementById('incomeAmount').value;
            const description = document.getElementById('incomeDescription').value;
            const date = document.getElementById('incomeDate').value;
            const paymentMethod = document.getElementById('incomePaymentMethod').value;

            if (!amount || !description || !date || !paymentMethod) {
                showToast('جميع حقول الإيرادات مطلوبة.', 'error');
                return;
            }
            if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
                showToast('المبلغ يجب أن يكون رقماً موجباً.', 'error');
                return;
            }


            const incomeData = {
                projectId: currentProjectId,
                amount: parseFloat(amount), // تأكد من تحويلها لرقم
                description,
                date,
                paymentMethod
            };

            const authToken = localStorage.getItem('authToken');
            try {
                const response = await fetch('https://7500-156-203-135-174.ngrok-free.app/api/incomes', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify(incomeData)
                });

                if (response.ok) {
                    showToast('تم حفظ الإيراد بنجاح!', 'success');
                    closeTransactionModal();
                    fetchProjects();
                } else {
                    const errorData = await response.json();
                    console.error('Failed to save income:', response.status, errorData.message);
                    showToast(errorData.message || 'فشل حفظ الإيراد.', 'error');
                }
            } catch (error) {
                console.error('Error saving income:', error);
                showToast('حدث خطأ في الاتصال بالخادم أثناء حفظ الإيراد.', 'error');
            }
        });
    }

    // مستمعي الأحداث للفلترة والبحث
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', fetchProjects);
    }
    if (projectSearchInput) {
        projectSearchInput.addEventListener('input', () => {
            setTimeout(fetchProjects, 500);
        });
    }
    if (projectStatusFilter) {
        projectStatusFilter.addEventListener('change', fetchProjects);
    }

    // جلب المشاريع عند تحميل الصفحة لأول مرة
    fetchProjects();

    // فرز الجدول (يحتاج منطق كامل للتعامل مع البيانات)
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
