// public/js/project-details.js

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('id');
    const authToken = localStorage.getItem('authToken');
    const userRole = localStorage.getItem('userRole');
    const username = localStorage.getItem('username'); // Get username for display

    // --- DOM Elements ---
    // Header & User Info
    const projectNameDisplayInHeader = document.getElementById('projectNameDisplayInHeader');
    const usernameDisplay = document.getElementById('usernameDisplay');
    const logoutBtn = document.getElementById('logoutBtn');
    const toggleSidebarBtn = document.querySelector('.toggle-sidebar-btn'); // For sidebar
    const sidebar = document.querySelector('.sidebar'); // For sidebar

    // Project Details Card
    const projectNameDetails = document.getElementById('projectNameDetails');
    const projectClientDetails = document.getElementById('projectClientDetails');
    const projectEngineerDetails = document.getElementById('projectEngineerDetails');
    const projectAddressDetails = document.getElementById('projectAddressDetails');
    const projectDescriptionDetails = document.getElementById('projectDescriptionDetails');
    const projectStartDateDetails = document.getElementById('projectStartDateDetails');
    const projectEndDateDetails = document.getElementById('projectEndDateDetails');
    const projectStatusDetails = document.getElementById('projectStatusDetails');
    const projectNotesDetails = document.getElementById('projectNotesDetails');

    const editProjectBtn = document.querySelector('.edit-project-btn');
    const changeStatusBtn = document.querySelector('.change-status-btn');
    const addTransactionUnifiedBtn = document.querySelector('.add-transaction-unified-btn'); // NEW: Unified add transaction button

    // Financial Summary
    const totalIncomesSpan = document.getElementById('totalIncomes');
    const totalExpensesSpan = document.getElementById('totalExpenses');
    const netProfitLossSpan = document.getElementById('netProfitLoss');
    const exportExcelBtn = document.getElementById('exportExcelBtn');

    // Tables
    const expensesTableBody = document.getElementById('expensesTableBody');
    const incomesTableBody = document.getElementById('incomesTableBody');

    // Transaction Modal Elements (The main modal for both expense/income forms)
    const transactionModal = document.getElementById('transactionModal');
    const closeTransactionModalBtn = transactionModal ? transactionModal.querySelector('.close-button') : null;
    const tabButtons = transactionModal ? transactionModal.querySelectorAll('.tab-button') : null;
    const currentProjectNameModal = document.getElementById('currentProjectName'); // Project name in modal header
    const expenseFormTab = document.getElementById('expenseFormTab');
    const incomeFormTab = document.getElementById('incomeFormTab');
    const expenseFormPane = document.getElementById('expenseForm'); // The actual form div for expenses
    const incomeFormPane = document.getElementById('incomeForm');   // The actual form div for incomes

    // Expense Form Elements
    const addExpenseForm = document.getElementById('addExpenseForm'); // The form element itself
    const expenseIdInput = document.getElementById('expenseId');
    const expenseAmountInput = document.getElementById('expenseAmount');
    const expenseDescriptionInput = document.getElementById('expenseDescription');
    const expenseDateInput = document.getElementById('expenseDate');
    const expenseAttachmentInput = document.getElementById('expenseAttachment');
    const expenseVendorSelect = document.getElementById('expenseVendor');
    const expenseCategorySelect = document.getElementById('expenseCategory');
    const expenseTreasurySelect = document.getElementById('expenseTreasurySelect'); // NEW: Treasury Select Element
    const saveExpenseBtn = document.getElementById('saveExpenseBtn');

    // Income Form Elements
    const addIncomeForm = document.getElementById('addIncomeForm'); // The form element itself
    const incomeIdInput = document.getElementById('incomeId');
    const incomeAmountInput = document.getElementById('incomeAmount');
    const incomeDescriptionInput = document.getElementById('incomeDescription');
    const incomeDateInput = document.getElementById('incomeDate');
    const incomePaymentMethodSelect = document.getElementById('incomePaymentMethod');
    const saveIncomeBtn = document.getElementById('saveIncomeBtn');

    // Status Change Modal Elements
    const statusChangeModal = document.getElementById('statusChangeModal');
    const closeStatusChangeModalBtn = document.getElementById('closeStatusChangeModalBtn');
    const projectNameToChangeStatusSpan = document.getElementById('projectNameToChangeStatus');
    const changeStatusForm = document.getElementById('changeStatusForm'); // The form element for status change
    const statusChangeProjectIdInput = document.getElementById('statusChangeProjectId');
    const newProjectStatusSelect = document.getElementById('newProjectStatus');
    const saveNewStatusBtn = document.getElementById('saveNewStatusBtn');

    // Image Modal Elements
    const imageModal = document.getElementById('imageModal');
    const closeImageModalBtn = imageModal ? imageModal.querySelector('.close-button') : null;
    const displayedImage = document.getElementById('displayedImage');
    const imageCaption = document.getElementById('caption');

    // --- Data Storage ---
    let projectData = null; // Stores current project details
    let allExpenses = [];   // Stores all fetched expenses
    let allIncomes = [];    // Stores all fetched incomes
    let contractorsData = []; // Stores contractors for dropdown
    let expenseCategoriesData = []; // Stores categories for dropdown
    let treasuriesData = []; // NEW: Stores treasuries for dropdown

    // Base URL for API requests
    const API_BASE_URL = 'https://6943-156-203-135-174.ngrok-free.app/api';

    // --- Initial Checks and Setup ---
    if (!authToken) {
        window.location.href = 'index.html'; // Redirect to login if not authenticated
        return;
    }
    if (!projectId) {
        showToast('معرف المشروع غير موجود في الرابط. جاري العودة لصفحة المشاريع.', 'error');
        setTimeout(() => { window.location.href = 'projects.html'; }, 1500);
        return;
    }

    // Set username display
    if (usernameDisplay) {
        usernameDisplay.textContent = username || 'المستخدم';
    }

    // Sidebar Toggle
    if (toggleSidebarBtn && sidebar) {
        toggleSidebarBtn.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });
    }

    // Logout functionality
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            handleLogout(); // Assuming handleLogout is defined in auth.js or main.js
        });
    }

    // Initial data fetch for the page
    fetchProjectDetails();


    // --- Event Listeners for Page Actions ---

    // Handle unified "Add Transaction" button click
    if (addTransactionUnifiedBtn) {
        addTransactionUnifiedBtn.addEventListener('click', () => {
            openTransactionModal('expense'); // Open with expense tab active by default
        });
    }

    // Edit Project Button
    if (editProjectBtn) {
        editProjectBtn.addEventListener('click', () => {
            if (projectId) {
                window.location.href = `add-project.html?id=${projectId}`; // Assuming edit uses add-project.html
            }
        });
    }

    // Change Status Button
    if (changeStatusBtn) {
        changeStatusBtn.addEventListener('click', async () => {
            if (!projectId) {
                showToast("لم يتم العثور على معرف المشروع.", "error");
                return;
            }
            try {
                // Ensure projectData is loaded, if not, fetch it again.
                if (!projectData) {
                    await fetchProjectDetails();
                }
                if (projectData) {
                    projectNameToChangeStatusSpan.textContent = projectData.name;
                    statusChangeProjectIdInput.value = projectId;
                    newProjectStatusSelect.value = projectData.status; // Set current status
                    statusChangeModal.style.display = 'flex';
                } else {
                    showToast("المشروع غير موجود أو لا يمكن جلب بياناته.", "error");
                }
            } catch (error) {
                console.error("Error preparing status change modal:", error);
                showToast("حدث خطأ أثناء إعداد تغيير حالة المشروع.", "error");
            }
        });
    }

    // Status Change Modal Close Button
    if (closeStatusChangeModalBtn) {
        closeStatusChangeModalBtn.addEventListener('click', () => {
            if (statusChangeModal) statusChangeModal.style.display = 'none';
        });
    }

    // Status Change Form Submission
    if (changeStatusForm) {
        changeStatusForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const projectToUpdateId = statusChangeProjectIdInput.value;
            const newStatus = newProjectStatusSelect.value;

            if (!newStatus || !projectToUpdateId) {
                showToast('الرجاء اختيار حالة جديدة.', 'error');
                return;
            }

            try {
                const response = await fetch(`${API_BASE_URL}/projects/${projectToUpdateId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify({ status: newStatus })
                });

                if (response.ok) {
                    showToast('تم تغيير حالة المشروع بنجاح!', 'success');
                    statusChangeModal.style.display = 'none';
                    fetchProjectDetails(); // Re-fetch project details to update status display
                } else {
                    const errorData = await response.json();
                    console.error('Failed to update project status:', response.status, errorData.message);
                    showToast(errorData.message || 'فشل تغيير حالة المشروع.', 'error');
                }
            } catch (error) {
                console.error('Error updating project status:', error);
                showToast('حدث خطأ في الاتصال بالخادم أثناء تغيير حالة المشروع.', 'error');
            }
        });
    }

    // Export Excel Button
    if (exportExcelBtn) {
        exportExcelBtn.addEventListener('click', exportProjectDataToExcel);
    }

    // --- Transaction Modal Handling ---

    // Close Transaction Modal (for both 'X' button and outside click)
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

    // Tab switching for transaction modal
    if (tabButtons) {
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tab = button.dataset.tab;
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');

                expenseFormPane.classList.remove('active'); // Use classList.remove/add
                incomeFormPane.classList.remove('active');

                if (tab === 'expense') {
                    expenseFormPane.classList.add('active');
                } else if (tab === 'income') {
                    incomeFormPane.classList.add('active');
                }
            });
        });
    }

    // Expense Form Submission
    if (addExpenseForm) {
        addExpenseForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveTransaction('expense');
        });
    }

    // Income Form Submission
    if (addIncomeForm) {
        addIncomeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveTransaction('income');
        });
    }


    // --- Functions for Data Fetching & Rendering ---

    /**
     * Fetches project details from the API and updates the UI.
     */
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
                    // Removed immediate redirect, assuming `handleLogout` or higher level auth logic will manage.
                }
                return;
            }

            projectData = await response.json(); // Store project data for later use (e.g., export)
            renderProjectDetails(projectData);
            fetchExpensesAndIncomes(projectId); // Fetch transactions after project details
            fetchVendorsAndCategoriesAndTreasuries(); // Fetch dropdown data for modals
        } catch (error) {
            console.error('Error fetching project details:', error);
            showToast('حدث خطأ أثناء جلب تفاصيل المشروع.', 'error');
        }
    }

    /**
     * Renders the project details onto the page.
     * @param {object} project - The project data object.
     */
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

            currentProjectNameModal.textContent = project.name; // Set for transaction modal header
            projectNameToChangeStatusSpan.textContent = project.name; // Set for status change modal header
        }
    }

    /**
     * Fetches expenses and incomes for the project and updates tables/summary.
     * @param {string} projectId - The ID of the current project.
     */
    async function fetchExpensesAndIncomes(projectId) {
        try {
            // Fetch Expenses
            const expensesResponse = await fetch(`${API_BASE_URL}/expenses/project/${projectId}`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (expensesResponse.ok) {
                allExpenses = await expensesResponse.json();
                renderExpensesTable(allExpenses);
            } else {
                console.error('Failed to fetch expenses:', expensesResponse.status);
                showToast('فشل جلب المصروفات.', 'error');
                expensesTableBody.innerHTML = '<tr><td colspan="7">فشل جلب المصروفات.</td></tr>';
            }

            // Fetch Incomes
            const incomesResponse = await fetch(`${API_BASE_URL}/incomes/project/${projectId}`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (incomesResponse.ok) {
                allIncomes = await incomesResponse.json();
                renderIncomesTable(allIncomes);
            } else {
                console.error('Failed to fetch incomes:', incomesResponse.status);
                showToast('فشل جلب الإيرادات.', 'error');
                incomesTableBody.innerHTML = '<tr><td colspan="5">فشل جلب الإيرادات.</td></tr>';
            }

            updateFinancialSummary(allExpenses, allIncomes); // Update summary after both are fetched
            applyRoleBasedVisibility(); // Apply roles after content is rendered
        } catch (error) {
            console.error('Error fetching expenses/incomes:', error);
            showToast('حدث خطأ أثناء جلب المصروفات والإيرادات.', 'error');
        }
    }

    /**
     * Renders the expenses table with provided data.
     * @param {Array<Object>} expenses - Array of expense objects.
     */
    function renderExpensesTable(expenses) {
        expensesTableBody.innerHTML = ''; // Clear existing rows
        if (expenses.length === 0) {
            expensesTableBody.innerHTML = '<tr><td colspan="7">لا توجد مصروفات لهذا المشروع.</td></tr>';
            return;
        }

        expenses.forEach(expense => {
            const row = expensesTableBody.insertRow();
            row.dataset.id = expense._id; // Use _id from backend
            const actionsHtml = `
                <button class="btn-action edit-expense" data-id="${expense._id}"><i class="fas fa-edit"></i> تعديل</button>
                <button class="btn-action delete-expense" data-id="${expense._id}"><i class="fas fa-trash-alt"></i> حذف</button>
                ${expense.attachment ? `<button class="btn-action view-attachment" data-attachment="${expense.attachment}"><i class="fas fa-paperclip"></i> عرض</button>` : ''}
            `;
            row.innerHTML = `
                <td>${new Date(expense.date).toLocaleDateString('ar-EG')}</td>
                <td>${expense.amount.toFixed(2)} EGP</td>
                <td>${expense.description || 'N/A'}</td>
                <td>${expense.vendorId ? expense.vendorId.name : 'غير محدد'}</td>
                <td>${expense.categoryId ? expense.categoryId.name : 'غير محدد'}</td>
                <td>${expense.treasuryId ? expense.treasuryId.name : 'غير محدد'}</td> <!-- Display Treasury Name -->
                <td class="actions">${actionsHtml}</td>
            `;

            // Add event listeners for view attachment, edit, and delete buttons
            const viewAttachmentBtn = row.querySelector('.view-attachment');
            if (viewAttachmentBtn) {
                viewAttachmentBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    showImageModal(e.currentTarget.dataset.attachment, expense.description || 'مرفق مصروف');
                });
            }
            row.querySelector('.edit-expense').addEventListener('click', (e) => {
                openTransactionModal('expense', allExpenses.find(exp => exp._id === e.currentTarget.dataset.id));
            });
            row.querySelector('.delete-expense').addEventListener('click', (e) => {
                showConfirmationModal('هل أنت متأكد من حذف هذا المصروف؟', async () => {
                    await deleteTransaction('expense', e.currentTarget.dataset.id);
                });
            });
        });
    }

    /**
     * Renders the incomes table with provided data.
     * @param {Array<Object>} incomes - Array of income objects.
     */
    function renderIncomesTable(incomes) {
        incomesTableBody.innerHTML = ''; // Clear existing rows
        if (incomes.length === 0) {
            incomesTableBody.innerHTML = '<tr><td colspan="5">لا توجد إيرادات لهذا المشروع.</td></tr>';
            return;
        }

        incomes.forEach(income => {
            const row = incomesTableBody.insertRow();
            row.dataset.id = income._id; // Use _id from backend
            const actionsHtml = `
                <button class="btn-action edit-income" data-id="${income._id}"><i class="fas fa-edit"></i> تعديل</button>
                <button class="btn-action delete-income" data-id="${income._id}"><i class="fas fa-trash-alt"></i> حذف</button>
            `;
            row.innerHTML = `
                <td>${new Date(income.date).toLocaleDateString('ar-EG')}</td>
                <td>${income.amount.toFixed(2)} EGP</td>
                <td>${income.description || 'N/A'}</td>
                <td>${income.paymentMethod || 'N/A'}</td>
                <td class="actions">${actionsHtml}</td>
            `;

            row.querySelector('.edit-income').addEventListener('click', (e) => {
                openTransactionModal('income', allIncomes.find(inc => inc._id === e.currentTarget.dataset.id));
            });
            row.querySelector('.delete-income').addEventListener('click', (e) => {
                showConfirmationModal('هل أنت متأكد من حذف هذا الإيراد؟', async () => {
                    await deleteTransaction('income', e.currentTarget.dataset.id);
                });
            });
        });
    }

    /**
     * Updates the financial summary (total incomes, expenses, net profit/loss).
     * @param {Array<Object>} expensesData - Array of current expense objects.
     * @param {Array<Object>} incomesData - Array of current income objects.
     */
    function updateFinancialSummary(expensesData, incomesData) {
        const currentTotalExpenses = expensesData.reduce((sum, exp) => sum + (exp.amount || 0), 0);
        const currentTotalIncomes = incomesData.reduce((sum, inc) => sum + (inc.amount || 0), 0);
        const netProfitLoss = currentTotalIncomes - currentTotalExpenses;

        totalIncomesSpan.textContent = `${currentTotalIncomes.toFixed(2)} EGP`;
        totalExpensesSpan.textContent = `${currentTotalExpenses.toFixed(2)} EGP`;
        netProfitLossSpan.textContent = `${netProfitLoss.toFixed(2)} EGP`;
        netProfitLossSpan.style.color = (netProfitLoss >= 0) ? 'var(--color-success)' : 'var(--color-danger)';
    }

    // --- Functions for Modals & Forms ---

    /**
     * Opens the transaction modal (expense/income).
     * @param {string} type - 'expense' or 'income' to pre-select the tab.
     * @param {object|null} data - Existing transaction data for editing, or null for new.
     */
    async function openTransactionModal(type, data = null) {
        if (!transactionModal) return;

        transactionModal.style.display = 'flex';
        // Reset forms before populating
        addExpenseForm.reset();
        addIncomeForm.reset();
        expenseIdInput.value = '';
        incomeIdInput.value = '';
        expenseAttachmentInput.value = ''; // Clear file input

        // Set default dates to today
        const today = new Date().toISOString().split('T')[0];
        expenseDateInput.value = today;
        incomeDateInput.value = today;

        currentProjectNameModal.textContent = projectData ? projectData.name : 'المشروع'; // Set project name in modal header

        // Fetch dropdown data (vendors, categories, treasuries)
        await fetchVendorsAndCategoriesAndTreasuries();

        // Switch to correct tab and populate form fields
        if (type === 'expense') {
            expenseFormTab.classList.add('active');
            incomeFormTab.classList.remove('active');
            expenseFormPane.classList.add('active');
            incomeFormPane.classList.remove('active');

            modalTitle.textContent = `إضافة مصروف للمشروع: ${currentProjectNameModal.textContent}`;
            saveExpenseBtn.textContent = 'حفظ المصروف';

            if (data) { // Edit mode
                modalTitle.textContent = `تعديل مصروف للمشروع: ${currentProjectNameModal.textContent}`;
                saveExpenseBtn.textContent = 'تحديث المصروف';
                expenseIdInput.value = data._id;
                expenseAmountInput.value = data.amount;
                expenseDescriptionInput.value = data.description;
                expenseDateInput.value = new Date(data.date).toISOString().split('T')[0];
                expenseVendorSelect.value = data.vendorId ? data.vendorId._id : '';
                expenseCategorySelect.value = data.categoryId ? data.categoryId._id : '';
                expenseTreasurySelect.value = data.treasuryId ? data.treasuryId._id : ''; // Pre-fill treasury
            }
        } else if (type === 'income') {
            expenseFormTab.classList.remove('active');
            incomeFormTab.classList.add('active');
            expenseFormPane.classList.remove('active');
            incomeFormPane.classList.add('active');

            modalTitle.textContent = `إضافة إيراد للمشروع: ${currentProjectNameModal.textContent}`;
            saveIncomeBtn.textContent = 'حفظ الإيراد';

            if (data) { // Edit mode
                modalTitle.textContent = `تعديل إيراد للمشروع: ${currentProjectNameModal.textContent}`;
                saveIncomeBtn.textContent = 'تحديث الإيراد';
                incomeIdInput.value = data._id;
                incomeAmountInput.value = data.amount;
                incomeDescriptionInput.value = data.description;
                incomeDateInput.value = new Date(data.date).toISOString().split('T')[0];
                incomePaymentMethodSelect.value = data.paymentMethod || 'cash';
            }
        }
    }

    /**
     * Closes the transaction modal. Resets forms and active tab.
     */
    function closeTransactionModal() {
        if (transactionModal) {
            transactionModal.style.display = 'none';
            addExpenseForm.reset();
            addIncomeForm.reset();
            // Ensure expense tab is active by default when modal closes
            expenseFormTab.classList.add('active');
            incomeFormTab.classList.remove('active');
            expenseFormPane.classList.add('active');
            incomeFormPane.classList.remove('active');
        }
    }

    /**
     * Saves an expense or income transaction.
     * @param {string} type - 'expense' or 'income'.
     */
    async function saveTransaction(type) {
        const isEditing = type === 'expense' ? !!expenseIdInput.value : !!incomeIdInput.value;
        const transactionId = isEditing ? (type === 'expense' ? expenseIdInput.value : incomeIdInput.value) : null;

        let amount, description, date;
        let transactionData = { projectId: projectId };
        let apiEndpoint = '';
        let attachmentFile = null;

        if (type === 'expense') {
            amount = parseFloat(expenseAmountInput.value);
            description = expenseDescriptionInput.value.trim();
            date = expenseDateInput.value;
            const vendorId = expenseVendorSelect.value;
            const categoryId = expenseCategorySelect.value;
            const treasuryId = expenseTreasurySelect.value; // Get selected treasury ID
            attachmentFile = expenseAttachmentInput.files[0];

            if (isNaN(amount) || amount <= 0 || !description || !date || !vendorId || !categoryId || !treasuryId) {
                showToast("يرجى ملء جميع حقول المصروفات المطلوبة واختيار خزينة.", "error");
                return;
            }

            transactionData = {
                ...transactionData, // Includes projectId
                amount,
                description,
                date,
                vendorId,
                categoryId,
                treasuryId // Add treasury ID to data
            };
            apiEndpoint = '/expenses';
        } else { // type === 'income'
            amount = parseFloat(incomeAmountInput.value);
            description = incomeDescriptionInput.value.trim();
            date = incomeDateInput.value;
            const paymentMethod = incomePaymentMethodSelect.value;

            if (isNaN(amount) || amount <= 0 || !description || !date || !paymentMethod) {
                showToast('يرجى ملء جميع حقول الإيرادات المطلوبة.', 'error');
                return;
            }

            transactionData = {
                ...transactionData, // Includes projectId
                amount,
                description,
                date,
                paymentMethod
            };
            apiEndpoint = '/incomes';
        }

        // Handle file upload if present
        let formData = new FormData();
        formData.append('data', JSON.stringify(transactionData));
        if (attachmentFile) {
            formData.append('attachment', attachmentFile);
        }

        let response;
        try {
            if (isEditing) {
                response = await fetch(`${API_BASE_URL}${apiEndpoint}/${transactionId}`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${authToken}` },
                    body: formData // Use formData for file upload
                });
            } else {
                response = await fetch(`${API_BASE_URL}${apiEndpoint}`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${authToken}` },
                    body: formData // Use formData for file upload
                });
            }

            if (response.ok) {
                showToast(`تم ${isEditing ? 'تعديل' : 'إضافة'} ${type === 'expense' ? 'المصروف' : 'الإيراد'} بنجاح!`, 'success');
                closeTransactionModal();
                fetchExpensesAndIncomes(projectId); // Re-fetch and update tables
            } else {
                const errorData = await response.json();
                console.error(`Failed to save ${type}:`, response.status, errorData.message);
                showToast(errorData.message || `فشل ${isEditing ? 'تعديل' : 'إضافة'} ${type === 'expense' ? 'المصروف' : 'الإيراد'}.`, 'error');
            }
        } catch (error) {
            console.error(`Error saving ${type}:`, error);
            showToast('حدث خطأ في الاتصال بالخادم أثناء حفظ المعاملة.', 'error');
        }
    }

    /**
     * Deletes a transaction (expense or income).
     * @param {string} type - 'expense' or 'income'.
     * @param {string} transactionId - ID of the transaction to delete.
     */
    async function deleteTransaction(type, transactionId) {
        let apiEndpoint = `/${type}s/${transactionId}`;
        try {
            const response = await fetch(`${API_BASE_URL}${apiEndpoint}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (response.ok) {
                showToast(`تم حذف ${type === 'expense' ? 'المصروف' : 'الإيراد'} بنجاح.`, 'success');
                fetchExpensesAndIncomes(projectId); // Re-fetch and update tables
            } else {
                const errorData = await response.json();
                console.error(`Failed to delete ${type}:`, response.status, errorData.message);
                showToast(errorData.message || `فشل حذف ${type === 'expense' ? 'المصروف' : 'الإيراد'}.`, 'error');
            }
        } catch (error) {
            console.error(`Error deleting ${type}:`, error);
            showToast('حدث خطأ في الاتصال بالخادم أثناء حذف المعاملة.', 'error');
        }
    }


    // --- Functions for Populating Dropdowns ---

    /**
     * Fetches all contractors, categories, and treasuries for dropdowns.
     */
    async function fetchVendorsAndCategoriesAndTreasuries() {
        try {
            // Fetch Contractors
            const vendorsResponse = await fetch(`${API_BASE_URL}/contractors`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            contractorsData = await vendorsResponse.json();
            populateSelectOptions(expenseVendorSelect, contractorsData, 'name', 'اختر مقاول');

            // Fetch Categories
            const categoriesResponse = await fetch(`${API_BASE_URL}/categories`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            expenseCategoriesData = await categoriesResponse.json();
            populateSelectOptions(expenseCategorySelect, expenseCategoriesData, 'name', 'اختر تصنيف');

            // Fetch Treasuries
            const treasuriesResponse = await fetch(`${API_BASE_URL}/treasuries`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            treasuriesData = await treasuriesResponse.json();
            populateSelectOptions(expenseTreasurySelect, treasuriesData, 'name', 'اختر خزينة');

        } catch (error) {
            console.error('Error fetching dropdown data:', error);
            showToast('فشل جلب بيانات القوائم المنسدلة.', 'error');
        }
    }

    /**
     * Helper function to populate a select element.
     * @param {HTMLSelectElement} selectElement - The select element to populate.
     * @param {Array<Object>} optionsData - Array of objects to use as options.
     * @param {string} displayKey - The key whose value will be displayed as option text.
     * @param {string} defaultOptionText - Optional text for the default (first) option.
     */
    function populateSelectOptions(selectElement, optionsData, displayKey, defaultOptionText = '') {
        selectElement.innerHTML = '';
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = defaultOptionText;
        selectElement.appendChild(defaultOption);

        optionsData.forEach(item => {
            const option = document.createElement('option');
            option.value = item._id; // Use _id for the value
            option.textContent = item[displayKey];
            selectElement.appendChild(option);
        });
    }

    // --- Image Modal Functions ---
    function showImageModal(imageUrl, caption) {
        if (!imageModal) return;
        displayedImage.src = imageUrl;
        imageCaption.textContent = caption;
        imageModal.style.display = 'block';
    }

    if (closeImageModalBtn) {
        closeImageModalBtn.addEventListener('click', () => {
            if (imageModal) imageModal.style.display = 'none';
        });
    }

    // --- Excel Export Function ---
    async function exportProjectDataToExcel() {
        if (!projectData || allExpenses.length === 0 && allIncomes.length === 0) {
            showToast("لا توجد بيانات لتصديرها.", "warning");
            return;
        }

        try {
            const workbook = XLSX.utils.book_new();

            // Sheet 1: Project Details
            const projectDetailsData = [
                ["تفاصيل المشروع"],
                ["اسم المشروع", projectData.name || ''],
                ["العميل", projectData.client ? projectData.client.name : ''],
                ["المهندس المسؤول", projectData.engineerId ? projectData.engineerId.username : ''],
                ["العنوان", projectData.address || ''],
                ["الوصف", projectData.description || ''],
                ["تاريخ البدء", new Date(projectData.startDate).toLocaleDateString('ar-EG') || ''],
                ["تاريخ الانتهاء المتوقع", projectData.endDate ? new Date(projectData.endDate).toLocaleDateString('ar-EG') : ''],
                ["الحالة", projectData.status || ''],
                ["ملاحظات", projectData.notes || '']
            ];
            const wsDetails = XLSX.utils.aoa_to_sheet(projectDetailsData);
            XLSX.utils.book_append_sheet(workbook, wsDetails, "بيانات المشروع");

            // Sheet 2: Expenses
            const expensesHeaders = ["التاريخ", "المبلغ (جنيه)", "الوصف", "المقاول", "التصنيف", "الخزينة", "رابط المرفق"];
            const expensesRows = allExpenses.map(exp => [
                new Date(exp.date).toLocaleDateString('ar-EG'),
                exp.amount || 0,
                exp.description || '',
                exp.vendorId ? exp.vendorId.name : '',
                exp.categoryId ? exp.categoryId.name : '',
                exp.treasuryId ? exp.treasuryId.name : '', // Include treasury name
                exp.attachment || '' // Attachment URL
            ]);
            const wsExpenses = XLSX.utils.aoa_to_sheet([expensesHeaders, ...expensesRows]);
            XLSX.utils.book_append_sheet(workbook, wsExpenses, "المصروفات");

            // Sheet 3: Incomes
            const incomesHeaders = ["التاريخ", "المبلغ (جنيه)", "الوصف", "طريقة الدفع"];
            const incomesRows = allIncomes.map(inc => [
                new Date(inc.date).toLocaleDateString('ar-EG'),
                inc.amount || 0,
                inc.description || '',
                inc.paymentMethod || ''
            ]);
            const wsIncomes = XLSX.utils.aoa_to_sheet([incomesHeaders, ...incomesRows]);
            XLSX.utils.book_append_sheet(workbook, wsIncomes, "الإيرادات");

            // Sheet 4: Financial Summary
            const totalExpensesValue = allExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
            const totalIncomesValue = allIncomes.reduce((sum, inc) => sum + (inc.amount || 0), 0);
            const netProfitLossValue = totalIncomesValue - totalExpensesValue;

            const summaryData = [
                ["ملخص مالي"],
                ["إجمالي الإيرادات", `${totalIncomesValue.toFixed(2)} EGP`],
                ["إجمالي المصروفات", `${totalExpensesValue.toFixed(2)} EGP`],
                ["صافي الربح/الخسارة", `${netProfitLossValue.toFixed(2)} EGP`]
            ];
            const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
            XLSX.utils.book_append_sheet(workbook, wsSummary, "الملخص المالي");

            // Generate and download
            XLSX.writeFile(workbook, `تقرير_المشروع_${projectData.name || 'تفاصيل'}.xlsx`);
            showToast("تم تصدير البيانات إلى Excel بنLنجاح.", "success");

        } catch (error) {
            console.error("Error exporting data to Excel:", error);
            showToast("حدث خطأ أثناء تصدير البيانات إلى Excel.", "error");
        }
    }


    // --- Utility Functions (assumed from utils.js, included here as fallback) ---
    // Make sure these are defined in your utils.js or another globally available script.
    // If you explicitly do NOT have these, uncomment the definitions below.
    /*
    function showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toastContainer'); // Assuming you have a toast container
        if (!toastContainer) {
            console.warn('Toast container not found. Message:', message);
            alert(message); // Fallback to alert
            return;
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
    */

    /**
     * Custom Confirmation Modal (replaces browser's confirm()).
     * Assumes the HTML for `confirmationModal` is present in `project-details.html`.
     */
    function showConfirmationModal(message, onConfirm) {
        const confirmModal = document.getElementById('confirmationModal');
        const confirmMessageElement = confirmModal.querySelector('#confirm-message');
        const confirmYesBtn = confirmModal.querySelector('#confirm-yes-btn');
        const confirmNoBtn = confirmModal.querySelector('#confirm-no-btn');
        const closeConfirmModalBtn = confirmModal.querySelector('#closeConfirmationModal');

        confirmMessageElement.textContent = message;
        confirmModal.style.display = 'flex'; // Use 'flex' for centering

        const cleanup = () => {
            confirmYesBtn.removeEventListener('click', handleConfirm);
            confirmNoBtn.removeEventListener('click', handleCancel);
            closeConfirmModalBtn.removeEventListener('click', handleCancel);
            confirmModal.style.display = 'none';
        };

        const handleConfirm = () => {
            onConfirm();
            cleanup();
        };

        const handleCancel = () => {
            cleanup();
        };

        confirmYesBtn.addEventListener('click', handleConfirm);
        confirmNoBtn.addEventListener('click', handleCancel);
        closeConfirmModalBtn.addEventListener('click', handleCancel);

        // Close on outside click
        window.addEventListener('click', (e) => {
            if (e.target === confirmModal) {
                cleanup();
            }
        });
    }

    // Function to apply role-based visibility (assuming userRole is set)
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

});
