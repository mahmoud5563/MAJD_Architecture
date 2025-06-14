// public/js/settings.js

document.addEventListener('DOMContentLoaded', () => {
    const categoryNameInput = document.getElementById('categoryNameInput');
    const addCategoryBtn = document.getElementById('addCategoryBtn');
    const categoriesTableBody = document.getElementById('categoriesTableBody');

    // عناصر مودال التعديل
    const editCategoryModal = document.getElementById('editCategoryModal');
    const editCategoryIdInput = document.getElementById('editCategoryId');
    const editCategoryNameInput = document.getElementById('editCategoryName');
    const saveEditedCategoryBtn = document.getElementById('saveEditedCategoryBtn');
    const closeEditModalButton = editCategoryModal ? editCategoryModal.querySelector('.close-button') : null;

    // دالة لجلب وعرض التصنيفات
    async function fetchCategories() {
        const authToken = localStorage.getItem('authToken');
        const userRole = localStorage.getItem('userRole');

        // هذه الصفحة متاحة للآدمن ومدير الحسابات والمهندس (للعرض فقط)
        // الآن المهندس يمكنه أيضاً إدارة التصنيفات
        if (!authToken) {
            window.location.href = 'index.html'; // إذا لم يكن مسجلاً دخول
            return;
        }

        try {
            const response = await fetch('https://6943-156-203-135-174.ngrok-free.app/api/categories', {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Failed to fetch categories:', response.status, errorData.message);
                showToast(errorData.message || 'فشل جلب التصنيفات.', 'error');
                if (response.status === 401 || response.status === 403) {
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('userRole');
                    localStorage.removeItem('username');
                    localStorage.removeItem('userId');
                    window.location.href = 'index.html';
                }
                return;
            }

            const categories = await response.json();
            renderCategories(categories);
        } catch (error) {
            console.error('Error fetching categories:', error);
            showToast('حدث خطأ أثناء جلب التصنيفات.', 'error');
        }
    }

    // دالة لرسم التصنيفات في الجدول
    function renderCategories(categories) {
        if (!categoriesTableBody) return;
        categoriesTableBody.innerHTML = ''; // تفريغ الجدول

        if (categories.length === 0) {
            categoriesTableBody.innerHTML = '<tr><td colspan="2">لا توجد تصنيفات حالياً.</td></tr>';
            return;
        }

        const currentUserRole = localStorage.getItem('userRole');

        categories.forEach(category => {
            const row = document.createElement('tr');
            // أزرار التعديل والحذف تظهر لجميع الأدوار (الآدمن، مدير الحسابات، والمهندس)
            // بما أن الـ backend هو من سيفرض الصلاحيات، هنا فقط نُظهر الأزرار
            const actionsHtml = `
                <button class="btn-action edit-category" data-id="${category._id}" data-name="${category.name}"><i class="fas fa-edit"></i> تعديل</button>
                <button class="btn-action delete-category" data-id="${category._id}"><i class="fas fa-trash-alt"></i> حذف</button>
            `;

            row.innerHTML = `
                <td>${category.name}</td>
                <td class="actions">
                    ${actionsHtml}
                </td>
            `;
            categoriesTableBody.appendChild(row);
        });

        addCategoryActionListeners();
    }

    // دالة لإضافة مستمعي الأحداث لأزرار الإجراءات (تعديل/حذف)
    function addCategoryActionListeners() {
        document.querySelectorAll('.edit-category').forEach(button => {
            button.addEventListener('click', (e) => {
                const categoryId = e.currentTarget.dataset.id;
                const categoryName = e.currentTarget.dataset.name;
                openEditCategoryModal(categoryId, categoryName);
            });
        });

        document.querySelectorAll('.delete-category').forEach(button => {
            button.addEventListener('click', async (e) => {
                const categoryId = e.currentTarget.dataset.id;
                if (confirm('هل أنت متأكد من حذف هذا التصنيف؟ لا يمكن التراجع عن هذا الإجراء.')) {
                    await deleteCategory(categoryId);
                }
            });
        });
    }

    // دالة لفتح مودال التعديل
    function openEditCategoryModal(id, name) {
        if (editCategoryModal) {
            editCategoryIdInput.value = id;
            editCategoryNameInput.value = name;
            editCategoryModal.style.display = 'flex';
        }
    }

    // دالة لإغلاق مودال التعديل
    function closeEditCategoryModal() {
        if (editCategoryModal) {
            editCategoryModal.style.display = 'none';
        }
    }

    // مستمعي الأحداث لمودال التعديل
    if (closeEditModalButton) {
        closeEditModalButton.addEventListener('click', closeEditCategoryModal);
    }
    if (editCategoryModal) {
        window.addEventListener('click', (e) => {
            if (e.target === editCategoryModal) {
                closeEditCategoryModal();
            }
        });
    }

    // معالجة إضافة تصنيف جديد
    if (addCategoryBtn) {
        addCategoryBtn.addEventListener('click', async () => {
            const name = categoryNameInput.value.trim();
            if (!name) {
                showToast('الرجاء إدخال اسم التصنيف.', 'error');
                return;
            }

            const authToken = localStorage.getItem('authToken');
            try {
                const response = await fetch('https://6943-156-203-135-174.ngrok-free.app/api/categories', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify({ name })
                });

                if (response.ok) {
                    showToast('تم إضافة التصنيف بنجاح!', 'success');
                    categoryNameInput.value = ''; // تفريغ الحقل
                    fetchCategories(); // إعادة جلب وعرض التصنيفات
                } else {
                    const errorData = await response.json();
                    console.error('Failed to add category:', response.status, errorData.message);
                    showToast(errorData.message || 'فشل إضافة التصنيف.', 'error');
                }
            } catch (error) {
                console.error('Error adding category:', error);
                showToast('حدث خطأ في الاتصال بالخادم أثناء إضافة التصنيف.', 'error');
            }
        });
    }

    // معالجة حفظ التعديلات على التصنيف
    if (saveEditedCategoryBtn) {
        saveEditedCategoryBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const categoryId = editCategoryIdInput.value;
            const newName = editCategoryNameInput.value.trim();

            if (!newName) {
                showToast('الرجاء إدخال اسم التصنيف.', 'error');
                return;
            }

            const authToken = localStorage.getItem('authToken');
            try {
                const response = await fetch(`https://6943-156-203-135-174.ngrok-free.app/api/categories/${categoryId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify({ name: newName })
                });

                if (response.ok) {
                    showToast('تم تحديث التصنيف بنجاح!', 'success');
                    closeEditCategoryModal();
                    fetchCategories();
                } else {
                    const errorData = await response.json();
                    console.error('Failed to update category:', response.status, errorData.message);
                    showToast(errorData.message || 'فشل تحديث التصنيف.', 'error');
                }
            } catch (error) {
                console.error('Error updating category:', error);
                showToast('حدث خطأ في الاتصال بالخادم أثناء تحديث التصنيف.', 'error');
            }
        });
    }

    // دالة لحذف تصنيف
    async function deleteCategory(categoryId) {
        const authToken = localStorage.getItem('authToken');
        try {
            const response = await fetch(`https://6943-156-203-135-174.ngrok-free.app/api/categories/${categoryId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });

            if (response.ok) {
                showToast('تم حذف التصنيف بنجاح.', 'success');
                fetchCategories();
            } else {
                const errorData = await response.json();
                console.error('Failed to delete category:', response.status, errorData.message);
                showToast(errorData.message || 'فشل حذف التصنيف. ليس لديك صلاحية أو حدث خطأ.', 'error');
            }
        } catch (error) {
            console.error('Error deleting category:', error);
            showToast('حدث خطأ أثناء حذف التصنيف.', 'error');
        }
    }

    // جلب التصنيفات عند تحميل الصفحة لأول مرة
    fetchCategories();
});
