// public/js/edit-project.js

document.addEventListener('DOMContentLoaded', () => {
    const editProjectForm = document.getElementById('editProjectForm');
    const projectIdInput = document.getElementById('projectIdInput');
    const projectNameInput = document.getElementById('projectName');
    const projectAddressInput = document.getElementById('projectAddress');
    const projectDescriptionInput = document.getElementById('projectDescription');
    const projectStartDateInput = document.getElementById('projectStartDate');
    const projectEndDateInput = document.getElementById('projectEndDate');
    const clientSelect = document.getElementById('clientSelect');
    const engineerSelect = document.getElementById('engineerSelect'); // NEW: Get engineer select element
    const projectStatusSelect = document.getElementById('projectStatus');
    const projectNotesInput = document.getElementById('projectNotes');

    // Base URL for API requests
    const API_BASE_URL = 'https://6943-156-203-135-174.ngrok-free.app/api';

    // Get project ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('id');

    if (!projectId) {
        showToast('معرف المشروع غير موجود في الرابط.', 'error');
        // Optionally redirect or hide form
        return;
    }

    // Function to fetch project details and populate the form
    async function fetchProjectDetails() {
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            window.location.href = 'index.html';
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Failed to fetch project details:', response.status, errorData.message);
                showToast(errorData.message || 'فشل جلب تفاصيل المشروع.', 'error');
                return;
            }

            const project = await response.json();
            populateProjectForm(project);
        } catch (error) {
            console.error('Error fetching project details:', error);
            showToast('حدث خطأ أثناء جلب تفاصيل المشروع.', 'error');
        }
    }

    // Function to fetch clients and populate the dropdown
    async function fetchClientsForDropdown(selectedClientId = null) {
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            console.error('No auth token found for fetching clients.');
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/clients`, {
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
            clientSelect.innerHTML = '<option value="">اختر عميل (اختياري)</option>';
            clients.forEach(client => {
                const option = document.createElement('option');
                option.value = client._id;
                option.textContent = client.name;
                clientSelect.appendChild(option);
            });

            // Set the selected client if one was provided (for edit mode)
            if (selectedClientId) {
                clientSelect.value = selectedClientId;
            }
        } catch (error) {
            console.error('Error fetching clients for dropdown:', error);
            showToast('حدث خطأ في الاتصال بالخادم أثناء جلب العملاء.', 'error');
        }
    }

    // NEW: Function to fetch engineers (users with role 'engineer') and populate the dropdown
    async function fetchEngineersForDropdown(selectedEngineerId = null) {
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            console.error('No auth token found for fetching engineers.');
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/users?role=engineer`, { // Filter by role=engineer
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
            engineerSelect.innerHTML = '<option value="">اختر مهندس (اختياري)</option>';
            engineers.forEach(engineer => {
                const option = document.createElement('option');
                option.value = engineer._id;
                option.textContent = engineer.username; // Display engineer's username
                engineerSelect.appendChild(option);
            });

            // Set the selected engineer if one was provided (for edit mode)
            if (selectedEngineerId) {
                engineerSelect.value = selectedEngineerId;
            }
        } catch (error) {
            console.error('Error fetching engineers for dropdown:', error);
            showToast('حدث خطأ في الاتصال بالخادم أثناء جلب المهندسين.', 'error');
        }
    }

    // Function to populate the form with project data
    function populateProjectForm(project) {
        projectIdInput.value = project._id;
        projectNameInput.value = project.name;
        projectAddressInput.value = project.address;
        projectDescriptionInput.value = project.description || '';
        projectStartDateInput.value = project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : '';
        projectEndDateInput.value = project.endDate ? new Date(project.endDate).toISOString().split('T')[0] : '';
        projectStatusSelect.value = project.status;
        projectNotesInput.value = project.notes || '';

        // Populate client dropdown and set selected client
        fetchClientsForDropdown(project.client ? project.client._id : null);

        // NEW: Populate engineer dropdown and set selected engineer
        fetchEngineersForDropdown(project.engineerId ? project.engineerId._id : null);
    }

    // Event listener for form submission
    if (editProjectForm) {
        editProjectForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = projectNameInput.value;
            const address = projectAddressInput.value;
            const description = projectDescriptionInput.value;
            const startDate = projectStartDateInput.value;
            const endDate = projectEndDateInput.value;
            const client = clientSelect.value === '' ? null : clientSelect.value; // Send null if empty
            const engineerId = engineerSelect.value === '' ? null : engineerSelect.value; // NEW: Get selected engineer ID, send null if empty
            const status = projectStatusSelect.value;
            const notes = projectNotesInput.value;

            if (!name || !address || !startDate) {
                showToast('الرجاء ملء الحقول المطلوبة: اسم المشروع، العنوان، وتاريخ البدء.', 'error');
                return;
            }
            if (endDate && startDate && new Date(endDate) < new Date(startDate)) {
                showToast('تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء.', 'error');
                return;
            }

            const projectData = {
                name,
                address,
                description,
                startDate,
                endDate,
                client,
                engineerId, // NEW: Include engineerId
                status,
                notes
            };

            const authToken = localStorage.getItem('authToken');
            if (!authToken) {
                showToast('الرجاء تسجيل الدخول لتعديل المشروع.', 'error');
                window.location.href = 'index.html';
                return;
            }

            try {
                const response = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify(projectData)
                });

                if (response.ok) {
                    showToast('تم تحديث المشروع بنجاح!', 'success');
                    // Optionally redirect back to projects list or details page
                    window.location.href = 'projects.html';
                } else {
                    const errorData = await response.json();
                    console.error('Error updating project:', errorData);
                    showToast(errorData.message || 'فشل تحديث المشروع. يرجى التحقق من البيانات.', 'error');
                }
            } catch (error) {
                console.error('Error in network request for updating project:', error);
                showToast('حدث خطأ في الاتصال بالخادم أثناء تحديث المشروع. يرجى المحاولة مرة أخرى لاحقاً.', 'error');
            }
        });
    }

    // Initial fetch to load project details and populate dropdowns
    fetchProjectDetails();
    // No need to call fetchClientsForDropdown and fetchEngineersForDropdown here,
    // as they are called by populateProjectForm after fetching project details.
});
