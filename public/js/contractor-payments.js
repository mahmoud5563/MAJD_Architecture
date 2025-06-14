// public/js/contractor-payments.js

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const contractorId = urlParams.get('id');
    const projectId = urlParams.get('projectId'); // Assuming projectId might also be passed if coming from project details

    // Get user info from localStorage (assuming utils.js or auth.js handles this)
    const authToken = localStorage.getItem('authToken');
    const userRole = localStorage.getItem('userRole');
    // const userId = localStorage.getItem('userId'); // Not directly used in this snippet but available

    // --- DOM Elements ---
    // Header & Contractor Details
    const contractorNameDisplayInHeader = document.getElementById('contractorNameDisplayInHeader');
    const contractorNameDetails = document.getElementById('contractorNameDetails');
    const contractorEmailDetails = document.getElementById('contractorEmailDetails');
    const contractorPhoneDetails = document.getElementById('contractorPhoneDetails');
    const contractorSpecialtyDetails = document.getElementById('contractorSpecialtyDetails');
    const contractorNotesDetails = document.getElementById('contractorNotesDetails');

    const editContractorBtn = document.querySelector('.edit-contractor-btn');
    const deleteContractorBtn = document.querySelector('.delete-contractor-btn');

    // Financial Summary Elements
    const financialSummaryContent = document.getElementById('financialSummaryContent');
    const totalAgreedAmountSpan = document.getElementById('totalAgreedAmount');
    const totalPaidAmountSpan = document.getElementById('totalPaidAmount');
    const remainingAmountSpan = document.getElementById('remainingAmount');

    // Agreements Section
    const addAgreementBtn = document.querySelector('.add-agreement-btn');
    const contractorAgreementsTableBody = document.getElementById('contractorAgreementsTableBody');

    // Expenses Section (existing)
    const contractorExpensesTableBody = document.getElementById('contractorExpensesTableBody');
    const addExpenseBtn = document.querySelector('.add-expense-btn');

    // Expense Modal Elements (existing)
    const expenseModal = document.getElementById('expenseModal');
    const expenseModalTitle = document.getElementById('expenseModalTitle');
    const currentContractorNameModal = document.getElementById('currentContractorName');
    const closeExpenseModalBtn = expenseModal ? expenseModal.querySelector('.close-button') : null;

    const expenseForm = document.getElementById('expenseForm');
    const expenseIdInput = document.getElementById('expenseId');
    const modalContractorIdInput = document.getElementById('modalContractorId'); // Hidden field in expense modal
    const expenseProjectSelect = document.getElementById('expenseProjectSelect');
    const expenseAmountInput = document.getElementById('expenseAmount');
    const expenseDescriptionInput = document.getElementById('expenseDescription');
    const expenseDateInput = document.getElementById('expenseDate');
    const expenseAttachmentInput = document.getElementById('expenseAttachment');
    const expenseCategorySelect = document.getElementById('expenseCategory');
    const saveExpenseBtn = document.getElementById('saveExpenseBtn');

    // Agreement Modal Elements (NEW)
    const agreementModal = document.getElementById('agreementModal');
    const agreementModalTitle = document.getElementById('agreementModalTitle');
    const currentContractorNameAgreementModal = document.getElementById('currentContractorNameAgreementModal');
    const closeAgreementModalBtn = agreementModal ? agreementModal.querySelector('.close-button') : null;

    const agreementForm = document.getElementById('agreementForm');
    const agreementIdInput = document.getElementById('agreementId');
    const modalAgreementContractorIdInput = document.getElementById('modalAgreementContractorId'); // Hidden field in agreement modal
    const agreementProjectSelect = document.getElementById('agreementProjectSelect');
    const agreementAmountInput = document.getElementById('agreementAmount');
    const agreementDescriptionInput = document.getElementById('agreementDescription');
    const agreementDateInput = document.getElementById('agreementDate');
    const agreementAttachmentInput = document.getElementById('agreementAttachment');
    const saveAgreementBtn = document.getElementById('saveAgreementBtn');

    // Image Modal Elements (existing)
    const imageModal = document.getElementById('imageModal');
    const displayedImage = document.getElementById('displayedImage');
    const imageCaption = document.getElementById('caption');
    const closeImageModalButton = imageModal ? imageModal.querySelector('.close-button') : null;

    // Loader and Message Containers (matching HTML IDs)
    const contractorDetailsLoader = document.getElementById('contractor-details-loader');
    const contractorDetailsMessage = document.getElementById('contractor-details-message');
    const financialSummaryLoader = document.getElementById('financial-summary-loader');
    const financialSummaryMessage = document.getElementById('financial-summary-message');
    const agreementsLoader = document.getElementById('agreements-loader');
    const agreementsMessage = document.getElementById('agreements-message');
    const expensesLoader = document.getElementById('expenses-loader');
    const expensesMessage = document.getElementById('expenses-message');
    


    // --- Data Storage ---
    let allAgreements = [];
    let allContractorExpenses = [];

    // --- Base URL for API requests (Make sure this matches your backend URL) ---
    // يمكنك تعديل هذا الرابط ليناسب بيئة التشغيل الخاصة بك (مثل  https://6943-156-203-135-174.ngrok-free.app)
    const API_BASE_URL = ' https://6943-156-203-135-174.ngrok-free.app/api'; 

    // --- Helper Functions (assuming they are in utils.js or defined here if not) ---
    // If utils.js is not loaded or doesn't have these, define them here:
    // function showToast(message, type) { /* ... implementation ... */ }
    // function formatNumber(num) { /* ... implementation ... */ }

    // Generic loader/message functions
    function showLoader(element) {
        if (element) {
            element.style.display = 'block';
            element.innerHTML = '<div class="loader"></div>';
        }
    }

    function hideLoader(element) {
        if (element) {
            element.style.display = 'none';
        }
    }

    function showMessage(element, type, text) {
        if (element) {
            element.style.display = 'block';
            element.innerHTML = `<div class="message ${type}">${text}</div>`;
        }
    }

    function hideMessage(element) {
        if (element) {
            element.style.display = 'none';
        }
    }


    // --- Initial Checks ---
    if (!contractorId) {
        showMessage(contractorDetailsMessage, 'error', 'خطأ: معرف المقاول غير موجود في الرابط. يرجى العودة لصفحة المقاولين.');
        setTimeout(() => { window.location.href = 'contractors.html'; }, 2000);
        return;
    }
    if (!authToken) {
        window.location.href = 'index.html'; // Redirect to login
        return;
    }

    // --- Main Data Fetching Function ---
    async function fetchContractorDetailsAndAllPayments() {
        // Show loaders for all sections
        showLoader(contractorDetailsLoader);
        showLoader(financialSummaryLoader);
        showLoader(agreementsLoader);
        showLoader(expensesLoader);

        hideMessage(contractorDetailsMessage);
        hideMessage(financialSummaryMessage);
        hideMessage(agreementsMessage);
        hideMessage(expensesMessage);

        try {
            // 1. Fetch Contractor Details
            const contractorResponse = await fetch(`${API_BASE_URL}/contractors/${contractorId}`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            hideLoader(contractorDetailsLoader);
            if (!contractorResponse.ok) {
                const errorData = await contractorResponse.json();
                showMessage(contractorDetailsMessage, 'error', errorData.message || 'فشل جلب تفاصيل المقاول.');
                throw new Error(errorData.message || 'فشل جلب تفاصيل المقاول.');
            }
            const contractor = await contractorResponse.json();
            renderContractorDetails(contractor);

            // 2. Fetch Agreements for this Contractor/Project
            // If projectId is available, filter by it. Otherwise, get all agreements for the contractor.
            const agreementsQuery = projectId ? `?contractorId=${contractorId}&projectId=${projectId}` : `?contractorId=${contractorId}`;
            const agreementsResponse = await fetch(`${API_BASE_URL}/agreements${agreementsQuery}`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            hideLoader(agreementsLoader);
            if (agreementsResponse.ok) {
                allAgreements = await agreementsResponse.json();
                renderContractorAgreements(allAgreements);
                if (allAgreements.length === 0) {
                    showMessage(agreementsMessage, 'info', 'لا توجد اتفاقات مسجلة لهذا المقاول.');
                }
            } else {
                const errorData = await agreementsResponse.json();
                showMessage(agreementsMessage, 'error', errorData.message || 'فشل جلب اتفاقات المقاول.');
                console.error('Failed to fetch contractor agreements:', agreementsResponse.status, errorData.message);
                allAgreements = []; // Ensure it's empty if fetch fails
            }

            // 3. Fetch Expenses (Payments) for this Contractor/Project
            // If projectId is available, filter by it. Otherwise, get all expenses for the contractor.
            const expensesQuery = projectId ? `?vendorId=${contractorId}&projectId=${projectId}` : `?vendorId=${contractorId}`;
            const expensesResponse = await fetch(`${API_BASE_URL}/expenses${expensesQuery}`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            hideLoader(expensesLoader);
            if (expensesResponse.ok) {
                allContractorExpenses = await expensesResponse.json();
                renderContractorExpenses(allContractorExpenses);
                if (allContractorExpenses.length === 0) {
                    showMessage(expensesMessage, 'info', 'لا توجد دفعات مسجلة لهذا المقاول.');
                }
            } else {
                const errorData = await expensesResponse.json();
                showMessage(expensesMessage, 'error', errorData.message || 'فشل جلب دفعات المقاول.');
                console.error('Failed to fetch contractor expenses:', expensesResponse.status, errorData.message);
                allContractorExpenses = []; // Ensure it's empty if fetch fails
            }

            // 4. Update Financial Summary after both agreements and expenses are fetched
            updateFinancialSummary(allAgreements, allContractorExpenses);
            hideLoader(financialSummaryLoader); // Hide after summary is rendered

        } catch (error) {
            console.error('Error in fetchContractorDetailsAndAllPayments:', error);
            // General error message if specific messages weren't shown
            if (!contractorDetailsMessage.style.display || contractorDetailsMessage.style.display === 'none') {
                showMessage(contractorDetailsMessage, 'error', 'حدث خطأ في الاتصال بالخادم أثناء جلب بيانات المقاول ودفعاته.');
            }
            if (error.message.includes('401') || error.message.includes('403')) {
                showToast('انتهت الجلسة أو ليس لديك صلاحية. جارٍ إعادة التوجيه لتسجيل الدخول.', 'error');
                localStorage.removeItem('authToken');
                localStorage.removeItem('userRole');
                localStorage.removeItem('username');
                localStorage.removeItem('userId');
                setTimeout(() => { window.location.href = 'index.html'; }, 2000);
            }
        } finally {
            // Ensure roles are applied after everything is loaded
            applyRoleBasedVisibility();
        }
    }

    // --- Rendering Functions ---

    function renderContractorDetails(contractor) {
        if (!contractor) {
            showMessage(contractorDetailsMessage, 'info', 'لا تتوفر بيانات للمقاول.');
            return;
        }

        contractorNameDisplayInHeader.textContent = contractor.name;
        document.title = `دفعات المقاول: ${contractor.name} - MAJD Architecture`;

        contractorNameDetails.textContent = contractor.name;
        contractorEmailDetails.textContent = contractor.email || 'لا يوجد';
        contractorPhoneDetails.textContent = contractor.phone || 'لا يوجد';
        contractorSpecialtyDetails.textContent = contractor.specialty || 'لا يوجد';
        contractorNotesDetails.textContent = contractor.notes || 'لا توجد ملاحظات';

        if (editContractorBtn) editContractorBtn.dataset.id = contractor._id;
        if (deleteContractorBtn) deleteContractorBtn.dataset.id = contractor._id;

        // Populate modal contractor ID for expense and agreement modals
        if (modalContractorIdInput) modalContractorIdInput.value = contractor._id;
        if (currentContractorNameModal) currentContractorNameModal.textContent = contractor.name;
        if (modalAgreementContractorIdInput) modalAgreementContractorIdInput.value = contractor._id;
        if (currentContractorNameAgreementModal) currentContractorNameAgreementModal.textContent = contractor.name;
    }

    function updateFinancialSummary(agreements, expenses) {
        // Ensure formatNumber function is available from utils.js
        if (typeof formatNumber === 'undefined') {
            console.error('formatNumber function is not defined. Please ensure utils.js is loaded correctly.');
            // Define a fallback if utils.js isn't consistently loaded
            window.formatNumber = (num) => `${parseFloat(num).toFixed(2)} EGP`;
        }

        const totalAgreed = agreements.reduce((sum, agreement) => sum + agreement.amount, 0);
        const totalPaid = expenses.reduce((sum, expense) => sum + expense.amount, 0);
        const remaining = totalAgreed - totalPaid;

        totalAgreedAmountSpan.textContent = formatNumber(totalAgreed);
        totalPaidAmountSpan.textContent = formatNumber(totalPaid);
        remainingAmountSpan.textContent = formatNumber(remaining);

        // Add classes for styling (assuming you'll define these in your CSS)
        totalAgreedAmountSpan.classList.add('amount-agreed');
        totalPaidAmountSpan.classList.add('amount-paid');
        if (remaining > 0) {
            remainingAmountSpan.classList.add('amount-remaining'); // Red for positive remaining (still owed)
            remainingAmountSpan.classList.remove('amount-agreed');
        } else {
            remainingAmountSpan.classList.add('amount-agreed'); // Green for zero or negative (paid off or overpaid)
            remainingAmountSpan.classList.remove('amount-remaining');
        }
    }

    function renderContractorAgreements(agreements) {
        if (!contractorAgreementsTableBody) return;
        contractorAgreementsTableBody.innerHTML = ''; // Clear existing rows

        if (agreements.length === 0) {
            showMessage(agreementsMessage, 'info', 'لا توجد اتفاقات مسجلة لهذا المقاول.');
            return;
        }
        hideMessage(agreementsMessage); // Hide info message if there are agreements

        agreements.forEach(agreement => {
            const row = document.createElement('tr');
            const projectName = agreement.projectId ? agreement.projectId.name : 'غير محدد';
            
            // Assuming attachment is a URL or path, if it exists
            const attachmentHtml = agreement.attachment 
                ? `<button class="btn btn-sm btn-view view-agreement-attachment" data-attachment="${agreement.attachment}"><i class="fas fa-paperclip"></i> عرض</button>` 
                : 'لا يوجد';

            const actionsHtml = `
                <div class="action-buttons">
                    <button class="btn btn-sm btn-edit edit-agreement-btn" data-id="${agreement._id}" data-access-role="admin,account_manager,engineer"><i class="fas fa-edit"></i> تعديل</button>
                    <button class="btn btn-sm btn-delete delete-agreement-btn" data-id="${agreement._id}" data-access-role="admin,account_manager"><i class="fas fa-trash-alt"></i> حذف</button>
                </div>
            `; // Note: Engineer can edit if assigned to project, but delete is usually Admin/Account Manager

            row.innerHTML = `
                <td>${new Date(agreement.date).toLocaleDateString('ar-EG')}</td>
                <td>${formatNumber(agreement.amount)}</td>
                <td>${agreement.description || 'لا يوجد'}</td>
                <td>${attachmentHtml}</td>
                <td>${projectName}</td>
                <td>${actionsHtml}</td>
            `;
            contractorAgreementsTableBody.appendChild(row);
        });
        addAgreementActionListeners();
    }

    function renderContractorExpenses(expenses) {
        if (!contractorExpensesTableBody) return;
        contractorExpensesTableBody.innerHTML = ''; // Clear existing rows

        if (expenses.length === 0) {
            showMessage(expensesMessage, 'info', 'لا توجد دفعات مسجلة لهذا المقاول.');
            return;
        }
        hideMessage(expensesMessage); // Hide info message if there are expenses

        expenses.forEach(expense => {
            const row = document.createElement('tr');
            const projectName = expense.projectId ? expense.projectId.name : 'غير محدد';
            const categoryName = expense.categoryId ? expense.categoryId.name : 'غير محدد';
            // Assuming 'treasuryId' is populated in the backend as treasury name
            const treasuryName = expense.treasuryId ? expense.treasuryId.name : 'غير معروف'; 

            const attachmentHtml = expense.attachment 
                ? `<button class="btn btn-sm btn-view view-expense-attachment" data-attachment="${expense.attachment}"><i class="fas fa-paperclip"></i> عرض</button>` 
                : 'لا يوجد';

            const actionsHtml = `
                <div class="action-buttons">
                    <button class="btn btn-sm btn-edit edit-expense-btn" data-id="${expense._id}" data-access-role="admin,account_manager,engineer"><i class="fas fa-edit"></i> تعديل</button>
                    <button class="btn btn-sm btn-delete delete-expense-btn" data-id="${expense._id}" data-access-role="admin,account_manager,engineer"><i class="fas fa-trash-alt"></i> حذف</button>
                </div>
            `;

            row.innerHTML = `
                <td>${new Date(expense.date).toLocaleDateString('ar-EG')}</td>
                <td>${formatNumber(expense.amount)}</td>
                <td>${expense.description || 'لا يوجد'}</td>
                <td>${projectName}</td>
                <td>${categoryName}</td>
                <td>${treasuryName}</td> <!-- Display treasury name -->
                <td>${attachmentHtml}</td>
                <td>${actionsHtml}</td>
            `;
            contractorExpensesTableBody.appendChild(row);
        });

        addExpenseActionListeners();
    }

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

    // --- Event Listeners for Agreements ---
    if (addAgreementBtn) {
        addAgreementBtn.addEventListener('click', () => {
            openAgreementModal('add');
        });
    }

    function addAgreementActionListeners() {
        document.querySelectorAll('.edit-agreement-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const agreementId = e.currentTarget.dataset.id;
                await openEditAgreementModal(agreementId);
            });
        });

        document.querySelectorAll('.delete-agreement-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const agreementId = e.currentTarget.dataset.id;
                if (confirm('هل أنت متأكد من حذف هذا الاتفاق؟ هذا سيؤثر على المبلغ المستحق للمقاول.')) {
                    await deleteAgreement(agreementId);
                }
            });
        });
         document.querySelectorAll('.view-agreement-attachment').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const attachmentUrl = e.currentTarget.dataset.attachment;
                openImageModal(attachmentUrl, 'مرفق الاتفاق');
            });
        });
    }

    // --- Agreement Modal Functions ---
    async function openEditAgreementModal(agreementId) {
        try {
            const response = await fetch(`${API_BASE_URL}/agreements/${agreementId}`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (!response.ok) {
                const errorData = await response.json();
                showToast(errorData.message || 'فشل جلب بيانات الاتفاق للتعديل.', 'error');
                return;
            }
            const agreement = await response.json();
            openAgreementModal('edit', agreement);
        } catch (error) {
            console.error('Error fetching agreement for edit:', error);
            showToast('حدث خطأ أثناء جلب بيانات الاتفاق للتعديل.', 'error');
        }
    }

    async function openAgreementModal(mode = 'add', agreement = null) {
        if (!agreementModal) return;

        agreementModal.style.display = 'block'; // Or 'flex' if you use flexbox for modals
        agreementForm.reset();

        // Populate projects for dropdown
        await fetchProjectsForAgreementModal();

        modalAgreementContractorIdInput.value = contractorId; // Ensure contractor ID is set

        if (mode === 'add') {
            agreementModalTitle.textContent = `إضافة اتفاق جديد للمقاول: ${contractorNameDisplayInHeader.textContent}`;
            saveAgreementBtn.textContent = 'حفظ الاتفاق';
            agreementIdInput.value = '';
        } else { // mode === 'edit'
            agreementModalTitle.textContent = `تعديل اتفاق للمقاول: ${contractorNameDisplayInHeader.textContent}`;
            saveAgreementBtn.textContent = 'تحديث الاتفاق';
            agreementIdInput.value = agreement._id;
            agreementProjectSelect.value = agreement.projectId ? agreement.projectId._id : '';
            agreementAmountInput.value = agreement.amount;
            agreementDescriptionInput.value = agreement.description || '';
            agreementDateInput.value = agreement.date ? new Date(agreement.date).toISOString().split('T')[0] : '';
            // No handling for agreementAttachmentInput yet for edit (file input cannot be pre-set)
        }
    }

    function closeAgreementModal() {
        if (agreementModal) {
            agreementModal.style.display = 'none';
            agreementForm.reset();
        }
    }

    if (closeAgreementModalBtn) {
        closeAgreementModalBtn.addEventListener('click', closeAgreementModal);
    }
    if (agreementModal) {
        window.addEventListener('click', (e) => {
            if (e.target === agreementModal) {
                closeAgreementModal();
            }
        });
    }

    async function fetchProjectsForAgreementModal() {
        try {
            const projectsResponse = await fetch(`${API_BASE_URL}/projects`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            const projects = await projectsResponse.json();
            agreementProjectSelect.innerHTML = '<option value="">اختر مشروع</option>';
            projects.forEach(project => {
                const option = document.createElement('option');
                option.value = project._id;
                option.textContent = project.name;
                agreementProjectSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error fetching projects for agreement modal:', error);
            showToast('فشل جلب بيانات المشاريع لمودال الاتفاق.', 'error');
        }
    }

    // Handle saving agreement (add/edit)
    if (saveAgreementBtn) {
        saveAgreementBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            
            const agreementId = agreementIdInput.value;
            const projectIdSelected = agreementProjectSelect.value;
            const amount = parseFloat(agreementAmountInput.value);
            const description = agreementDescriptionInput.value.trim();
            const date = agreementDateInput.value;
            const contractorIdForAgreement = modalAgreementContractorIdInput.value;

            if (!projectIdSelected || !amount || !date || !contractorIdForAgreement) {
                showToast('الرجاء ملء جميع الحقول المطلوبة لإضافة/تعديل الاتفاق.', 'error');
                return;
            }
            if (isNaN(amount) || amount <= 0) {
                showToast('المبلغ المتفق عليه يجب أن يكون رقماً موجباً.', 'error');
                return;
            }

            const agreementData = {
                contractorId: contractorIdForAgreement,
                projectId: projectIdSelected,
                amount: amount,
                description: description,
                date: date,
                // attachment: handle file upload separately
            };

            let response;
            try {
                if (agreementId) { // Edit mode
                    response = await fetch(`${API_BASE_URL}/agreements/${agreementId}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${authToken}`
                        },
                        body: JSON.stringify(agreementData)
                    });
                } else { // Add mode
                    response = await fetch(`${API_BASE_URL}/agreements`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${authToken}`
                        },
                        body: JSON.stringify(agreementData)
                    });
                }

                if (response.ok) {
                    showToast(`تم ${agreementId ? 'تعديل' : 'حفظ'} الاتفاق بنجاح!`, 'success');
                    closeAgreementModal();
                    fetchContractorDetailsAndAllPayments(); // Refresh all data
                } else {
                    const errorData = await response.json();
                    console.error('Failed to save agreement:', response.status, errorData.message);
                    showToast(errorData.message || `فشل ${agreementId ? 'تعديل' : 'حفظ'} الاتفاق.`, 'error');
                }
            } catch (error) {
                console.error('Error saving agreement:', error);
                showToast('حدث خطأ في الاتصال بالخادم أثناء حفظ الاتفاق.', 'error');
            }
        });
    }

    // Delete Agreement
    async function deleteAgreement(agreementId) {
        try {
            const response = await fetch(`${API_BASE_URL}/agreements/${agreementId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (response.ok) {
                showToast('تم حذف الاتفاق بنجاح.', 'success');
                fetchContractorDetailsAndAllPayments(); // Refresh data
            } else {
                const errorData = await response.json();
                console.error('Failed to delete agreement:', response.status, errorData.message);
                showToast(errorData.message || 'فشل حذف الاتفاق.', 'error');
            }
        } catch (error) {
            console.error('Error deleting agreement:', error);
            showToast('حدث خطأ أثناء حذف الاتفاق.', 'error');
        }
    }


    // --- Existing Expense Modal Functions (modified slightly for context) ---
    function addExpenseActionListeners() {
        document.querySelectorAll('.edit-expense-btn').forEach(button => { // changed class name for clarity
            button.addEventListener('click', async (e) => {
                const expenseId = e.currentTarget.dataset.id;
                await openEditExpenseModal(expenseId);
            });
        });

        document.querySelectorAll('.delete-expense-btn').forEach(button => { // changed class name for clarity
            button.addEventListener('click', async (e) => {
                const expenseId = e.currentTarget.dataset.id;
                if (confirm('هل أنت متأكد من حذف هذه الدفعة؟')) {
                    await deleteExpense(expenseId);
                }
            });
        });

        document.querySelectorAll('.view-expense-attachment').forEach(link => { // changed class name for clarity
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const attachmentUrl = e.currentTarget.dataset.attachment;
                openImageModal(attachmentUrl, 'مرفق الدفعة');
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
                showToast(errorData.message || 'فشل جلب بيانات الدفعة للتعديل.', 'error');
                return;
            }
            const expense = await response.json();
            openExpenseModal('edit', expense);
        } catch (error) {
            console.error('Error fetching expense for edit:', error);
            showToast('حدث خطأ أثناء جلب بيانات الدفعة للتعديل.', 'error');
        }
    }

    async function openExpenseModal(mode = 'add', expense = null) {
        if (!expenseModal) return;

        expenseModal.style.display = 'block'; // Or 'flex'
        expenseForm.reset();

        // Populate projects and categories for dropdowns
        await fetchProjectsAndCategoriesForExpenseModal();
        // TODO: Populate Treasuries dropdown here once backend is ready
        // await fetchTreasuriesForExpenseModal();

        modalContractorIdInput.value = contractorId; // Ensure contractor ID is set

        if (mode === 'add') {
            expenseModalTitle.textContent = `إضافة دفعة للمقاول: ${contractorNameDisplayInHeader.textContent}`; // Changed text
            saveExpenseBtn.textContent = 'حفظ الدفعة'; // Changed text
            expenseIdInput.value = '';
        } else { // mode === 'edit'
            expenseModalTitle.textContent = `تعديل دفعة للمقاول: ${contractorNameDisplayInHeader.textContent}`; // Changed text
            saveExpenseBtn.textContent = 'تحديث الدفعة'; // Changed text
            expenseIdInput.value = expense._id;
            expenseProjectSelect.value = expense.projectId ? expense.projectId._id : '';
            expenseAmountInput.value = expense.amount;
            expenseDescriptionInput.value = expense.description || '';
            expenseDateInput.value = expense.date ? new Date(expense.date).toISOString().split('T')[0] : '';
            expenseCategorySelect.value = expense.categoryId ? expense.categoryId._id : '';
            // TODO: Set selected treasury here when editing
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
            // TODO: Get selected treasury ID here
            // const treasuryId = document.getElementById('expenseTreasurySelect').value; 

            if (!projectIdSelected || !amount || !description || !date || !categoryId || !vendorId) {
                showToast('الرجاء ملء جميع الحقول المطلوبة لإضافة/تعديل الدفعة.', 'error'); // Changed text
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
                // treasuryId: treasuryId, // Include treasury ID once implemented in backend
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
                    showToast(`تم ${expenseId ? 'تعديل' : 'حفظ'} الدفعة بنجاح!`, 'success'); // Changed text
                    closeExpenseModal();
                    fetchContractorDetailsAndAllPayments(); // Refresh all data
                } else {
                    const errorData = await response.json();
                    console.error('Failed to save expense (payment):', response.status, errorData.message);
                    showToast(errorData.message || `فشل ${expenseId ? 'تعديل' : 'حفظ'} الدفعة.`, 'error'); // Changed text
                }
            } catch (error) {
                console.error('Error saving expense (payment):', error);
                showToast('حدث خطأ في الاتصال بالخادم أثناء حفظ الدفعة.', 'error'); // Changed text
            }
        });
    }

    // Delete Expense (Payment)
    async function deleteExpense(expenseId) {
        try {
            const response = await fetch(`${API_BASE_URL}/expenses/${expenseId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (response.ok) {
                showToast('تم حذف الدفعة بنجاح.', 'success'); // Changed text
                fetchContractorDetailsAndAllPayments(); // Refresh data
            } else {
                const errorData = await response.json();
                console.error('Failed to delete expense (payment):', response.status, errorData.message);
                showToast(errorData.message || 'فشل حذف الدفعة.', 'error'); // Changed text
            }
        } catch (error) {
            console.error('Error deleting expense (payment):', error);
            showToast('حدث خطأ أثناء حذف الدفعة.', 'error'); // Changed text
        }
    }

    // Image Modal Logic (existing)
    function openImageModal(imageUrl, captionText) {
        if (imageModal && displayedImage && imageCaption) {
            displayedImage.src = imageUrl;
            imageCaption.textContent = captionText;
            imageModal.style.display = 'block'; // Or 'flex'
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
            if (confirm('هل أنت متأكد من حذف هذا المقاول؟ سيتم حذف جميع الدفعات والاتفاقات المرتبطة به. لا يمكن التراجع عن هذا الإجراء!')) {
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
    fetchContractorDetailsAndAllPayments();
});
