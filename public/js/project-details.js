// public/js/project-details.js

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('id');
    const authToken = localStorage.getItem('authToken');
    const userRole = localStorage.getItem('userRole');

    // عناصر عرض بيانات المشروع
    const projectNameDisplayInHeader = document.getElementById('projectNameDisplayInHeader');
    const projectNameDetails = document.getElementById('projectNameDetails');
    const projectClientDetails = document.getElementById('projectClientDetails');
    const projectEngineerDetails = document.getElementById('projectEngineerDetails');
    const projectAddressDetails = document.getElementById('projectAddressDetails');
    const projectDescriptionDetails = document.getElementById('projectDescriptionDetails');
    const projectStartDateDetails = document.getElementById('projectStartDateDetails');
    const projectEndDateDetails = document.getElementById('projectEndDateDetails');
    const projectStatusDetails = document.getElementById('projectStatusDetails');
    const projectNotesDetails = document.getElementById('projectNotesDetails');

    // أزرار الإجراءات على المشروع
    const editProjectBtn = document.querySelector('.edit-project-btn');
    const changeStatusBtn = document.querySelector('.change-status-btn');

    // عناصر الملخص المالي
    const totalIncomesSpan = document.getElementById('totalIncomes');
    const totalExpensesSpan = document.getElementById('totalExpenses');
    const netProfitLossSpan = document.getElementById('netProfitLoss');
    const exportExcelBtn = document.getElementById('exportExcelBtn');

    // جداول المصروفات والإيرادات
    const expensesTableBody = document.getElementById('expensesTableBody');
    const incomesTableBody = document.getElementById('incomesTableBody');

    // مودال المصروفات/الإيرادات
    const transactionModal = document.getElementById('transactionModal');
    const closeTransactionModalBtn = transactionModal ? transactionModal.querySelector('.close-button') : null;
    const tabButtons = transactionModal ? transactionModal.querySelectorAll('.tab-button') : null;
    const currentProjectNameModal = document.getElementById('currentProjectName'); // للمودال
    const expenseFormTab = document.getElementById('expenseFormTab');
    const incomeFormTab = document.getElementById('incomeFormTab');

    // عناصر نموذج المصروفات
    const addExpenseForm = document.getElementById('addExpenseForm');
    const expenseIdInput = document.getElementById('expenseId');
    const expenseAmountInput = document.getElementById('expenseAmount');
    const expenseDescriptionInput = document.getElementById('expenseDescription');
    const expenseDateInput = document.getElementById('expenseDate');
    const expenseAttachmentInput = document.getElementById('expenseAttachment');
    const expenseVendorSelect = document.getElementById('expenseVendor');
    const expenseCategorySelect = document.getElementById('expenseCategory');
    const saveExpenseBtn = document.getElementById('saveExpenseBtn');

    // عناصر نموذج الإيرادات
    const addIncomeForm = document.getElementById('addIncomeForm');
    const incomeIdInput = document.getElementById('incomeId');
    const incomeAmountInput = document.getElementById('incomeAmount');
    const incomeDescriptionInput = document.getElementById('incomeDescription');
    const incomeDateInput = document.getElementById('incomeDate');
    const incomePaymentMethodSelect = document.getElementById('incomePaymentMethod');
    const saveIncomeBtn = document.getElementById('saveIncomeBtn');

    // مودال تغيير الحالة
    const statusChangeModal = document.getElementById('statusChangeModal');
    const closeStatusChangeModalBtn = document.getElementById('closeStatusChangeModalBtn');
    const projectNameToChangeStatusSpan = document.getElementById('projectNameToChangeStatus');
    const statusChangeProjectIdInput = document.getElementById('statusChangeProjectId');
    const newProjectStatusSelect = document.getElementById('newProjectStatus');
    const saveNewStatusBtn = document.getElementById('saveNewStatusBtn');

    // مودال عرض الصورة
    const imageModal = document.getElementById('imageModal');
    const closeImageModalBtn = imageModal ? imageModal.querySelector('.close-button') : null;
    const displayedImage = document.getElementById('displayedImage');
    const imageCaption = document.getElementById('caption');

    let projectData = null; // لتخزين بيانات المشروع لجعلها متاحة للتصدير
    let allExpenses = [];   // لتخزين المصروفات لجعلها متاحة للتصدير
    let allIncomes = [];    // لتخزين الإيرادات لجعلها متاحة للتصدير

    // Base URL for API requests
    const API_BASE_URL = 'https://6943-156-203-135-174.ngrok-free.app/api';


    // 1. التحقق من الصلاحيات ووجود ID المشروع
    if (!authToken) {
        window.location.href = 'index.html';
        return;
    }
    if (!projectId) {
        showToast('معرف المشروع غير موجود.', 'error');
        setTimeout(() => { window.location.href = 'projects.html'; }, 1500);
        return;
    }

    // 2. دالة جلب بيانات المشروع
    async function fetchProjectDetails() {
        try {
            const response = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Failed to fetch project details:', response.status, errorData.message);
                showToast(errorData.message || 'فشل جلب تفاصيل المشروع.', 'error');
                if (response.status === 401 || response.status === 403) {
                    showToast('ليس لديك صلاحية لعرض تفاصيل هذا المشروع.', 'error');
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('userRole');
                    localStorage.removeItem('username');
                    localStorage.removeItem('userId');
                    window.location.href = 'index.html';
                }
                return;
            }

            projectData = await response.json(); // تخزين بيانات المشروع
            renderProjectDetails(projectData);
            fetchExpensesAndIncomes(projectId); // جلب المصروفات والإيرادات بعد جلب تفاصيل المشروع
        } catch (error) {
            console.error('Error fetching project details:', error);
            showToast('حدث خطأ أثناء جلب تفاصيل المشروع.', 'error');
            setTimeout(() => { window.location.href = 'projects.html'; }, 1500);
        }
    }

    // 3. دالة لعرض بيانات المشروع
    function renderProjectDetails(project) {
        if (project) {
            projectNameDisplayInHeader.textContent = project.name;
            document.title = `تفاصيل المشروع: ${project.name} - MAJD Architecture`;

            projectNameDetails.textContent = project.name;
            projectClientDetails.textContent = project.client ? project.client.name : 'لا يوجد عميل';
            projectEngineerDetails.textContent = project.engineerId ? project.engineerId.username : 'لم يتم التعيين';
            projectAddressDetails.textContent = project.address;
            projectDescriptionDetails.textContent = project.description || 'لا يوجد وصف';
            projectStartDateDetails.textContent = new Date(project.startDate).toLocaleDateString('ar-EG');
            projectEndDateDetails.textContent = project.endDate ? new Date(project.endDate).toLocaleDateString('ar-EG') : 'غير محدد';
            
            projectStatusDetails.textContent = project.status === 'ongoing' ? 'جارية' : project.status === 'completed' ? 'منتهية' : 'معلقة';
            projectStatusDetails.className = `status-badge ${project.status === 'ongoing' ? 'status-ongoing' : project.status === 'completed' ? 'status-completed' : 'status-pending'}`;
            
            projectNotesDetails.textContent = project.notes || 'لا توجد ملاحظات';

            // ربط أزرار الإجراءات بـ ID المشروع
            if(editProjectBtn) {
                editProjectBtn.onclick = () => { window.location.href = `edit-project.html?id=${projectId}`; };
            }
            
            // زر تغيير الحالة
            if(changeStatusBtn) {
                changeStatusBtn.onclick = () => {
                    projectNameToChangeStatusSpan.textContent = project.name;
                    statusChangeProjectIdInput.value = projectId;
                    newProjectStatusSelect.value = project.status; // Set current status
                    statusChangeModal.style.display = 'flex';
                };
            }
        }
    }

    // 4. دالة جلب المصروفات والإيرادات
    async function fetchExpensesAndIncomes(projectId) {
        let currentTotalExpenses = 0; // Use currentTotalExpenses to avoid confusion with span ID
        let currentTotalIncomes = 0;   // Use currentTotalIncomes to avoid confusion with span ID

        try {
            // جلب المصروفات
            const expensesResponse = await fetch(`${API_BASE_URL}/expenses/project/${projectId}`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (expensesResponse.ok) {
                allExpenses = await expensesResponse.json(); // تخزين المصروفات
                expensesTableBody.innerHTML = '';
                if (allExpenses.length > 0) {
                    allExpenses.forEach(expense => {
                        currentTotalExpenses += expense.amount;
                        const row = document.createElement('tr');
                        const actionsHtml = `
                            <button class="btn-action edit-expense" data-id="${expense._id}"><i class="fas fa-edit"></i> تعديل</button>
                            <button class="btn-action delete-expense" data-id="${expense._id}"><i class="fas fa-trash-alt"></i> حذف</button>
                            ${expense.attachment ? `<button class="btn-action view-attachment" data-attachment="${expense.attachment}"><i class="fas fa-paperclip"></i> عرض</button>` : ''}
                        `;
                        row.innerHTML = `
                            <td>${new Date(expense.date).toLocaleDateString('ar-EG')}</td>
                            <td>${expense.amount.toFixed(2)}</td>
                            <td>${expense.description}</td>
                            <td>${expense.vendorId ? expense.vendorId.name : 'غير محدد'}</td>
                            <td>${expense.categoryId ? expense.categoryId.name : 'غير محدد'}</td>
                            <td>${expense.attachment ? '<i class="fas fa-paperclip"></i> موجود' : 'لا يوجد'}</td>
                            <td class="actions">${actionsHtml}</td>
                        `;
                        expensesTableBody.appendChild(row);
                    });
                } else {
                    expensesTableBody.innerHTML = '<tr><td colspan="7">لا توجد مصروفات لهذا المشروع.</td></tr>';
                }
            } else {
                console.error('Failed to fetch expenses:', expensesResponse.status);
                expensesTableBody.innerHTML = '<tr><td colspan="7">فشل جلب المصروفات.</td></tr>';
            }

            // جلب الإيرادات
            const incomesResponse = await fetch(`${API_BASE_URL}/incomes/project/${projectId}`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (incomesResponse.ok) {
                allIncomes = await incomesResponse.json(); // تخزين الإيرادات
                incomesTableBody.innerHTML = '';
                if (allIncomes.length > 0) {
                    allIncomes.forEach(income => {
                        currentTotalIncomes += income.amount;
                        const row = document.createElement('tr');
                        const actionsHtml = `
                            <button class="btn-action edit-income" data-id="${income._id}"><i class="fas fa-edit"></i> تعديل</button>
                            <button class="btn-action delete-income" data-id="${income._id}"><i class="fas fa-trash-alt"></i> حذف</button>
                        `;
                        row.innerHTML = `
                            <td>${new Date(income.date).toLocaleDateString('ar-EG')}</td>
                            <td>${income.amount.toFixed(2)}</td>
                            <td>${income.description}</td>
                            <td>${income.paymentMethod || 'غير محدد'}</td>
                            <td class="actions">${actionsHtml}</td>
                        `;
                        incomesTableBody.appendChild(row);
                    });
                } else {
                    incomesTableBody.innerHTML = '<tr><td colspan="5">لا توجد إيرادات لهذا المشروع.</td></tr>';
                }
            } else {
                console.error('Failed to fetch incomes:', incomesResponse.status);
                incomesTableBody.innerHTML = '<tr><td colspan="5">فشل جلب الإيرادات.</td></tr>';
            }

            // تحديث الملخص المالي
            const netProfitLoss = currentTotalIncomes - currentTotalExpenses;
            totalIncomesSpan.textContent = `${currentTotalIncomes.toFixed(2)} EGP`;
            totalExpensesSpan.textContent = `${currentTotalExpenses.toFixed(2)} EGP`;
            netProfitLossSpan.textContent = `${netProfitLoss.toFixed(2)} EGP`;
            netProfitLossSpan.style.color = (netProfitLoss >= 0) ? 'var(--success-color)' : 'var(--danger-color)';

            addTransactionActionListeners(); // إضافة مستمعي الأحداث لأزرار المعاملات
            applyRoleBasedVisibility(); // تطبيق صلاحيات الأدوار على الأزرار بعد العرض

        } catch (error) {
            console.error('Error fetching expenses/incomes:', error);
            showToast('حدث خطأ أثناء جلب المصروفات والإيرادات.', 'error');
        }
    }

    // 5. دالة لتطبيق صلاحيات الأدوار على الأزرار
    function applyRoleBasedVisibility() {
        const elementsWithRoleRestriction = document.querySelectorAll('[data-access-role]');
        elementsWithRoleRestriction.forEach(el => {
            const requiredRoles = el.dataset.accessRole.split(',');
            if (requiredRoles.includes(userRole)) {
                el.style.display = ''; // Show element (or default display)
            } else {
                el.style.display = 'none'; // Hide element
            }
        });
    }

    // 6. مستمعي الأحداث لأزرار المعاملات (تعديل/حذف/إضافة)
    function addTransactionActionListeners() {
        // إضافة مستمعي أحداث المصروفات
        document.querySelectorAll('.edit-expense').forEach(button => {
            button.addEventListener('click', async (e) => {
                const expenseId = e.currentTarget.dataset.id;
                await editExpense(expenseId);
            });
        });
        document.querySelectorAll('.delete-expense').forEach(button => {
            button.addEventListener('click', async (e) => {
                const expenseId = e.currentTarget.dataset.id;
                if (confirm('هل أنت متأكد من حذف هذا المصروف؟')) {
                    await deleteExpense(expenseId);
                }
            });
        });
        document.querySelectorAll('.view-attachment').forEach(button => {
            button.addEventListener('click', (e) => {
                const attachmentUrl = e.currentTarget.dataset.attachment;
                openImageModal(attachmentUrl);
            });
        });

        // إضافة مستمعي أحداث الإيرادات
        document.querySelectorAll('.edit-income').forEach(button => {
            button.addEventListener('click', async (e) => {
                const incomeId = e.currentTarget.dataset.id;
                await editIncome(incomeId);
            });
        });
        document.querySelectorAll('.delete-income').forEach(button => {
            button.addEventListener('click', async (e) => {
                const incomeId = e.currentTarget.dataset.id;
                if (confirm('هل أنت متأكد من حذف هذا الإيراد؟')) {
                    await deleteIncome(incomeId);
                }
            });
        });

        // أزرار إضافة مصروف/إيراد
        document.querySelectorAll('.add-transaction-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const type = e.currentTarget.dataset.type; // 'expense' or 'income'
                currentProjectNameModal.textContent = projectNameDetails.textContent; // تحديث اسم المشروع
                openTransactionModal(type);
            });
        });
    }

    // 7. وظائف CRUD للمصروفات والإيرادات (ستقوم بفتح المودال وملء البيانات)
    async function editExpense(expenseId) {
        try {
            const response = await fetch(`${API_BASE_URL}/expenses/${expenseId}`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (response.ok) {
                const expense = await response.json();
                openTransactionModal('expense', expense);
            } else {
                showToast('فشل جلب بيانات المصروف للتعديل.', 'error');
            }
        } catch (error) {
            console.error('Error fetching expense for edit:', error);
            showToast('حدث خطأ.', 'error');
        }
    }

    async function deleteExpense(expenseId) {
        try {
            const response = await fetch(`${API_BASE_URL}/expenses/${expenseId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (response.ok) {
                showToast('تم حذف المصروف بنجاح.', 'success');
                fetchExpensesAndIncomes(projectId);
            } else {
                showToast('فشل حذف المصروف.', 'error');
            }
        } catch (error) {
            console.error('Error deleting expense:', error);
            showToast('حدث خطأ.', 'error');
        }
    }

    async function editIncome(incomeId) {
        try {
            const response = await fetch(`${API_BASE_URL}/incomes/${incomeId}`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (response.ok) {
                const income = await response.json();
                openTransactionModal('income', income);
            } else {
                showToast('فشل جلب بيانات الإيراد للتعديل.', 'error');
            }
        } catch (error) {
            console.error('Error fetching income for edit:', error);
            showToast('حدث خطأ.', 'error');
        }
    }

    async function deleteIncome(incomeId) {
        try {
            const response = await fetch(`${API_BASE_URL}/incomes/${incomeId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (response.ok) {
                showToast('تم حذف الإيراد بنجاح.', 'success');
                fetchExpensesAndIncomes(projectId);
            } else {
                showToast('فشل حذف الإيراد.', 'error');
            }
        } catch (error) {
            console.error('Error deleting income:', error);
            showToast('حدث خطأ.', 'error');
        }
    }

    // 8. منطق مودال إضافة/تعديل مصروف/إيراد
    function openTransactionModal(type, data = null) {
        if (transactionModal) {
            transactionModal.style.display = 'flex';
            // تفريغ النماذج
            addExpenseForm.reset();
            addIncomeForm.reset();

            // إخفاء جميع التبويبات أولاً
            document.getElementById('expenseForm').style.display = 'none';
            document.getElementById('incomeForm').style.display = 'none';

            // تنشيط التبويب الصحيح وإظهار النموذج
            tabButtons.forEach(btn => btn.classList.remove('active'));
            if (type === 'expense') {
                expenseFormTab.classList.add('active');
                document.getElementById('expenseForm').style.display = 'block';
                document.getElementById('modalTitle').textContent = `إضافة مصروف للمشروع: ${currentProjectNameModal.textContent}`;
                saveExpenseBtn.textContent = 'حفظ المصروف';
                expenseIdInput.value = '';
                if (data) { // وضع التعديل
                    document.getElementById('modalTitle').textContent = `تعديل مصروف للمشروع: ${currentProjectNameModal.textContent}`;
                    saveExpenseBtn.textContent = 'تحديث المصروف';
                    expenseIdInput.value = data._id;
                    expenseAmountInput.value = data.amount;
                    expenseDescriptionInput.value = data.description;
                    expenseDateInput.value = new Date(data.date).toISOString().split('T')[0];
                    expenseVendorSelect.value = data.vendorId ? data.vendorId._id : '';
                    expenseCategorySelect.value = data.categoryId ? data.categoryId._id : '';
                }
            } else if (type === 'income') {
                incomeFormTab.classList.add('active');
                document.getElementById('incomeForm').style.display = 'block';
                document.getElementById('modalTitle').textContent = `إضافة إيراد للمشروع: ${currentProjectNameModal.textContent}`;
                saveIncomeBtn.textContent = 'حفظ الإيراد';
                incomeIdInput.value = '';
                if (data) { // وضع التعديل
                    document.getElementById('modalTitle').textContent = `تعديل إيراد للمشروع: ${currentProjectNameModal.textContent}`;
                    saveIncomeBtn.textContent = 'تحديث الإيراد';
                    incomeIdInput.value = data._id;
                    incomeAmountInput.value = data.amount;
                    incomeDescriptionInput.value = data.description;
                    incomeDateInput.value = new Date(data.date).toISOString().split('T')[0];
                    incomePaymentMethodSelect.value = data.paymentMethod;
                }
            }
            fetchVendorsAndCategories(); // جلب بيانات القوائم المنسدلة
        }
    }

    function closeTransactionModal() {
        if (transactionModal) {
            transactionModal.style.display = 'none';
            // تفريغ الحقول وإعادة تعيينها
            addExpenseForm.reset();
            addIncomeForm.reset();
            // تأكد من إعادة تعيين التبويب النشط إلى المصروفات عند الإغلاق
            expenseFormTab.classList.add('active');
            incomeFormTab.classList.remove('active');
            document.getElementById('expenseForm').style.display = 'block';
            document.getElementById('incomeForm').style.display = 'none';
        }
    }

    // مستمعي الأحداث لمودال المعاملات
    if (closeTransactionModalBtn) {
        closeTransactionModalBtn.addEventListener('click', closeTransactionModal);
    }
    if (transactionModal) {
        window.addEventListener('click', (e) => {
            if (e.target === transactionModal) {
                closeTransactionModal();
            }
        });
    }

    // منطق التبديل بين ألسنة المصروف والإيراد في المودال
    if (tabButtons) {
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tab = button.dataset.tab;
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');

                document.getElementById('expenseForm').style.display = 'none';
                document.getElementById('incomeForm').style.display = 'none';

                if (tab === 'expense') document.getElementById('expenseForm').style.display = 'block';
                if (tab === 'income') document.getElementById('incomeForm').style.display = 'block';
            });
        });
    }

    // 9. دالة لجلب المقاولين والتصنيفات لملء القوائم المنسدلة (للمصروفات)
    async function fetchVendorsAndCategories() {
        try {
            // جلب المقاولين
            const vendorsResponse = await fetch(`${API_BASE_URL}/contractors`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            const vendors = await vendorsResponse.json();
            expenseVendorSelect.innerHTML = '<option value="">اختر مقاول</option>';
            vendors.forEach(vendor => {
                const option = document.createElement('option');
                option.value = vendor._id;
                option.textContent = vendor.name;
                expenseVendorSelect.appendChild(option);
            });

            // جلب التصنيفات
            const categoriesResponse = await fetch(`${API_BASE_URL}/categories`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            const categories = await categoriesResponse.json();
            expenseCategorySelect.innerHTML = '<option value="">اختر تصنيف</option>';
            categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category._id;
                option.textContent = category.name;
                expenseCategorySelect.appendChild(option);
            });

        } catch (error) {
            console.error('Error fetching vendors or categories for dropdowns:', error);
            showToast('فشل جلب بيانات المقاولين والتصنيفات.', 'error');
        }
    }

    // 10. معالجة إرسال نموذج المصروف
    if (saveExpenseBtn) {
        saveExpenseBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const expenseId = expenseIdInput.value;
            const amount = parseFloat(expenseAmountInput.value);
            const description = expenseDescriptionInput.value.trim();
            const date = expenseDateInput.value;
            // المرفقات: تتطلب معالجة خاصة لرفع الملفات (multer في Backend)
            // const attachmentFile = expenseAttachmentInput.files[0];
            const vendorId = expenseVendorSelect.value;
            const categoryId = expenseCategorySelect.value;

            if (!amount || !description || !date || !vendorId || !categoryId) {
                showToast('جميع حقول المصروفات مطلوبة.', 'error');
                return;
            }
            if (isNaN(amount) || amount <= 0) {
                showToast('المبلغ يجب أن يكون رقماً موجباً.', 'error');
                return;
            }

            const expenseData = {
                projectId: projectId,
                amount: amount,
                description: description,
                date: date,
                categoryId: categoryId,
                vendorId: vendorId,
                // attachment: attachmentFile ? attachmentFile.name : undefined
            };

            let response;
            try {
                if (expenseId) { // تعديل
                    response = await fetch(`${API_BASE_URL}/expenses/${expenseId}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${authToken}`
                        },
                        body: JSON.stringify(expenseData)
                    });
                } else { // إضافة
                    response = await fetch(`${API_BASE_URL}/expenses`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${authToken}`
                        },
                        body: JSON.stringify(expenseData)
                    });
                }

                if (response.ok) {
                    showToast(`تم ${expenseId ? 'تعديل' : 'إضافة'} المصروف بنجاح!`, 'success');
                    closeTransactionModal();
                    fetchExpensesAndIncomes(projectId); // إعادة جلب وتحديث
                } else {
                    const errorData = await response.json();
                    console.error('Failed to save expense:', response.status, errorData.message);
                    showToast(errorData.message || `فشل ${expenseId ? 'تعديل' : 'إضافة'} المصروف.`, 'error');
                }
            } catch (error) {
                console.error('Error saving expense:', error);
                showToast('حدث خطأ في الاتصال بالخادم أثناء حفظ المصروف.', 'error');
            }
        });
    }

    // 11. معالجة إرسال نموذج الإيراد
    if (saveIncomeBtn) {
        saveIncomeBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const incomeId = incomeIdInput.value;
            const amount = parseFloat(incomeAmountInput.value);
            const description = incomeDescriptionInput.value.trim();
            const date = incomeDateInput.value;
            const paymentMethod = incomePaymentMethodSelect.value;

            if (!amount || !description || !date || !paymentMethod) {
                showToast('جميع حقول الإيرادات مطلوبة.', 'error');
                return;
            }
            if (isNaN(amount) || amount <= 0) {
                showToast('المبلغ يجب أن يكون رقماً موجباً.', 'error');
                return;
            }

            const incomeData = {
                projectId: projectId,
                amount: amount,
                description: description,
                date: date,
                paymentMethod: paymentMethod
            };

            let response;
            try {
                if (incomeId) { // تعديل
                    response = await fetch(`${API_BASE_URL}/incomes/${incomeId}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${authToken}`
                        },
                        body: JSON.stringify(incomeData)
                    });
                } else { // إضافة
                    response = await fetch(`${API_BASE_URL}/incomes`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${authToken}`
                        },
                        body: JSON.stringify(incomeData)
                    });
                }

                if (response.ok) {
                    showToast(`تم ${incomeId ? 'تعديل' : 'إضافة'} الإيراد بنجاح!`, 'success');
                    closeTransactionModal();
                    fetchExpensesAndIncomes(projectId);
                } else {
                    const errorData = await response.json();
                    console.error('Failed to save income:', response.status, errorData.message);
                    showToast(errorData.message || `فشل ${incomeId ? 'تعديل' : 'إضافة'} الإيراد.`, 'error');
                }
            } catch (error) {
                console.error('Error saving income:', error);
                showToast('حدث خطأ في الاتصال بالخادم أثناء حفظ الإيراد.', 'error');
            }
        });
    }

    // 12. منطق مودال تغيير الحالة
    if (closeStatusChangeModalBtn) {
        closeStatusChangeModalBtn.addEventListener('click', () => {
            if (statusChangeModal) statusChangeModal.style.display = 'none';
        });
    }
    if (statusChangeModal) {
        window.addEventListener('click', (e) => {
            if (e.target === statusChangeModal) {
                statusChangeModal.style.display = 'none';
            }
        });
    }
    if (saveNewStatusBtn) {
        saveNewStatusBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const newStatus = newProjectStatusSelect.value;
            const projectToUpdateId = statusChangeProjectIdInput.value;

            if (!newStatus || !projectToUpdateId) {
                showToast('الرجاء اختيار حالة جديدة.', 'error');
                return;
            }

            try {
                const response = await fetch(`${API_BASE_URL}/projects/${projectToUpdateId}/status`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify({ status: newStatus })
                });

                if (response.ok) {
                    showToast('تم تغيير حالة المشروع بنجاح!', 'success');
                    if (statusChangeModal) statusChangeModal.style.display = 'none';
                    fetchProjectDetails(); // تحديث بيانات المشروع والماليات
                } else {
                    const errorData = await response.json();
                    console.error('Failed to change project status:', response.status, errorData.message);
                    showToast(errorData.message || 'فشل تغيير حالة المشروع.', 'error');
                }
            } catch (error) {
                console.error('Error changing project status:', error);
                showToast('حدث خطأ في الاتصال بالخادم أثناء تغيير حالة المشروع.', 'error');
            }
        });
    }

    // 13. منطق مودال عرض الصورة المرفقة
    function openImageModal(imageUrl) {
        if (imageModal && displayedImage && imageCaption) {
            displayedImage.src = imageUrl;
            imageCaption.textContent = 'مرفق المصروف'; 
            imageModal.style.display = 'flex';
        }
    }

    if (closeImageModalBtn) {
        closeImageModalBtn.addEventListener('click', () => {
            if (imageModal) imageModal.style.display = 'none';
        });
    }
    if (imageModal) {
        window.addEventListener('click', (e) => {
            if (e.target === imageModal) {
                imageModal.style.display = 'none';
            }
        });
    }

    // 14. تصدير Excel - الوظيفة الجديدة
    if (exportExcelBtn) {
        exportExcelBtn.addEventListener('click', () => {
            // التأكد من أن جميع البيانات المطلوبة موجودة
            if (projectData && allExpenses && allIncomes && typeof XLSX !== 'undefined') {
                exportProjectDataToExcel(projectData, allExpenses, allIncomes);
            } else {
                showToast('لا توجد بيانات كافية للتصدير بعد. الرجاء الانتظار حتى يتم تحميلها.', 'info');
                console.error('XLSX library not loaded or data missing. projectData:', projectData, 'allExpenses:', allExpenses, 'allIncomes:', allIncomes, 'XLSX:', typeof XLSX);
            }
        });
    }

    // دالة مساعدة لتصدير البيانات إلى Excel
    function exportProjectDataToExcel(project, expenses, incomes) {
        const wb = XLSX.utils.book_new();
        const projectName = project.name || 'المشروع';

        let exportData = [];
        let merges = []; // لتخزين معلومات دمج الخلايا

        // Row 0: Report Title
        exportData.push([`تقرير تفاصيل المشروع: ${projectName}`]);
        merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }); // Merge across 5 columns

        // Row 1: Empty for spacing
        exportData.push([]);

        // Row 2: Client Name
        exportData.push([`العميل: ${project.client ? project.client.name : 'لا يوجد عميل'}`]);
        merges.push({ s: { r: 2, c: 0 }, e: { r: 2, c: 4 } });

        // Row 3: Client Phone
        exportData.push([`رقم هاتف العميل: ${project.client ? project.client.phone : 'لا يوجد'}`]);
        merges.push({ s: { r: 3, c: 0 }, e: { r: 3, c: 4 } });
        
        // Row 4: Project Address
        exportData.push([`العنوان: ${project.address || 'غير محدد'}`]);
        merges.push({ s: { r: 4, c: 0 }, e: { r: 4, c: 4 } });

        // Row 5: Start Date
        exportData.push([`تاريخ البدء: ${project.startDate ? new Date(project.startDate).toLocaleDateString('ar-EG') : 'غير محدد'}`]);
        merges.push({ s: { r: 5, c: 0 }, e: { r: 5, c: 4 } });

        // Row 6: Status
        const statusText = project.status === 'ongoing' ? 'جارية' :
                           project.status === 'completed' ? 'منتهية' :
                           'معلقة';
        exportData.push([`الحالة: ${statusText}`]);
        merges.push({ s: { r: 6, c: 0 }, e: { r: 6, c: 4 } });

        // Row 7: Empty for spacing before expenses
        exportData.push([]);
        exportData.push([]);

        // --- Expenses Section ---
        let expensesSectionStartRow = exportData.length; // This will be the row index for 'المصروفات' title
        exportData.push(['المصروفات']);
        merges.push({ s: { r: expensesSectionStartRow, c: 0 }, e: { r: expensesSectionStartRow, c: 4 } }); // Merge for expenses title

        exportData.push(['التاريخ', 'المبلغ (جنيه)', 'الوصف', 'المقاول', 'التصنيف']); // Headers
        expenses.forEach(exp => {
            exportData.push([
                exp.date ? new Date(exp.date).toLocaleDateString('ar-EG') : '',
                exp.amount.toFixed(2),
                exp.description || '',
                exp.vendorId ? exp.vendorId.name : 'غير محدد',
                exp.categoryId ? exp.categoryId.name : 'غير محدد'
            ]);
        });
        const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
        let totalExpensesRowIndex = exportData.length; // This is the row index where the total row will be pushed
        // Adjusted: Empty cell for column A, label in B, then two empty, then value in E
        exportData.push(['', 'إجمالي المصروفات', '', '', totalExpenses.toFixed(2)]); 
        // Merge columns B, C, D for the "إجمالي المصروفات" label
        merges.push({ s: { r: totalExpensesRowIndex, c: 1 }, e: { r: totalExpensesRowIndex, c: 3 } });

        exportData.push([]); // Empty for spacing
        exportData.push([]);

        // --- Incomes Section ---
        let incomesSectionStartRow = exportData.length; // Row index for 'الإيرادات' title
        exportData.push(['الإيرادات']);
        merges.push({ s: { r: incomesSectionStartRow, c: 0 }, e: { r: incomesSectionStartRow, c: 4 } }); // Merge for incomes title

        exportData.push(['التاريخ', 'المبلغ (جنيه)', 'الوصف', 'طريقة الدفع']); // Headers (4 columns)
        incomes.forEach(inc => {
            exportData.push([
                inc.date ? new Date(inc.date).toLocaleDateString('ar-EG') : '',
                inc.amount.toFixed(2),
                inc.description || '',
                inc.paymentMethod || 'غير محدد'
            ]);
        });
        const totalIncomes = incomes.reduce((sum, income) => sum + income.amount, 0);
        let totalIncomesRowIndex = exportData.length; // Row index for total incomes row
        // Adjusted: Empty cell for column A, label in B, then two empty, then value in E
        exportData.push(['', 'إجمالي الإيرادات', '', '', totalIncomes.toFixed(2)]); 
        // Merge columns B, C, D for the "إجمالي الإيرادات" label
        merges.push({ s: { r: totalIncomesRowIndex, c: 1 }, e: { r: totalIncomesRowIndex, c: 3 } });

        exportData.push([]); // Empty for spacing
        exportData.push([]);

        // --- Net Profit/Loss Section ---
        const netProfitLoss = totalIncomes - totalExpenses;
        let netProfitLossRowIndex = exportData.length; // Row index for net profit/loss row
        // Adjusted: Empty cell for column A, label in B, then two empty, then value in E
        exportData.push(['', 'صافي ربح', '', '', netProfitLoss.toFixed(2)]); 
        // Merge columns B, C, D for the "صافي ربح" label
        merges.push({ s: { r: netProfitLossRowIndex, c: 1 }, e: { r: netProfitLossRowIndex, c: 3 } });

        const ws = XLSX.utils.aoa_to_sheet(exportData);

        // Apply merged cells
        ws['!merges'] = merges;

        // Set column widths
        const wscols = [
            { wch: 15 }, // A: التاريخ / العنوان
            { wch: 15 }, // B: المبلغ / رقم هاتف العميل (بداية دمج عنوان الإجمالي)
            { wch: 10 }, // C: الوصف (جزء من دمج عنوان الإجمالي)
            { wch: 10 }, // D: المقاول / طريقة الدفع (نهاية دمج عنوان الإجمالي)
            { wch: 15 }  // E: التصنيف (أو قيمة الإجمالي)
        ];
        ws['!cols'] = wscols;

        XLSX.utils.book_append_sheet(wb, ws, projectName); // اسم ورقة العمل

        // كتابة الملف
        XLSX.writeFile(wb, `${projectName}_التقرير_المالي.xlsx`);
        showToast('تم تصدير البيانات إلى Excel بنجاح!', 'success');
    }

    // بدء جلب البيانات عند تحميل الصفحة
    fetchProjectDetails();
    applyRoleBasedVisibility(); // تطبيق الصلاحيات الأولية عند التحميل
});
