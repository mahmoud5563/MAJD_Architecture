// public/js/main-treasury.js

document.addEventListener('DOMContentLoaded', () => {
    const mainTreasuryBalanceDisplay = document.getElementById('mainTreasuryBalance');
    const depositBtn = document.getElementById('depositBtn');
    const withdrawBtn = document.getElementById('withdrawBtn');
    const transactionsTableBody = document.getElementById('transactionsTableBody');

    const treasuryOperationModal = document.getElementById('treasuryOperationModal');
    const closeTreasuryOperationModalBtn = document.getElementById('closeTreasuryOperationModal');
    const treasuryOperationModalTitle = document.getElementById('treasuryOperationModalTitle');
    const treasuryOperationForm = document.getElementById('treasuryOperationForm');
    const operationAmountInput = document.getElementById('operationAmount');
    const operationDescriptionInput = document.getElementById('operationDescription');
    const saveOperationBtn = document.getElementById('saveOperationBtn');

    const transactionSearchInput = document.getElementById('transactionSearch');
    const transactionTypeFilter = document.getElementById('transactionTypeFilter');
    const transactionStartDateFilter = document.getElementById('transactionStartDateFilter');
    const transactionEndDateFilter = document.getElementById('transactionEndDateFilter');
    const applyTransactionFiltersBtn = document.getElementById('applyTransactionFiltersBtn');
    const resetTransactionFiltersBtn = document.getElementById('resetTransactionFiltersBtn');

    const API_BASE_URL = 'https://7500-156-203-135-174.ngrok-free.app/api';
    let currentOperationType = ''; // 'deposit' or 'withdrawal'

    // Check user role and redirect if not authorized
    const currentUserRole = localStorage.getItem('userRole');
    if (currentUserRole !== 'admin' && currentUserRole !== 'account_manager') {
        showToast('ليس لديك صلاحية للوصول إلى هذه الصفحة.', 'error');
        window.location.href = 'dashboard.html';
        return;
    }

    // Function to fetch main treasury balance
    async function fetchMainTreasuryBalance() {
        const authToken = localStorage.getItem('authToken');
        try {
            const response = await fetch(`${API_BASE_URL}/treasuries?type=main`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });

            if (response.ok) {
                const treasuries = await response.json();
                if (treasuries.length > 0) {
                    mainTreasuryBalanceDisplay.textContent = `${treasuries[0].balance.toFixed(2)} EGP`;
                } else {
                    mainTreasuryBalanceDisplay.textContent = '0.00 EGP (الخزينة الرئيسية غير موجودة)';
                    showToast('تنبيه: الخزينة الرئيسية غير موجودة. يرجى التأكد من إعدادها في الباك إند.', 'info');
                }
            } else {
                const errorData = await response.json();
                showToast(errorData.message || 'فشل جلب رصيد الخزينة الرئيسية.', 'error');
            }
        } catch (error) {
            console.error('Error fetching main treasury balance:', error);
            showToast('حدث خطأ في الاتصال بالخادم أثناء جلب الرصيد.', 'error');
        }
    }

    // Function to fetch all transactions
    async function fetchTransactions() {
        const authToken = localStorage.getItem('authToken');
        if (!authToken) return;

        const searchTerm = transactionSearchInput.value;
        const typeFilter = transactionTypeFilter.value;
        const startDate = transactionStartDateFilter.value;
        const endDate = transactionEndDateFilter.value;

        let queryParams = new URLSearchParams();
        if (searchTerm) queryParams.append('search', searchTerm);
        if (typeFilter) queryParams.append('type', typeFilter);
        if (startDate) queryParams.append('startDate', startDate);
        if (endDate) queryParams.append('endDate', endDate);

        try {
            const response = await fetch(`${API_BASE_URL}/transactions?${queryParams.toString()}`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });

            if (!response.ok) {
                const errorData = await response.json();
                showToast(errorData.message || 'فشل جلب سجل المعاملات.', 'error');
                return;
            }

            const transactions = await response.json();
            renderTransactions(transactions);
        } catch (error) {
            console.error('Error fetching transactions:', error);
            showToast('حدث خطأ أثناء جلب سجل المعاملات.', 'error');
        }
    }

    // Function to render transactions in the table
    function renderTransactions(transactions) {
        transactionsTableBody.innerHTML = '';
        if (transactions.length === 0) {
            transactionsTableBody.innerHTML = '<tr><td colspan="7">لا توجد معاملات مطابقة للفلاتر.</td></tr>';
            return;
        }

        transactions.forEach(transaction => {
            const row = document.createElement('tr');
            let typeText = '';
            let relatedParty = '';
            let relatedProjectName = '';

            switch (transaction.type) {
                case 'deposit_main': typeText = 'إيداع (رئيسية)'; break;
                case 'withdrawal_main': typeText = 'سحب (رئيسية)'; break;
                case 'custody_assignment': typeText = 'تعيين عهدة'; break;
                case 'expense_from_custody': typeText = 'مصروف من عهدة'; break;
                case 'income_to_main': typeText = 'إيراد مشروع'; break;
                case 'project_expense': typeText = 'مصروف مشروع (غير مباشر)'; break; // للمصروفات التي لا تخرج من عهدة المهندس
                case 'income_to_custody': typeText = 'استلام عهدة (مهندس)'; break; // هذا يظهر فقط للمهندس في صفحته، هنا للآدمن/مدير الحسابات
                default: typeText = transaction.type;
            }

            if (transaction.relatedUser) {
                relatedParty = transaction.relatedUser.username;
            } else if (transaction.treasury && transaction.treasury.name) {
                relatedParty = transaction.treasury.name; // For treasury names
            } else {
                relatedParty = 'غير محدد';
            }

            if (transaction.relatedProject) {
                relatedProjectName = transaction.relatedProject.name;
            } else {
                relatedProjectName = 'لا يوجد';
            }

            const createdBy = transaction.createdBy ? transaction.createdBy.username : 'غير محدد';

            row.innerHTML = `
                <td>${new Date(transaction.date).toLocaleDateString('ar-EG')}</td>
                <td>${transaction.amount.toFixed(2)}</td>
                <td>${typeText}</td>
                <td class="transaction-description">${transaction.description}</td>
                <td>${relatedParty}</td>
                <td>${relatedProjectName}</td>
                <td>${createdBy}</td>
            `;
            transactionsTableBody.appendChild(row);
        });
    }

    // Open deposit/withdrawal modal
    if (depositBtn) {
        depositBtn.addEventListener('click', () => {
            openTreasuryOperationModal('deposit');
        });
    }

    if (withdrawBtn) {
        withdrawBtn.addEventListener('click', () => {
            openTreasuryOperationModal('withdrawal');
        });
    }

    function openTreasuryOperationModal(type) {
        currentOperationType = type;
        treasuryOperationModalTitle.textContent = type === 'deposit' ? 'إيداع أموال' : 'سحب أموال';
        saveOperationBtn.textContent = type === 'deposit' ? 'تأكيد الإيداع' : 'تأكيد السحب';
        operationAmountInput.value = '';
        operationDescriptionInput.value = '';
        treasuryOperationModal.style.display = 'flex';
    }

    // Close modal
    if (closeTreasuryOperationModalBtn) {
        closeTreasuryOperationModalBtn.addEventListener('click', () => {
            treasuryOperationModal.style.display = 'none';
        });
    }
    if (treasuryOperationModal) {
        window.addEventListener('click', (e) => {
            if (e.target === treasuryOperationModal) {
                treasuryOperationModal.style.display = 'none';
            }
        });
    }

    // Handle form submission for deposit/withdrawal
    if (treasuryOperationForm) {
        treasuryOperationForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const amount = parseFloat(operationAmountInput.value);
            const description = operationDescriptionInput.value.trim();

            if (!amount || amount <= 0 || !description) {
                showToast('الرجاء ملء جميع الحقول بمبلغ صحيح ووصف.', 'error');
                return;
            }

            const authToken = localStorage.getItem('authToken');
            let endpoint = '';

            if (currentOperationType === 'deposit') {
                endpoint = `${API_BASE_URL}/treasuries/deposit`;
            } else if (currentOperationType === 'withdrawal') {
                endpoint = `${API_BASE_URL}/treasuries/withdrawal`;
            }

            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify({ amount, description })
                });

                if (response.ok) {
                    showToast(`تمت عملية ${currentOperationType === 'deposit' ? 'الإيداع' : 'السحب'} بنجاح!`, 'success');
                    treasuryOperationModal.style.display = 'none';
                    fetchMainTreasuryBalance(); // Refresh balance
                    fetchTransactions(); // Refresh transactions
                } else {
                    const errorData = await response.json();
                    console.error('Failed to perform treasury operation:', response.status, errorData.message);
                    showToast(errorData.message || `فشل عملية ${currentOperationType === 'deposit' ? 'الإيداع' : 'السحب'}.`, 'error');
                }
            } catch (error) {
                console.error('Error performing treasury operation:', error);
                showToast('حدث خطأ في الاتصال بالخادم أثناء عملية الخزينة.', 'error');
            }
        });
    }

    // Filter and search event listeners
    if (applyTransactionFiltersBtn) {
        applyTransactionFiltersBtn.addEventListener('click', fetchTransactions);
    }
    if (resetTransactionFiltersBtn) {
        resetTransactionFiltersBtn.addEventListener('click', () => {
            transactionSearchInput.value = '';
            transactionTypeFilter.value = '';
            transactionStartDateFilter.value = '';
            transactionEndDateFilter.value = '';
            fetchTransactions();
        });
    }
    if (transactionSearchInput) {
        transactionSearchInput.addEventListener('input', () => {
            setTimeout(fetchTransactions, 500); // Debounce search
        });
    }
    if (transactionTypeFilter) {
        transactionTypeFilter.addEventListener('change', fetchTransactions);
    }
    if (transactionStartDateFilter) {
        transactionStartDateFilter.addEventListener('change', fetchTransactions);
    }
    if (transactionEndDateFilter) {
        transactionEndDateFilter.addEventListener('change', fetchTransactions);
    }

    // Initial data load
    fetchMainTreasuryBalance();
    fetchTransactions();
});
