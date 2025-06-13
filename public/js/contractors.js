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


    // دالة لجلب وعرض المقاولين
    async function fetchContractors() {
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            window.location.href = 'index.html';
            return;
        }

        const searchTerm = contractorSearchInput.value;

        try {
            // **تحديث الـ endpoint ليتوافق مع الـ Backend API الجديد**
            const response = await fetch(`https://7500-156-203-135-174.ngrok-free.app/api/contractors?search=${searchTerm}`, {
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
                    window.location.href = 'index.html';
                } else {
                    showToast(errorData.message || 'فشل جلب المقاولين. يرجى المحاولة مرة أخرى.', 'error');
                }
                return;
            }

            const contractors = await response.json();
            renderContractors(contractors); 
            // هنا يمكن إضافة logic للـ Pagination
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
            contractorsTableBody.innerHTML = '<tr><td colspan="5">لا توجد مقاولون مطابقون.</td></tr>';
            return;
        }

        contractors.forEach(contractor => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${contractor.name}</td>
                <td>${contractor.email || 'لا يوجد'}</td>
                <td>${contractor.phone || 'لا يوجد'}</td>
                <td>${contractor.specialty || 'لا يوجد'}</td>
                <td class="actions">
                    <button class="btn-action view-contractor" data-id="${contractor._id}"><i class="fas fa-eye"></i> عرض</button>
                    <button class="btn-action edit-contractor" data-id="${contractor._id}"><i class="fas fa-edit"></i> تعديل</button>
                    <button class="btn-action delete-contractor" data-id="${contractor._id}"><i class="fas fa-trash-alt"></i> حذف</button>
                </td>
            `;
            contractorsTableBody.appendChild(row);
        });

        // إضافة مستمعي الأحداث لأزرار الإجراءات
        addContractorActionListeners();
    }

    // دالة لإضافة مستمعي الأحداث لأزرار الإجراءات في الجدول
    function addContractorActionListeners() {
        document.querySelectorAll('.view-contractor').forEach(button => {
            button.addEventListener('click', (e) => {
                const contractorId = e.currentTarget.dataset.id;
                // هنا سيتم توجيه المستخدم لصفحة عرض تفاصيل المقاول (اختياري)
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
            // **تحديث الـ endpoint ليتوافق مع الـ Backend API الجديد**
            const response = await fetch(`https://7500-156-203-135-174.ngrok-free.app/api/contractors/${contractorId}`, {
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
            contractorForm.reset(); // تفريغ الفورم

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
                    // **تحديث الـ endpoint ليتوافق مع الـ Backend API الجديد**
                    response = await fetch(`https://7500-156-203-135-174.ngrok-free.app/api/contractors/${contractorId}`, {
                        method: 'PUT', 
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${authToken}`
                        },
                        body: JSON.stringify(contractorData)
                    });
                } else { // إضافة
                    // **تحديث الـ endpoint ليتوافق مع الـ Backend API الجديد**
                    response = await fetch('https://7500-156-203-135-174.ngrok-free.app/api/contractors', {
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
            // **تحديث الـ endpoint ليتوافق مع الـ Backend API الجديد**
            const response = await fetch(`https://7500-156-203-135-174.ngrok-free.app/api/contractors/${contractorId}`, {
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

    // جلب المقاولين عند تحميل الصفحة لأول مرة
    fetchContractors();

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
            // هنا ستحتاج لإعادة فرز البيانات المعروضة
            // الأفضل أن يتم الفرز في الـ Backend إذا كانت البيانات كبيرة
            showToast(`سيتم الفرز حسب: ${column} (${currentSortDirection === 'asc' ? 'تصاعدي' : 'تنازلي'})`, 'info');
        });
    });
});
