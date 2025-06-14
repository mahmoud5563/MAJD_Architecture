// public/js/contractors.js

document.addEventListener('DOMContentLoaded', () => {
    const contractorsTableBody = document.getElementById('contractorsTableBody');
    const contractorSearchInput = document.getElementById('contractorSearch');
    const applyContractorFiltersBtn = document.getElementById('applyContractorFiltersBtn');
    const addContractorBtn = document.getElementById('addContractorBtn');

    // عناصر المودال
    const contractorModal = document.getElementById('contractorModal');
    const contractorModalTitle = document.getElementById('contractorModalTitle');
    const contractorForm = document.getElementById('contractorForm');
    const contractorIdInput = document.getElementById('contractorId');
    const contractorNameInput = document.getElementById('contractorName');
    const contractorEmailInput = document.getElementById('contractorEmail');
    const contractorPhoneInput = document.getElementById('contractorPhone');
    const contractorSpecialtyInput = document.getElementById('contractorSpecialty');
    const contractorNotesInput = document.getElementById('contractorNotes');
    const saveContractorBtn = document.getElementById('saveContractorBtn');
    const closeButton = contractorModal ? contractorModal.querySelector('.close-button') : null;

    let currentSortColumn = null;
    let currentSortDirection = 'asc'; 

    // Base URL for API requests
    const API_BASE_URL = 'https://6943-156-203-135-174.ngrok-free.app/api'; // Make sure this matches your backend URL

    // دالة لجلب وعرض المقاولين
    async function fetchContractors() {
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            window.location.href = 'index.html';
            return;
        }

        const searchTerm = contractorSearchInput.value;
        let queryParams = new URLSearchParams();
        if (searchTerm) {
            queryParams.append('search', searchTerm);
        }

        try {
            const response = await fetch(`${API_BASE_URL}/contractors?${queryParams.toString()}`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Failed to fetch contractors:', response.status, errorData.message);
                if (response.status === 401 || response.status === 403) {
                    showToast('ليس لديك صلاحية لعرض المقاولين.', 'error');
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('userRole');
                    localStorage.removeItem('username');
                    localStorage.removeItem('userId');
                    window.location.href = 'index.html';
                } else {
                    showToast(errorData.message || 'فشل جلب المقاولين. يرجى المحاولة مرة أخرى.', 'error');
                }
                return;
            }

            const contractors = await response.json();
            renderContractors(contractors); 
        } catch (error) {
            console.error('Error fetching contractors:', error);
            showToast('حدث خطأ أثناء جلب المقاولين.', 'error');
        }
    }

    // دالة لرسم المقاولين في الجدول
    function renderContractors(contractors) {
        if (!contractorsTableBody) return;
        contractorsTableBody.innerHTML = ''; 

        if (contractors.length === 0) {
            contractorsTableBody.innerHTML = '<tr><td colspan="6">لا توجد مقاولون مطابقون.</td></tr>'; // Increased colspan for new button
            return;
        }

        const currentUserRole = localStorage.getItem('userRole');

        contractors.forEach(contractor => {
            const row = document.createElement('tr');
            
            let actionsHtml = '';

            // زر عرض التفاصيل (View Details - if you have a separate details page)
            actionsHtml += `<button class="btn-action view-contractor" data-id="${contractor._id}"><i class="fas fa-eye"></i> عرض</button>`;

            // زر تعديل: متاح للآدمن ومدير الحسابات
            if (currentUserRole === 'admin' || currentUserRole === 'account_manager') {
                actionsHtml += `<button class="btn-action edit-contractor" data-id="${contractor._id}"><i class="fas fa-edit"></i> تعديل</button>`;
            }

            // زر حذف: متاح للآدمن ومدير الحسابات
            if (currentUserRole === 'admin' || currentUserRole === 'account_manager') {
                actionsHtml += `<button class="btn-action delete-contractor" data-id="${contractor._id}"><i class="fas fa-trash-alt"></i> حذف</button>`;
            }

            // NEW: زر الدفعات: متاح للآدمن ومدير الحسابات والمهندس
            if (currentUserRole === 'admin' || currentUserRole === 'account_manager' || currentUserRole === 'engineer') {
                actionsHtml += `<button class="btn-action view-payments" data-id="${contractor._id}"><i class="fas fa-money-bill-wave"></i> الدفعات</button>`;
            }


            row.innerHTML = `
                <td>${contractor.name}</td>
                <td>${contractor.email || 'لا يوجد'}</td>
                <td>${contractor.phone || 'لا يوجد'}</td>
                <td>${contractor.specialty || 'لا يوجد'}</td>
                <td class="actions">
                    ${actionsHtml}
                </td>
            `;
            contractorsTableBody.appendChild(row);
        });

        addContractorActionListeners();
    }

    // دالة لإضافة مستمعي الأحداث لأزرار الإجراءات في الجدول
    function addContractorActionListeners() {
        document.querySelectorAll('.view-contractor').forEach(button => {
            button.addEventListener('click', (e) => {
                const contractorId = e.currentTarget.dataset.id;
                // يمكنك توجيه المستخدم لصفحة تفاصيل المقاول إذا كان لديك واحدة
                showToast(`عرض تفاصيل المقاول ID: ${contractorId} (قيد التنفيذ)`, 'info');
            });
        });

        document.querySelectorAll('.edit-contractor').forEach(button => {
            button.addEventListener('click', async (e) => {
                const contractorId = e.currentTarget.dataset.id;
                await editContractor(contractorId);
            });
        });

        document.querySelectorAll('.delete-contractor').forEach(button => {
            button.addEventListener('click', async (e) => {
                const contractorId = e.currentTarget.dataset.id;
                if (confirm('هل أنت متأكد من حذف هذا المقاول؟')) {
                    await deleteContractor(contractorId);
                }
            });
        });

        // NEW: Event listener for "View Payments" button
        document.querySelectorAll('.view-payments').forEach(button => {
            button.addEventListener('click', (e) => {
                const contractorId = e.currentTarget.dataset.id;
                window.location.href = `contractor-payments.html?id=${contractorId}`;
            });
        });
    }

    // دالة لفتح المودال لإضافة مقاول جديد
    if (addContractorBtn) {
        addContractorBtn.addEventListener('click', () => {
            openContractorModal();
        });
    }

    // دالة لفتح المودال لوضع بيانات مقاول لتعديله
    async function editContractor(contractorId) {
        const authToken = localStorage.getItem('authToken');
        try {
            const response = await fetch(`${API_BASE_URL}/contractors/${contractorId}`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            if (response.ok) {
                const contractor = await response.json();
                openContractorModal('edit', contractor);
            } else {
                const errorData = await response.json();
                console.error('Failed to fetch contractor for edit:', response.status, errorData.message);
                showToast('فشل جلب بيانات المقاول للتعديل.', 'error');
            }
        } catch (error) {
            console.error('Error fetching contractor for edit:', error);
            showToast('حدث خطأ أثناء جلب بيانات المقاول.', 'error');
        }
    }

    // دالة لفتح/ملء المودال (لإضافة أو تعديل)
    function openContractorModal(mode = 'add', contractor = null) {
        if (contractorModal) {
            contractorModal.style.display = 'flex';
            contractorForm.reset(); 

            if (mode === 'add') {
                contractorModalTitle.textContent = 'إضافة مقاول جديد';
                saveContractorBtn.textContent = 'حفظ المقاول';
                contractorIdInput.value = '';
            } else { // mode === 'edit'
                contractorModalTitle.textContent = 'تعديل بيانات المقاول';
                saveContractorBtn.textContent = 'تحديث المقاول';
                contractorIdInput.value = contractor._id;
                contractorNameInput.value = contractor.name;
                contractorEmailInput.value = contractor.email || '';
                contractorPhoneInput.value = contractor.phone || '';
                contractorSpecialtyInput.value = contractor.specialty || '';
                contractorNotesInput.value = contractor.notes || '';
            }
        }
    }

    // دالة لإغلاق المودال
    function closeContractorModal() {
        if (contractorModal) {
            contractorModal.style.display = 'none';
        }
    }

    // مستمعي الأحداث للمودال
    if (closeButton) {
        closeButton.addEventListener('click', closeContractorModal);
    }
    if (contractorModal) {
        window.addEventListener('click', (e) => {
            if (e.target === contractorModal) {
                closeContractorModal();
            }
        });
    }

    // معالجة إرسال النموذج (إضافة/تعديل)
    if (contractorForm) {
        contractorForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const contractorId = contractorIdInput.value;
            const contractorData = {
                name: contractorNameInput.value,
                email: contractorEmailInput.value,
                phone: contractorPhoneInput.value,
                specialty: contractorSpecialtyInput.value,
                notes: contractorNotesInput.value
            };

            // تحقق بسيط من المدخلات
            if (!contractorData.name || !contractorData.phone) {
                showToast('الرجاء ملء اسم المقاول ورقم الهاتف على الأقل.', 'error');
                return;
            }

            const authToken = localStorage.getItem('authToken');
            let response;
            try {
                if (contractorId) { // تعديل
                    response = await fetch(`${API_BASE_URL}/contractors/${contractorId}`, {
                        method: 'PUT', 
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${authToken}`
                        },
                        body: JSON.stringify(contractorData)
                    });
                } else { // إضافة
                    response = await fetch(`${API_BASE_URL}/contractors`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${authToken}`
                        },
                        body: JSON.stringify(contractorData)
                    });
                }

                if (response.ok) {
                    showToast(`تم ${contractorId ? 'تعديل' : 'إضافة'} المقاول بنجاح!`, 'success');
                    closeContractorModal();
                    fetchContractors(); // إعادة تحميل المقاولين
                } else {
                    const errorData = await response.json();
                    console.error('Failed to save contractor:', response.status, errorData.message);
                    showToast(errorData.message || `فشل ${contractorId ? 'تعديل' : 'إضافة'} المقاول.`, 'error');
                }
            } catch (error) {
                console.error(`Error ${contractorId ? 'updating' : 'adding'} contractor:`, error);
                showToast('حدث خطأ في الاتصال بالخادم.', 'error');
            }
        });
    }

    // دالة لحذف مقاول
    async function deleteContractor(contractorId) {
        const authToken = localStorage.getItem('authToken');
        try {
            const response = await fetch(`${API_BASE_URL}/contractors/${contractorId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });

            if (response.ok) {
                showToast('تم حذف المقاول بنجاح.', 'success');
                fetchContractors(); // إعادة تحميل المقاولين بعد الحذف
            } else {
                const errorData = await response.json();
                console.error('Failed to delete contractor:', response.status, errorData.message);
                showToast(errorData.message || 'فشل حذف المقاول. ليس لديك صلاحية أو حدث خطأ.', 'error');
            }
        } catch (error) {
            console.error('Error deleting contractor:', error);
            showToast('حدث خطأ أثناء حذف المقاول.', 'error');
        }
    }

    // مستمعي الأحداث للفلترة والبحث
    if (applyContractorFiltersBtn) {
        applyContractorFiltersBtn.addEventListener('click', fetchContractors);
    }
    if (contractorSearchInput) {
        contractorSearchInput.addEventListener('input', () => {
            setTimeout(fetchContractors, 500);
        });
    }

    // NEW: Function to handle initial load, checking for editId
    async function fetchContractorsOnLoad() {
        await fetchContractors(); // Fetch all contractors first
        const urlParams = new URLSearchParams(window.location.search);
        const editId = urlParams.get('editId');
        if (editId) {
            // Remove editId from URL to prevent reopening modal on refresh
            urlParams.delete('editId');
            const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
            history.replaceState(null, '', newUrl);

            await editContractor(editId); // Open modal for editing
        }
    }

    // جلب المقاولين عند تحميل الصفحة لأول مرة
    fetchContractorsOnLoad();

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
