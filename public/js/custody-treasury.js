// public/js/custody-treasury.js

document.addEventListener('DOMContentLoaded', () => {
    const engineerSelect = document.getElementById('engineerSelect');
    const custodyAmountInput = document.getElementById('custodyAmount');
    const custodyDescriptionInput = document.getElementById('custodyDescription');
    const assignCustodyForm = document.getElementById('assignCustodyForm');
    const custodyTransactionsTableBody = document.getElementById('custodyTransactionsTableBody');
    const custodyBalanceDisplay = document.getElementById('custodyBalanceDisplay'); // لعرض رصيد العهدة للمهندس

    const API_BASE_URL = 'https://7500-156-203-135-174.ngrok-free.app/api'; // تم التحديث إلى localhost

    const currentUserRole = localStorage.getItem('userRole');
    const currentUserId = localStorage.getItem('userId');

    // إخفاء/إظهار أقسام بناءً على الدور
    const adminManagerOnlyElements = document.querySelectorAll('.admin-manager-only');
    if (currentUserRole === 'engineer') {
        adminManagerOnlyElements.forEach(el => el.style.display = 'none');
    }

    // Function to fetch engineers for the dropdown
    async function fetchEngineersForDropdown() {
        const authToken = localStorage.getItem('authToken');
        if (!authToken) return;

        try {
            const response = await fetch(`${API_BASE_URL}/users?role=engineer`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            const engineers = await response.json();

            engineerSelect.innerHTML = '<option value="">اختر مهندس</option>';
            engineers.forEach(engineer => {
                const option = document.createElement('option');
                option.value = engineer._id;
                option.textContent = engineer.username;
                engineerSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error fetching engineers:', error);
            showToast('فشل جلب قائمة المهندسين.', 'error');
        }
    }

    // Function to fetch custody assignments/transactions
    async function fetchCustodyTransactions() {
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            window.location.href = 'index.html';
            return;
        }

        let endpoint = `${API_BASE_URL}/transactions?type=custody_assignment`; // جلب كل معاملات العهدة
        if (currentUserRole === 'engineer') {
            // المهندس يرى فقط المعاملات التي هو طرف فيها (كمستلم للعهدة)
            endpoint = `${API_BASE_URL}/transactions?type=income_to_custody&userId=${currentUserId}`;
        }
        
        try {
            const response = await fetch(endpoint, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });

            if (!response.ok) {
                const errorData = await response.json();
                showToast(errorData.message || 'فشل جلب سجل العهدات.', 'error');
                return;
            }

            const transactions = await response.json();
            renderCustodyTransactions(transactions);

            // جلب وعرض رصيد العهدة للمهندس فقط
            if (currentUserRole === 'engineer') {
                await fetchEngineerCustodyBalance();
            }
        } catch (error) {
            console.error('Error fetching custody transactions:', error);
            showToast('حدث خطأ أثناء جلب سجل العهدات.', 'error');
        }
    }

    // Function to render custody transactions in the table
    function renderCustodyTransactions(transactions) {
        custodyTransactionsTableBody.innerHTML = '';
        if (transactions.length === 0) {
            custodyTransactionsTableBody.innerHTML = '<tr><td colspan="6">لا توجد عهدات حتى الآن.</td></tr>';
            return;
        }

        transactions.forEach(transaction => {
            const row = document.createElement('tr');
            // تأكد من أن transaction.relatedUser و transaction.createdBy موجودان قبل الوصول لـ .username
            const engineerName = transaction.relatedUser ? transaction.relatedUser.username : 'غير محدد';
            const createdByName = transaction.createdBy ? transaction.createdBy.username : 'غير محدد';

            row.innerHTML = `
                <td>${new Date(transaction.date).toLocaleDateString('ar-EG')}</td>
                <td>${engineerName}</td>
                <td>${transaction.amount.toFixed(2)} EGP</td>
                <td>${transaction.description}</td>
                <td>${createdByName}</td>
                <td class="actions">
                    <!-- حاليا لا يوجد تعديل/حذف للعهدة بشكل مباشر هنا، فقط عرض السجل -->
                    <!-- يمكن إضافة أزرار هنا لاحقاً إذا لزم الأمر -->
                </td>
            `;
            custodyTransactionsTableBody.appendChild(row);
        });
    }

    // Function to fetch and display engineer's custody balance
    async function fetchEngineerCustodyBalance() {
        if (currentUserRole !== 'engineer') {
            custodyBalanceDisplay.style.display = 'none'; // Hide if not an engineer
            return;
        }
        const authToken = localStorage.getItem('authToken');
        try {
            const response = await fetch(`${API_BASE_URL}/treasuries?type=custody&userId=${currentUserId}`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (response.ok) {
                const treasuries = await response.json();
                if (treasuries.length > 0) {
                    const balance = treasuries[0].balance.toFixed(2);
                    custodyBalanceDisplay.textContent = `رصيد عهدتك الحالي: ${balance} جنيه`;
                    custodyBalanceDisplay.style.display = 'block';
                    custodyBalanceDisplay.classList.add('status-info'); // Add a class for styling
                } else {
                    custodyBalanceDisplay.textContent = 'لا توجد عهدة مخصصة لك.';
                    custodyBalanceDisplay.style.display = 'block';
                    custodyBalanceDisplay.classList.add('status-pending');
                }
            } else {
                showToast('فشل جلب رصيد العهدة.', 'error');
                custodyBalanceDisplay.style.display = 'none';
            }
        } catch (error) {
            console.error('Error fetching engineer custody balance:', error);
            showToast('حدث خطأ أثناء جلب رصيد العهدة.', 'error');
            custodyBalanceDisplay.style.display = 'none';
        }
    }


    // Handle form submission for assigning custody
    if (assignCustodyForm) {
        assignCustodyForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const engineerId = engineerSelect.value;
            const amount = parseFloat(custodyAmountInput.value);
            const description = custodyDescriptionInput.value.trim();

            if (!engineerId || !amount || amount <= 0 || !description) {
                showToast('الرجاء ملء جميع الحقول بمبلغ صحيح.', 'error');
                return;
            }

            const authToken = localStorage.getItem('authToken');
            console.log('Assigning custody... Sending data:', { engineerId, amount, description }); // Debug log
            try {
                const response = await fetch(`${API_BASE_URL}/treasuries/assign-custody`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify({ engineerId, amount, description })
                });

                console.log('Response status:', response.status); // Debug log
                console.log('Response ok:', response.ok);       // Debug log
                const responseData = await response.json(); // Always try to parse JSON
                console.log('Response data:', responseData);    // Debug log

                if (response.ok) {
                    showToast('تم تعيين العهدة بنجاح!', 'success');
                    assignCustodyForm.reset();
                    fetchCustodyTransactions(); // Refresh the table
                } else {
                    // This block is executed if response.ok is false (e.g., 400, 401, 500)
                    showToast(responseData.message || 'فشل تعيين العهدة.', 'error');
                    console.error('Failed to assign custody (non-OK response):', response.status, responseData.message);
                }
            } catch (error) {
                // This block is executed for network errors or errors in parsing JSON
                console.error('Error assigning custody (network or JSON parse error):', error);
                showToast('حدث خطأ في الاتصال بالخادم أثناء تعيين العهدة.', 'error');
            }
        });
    }

    // Initial loads
    if (currentUserRole === 'admin' || currentUserRole === 'account_manager') {
        fetchEngineersForDropdown(); // Only for admin/account_manager
    }
    fetchCustodyTransactions();
});
