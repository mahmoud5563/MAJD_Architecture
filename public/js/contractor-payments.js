// public/js/contractor-payments.js

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const contractorId = urlParams.get('id');

    // Get user role and ID from localStorage
    const authToken = localStorage.getItem('authToken');
    const userRole = localStorage.getItem('userRole');
    const userId = localStorage.getItem('userId'); // Not directly used here, but good practice to get

    // Contractor details elements
    const contractorNameDisplayInHeader = document.getElementById('contractorNameDisplayInHeader');
    const contractorNameDetails = document.getElementById('contractorNameDetails');
    const contractorEmailDetails = document.getElementById('contractorEmailDetails');
    const contractorPhoneDetails = document.getElementById('contractorPhoneDetails');
    const contractorSpecialtyDetails = document.getElementById('contractorSpecialtyDetails');
    const contractorNotesDetails = document.getElementById('contractorNotesDetails');

    const editContractorBtn = document.querySelector('.edit-contractor-btn');
    const deleteContractorBtn = document.querySelector('.delete-contractor-btn');

    // Financial summary elements
    const totalContractorExpensesSpan = document.getElementById('totalContractorExpenses');

    // Expenses table
    const contractorExpensesTableBody = document.getElementById('contractorExpensesTableBody');
    const addExpenseBtn = document.querySelector('.add-expense-btn');

    // Expense Modal elements
    const expenseModal = document.getElementById('expenseModal');
    const expenseModalTitle = document.getElementById('expenseModalTitle');
    const currentContractorNameModal = document.getElementById('currentContractorName');
    const closeExpenseModalBtn = expenseModal ? expenseModal.querySelector('.close-button') : null;

    const expenseForm = document.getElementById('expenseForm');
    const expenseIdInput = document.getElementById('expenseId');
    const modalContractorIdInput = document.getElementById('modalContractorId');
    const expenseProjectSelect = document.getElementById('expenseProjectSelect');
    const expenseAmountInput = document.getElementById('expenseAmount');
    const expenseDescriptionInput = document.getElementById('expenseDescription');
    const expenseDateInput = document.getElementById('expenseDate');
    const expenseAttachmentInput = document.getElementById('expenseAttachment');
    const expenseCategorySelect = document.getElementById('expenseCategory');
    const saveExpenseBtn = document.getElementById('saveExpenseBtn');

    // Image Modal elements
    const imageModal = document.getElementById('imageModal');
    const displayedImage = document.getElementById('displayedImage');
    const imageCaption = document.getElementById('caption');
    const closeImageModalButton = imageModal ? imageModal.querySelector('.close-button') : null;

    let allContractorExpenses = []; // To store fetched expenses

    // Base URL for API requests
    const API_BASE_URL = 'https://6943-156-203-135-174.ngrok-free.app/api'; // Make sure this matches your backend URL


    // Initial check for contractor ID and authentication
    if (!contractorId) {
        showToast('خطأ: معرف المقاول غير موجود في الرابط. يرجى العودة لصفحة المقاولين.', 'error');
        setTimeout(() => { window.location.href = 'contractors.html'; }, 2000);
        return;
    }
    if (!authToken) {
        window.location.href = 'index.html';
        return;
    }

    // Function to fetch contractor details and their expenses
    async function fetchContractorDetailsAndExpenses() {
        try {
            // Fetch contractor details
            const contractorResponse = await fetch(`${API_BASE_URL}/contractors/${contractorId}`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });

            if (!contractorResponse.ok) {
                const errorData = await contractorResponse.json();
                console.error('Failed to fetch contractor details:', contractorResponse.status, errorData.message);
                showToast(errorData.message || 'فشل جلب تفاصيل المقاول.', 'error');
                if (contractorResponse.status === 401 || contractorResponse.status === 403) {
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('userRole');
                    localStorage.removeItem('username');
                    localStorage.removeItem('userId');
                    window.location.href = 'index.html';
                } else {
                    setTimeout(() => { window.location.href = 'contractors.html'; }, 2000);
                }
                return;
            }
            const contractor = await contractorResponse.json();
            renderContractorDetails(contractor);

            // Fetch expenses related to this contractor
            const expensesResponse = await fetch(`${API_BASE_URL}/expenses?vendorId=${contractorId}`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (expensesResponse.ok) {
                allContractorExpenses = await expensesResponse.json();
                renderContractorExpenses(allContractorExpenses);
                updateFinancialSummary(allContractorExpenses);
            } else {
                const errorData = await expensesResponse.json();
                console.error('Failed to fetch contractor expenses:', expensesResponse.status, errorData.message);
                showToast(errorData.message || 'فشل جلب مصروفات المقاول.', 'error');
            }

        } catch (error) {
            console.error('Error fetching contractor details or expenses:', error);
            showToast('حدث خطأ في الاتصال بالخادم أثناء جلب بيانات المقاول.', 'error');
            setTimeout(() => { window.location.href = 'contractors.html'; }, 2000);
        } finally {
            applyRoleBasedVisibility(); // Apply visibility after data is loaded and rendered
        }
    }

    // Function to display contractor details
    function renderContractorDetails(contractor) {
        if (!contractor) return;

        contractorNameDisplayInHeader.textContent = contractor.name;
        document.title = `دفعات المقاول: ${contractor.name} - MAJD Architecture`;

        contractorNameDetails.textContent = contractor.name;
        contractorEmailDetails.textContent = contractor.email || 'لا يوجد';
        contractorPhoneDetails.textContent = contractor.phone || 'لا يوجد';
        contractorSpecialtyDetails.textContent = contractor.specialty || 'لا يوجد';
        contractorNotesDetails.textContent = contractor.notes || 'لا توجد ملاحظات';

        if (editContractorBtn) editContractorBtn.dataset.id = contractor._id;
        if (deleteContractorBtn) deleteContractorBtn.dataset.id = contractor._id;

        // Populate modal contractor ID if adding expense from this page
        if (modalContractorIdInput) modalContractorIdInput.value = contractor._id;
        if (currentContractorNameModal) currentContractorNameModal.textContent = contractor.name;
    }

    // Function to display expenses in the table
    function renderContractorExpenses(expenses) {
        if (!contractorExpensesTableBody) return;
        contractorExpensesTableBody.innerHTML = '';

        if (expenses.length === 0) {
            contractorExpensesTableBody.innerHTML = '<tr><td colspan="7">لا توجد مصروفات مسجلة لهذا المقاول.</td></tr>';
            return;
        }

        expenses.forEach(expense => {
            const row = document.createElement('tr');
            // Check if projectId, vendorId, categoryId are populated and have a 'name' property
            const projectName = expense.projectId ? expense.projectId.name : 'غير محدد';
            const categoryName = expense.categoryId ? expense.categoryId.name : 'غير محدد';

            const actionsHtml = `
                <button class="btn-action edit-expense" data-id="${expense._id}" data-access-role="admin,account_manager,engineer"><i class="fas fa-edit"></i> تعديل</button>
                <button class="btn-action delete-expense" data-id="${expense._id}" data-access-role="admin,account_manager,engineer"><i class="fas fa-trash-alt"></i> حذف</button>
                ${expense.attachment ? `<button class="btn-action view-attachment" data-attachment="${expense.attachment}"><i class="fas fa-paperclip"></i> عرض</button>` : ''}
            `;

            row.innerHTML = `
                <td>${new Date(expense.date).toLocaleDateString('ar-EG')}</td>
                <td>${expense.amount.toFixed(2)}</td>
                <td>${expense.description || 'لا يوجد'}</td>
                <td>${projectName}</td>
                <td>${categoryName}</td>
                <td>${expense.attachment ? '<i class="fas fa-paperclip"></i> موجود' : 'لا يوجد'}</td>
                <td class="actions">${actionsHtml}</td>
            `;
            contractorExpensesTableBody.appendChild(row);
        });

        addExpenseActionListeners();
    }

    // Function to update the financial summary
    function updateFinancialSummary(expenses) {
        const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
        totalContractorExpensesSpan.textContent = `${totalExpenses.toFixed(2)} EGP`;
    }

    // Function to apply role-based visibility
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

    // Add action listeners for expenses (edit/delete/view attachment)
    function addExpenseActionListeners() {
        document.querySelectorAll('.edit-expense').forEach(button => {
            button.addEventListener('click', async (e) => {
                const expenseId = e.currentTarget.dataset.id;
                await openEditExpenseModal(expenseId);
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

        document.querySelectorAll('.view-attachment').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const attachmentUrl = e.currentTarget.dataset.attachment;
                openImageModal(attachmentUrl, 'مرفق المصروف');
            });
        });
    }

    // Open/Close Expense Modal functions
    if (addExpenseBtn) {
        addExpenseBtn.addEventListener('click', () => {
            openExpenseModal('add');
        });
    }

    async function openEditExpenseModal(expenseId) {
        try {
            const response = await fetch(`${API_BASE_URL}/expenses/${expenseId}`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (!response.ok) {
                const errorData = await response.json();
                showToast(errorData.message || 'فشل جلب بيانات المصروف للتعديل.', 'error');
                return;
            }
            const expense = await response.json();
            openExpenseModal('edit', expense);
        } catch (error) {
            console.error('Error fetching expense for edit:', error);
            showToast('حدث خطأ أثناء جلب بيانات المصروف للتعديل.', 'error');
        }
    }

    async function openExpenseModal(mode = 'add', expense = null) {
        if (!expenseModal) return;

        expenseModal.style.display = 'flex';
        expenseForm.reset();

        // Populate projects and categories for dropdowns
        await fetchProjectsAndCategoriesForExpenseModal();

        modalContractorIdInput.value = contractorId; // Ensure contractor ID is set

        if (mode === 'add') {
            expenseModalTitle.textContent = `إضافة مصروف للمقاول: ${contractorNameDisplayInHeader.textContent}`;
            saveExpenseBtn.textContent = 'حفظ المصروف';
            expenseIdInput.value = '';
            // Pre-select the contractor
            // The vendorId will be sent from modalContractorIdInput.value
        } else { // mode === 'edit'
            expenseModalTitle.textContent = `تعديل مصروف للمقاول: ${contractorNameDisplayInHeader.textContent}`;
            saveExpenseBtn.textContent = 'تحديث المصروف';
            expenseIdInput.value = expense._id;
            expenseProjectSelect.value = expense.projectId ? expense.projectId._id : '';
            expenseAmountInput.value = expense.amount;
            expenseDescriptionInput.value = expense.description || '';
            expenseDateInput.value = expense.date ? new Date(expense.date).toISOString().split('T')[0] : '';
            expenseCategorySelect.value = expense.categoryId ? expense.categoryId._id : '';
            // No need to set expenseVendorSelect.value as it's fixed by modalContractorIdInput
        }
    }

    function closeExpenseModal() {
        if (expenseModal) {
            expenseModal.style.display = 'none';
            expenseForm.reset();
        }
    }

    if (closeExpenseModalBtn) {
        closeExpenseModalBtn.addEventListener('click', closeExpenseModal);
    }
    if (expenseModal) {
        window.addEventListener('click', (e) => {
            if (e.target === expenseModal) {
                closeExpenseModal();
            }
        });
    }

    // Function to fetch projects and categories for expense modal dropdowns
    async function fetchProjectsAndCategoriesForExpenseModal() {
        try {
            // Fetch Projects
            const projectsResponse = await fetch(`${API_BASE_URL}/projects`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            const projects = await projectsResponse.json();
            expenseProjectSelect.innerHTML = '<option value="">اختر مشروع</option>';
            projects.forEach(project => {
                const option = document.createElement('option');
                option.value = project._id;
                option.textContent = project.name;
                expenseProjectSelect.appendChild(option);
            });

            // Fetch Categories
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
            console.error('Error fetching projects or categories for modal:', error);
            showToast('فشل جلب بيانات المشاريع أو التصنيفات للمودال.', 'error');
        }
    }

    // Handle saving expense (add/edit)
    if (saveExpenseBtn) {
        saveExpenseBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            
            const expenseId = expenseIdInput.value;
            const projectIdSelected = expenseProjectSelect.value;
            const amount = parseFloat(expenseAmountInput.value);
            const description = expenseDescriptionInput.value.trim();
            const date = expenseDateInput.value;
            const categoryId = expenseCategorySelect.value;
            const vendorId = modalContractorIdInput.value; // Get contractor ID from hidden input

            if (!projectIdSelected || !amount || !description || !date || !categoryId || !vendorId) {
                showToast('الرجاء ملء جميع الحقول المطلوبة لإضافة/تعديل المصروف.', 'error');
                return;
            }
            if (isNaN(amount) || amount <= 0) {
                showToast('المبلغ يجب أن يكون رقماً موجباً.', 'error');
                return;
            }

            const expenseData = {
                projectId: projectIdSelected,
                amount: amount,
                description: description,
                date: date,
                categoryId: categoryId,
                vendorId: vendorId,
                // attachment: attachmentFile ? attachmentFile.name : undefined // Implement file upload later
            };

            let response;
            try {
                if (expenseId) { // Edit mode
                    response = await fetch(`${API_BASE_URL}/expenses/${expenseId}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${authToken}`
                        },
                        body: JSON.stringify(expenseData)
                    });
                } else { // Add mode
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
                    showToast(`تم ${expenseId ? 'تعديل' : 'حفظ'} المصروف بنجاح!`, 'success');
                    closeExpenseModal();
                    fetchContractorDetailsAndExpenses(); // Refresh data
                } else {
                    const errorData = await response.json();
                    console.error('Failed to save expense:', response.status, errorData.message);
                    showToast(errorData.message || `فشل ${expenseId ? 'تعديل' : 'حفظ'} المصروف.`, 'error');
                }
            } catch (error) {
                console.error('Error saving expense:', error);
                showToast('حدث خطأ في الاتصال بالخادم أثناء حفظ المصروف.', 'error');
            }
        });
    }

    // Delete Expense
    async function deleteExpense(expenseId) {
        try {
            const response = await fetch(`${API_BASE_URL}/expenses/${expenseId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (response.ok) {
                showToast('تم حذف المصروف بنجاح.', 'success');
                fetchContractorDetailsAndExpenses(); // Refresh data
            } else {
                const errorData = await response.json();
                console.error('Failed to delete expense:', response.status, errorData.message);
                showToast(errorData.message || 'فشل حذف المصروف.', 'error');
            }
        } catch (error) {
            console.error('Error deleting expense:', error);
            showToast('حدث خطأ أثناء حذف المصروف.', 'error');
        }
    }

    // Image Modal Logic
    function openImageModal(imageUrl, captionText) {
        if (imageModal && displayedImage && imageCaption) {
            displayedImage.src = imageUrl;
            imageCaption.textContent = captionText;
            imageModal.style.display = 'flex';
        }
    }

    function closeImageModal() {
        if (imageModal) {
            imageModal.style.display = 'none';
            displayedImage.src = '';
            imageCaption.textContent = '';
        }
    }

    if (closeImageModalButton) {
        closeImageModalButton.addEventListener('click', closeImageModal);
    }
    if (imageModal) {
        window.addEventListener('click', (e) => {
            if (e.target === imageModal) {
                closeImageModal();
            }
        });
    }

    // Event listener for "Edit Contractor" button
    if (editContractorBtn) {
        editContractorBtn.addEventListener('click', () => {
            // Redirect to contractors.html with editId to open modal
            window.location.href = `contractors.html?editId=${contractorId}`; 
        });
    }

    // Event listener for "Delete Contractor" button
    if (deleteContractorBtn) {
        deleteContractorBtn.addEventListener('click', async () => {
            if (confirm('هل أنت متأكد من حذف هذا المقاول؟ سيتم حذف جميع المصروفات المرتبطة به. لا يمكن التراجع عن هذا الإجراء!')) {
                try {
                    const response = await fetch(`${API_BASE_URL}/contractors/${contractorId}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${authToken}` }
                    });

                    if (response.ok) {
                        showToast('تم حذف المقاول بنجاح.', 'success');
                        setTimeout(() => { window.location.href = 'contractors.html'; }, 1500);
                    } else {
                        const errorData = await response.json();
                        console.error('Failed to delete contractor:', response.status, errorData.message);
                        showToast(errorData.message || 'فشل حذف المقاول.', 'error');
                    }
                } catch (error) {
                    console.error('Error deleting contractor:', error);
                    showToast('حدث خطأ أثناء حذف المقاول.', 'error');
                }
            }
        });
    }


    // Initial fetch when page loads
    fetchContractorDetailsAndExpenses();
});
