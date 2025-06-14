// public/js/add-project.js

document.addEventListener('DOMContentLoaded', () => {
    const addProjectForm = document.getElementById('addProjectForm');
    const clientSelect = document.getElementById('clientSelect'); 
    const engineerSelect = document.getElementById('engineerSelect'); // NEW: Get engineer select element

    // Base URL for API requests - Using a constant for better maintainability
    const API_BASE_URL = 'https://6943-156-203-135-174.ngrok-free.app/api';


    // Function to fetch clients and populate the dropdown
    async function fetchClientsForDropdown() {
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            console.error('No auth token found for fetching clients.');
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/clients`, { // Using API_BASE_URL constant
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Failed to fetch clients for dropdown:', response.status, errorData.message);
                showToast('فشل جلب قائمة العملاء.', 'error');
                return;
            }

            const clients = await response.json();
            clientSelect.innerHTML = '<option value="">اختر عميل </option>'; 
            clients.forEach(client => {
                const option = document.createElement('option');
                option.value = client._id;
                option.textContent = client.name;
                clientSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error fetching clients for dropdown:', error);
            showToast('حدث خطأ في الاتصال بالخادم أثناء جلب العملاء.', 'error');
        }
    }

    // NEW: Function to fetch engineers (users with role 'engineer') and populate the dropdown
    async function fetchEngineersForDropdown() {
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            console.error('No auth token found for fetching engineers.');
            return;
        }

        try {
            // Fetch users with role 'engineer'
            const response = await fetch(`${API_BASE_URL}/users?role=engineer`, { // Using API_BASE_URL constant and filtering by role
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Failed to fetch engineers for dropdown:', response.status, errorData.message);
                showToast('فشل جلب قائمة المهندسين.', 'error');
                return;
            }

            const engineers = await response.json();
            engineerSelect.innerHTML = '<option value="">اختر مهندس</option>'; 
            engineers.forEach(engineer => {
                const option = document.createElement('option');
                option.value = engineer._id;
                option.textContent = engineer.username; // Display engineer's username
                engineerSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error fetching engineers for dropdown:', error);
            showToast('حدث خطأ في الاتصال بالخادم أثناء جلب المهندسين.', 'error');
        }
    }

    // Call fetch functions when the page loads
    fetchClientsForDropdown();
    fetchEngineersForDropdown(); // NEW: Call engineer fetch when page loads


    if (addProjectForm) {
        addProjectForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // منع الإرسال الافتراضي للنموذج

            const projectName = document.getElementById('projectName').value;
            const projectAddress = document.getElementById('projectAddress').value;
            const projectDescription = document.getElementById('projectDescription').value;
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;
            const notes = document.getElementById('notes').value;
            const selectedClient = clientSelect.value; 
            const selectedEngineer = engineerSelect.value; // NEW: Get selected engineer ID

            // التحقق الأساسي من المدخلات
            if (!projectName || !projectAddress || !startDate) {
                showToast('الرجاء ملء الحقول المطلوبة: اسم المشروع، العنوان، وتاريخ البدء.', 'error');
                return;
            }
            if (endDate && startDate && new Date(endDate) < new Date(startDate)) {
                showToast('تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء.', 'error');
                return;
            }

            const projectData = {
                name: projectName,
                address: projectAddress,
                description: projectDescription,
                startDate: startDate,
                endDate: endDate,
                notes: notes,
                status: 'ongoing', // افتراضياً، المشروع يبدأ كـ "جارية"
                client: selectedClient || undefined, // Add client ID, send undefined if not selected
                engineerId: selectedEngineer || undefined // NEW: Add engineer ID, send undefined if not selected
            };

            const authToken = localStorage.getItem('authToken');
            if (!authToken) {
                showToast('الرجاء تسجيل الدخول لإضافة مشروع.', 'error');
                window.location.href = 'index.html';
                return;
            }

            try {
                const response = await fetch(`${API_BASE_URL}/projects`, { // Using API_BASE_URL constant
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}` // إرسال التوكن للمصادقة
                    },
                    body: JSON.stringify(projectData)
                });

                if (response.ok) {
                    showToast('تم إضافة المشروع بنجاح!', 'success');
                    addProjectForm.reset(); // تفريغ النموذج بعد الحفظ
                    // Refresh dropdowns after successful add to clear selected values if needed
                    await fetchClientsForDropdown(); 
                    await fetchEngineersForDropdown(); // NEW: Refresh engineer dropdown too

                } else {
                    const errorData = await response.json();
                    console.error('Error adding project:', errorData);
                    showToast(errorData.message || 'فشل إضافة المشروع. يرجى التحقق من البيانات.', 'error');
                }
            } catch (error) {
                console.error('Error in network request for adding project:', error);
                showToast('حدث خطأ في الاتصال بالخادم أثناء إضافة المشروع. يرجى المحاولة مرة أخرى لاحقاً.', 'error');
            }
        });
    }
});
