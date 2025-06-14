// public/js/projects.js

document.addEventListener('DOMContentLoaded', async () => {
    // Get user info from localStorage (assuming auth.js handles this)
    const authToken = localStorage.getItem('authToken');
    const userRole = localStorage.getItem('userRole');

    // --- DOM Elements ---
    // Header
    const usernameDisplay = document.getElementById('usernameDisplay');
    const logoutBtn = document.getElementById('logoutBtn');
    const logoutBtnDropdown = document.getElementById('logoutBtnDropdown');
    const toggleSidebarBtn = document.querySelector('.toggle-sidebar-btn');
    const sidebar = document.querySelector('.sidebar');

    // Projects Table & Filters
    const projectSearchInput = document.getElementById('projectSearchInput');
    const projectFilterStatus = document.getElementById('projectFilterStatus');
    const projectFilterEngineer = document.getElementById('projectFilterEngineer');
    const projectFilterClient = document.getElementById('projectFilterClient');
    const addProjectBtn = document.querySelector('.add-project-btn');
    const projectsTableBody = document.getElementById('projectsTableBody');

    // NEW: Transaction Selection Modal Elements
    const transactionSelectionModal = document.getElementById('transactionSelectionModal');
    const transactionSelectionModalTitle = document.getElementById('transactionSelectionModalTitle');
    const currentProjectNameTransactionModal = document.getElementById('currentProjectNameTransactionModal');
    const addExpenseOptionBtn = document.getElementById('addExpenseOptionBtn');
    const addRevenueOptionBtn = document.getElementById('addRevenueOptionBtn');
    const closeTransactionSelectionModalBtn = transactionSelectionModal ? transactionSelectionModal.querySelector('.close-button') : null;

    // Expense Modal Elements
    const expenseModal = document.getElementById('expenseModal');
    const expenseModalTitle = document.getElementById('expenseModalTitle');
    const currentProjectNameExpenseModal = document.getElementById('currentProjectNameExpenseModal');
    const closeExpenseModalBtn = expenseModal ? expenseModal.querySelector('.close-button') : null;
    const expenseForm = document.getElementById('expenseForm');
    const expenseIdInput = document.getElementById('expenseId');
    const modalProjectIdInput = document.getElementById('modalProjectId'); // Hidden field for project ID in modal
    const expenseAmountInput = document.getElementById('expenseAmount');
    const expenseDescriptionInput = document.getElementById('expenseDescription');
    const expenseDateInput = document.getElementById('expenseDate');
    const expenseCategorySelect = document.getElementById('expenseCategory');
    const expenseTreasurySelect = document.getElementById('expenseTreasurySelect');
    const expenseAttachmentInput = document.getElementById('expenseAttachment');
    const saveExpenseBtn = document.getElementById('saveExpenseBtn');

    // NEW: Revenue Modal Elements
    const revenueModal = document.getElementById('revenueModal');
    const revenueModalTitle = document.getElementById('revenueModalTitle');
    const currentProjectNameRevenueModal = document.getElementById('currentProjectNameRevenueModal');
    const closeRevenueModalBtn = revenueModal ? revenueModal.querySelector('.close-button') : null;
    const revenueForm = document.getElementById('revenueForm');
    const revenueIdInput = document.getElementById('revenueId');
    const modalRevenueProjectIdInput = document.getElementById('modalRevenueProjectId');
    const revenueAmountInput = document.getElementById('revenueAmount');
    const revenueDescriptionInput = document.getElementById('revenueDescription');
    const revenueDateInput = document.getElementById('revenueDate');
    const revenueAttachmentInput = document.getElementById('revenueAttachment');
    const saveRevenueBtn = document.getElementById('saveRevenueBtn');

    // Loader and Message Containers
    const projectsLoader = document.getElementById('projects-loader');
    const projectsMessage = document.getElementById('projects-message');

    // --- Data Storage ---
    let allProjects = []; // Stores all fetched projects for filtering
    let engineers = []; // Stores engineers for filter dropdown
    let clients = [];   // Stores clients for filter dropdown

    // Temp storage for projectId and projectName when moving between modals
    let currentTransactionProjectId = null;
    let currentTransactionProjectName = '';

    // --- Base URL for API requests ---
    const API_BASE_URL = 'https://6943-156-203-135-174.ngrok-free.app/api';

    // --- Helper Functions (assuming they are in utils.js or defined here if not) ---
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
    if (!authToken) {
        window.location.href = 'index.html'; // Redirect to login
        return;
    }

    // Set username from localStorage
    if (usernameDisplay) {
        usernameDisplay.textContent = localStorage.getItem('username') || 'المستخدم';
    }

    // Sidebar Toggle
    if (toggleSidebarBtn) {
        toggleSidebarBtn.addEventListener('click', () => {
            if (sidebar) {
                sidebar.classList.toggle('active');
            }
        });
    }

    // Logout functionality
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            handleLogout();
        });
    }
    if (logoutBtnDropdown) {
        logoutBtnDropdown.addEventListener('click', () => {
            handleLogout();
        });
    }

    function handleLogout() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userRole');
        localStorage.removeItem('username');
        localStorage.removeItem('userId');
        window.location.href = 'index.html';
    }

    // --- Main Data Fetching Function ---
    async function fetchProjectsAndFilters() {
        showLoader(projectsLoader);
        hideMessage(projectsMessage);

        try {
            // Fetch Projects
            const projectsResponse = await fetch(`${API_BASE_URL}/projects`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (!projectsResponse.ok) {
                const errorData = await projectsResponse.json();
                showMessage(projectsMessage, 'error', errorData.message || 'فشل جلب المشاريع.');
                throw new Error(errorData.message || 'فشل جلب المشاريع.');
            }
            allProjects = await projectsResponse.json();
            renderProjects(allProjects);

            // Fetch Engineers for filter
            const engineersResponse = await fetch(`${API_BASE_URL}/engineers`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (engineersResponse.ok) {
                engineers = await engineersResponse.json();
                populateFilterDropdown(projectFilterEngineer, engineers, 'name', 'جميع المهندسين');
            } else {
                console.error('Failed to fetch engineers for filter.');
            }

            // Fetch Clients for filter
            const clientsResponse = await fetch(`${API_BASE_URL}/clients`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (clientsResponse.ok) {
                clients = await clientsResponse.json();
                populateFilterDropdown(projectFilterClient, clients, 'name', 'جميع العملاء');
            } else {
                console.error('Failed to fetch clients for filter.');
            }

            if (allProjects.length === 0) {
                showMessage(projectsMessage, 'info', 'لا توجد مشاريع لعرضها.');
            }

        } catch (error) {
            console.error('Error fetching projects and filters:', error);
            if (!projectsMessage.style.display || projectsMessage.style.display === 'none') {
                showMessage(projectsMessage, 'error', 'حدث خطأ في الاتصال بالخادم أثناء جلب البيانات.');
            }
            if (error.message.includes('401') || error.message.includes('403')) {
                if (typeof showToast !== 'undefined') {
                    showToast('انتهت الجلسة أو ليس لديك صلاحية. جارٍ إعادة التوجيه لتسجيل الدخول.', 'error');
                } else {
                    alert('انتهت الجلسة أو ليس لديك صلاحية. جارٍ إعادة التوجيه لتسجيل الدخول.');
                }
                localStorage.removeItem('authToken');
                localStorage.removeItem('userRole');
                localStorage.removeItem('username');
                localStorage.removeItem('userId');
                setTimeout(() => { window.location.href = 'index.html'; }, 2000);
            }
        } finally {
            hideLoader(projectsLoader);
            applyRoleBasedVisibility();
        }
    }

    // --- Rendering Functions ---
    function renderProjects(projectsToRender) {
        if (!projectsTableBody) return;
        projectsTableBody.innerHTML = ''; // Clear existing rows

        if (projectsToRender.length === 0) {
            projectsTableBody.innerHTML = `<tr><td colspan="8">لا توجد مشاريع مطابقة لمعايير البحث/الفلترة.</td></tr>`;
            return;
        }

        projectsToRender.forEach(project => {
            const row = document.createElement('tr');
            const clientName = project.client ? project.client.name : 'غير محدد';
            const engineerName = project.engineer ? project.engineer.name : 'غير محدد';
            const startDate = project.startDate ? new Date(project.startDate).toLocaleDateString('ar-EG') : 'غير محدد';
            const endDate = project.endDate ? new Date(project.endDate).toLocaleDateString('ar-EG') : 'غير محدد';
            const budget = typeof formatNumber !== 'undefined' ? formatNumber(project.budget) : `${project.budget} EGP`;

            // Changed button to open transaction selection modal
            const actionsHtml = `
                <div class="action-buttons">
                    <a href="project-details.html?id=${project._id}" class="btn btn-sm btn-view" data-access-role="admin,account_manager,engineer"><i class="fas fa-eye"></i> عرض</a>
                    <button class="btn btn-sm btn-edit edit-project-btn" data-id="${project._id}" data-access-role="admin,account_manager,engineer"><i class="fas fa-edit"></i> تعديل</button>
                    <button class="btn btn-sm btn-delete delete-project-btn" data-id="${project._id}" data-access-role="admin,account_manager"><i class="fas fa-trash-alt"></i> حذف</button>
                    <button class="btn btn-sm btn-add-transaction add-transaction-to-project-btn" data-id="${project._id}" data-name="${project.name}" data-access-role="admin,account_manager,engineer"><i class="fas fa-plus"></i> إضافة معاملة</button>
                </div>
            `;

            row.innerHTML = `
                <td>${project.name}</td>
                <td>${clientName}</td>
                <td>${engineerName}</td>
                <td>${startDate}</td>
                <td>${endDate}</td>
                <td>${project.status}</td>
                <td>${budget}</td>
                <td>${actionsHtml}</td>
            `;
            projectsTableBody.appendChild(row);
        });

        addProjectActionListeners();
    }

    function populateFilterDropdown(selectElement, data, nameField, defaultOptionText) {
        selectElement.innerHTML = `<option value="">${defaultOptionText}</option>`;
        data.forEach(item => {
            const option = document.createElement('option');
            option.value = item._id;
            option.textContent = item[nameField];
            selectElement.appendChild(option);
        });
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

    // --- Filtering and Searching ---
    function filterAndSearchProjects() {
        const searchTerm = projectSearchInput.value.toLowerCase();
        const statusFilter = projectFilterStatus.value;
        const engineerFilter = projectFilterEngineer.value;
        const clientFilter = projectFilterClient.value;

        const filteredProjects = allProjects.filter(project => {
            const matchesSearch = project.name.toLowerCase().includes(searchTerm) ||
                                  (project.client && project.client.name.toLowerCase().includes(searchTerm)) ||
                                  (project.engineer && project.engineer.name.toLowerCase().includes(searchTerm));
            const matchesStatus = statusFilter === '' || project.status === statusFilter;
            const matchesEngineer = engineerFilter === '' || (project.engineer && project.engineer._id === engineerFilter);
            const matchesClient = clientFilter === '' || (project.client && project.client._id === clientFilter);

            return matchesSearch && matchesStatus && matchesEngineer && matchesClient;
        });

        renderProjects(filteredProjects);
        if (filteredProjects.length === 0) {
            showMessage(projectsMessage, 'info', 'لا توجد مشاريع مطابقة لمعايير البحث/الفلترة.');
        } else {
            hideMessage(projectsMessage);
        }
    }

    if (projectSearchInput) projectSearchInput.addEventListener('input', filterAndSearchProjects);
    if (projectFilterStatus) projectFilterStatus.addEventListener('change', filterAndSearchProjects);
    if (projectFilterEngineer) projectFilterEngineer.addEventListener('change', filterAndSearchProjects);
    if (projectFilterClient) projectFilterClient.addEventListener('change', filterAndSearchProjects);


    // --- Event Listeners for Project Actions ---
    function addProjectActionListeners() {
        // Edit Project Button
        document.querySelectorAll('.edit-project-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const projectIdToEdit = e.currentTarget.dataset.id;
                // Redirect to add-project.html with project ID for editing
                window.location.href = `add-project.html?id=${projectIdToEdit}`;
            });
        });

        // Delete Project Button
        document.querySelectorAll('.delete-project-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const projectIdToDelete = e.currentTarget.dataset.id;
                showConfirmationModal('هل أنت متأكد من حذف هذا المشروع؟ هذا الإجراء لا يمكن التراجع عنه وسيحذف جميع بياناته (إيرادات، مصروفات، مستخلصات).', async () => {
                    await deleteProject(projectIdToDelete);
                });
            });
        });

        // NEW: Add Transaction Button for a specific project
        document.querySelectorAll('.add-transaction-to-project-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                currentTransactionProjectId = e.currentTarget.dataset.id;
                currentTransactionProjectName = e.currentTarget.dataset.name;
                openTransactionSelectionModal(currentTransactionProjectId, currentTransactionProjectName);
            });
        });
    }

    // Handle Add New Project button
    if (addProjectBtn) {
        addProjectBtn.addEventListener('click', () => {
            window.location.href = 'add-project.html'; // Direct to the add project page
        });
    }

    // --- Delete Project Function ---
    async function deleteProject(projectIdToDelete) {
        try {
            showLoader(projectsLoader); // Show loader during deletion
            const response = await fetch(`${API_BASE_URL}/projects/${projectIdToDelete}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${authToken}` }
            });

            if (response.ok) {
                if (typeof showToast !== 'undefined') showToast('تم حذف المشروع بنجاح.', 'success');
                fetchProjectsAndFilters(); // Re-fetch and re-render projects
            } else {
                const errorData = await response.json();
                console.error('Failed to delete project:', response.status, errorData.message);
                if (typeof showToast !== 'undefined') showToast(errorData.message || 'فشل حذف المشروع.', 'error');
            }
        } catch (error) {
            console.error('Error deleting project:', error);
            if (typeof showToast !== 'undefined') showToast('حدث خطأ أثناء حذف المشروع.', 'error');
        } finally {
            hideLoader(projectsLoader); // Hide loader after deletion attempt
        }
    }


    // --- NEW: Transaction Selection Modal Functions ---
    function openTransactionSelectionModal(projectId, projectName) {
        if (!transactionSelectionModal) return;
        currentProjectNameTransactionModal.textContent = projectName;
        transactionSelectionModal.style.display = 'block';
    }

    function closeTransactionSelectionModal() {
        if (transactionSelectionModal) {
            transactionSelectionModal.style.display = 'none';
            currentTransactionProjectId = null;
            currentTransactionProjectName = '';
        }
    }

    if (closeTransactionSelectionModalBtn) {
        closeTransactionSelectionModalBtn.addEventListener('click', closeTransactionSelectionModal);
    }
    if (transactionSelectionModal) {
        window.addEventListener('click', (e) => {
            if (e.target === transactionSelectionModal) {
                closeTransactionSelectionModal();
            }
        });
    }

    // Event listeners for choosing transaction type
    if (addExpenseOptionBtn) {
        addExpenseOptionBtn.addEventListener('click', () => {
            closeTransactionSelectionModal(); // Close selection modal
            openExpenseModal('add', currentTransactionProjectId, currentTransactionProjectName);
        });
    }
    if (addRevenueOptionBtn) {
        addRevenueOptionBtn.addEventListener('click', () => {
            closeTransactionSelectionModal(); // Close selection modal
            openRevenueModal('add', currentTransactionProjectId, currentTransactionProjectName);
        });
    }

    // --- Expense Modal Functions ---

    // Open Expense Modal for adding/editing
    async function openExpenseModal(mode = 'add', projectIdToAssociate = null, projectNameToAssociate = '') {
        if (!expenseModal) return;

        expenseModal.style.display = 'block';
        expenseForm.reset(); // Clear form fields

        // Set the hidden project ID
        modalProjectIdInput.value = projectIdToAssociate;
        currentProjectNameExpenseModal.textContent = projectNameToAssociate;

        // Populate Categories and Treasuries
        await fetchCategoriesForExpenseModal();
        await fetchTreasuriesForExpenseModal();

        if (mode === 'add') {
            expenseModalTitle.textContent = `إضافة مصروف جديد للمشروع: ${projectNameToAssociate}`;
            saveExpenseBtn.textContent = 'حفظ المصروف';
            expenseIdInput.value = ''; // Ensure no expense ID is set for new entries
        }
    }

    // Close Expense Modal
    function closeExpenseModal() {
        if (expenseModal) {
            expenseModal.style.display = 'none';
            expenseForm.reset();
        }
    }

    if (closeExpenseModalBtn) {
        closeExpenseModalBtn.addEventListener('click', closeExpenseModal);
    }
    // Added for outside click closing
    if (expenseModal) {
        window.addEventListener('click', (e) => {
            if (e.target === expenseModal) {
                closeExpenseModal();
            }
        });
    }

    async function fetchCategoriesForExpenseModal() {
        try {
            const categoriesResponse = await fetch(`${API_BASE_URL}/categories`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (!categoriesResponse.ok) {
                throw new Error('فشل جلب التصنيفات.');
            }
            const categories = await categoriesResponse.json();
            expenseCategorySelect.innerHTML = '<option value="">اختر تصنيف</option>';
            categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category._id;
                option.textContent = category.name;
                expenseCategorySelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error fetching categories for expense modal:', error);
            if (typeof showToast !== 'undefined') showToast('فشل جلب بيانات التصنيفات لمودال المصروفات.', 'error');
        }
    }

    async function fetchTreasuriesForExpenseModal() {
        try {
            const treasuriesResponse = await fetch(`${API_BASE_URL}/treasuries`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (!treasuriesResponse.ok) {
                throw new Error('فشل جلب الخزائن.');
            }
            const treasuries = await treasuriesResponse.json();
            expenseTreasurySelect.innerHTML = '<option value="">اختر خزينة</option>';
            treasuries.forEach(treasury => {
                const option = document.createElement('option');
                option.value = treasury._id;
                option.textContent = treasury.name;
                expenseTreasurySelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error fetching treasuries for expense modal:', error);
            if (typeof showToast !== 'undefined') showToast('فشل جلب بيانات الخزائن لمودال المصروفات.', 'error');
        }
    }


    // Handle saving (adding) an expense
    if (saveExpenseBtn) {
        saveExpenseBtn.addEventListener('click', async (e) => {
            e.preventDefault();

            const projectIdForExpense = modalProjectIdInput.value; // Get the associated project ID
            const amount = parseFloat(expenseAmountInput.value);
            const description = expenseDescriptionInput.value.trim();
            const date = expenseDateInput.value;
            const categoryId = expenseCategorySelect.value;
            const treasuryId = expenseTreasurySelect.value;

            if (!projectIdForExpense || !amount || !date || !categoryId || !treasuryId) {
                if (typeof showToast !== 'undefined') showToast('الرجاء ملء جميع الحقول المطلوبة لإضافة المصروف.', 'error');
                return;
            }
            if (isNaN(amount) || amount <= 0) {
                if (typeof showToast !== 'undefined') showToast('المبلغ المدفوع يجب أن يكون رقماً موجباً.', 'error');
                return;
            }

            const expenseData = {
                projectId: projectIdForExpense,
                categoryId: categoryId,
                treasuryId: treasuryId,
                amount: amount,
                description: description,
                date: date,
            };

            let response;
            try {
                response = await fetch(`${API_BASE_URL}/expenses`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify(expenseData)
                });

                if (response.ok) {
                    if (typeof showToast !== 'undefined') showToast('تم حفظ المصروف بنجاح!', 'success');
                    closeExpenseModal();
                    fetchProjectsAndFilters(); // Re-fetch projects to update financial summaries/data
                } else {
                    const errorData = await response.json();
                    console.error('Failed to save expense:', response.status, errorData.message);
                    if (typeof showToast !== 'undefined') showToast(errorData.message || 'فشل حفظ المصروف.', 'error');
                }
            } catch (error) {
                console.error('Error saving expense:', error);
                if (typeof showToast !== 'undefined') showToast('حدث خطأ في الاتصال بالخادم أثناء حفظ المصروف.', 'error');
            }
        });
    }

    // --- NEW: Revenue Modal Functions ---

    // Open Revenue Modal for adding/editing
    async function openRevenueModal(mode = 'add', projectIdToAssociate = null, projectNameToAssociate = '') {
        if (!revenueModal) return;

        revenueModal.style.display = 'block';
        revenueForm.reset(); // Clear form fields

        // Set the hidden project ID
        modalRevenueProjectIdInput.value = projectIdToAssociate;
        currentProjectNameRevenueModal.textContent = projectNameToAssociate;

        if (mode === 'add') {
            revenueModalTitle.textContent = `إضافة إيراد جديد للمشروع: ${projectNameToAssociate}`;
            saveRevenueBtn.textContent = 'حفظ الإيراد';
            revenueIdInput.value = ''; // Ensure no revenue ID is set for new entries
        }
    }

    // Close Revenue Modal
    function closeRevenueModal() {
        if (revenueModal) {
            revenueModal.style.display = 'none';
            revenueForm.reset();
        }
    }

    if (closeRevenueModalBtn) {
        closeRevenueModalBtn.addEventListener('click', closeRevenueModal);
    }
    // Added for outside click closing
    if (revenueModal) {
        window.addEventListener('click', (e) => {
            if (e.target === revenueModal) {
                closeRevenueModal();
            }
        });
    }

    // Handle saving (adding) a revenue
    if (saveRevenueBtn) {
        saveRevenueBtn.addEventListener('click', async (e) => {
            e.preventDefault();

            const projectIdForRevenue = modalRevenueProjectIdInput.value; // Get the associated project ID
            const amount = parseFloat(revenueAmountInput.value);
            const description = revenueDescriptionInput.value.trim();
            const date = revenueDateInput.value;

            if (!projectIdForRevenue || !amount || !date) {
                if (typeof showToast !== 'undefined') showToast('الرجاء ملء جميع الحقول المطلوبة لإضافة الإيراد.', 'error');
                return;
            }
            if (isNaN(amount) || amount <= 0) {
                if (typeof showToast !== 'undefined') showToast('المبلغ المدفوع يجب أن يكون رقماً موجباً.', 'error');
                return;
            }

            const revenueData = {
                projectId: projectIdForRevenue,
                amount: amount,
                description: description,
                date: date,
            };

            let response;
            try {
                response = await fetch(`${API_BASE_URL}/revenues`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify(revenueData)
                });

                if (response.ok) {
                    if (typeof showToast !== 'undefined') showToast('تم حفظ الإيراد بنجاح!', 'success');
                    closeRevenueModal();
                    fetchProjectsAndFilters(); // Re-fetch projects to update financial summaries/data
                } else {
                    const errorData = await response.json();
                    console.error('Failed to save revenue:', response.status, errorData.message);
                    if (typeof showToast !== 'undefined') showToast(errorData.message || 'فشل حفظ الإيراد.', 'error');
                }
            } catch (error) {
                console.error('Error saving revenue:', error);
                if (typeof showToast !== 'undefined') showToast('حدث خطأ في الاتصال بالخادم أثناء حفظ الإيراد.', 'error');
            }
        });
    }


    // Custom Confirmation Modal (replaces browser's confirm())
    function showConfirmationModal(message, onConfirm) {
        const modalHtml = `
            <div id="confirmationModal" class="modal">
                <div class="modal-content">
                    <span class="close-button" id="closeConfirmationModal">&times;</span>
                    <p id="confirm-message">${message}</p>
                    <div class="modal-actions">
                        <button class="btn btn-danger" id="confirm-yes-btn">نعم</button>
                        <button class="btn btn-secondary" id="confirm-no-btn">إلغاء</button>
                    </div>
                </div>
            </div>
        `;

        if (!document.getElementById('confirmationModal')) {
            document.body.insertAdjacentHTML('beforeend', modalHtml);
        }

        const confirmModal = document.getElementById('confirmationModal');
        const confirmMessageElement = document.getElementById('confirm-message');
        const confirmYesBtn = document.getElementById('confirm-yes-btn');
        const confirmNoBtn = document.getElementById('confirm-no-btn');
        const closeConfirmModalBtn = document.getElementById('closeConfirmationModal');

        confirmMessageElement.textContent = message;
        confirmModal.style.display = 'block';

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

        window.addEventListener('click', (e) => {
            if (e.target === confirmModal) {
                cleanup();
            }
        });
    }


    // Initial data fetch
    fetchProjectsAndFilters();
});
