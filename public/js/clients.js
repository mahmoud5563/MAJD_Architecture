// public/js/clients.js

document.addEventListener('DOMContentLoaded', () => {
    const clientsTableBody = document.getElementById('clientsTableBody');
    const clientSearchInput = document.getElementById('clientSearch');
    const applyClientFiltersBtn = document.getElementById('applyClientFiltersBtn');
    const addClientBtn = document.getElementById('addClientBtn');

    // عناصر المودال
    const clientModal = document.getElementById('clientModal');
    const clientModalTitle = document.getElementById('clientModalTitle');
    const clientForm = document.getElementById('clientForm');
    const clientIdInput = document.getElementById('clientId');
    const clientNameInput = document.getElementById('clientName');
    const clientEmailInput = document.getElementById('clientEmail');
    const clientPhoneInput = document.getElementById('clientPhone');
    const clientCompanyInput = document.getElementById('clientCompany');
    const clientNotesInput = document.getElementById('clientNotes');
    const saveClientBtn = document.getElementById('saveClientBtn');
    const closeButton = clientModal ? clientModal.querySelector('.close-button') : null;

    let currentSortColumn = null;
    let currentSortDirection = 'asc'; 


    // دالة لجلب وعرض العملاء
    async function fetchClients() {
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            window.location.href = 'index.html';
            return;
        }

        const searchTerm = clientSearchInput.value;

        try {
            const response = await fetch(`https://7500-156-203-135-174.ngrok-free.app/api/clients?search=${searchTerm}`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Failed to fetch clients:', response.status, errorData.message);
                if (response.status === 401 || response.status === 403) {
                    showToast('ليس لديك صلاحية لعرض العملاء.', 'error');
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('userRole');
                    localStorage.removeItem('username');
                    window.location.href = 'index.html';
                } else {
                    showToast(errorData.message || 'فشل جلب العملاء. يرجى المحاولة مرة أخرى.', 'error');
                }
                return;
            }

            const clients = await response.json();
            renderClients(clients); 
        } catch (error) {
            console.error('Error fetching clients:', error);
            showToast('حدث خطأ أثناء جلب العملاء.', 'error');
        }
    }

    // دالة لرسم العملاء في الجدول
    function renderClients(clients) {
        if (!clientsTableBody) return;
        clientsTableBody.innerHTML = ''; 

        if (clients.length === 0) {
            clientsTableBody.innerHTML = '<tr><td colspan="5">لا توجد عملاء مطابقة.</td></tr>';
            return;
        }

        clients.forEach(client => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${client.name}</td>
                <td>${client.email || 'لا يوجد'}</td>
                <td>${client.phone || 'لا يوجد'}</td>
                <td>${client.company || 'لا يوجد'}</td>
                <td class="actions">
                    <button class="btn-action view-client" data-id="${client._id}"><i class="fas fa-eye"></i> عرض</button>
                    <button class="btn-action edit-client" data-id="${client._id}"><i class="fas fa-edit"></i> تعديل</button>
                    <button class="btn-action delete-client" data-id="${client._id}"><i class="fas fa-trash-alt"></i> حذف</button>
                </td>
            `;
            clientsTableBody.appendChild(row);
        });

        addClientActionListeners();
    }

    // دالة لإضافة مستمعي الأحداث لأزرار الإجراءات في الجدول
    function addClientActionListeners() {
        document.querySelectorAll('.view-client').forEach(button => {
            button.addEventListener('click', (e) => {
                const clientId = e.currentTarget.dataset.id;
                // NEW: توجيه المستخدم لصفحة عرض تفاصيل العميل
                window.location.href = `client-details.html?id=${clientId}`;
            });
        });

        document.querySelectorAll('.edit-client').forEach(button => {
            button.addEventListener('click', async (e) => {
                const clientId = e.currentTarget.dataset.id;
                await editClient(clientId);
            });
        });

        document.querySelectorAll('.delete-client').forEach(button => {
            button.addEventListener('click', async (e) => {
                const clientId = e.currentTarget.dataset.id;
                if (confirm('هل أنت متأكد من حذف هذا العميل؟ سيتم حذف جميع المشاريع المرتبطة به.')) {
                    await deleteClient(clientId);
                }
            });
        });
    }

    // دالة لفتح المودال لإضافة عميل جديد
    if (addClientBtn) {
        addClientBtn.addEventListener('click', () => {
            openClientModal();
        });
    }

    // دالة لفتح المودال لوضع بيانات عميل لتعديله
    async function editClient(clientId) {
        const authToken = localStorage.getItem('authToken');
        try {
            const response = await fetch(`https://7500-156-203-135-174.ngrok-free.app/api/clients/${clientId}`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            if (response.ok) {
                const client = await response.json();
                openClientModal('edit', client);
            } else {
                const errorData = await response.json();
                console.error('Failed to fetch client for edit:', response.status, errorData.message);
                showToast('فشل جلب بيانات العميل للتعديل.', 'error');
            }
        } catch (error) {
            console.error('Error fetching client for edit:', error);
            showToast('حدث خطأ أثناء جلب بيانات العميل.', 'error');
        }
    }


    // دالة لفتح/ملء المودال (لإضافة أو تعديل)
    function openClientModal(mode = 'add', client = null) {
        if (clientModal) {
            clientModal.style.display = 'flex';
            clientForm.reset();

            if (mode === 'add') {
                clientModalTitle.textContent = 'إضافة عميل جديد';
                saveClientBtn.textContent = 'حفظ العميل';
                clientIdInput.value = '';
            } else { // mode === 'edit'
                clientModalTitle.textContent = 'تعديل بيانات العميل';
                saveClientBtn.textContent = 'تحديث العميل';
                clientIdInput.value = client._id;
                clientNameInput.value = client.name;
                clientEmailInput.value = client.email || '';
                clientPhoneInput.value = client.phone || '';
                clientCompanyInput.value = client.company || '';
                clientNotesInput.value = client.notes || '';
            }
        }
    }

    // دالة لإغلاق المودال
    function closeClientModal() {
        if (clientModal) {
            clientModal.style.display = 'none';
        }
    }

    // مستمعي الأحداث للمودال
    if (closeButton) {
        closeButton.addEventListener('click', closeClientModal);
    }
    if (clientModal) {
        window.addEventListener('click', (e) => {
            if (e.target === clientModal) {
                closeClientModal();
            }
        });
    }

    // معالجة إرسال النموذج (إضافة/تعديل)
    if (clientForm) {
        clientForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const clientId = clientIdInput.value;
            const clientData = {
                name: clientNameInput.value,
                email: clientEmailInput.value,
                phone: clientPhoneInput.value,
                company: clientCompanyInput.value,
                notes: clientNotesInput.value
            };

            if (!clientData.name || !clientData.phone) {
                showToast('الرجاء ملء اسم العميل ورقم الهاتف.', 'error');
                return;
            }

            const authToken = localStorage.getItem('authToken');
            let response;
            try {
                if (clientId) {
                    response = await fetch(`https://7500-156-203-135-174.ngrok-free.app/api/clients/${clientId}`, {
                        method: 'PUT', 
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${authToken}`
                        },
                        body: JSON.stringify(clientData)
                    });
                } else {
                    response = await fetch('https://7500-156-203-135-174.ngrok-free.app/api/clients', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${authToken}`
                        },
                        body: JSON.stringify(clientData)
                    });
                }

                if (response.ok) {
                    showToast(`تم ${clientId ? 'تعديل' : 'إضافة'} العميل بنجاح!`, 'success');
                    closeClientModal();
                    fetchClients();
                } else {
                    const errorData = await response.json();
                    console.error('Failed to save client:', response.status, errorData.message);
                    showToast(errorData.message || `فشل ${clientId ? 'تعديل' : 'إضافة'} العميل.`, 'error');
                }
            } catch (error) {
                console.error(`Error ${clientId ? 'updating' : 'adding'} client:`, error);
                showToast('حدث خطأ في الاتصال بالخادم.', 'error');
            }
        });
    }

    // دالة لحذف عميل
    async function deleteClient(clientId) {
        const authToken = localStorage.getItem('authToken');
        try {
            const response = await fetch(`https://7500-156-203-135-174.ngrok-free.app/api/clients/${clientId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });

            if (response.ok) {
                showToast('تم حذف العميل بنجاح.', 'success');
                fetchClients();
            } else {
                const errorData = await response.json();
                console.error('Failed to delete client:', response.status, errorData.message);
                showToast(errorData.message || 'فشل حذف العميل. ليس لديك صلاحية أو حدث خطأ.', 'error');
            }
        } catch (error) {
            console.error('Error deleting client:', error);
            showToast('حدث خطأ أثناء حذف العميل.', 'error');
        }
    }

    // مستمعي الأحداث للفلترة والبحث
    if (applyClientFiltersBtn) {
        applyClientFiltersBtn.addEventListener('click', fetchClients);
    }
    if (clientSearchInput) {
        clientSearchInput.addEventListener('input', () => {
            setTimeout(fetchClients, 500);
        });
    }

    // جلب العملاء عند تحميل الصفحة لأول مرة
    fetchClients();

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
