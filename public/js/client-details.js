// public/js/client-details.js

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const clientId = urlParams.get('id');

    // عناصر تفاصيل العميل
    const clientNameDisplayInHeader = document.getElementById('clientNameDisplayInHeader');
    const clientNameDetails = document.getElementById('clientNameDetails');
    const clientEmailDetails = document.getElementById('clientEmailDetails');
    const clientPhoneDetails = document.getElementById('clientPhoneDetails');
    const clientCompanyDetails = document.getElementById('clientCompanyDetails');
    const clientNotesDetails = document.getElementById('clientNotesDetails');

    const editClientBtn = document.querySelector('.edit-client-btn');
    const deleteClientBtn = document.querySelector('.delete-client-btn');

    // جدول المشاريع المرتبطة بالعميل
    const clientProjectsTableBody = document.getElementById('clientProjectsTableBody');


    // التحقق من وجود معرف العميل
    if (!clientId) {
        showToast('معرف العميل غير موجود.', 'error');
        setTimeout(() => { window.location.href = 'clients.html'; }, 2000);
        return;
    }

    // دالة لجلب بيانات العميل والمشاريع المرتبطة به
    async function fetchClientDetails() {
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            window.location.href = 'index.html';
            return;
        }

        try {
            // جلب تفاصيل العميل
            const clientResponse = await fetch(`https://7500-156-203-135-174.ngrok-free.app/api/clients/${clientId}`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });

            if (!clientResponse.ok) {
                const errorData = await clientResponse.json();
                console.error('Failed to fetch client details:', clientResponse.status, errorData.message);
                showToast(errorData.message || 'فشل جلب تفاصيل العميل.', 'error');
                if (clientResponse.status === 401 || clientResponse.status === 403) {
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('userRole');
                    localStorage.removeItem('username');
                    localStorage.removeItem('userId');
                    window.location.href = 'index.html';
                } else {
                    setTimeout(() => { window.location.href = 'clients.html'; }, 2000);
                }
                return;
            }

            const client = await clientResponse.json();
            renderClientDetails(client);

            // جلب المشاريع المرتبطة بهذا العميل (باستخدام endpoint جديد إذا كان متوفراً في Backend)
            // بما أن الموديل Project.js لا يحتوي على حقل clientId حتى الآن، سنفترض هذا الـ endpoint لغرض العرض
            // في Backend، ستحتاج لإضافة حقل clientId إلى Project Model ومسار لجلب المشاريع بواسطة clientId.
            const projectsResponse = await fetch(`https://7500-156-203-135-174.ngrok-free.app/api/projects?clientId=${clientId}`, { // هذا الـ endpoint افتراضي وغير موجود بعد
                headers: { 'Authorization': `Bearer ${authToken}` }
            });

            let clientProjects = [];
            if (projectsResponse.ok) {
                clientProjects = await projectsResponse.json();
            } else {
                console.warn('Could not fetch projects for this client. Backend endpoint might not exist yet.');
                showToast('لم يتم العثور على مشاريع لهذا العميل أو حدث خطأ في جلبها.', 'info');
            }
            renderClientProjects(clientProjects);


        } catch (error) {
            console.error('Error fetching client details or projects:', error);
            showToast('حدث خطأ في الاتصال بالخادم أثناء جلب بيانات العميل.', 'error');
            setTimeout(() => { window.location.href = 'clients.html'; }, 2000);
        }
    }

    // دالة لعرض تفاصيل العميل
    function renderClientDetails(client) {
        if (!client) return;

        if (clientNameDisplayInHeader) {
            clientNameDisplayInHeader.textContent = client.name;
        }

        clientNameDetails.textContent = client.name;
        clientEmailDetails.textContent = client.email || 'لا يوجد';
        clientPhoneDetails.textContent = client.phone || 'لا يوجد';
        clientCompanyDetails.textContent = client.company || 'لا يوجد';
        clientNotesDetails.textContent = client.notes || 'لا توجد ملاحظات';

        // Set data-id for edit/delete buttons
        if (editClientBtn) editClientBtn.dataset.id = client._id;
        if (deleteClientBtn) deleteClientBtn.dataset.id = client._id;
    }

    // دالة لعرض المشاريع المرتبطة بالعميل
    function renderClientProjects(projects) {
        if (!clientProjectsTableBody) return;
        clientProjectsTableBody.innerHTML = '';

        if (projects.length === 0) {
            clientProjectsTableBody.innerHTML = '<tr><td colspan="5">لا توجد مشاريع مرتبطة بهذا العميل.</td></tr>';
            return;
        }

        projects.forEach(project => {
            const row = document.createElement('tr');
            const statusClass = project.status === 'ongoing' ? 'status-ongoing' :
                                project.status === 'completed' ? 'status-completed' :
                                'status-pending';
            const statusText = project.status === 'ongoing' ? 'جارية' :
                                project.status === 'completed' ? 'منتهية' :
                                'معلقة';

            row.innerHTML = `
                <td>${project.name}</td>
                <td>${project.address}</td>
                <td>${new Date(project.startDate).toLocaleDateString('ar-EG')}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td class="actions">
                    <button class="btn-action view-project" data-id="${project._id}"><i class="fas fa-eye"></i> عرض</button>
                    <!-- يمكنك إضافة أزرار تعديل/حذف المشروع هنا إذا أردت -->
                </td>
            `;
            clientProjectsTableBody.appendChild(row);
        });

        // إضافة مستمعي الأحداث لأزرار "عرض" المشاريع
        document.querySelectorAll('.view-project').forEach(button => {
            button.addEventListener('click', (e) => {
                const projectId = e.currentTarget.dataset.id;
                window.location.href = `project-details.html?id=${projectId}`;
            });
        });
    }

    // مستمع لزر "تعديل العميل"
    if (editClientBtn) {
        editClientBtn.addEventListener('click', () => {
            // يمكننا إعادة استخدام مودال العملاء الموجود في clients.js أو إنشاء مودال خاص هنا
            // للأغراض الحالية، الأبسط هو إعادة التوجيه لصفحة clients.html وفتح المودال هناك
            window.location.href = `clients.html?editId=${clientId}`; // يمكن استخدام هذا للفتح المباشر للمودال
            // أو يمكننا استخدام نفس وظيفة فتح المودال مباشرة إذا تم نسخها هنا أو استيرادها
        });
    }

    // مستمع لزر "حذف العميل"
    if (deleteClientBtn) {
        deleteClientBtn.addEventListener('click', async () => {
            if (confirm('هل أنت متأكد من حذف هذا العميل؟ سيتم حذف جميع المشاريع المرتبطة به.')) {
                const authToken = localStorage.getItem('authToken');
                try {
                    const response = await fetch(`https://7500-156-203-135-174.ngrok-free.app/api/clients/${clientId}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${authToken}` }
                    });

                    if (response.ok) {
                        showToast('تم حذف العميل بنجاح.', 'success');
                        setTimeout(() => { window.location.href = 'clients.html'; }, 1500); // العودة لصفحة العملاء
                    } else {
                        const errorData = await response.json();
                        console.error('Failed to delete client:', response.status, errorData.message);
                        showToast(errorData.message || 'فشل حذف العميل.', 'error');
                    }
                } catch (error) {
                    console.error('Error deleting client:', error);
                    showToast('حدث خطأ أثناء حذف العميل.', 'error');
                }
            }
        });
    }


    // استدعاء دالة جلب التفاصيل عند تحميل الصفحة
    fetchClientDetails();
});
