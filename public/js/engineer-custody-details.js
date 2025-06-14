// public/js/engineer-custody-details.js

document.addEventListener('DOMContentLoaded', () => {
    const engineerSelectFilter = document.getElementById('engineerSelectFilter');
    const projectSelectFilter = document.getElementById('projectSelectFilter');
    const projectSelectionSection = document.querySelector('.project-selection-section');
    const selectedEngineerNameDisplay = document.getElementById('selectedEngineerName');
    const totalAssignedCustodySpan = document.getElementById('totalAssignedCustody');
    const totalSpentFromCustodySpan = document.getElementById('totalSpentFromCustody');
    const remainingCustodyBalanceSpan = document.getElementById('remainingCustodyBalance');
    const custodyExpensesTableBody = document.getElementById('custodyExpensesTableBody');

    const API_BASE_URL = 'https://6943-156-203-135-174.ngrok-free.app/api'; // استخدام localhost

    const currentUserRole = localStorage.getItem('userRole');
    const currentUserId = localStorage.getItem('userId');
    const currentUserName = localStorage.getItem('username');

    let selectedEngineerId = null;
    let selectedProjectId = null;

    // Show/hide sections based on user role
    const adminManagerViewOnlyElements = document.querySelectorAll('.admin-manager-view-only');
    const engineerViewOnlyElements = document.querySelectorAll('.engineer-view-only');

    if (currentUserRole === 'engineer') {
        adminManagerViewOnlyElements.forEach(el => el.style.display = 'none');
        engineerViewOnlyElements.forEach(el => el.style.display = 'block');
        selectedEngineerId = currentUserId; // Engineer can only see their own custody
        selectedEngineerNameDisplay.textContent = currentUserName;
        // For engineers, project selection section is hidden by default as they see their projects
        projectSelectionSection.style.display = 'none'; 
        // Initial fetch for engineer will be for all their custody details, not project-specific initially
        fetchEngineerCustodyDetails(selectedEngineerId, null); // Pass null for projectId initially
    } else { // admin or account_manager
        adminManagerViewOnlyElements.forEach(el => el.style.display = 'flex'); // Assuming flex for layout
        engineerViewOnlyElements.forEach(el => el.style.display = 'none');
        fetchEngineersForDropdown(); // Populate dropdown for admin/manager
        projectSelectionSection.style.display = 'none'; // Initially hide project dropdown
    }

    // Function to fetch engineers for the dropdown (Admin/Account Manager only)
    async function fetchEngineersForDropdown() {
        const authToken = localStorage.getItem('authToken');
        try {
            const response = await fetch(`${API_BASE_URL}/users?role=engineer`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            const engineers = await response.json();

            engineerSelectFilter.innerHTML = '<option value="">اختر مهندس لعرض عهدته</option>';
            engineers.forEach(engineer => {
                const option = document.createElement('option');
                option.value = engineer._id;
                option.textContent = engineer.username;
                engineerSelectFilter.appendChild(option);
            });
        } catch (error) {
            console.error('Error fetching engineers for filter:', error);
            showToast('فشل جلب قائمة المهندسين.', 'error');
        }
    }

    // Function to fetch projects for a specific engineer (Admin/Account Manager only)
    async function fetchProjectsForEngineer(engineerId) {
        const authToken = localStorage.getItem('authToken');
        try {
            // Fetch projects where this engineer is assigned
            const response = await fetch(`${API_BASE_URL}/projects?engineerId=${engineerId}`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            const projects = await response.json();

            projectSelectFilter.innerHTML = '<option value="">كل المشاريع</option>'; // Default option to view all projects for engineer
            projects.forEach(project => {
                const option = document.createElement('option');
                option.value = project._id;
                option.textContent = project.name;
                projectSelectFilter.appendChild(option);
            });
            projectSelectionSection.style.display = 'flex'; // Show project dropdown
        } catch (error) {
            console.error('Error fetching projects for engineer:', error);
            showToast('فشل جلب قائمة المشاريع للمهندس المختار.', 'error');
            projectSelectFilter.innerHTML = '<option value="">فشل التحميل</option>';
        }
    }

    // Function to fetch and display custody details for a selected engineer and optionally project
    async function fetchEngineerCustodyDetails(engineerId, projectId = null) {
        if (!engineerId) {
            // Clear previous data if no engineer is selected
            selectedEngineerNameDisplay.textContent = 'غير محدد';
            totalAssignedCustodySpan.textContent = '0.00';
            totalSpentFromCustodySpan.textContent = '0.00';
            remainingCustodyBalanceSpan.textContent = '0.00';
            custodyExpensesTableBody.innerHTML = '<tr><td colspan="5">الرجاء اختيار مهندس لعرض تفاصيل عهدته.</td></tr>';
            if (currentUserRole !== 'engineer') { // Only show this toast for admin/manager
                showToast('الرجاء اختيار مهندس لعرض تفاصيل عهدته.', 'info');
            }
            projectSelectionSection.style.display = 'none'; // Hide project dropdown
            projectSelectFilter.value = ''; // Clear projects dropdown value
            projectSelectFilter.innerHTML = '<option value="">كل المشاريع</option>'; // Clear projects options
            return;
        }

        const authToken = localStorage.getItem('authToken');
        try {
            // 1. Fetch the engineer's custody treasury balance (Overall Balance - not project specific)
            // This is for displaying the *total* available custody of the engineer.
            const treasuryResponse = await fetch(`${API_BASE_URL}/treasuries?type=custody&userId=${engineerId}`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });

            let engineerOverallBalance = 0;
            if (treasuryResponse.ok) {
                const treasuries = await treasuryResponse.json();
                if (treasuries.length > 0) {
                    engineerOverallBalance = treasuries[0].balance;
                }
            } else {
                console.error('Error fetching custody treasury (overall balance):', treasuryResponse.status);
            }
            // Display engineer's name based on the selected filter
            if (currentUserRole !== 'engineer') { // Only update name for admin/manager view
                 const selectedEngineerOption = engineerSelectFilter.options[engineerSelectFilter.selectedIndex];
                 selectedEngineerNameDisplay.textContent = selectedEngineerOption && selectedEngineerOption.value ? selectedEngineerOption.textContent : 'غير محدد';
            } else { // Engineer view
                selectedEngineerNameDisplay.textContent = currentUserName;
            }
            // The remainingCustodyBalanceSpan will be calculated based on project-specific assigned/spent
            // So we don't set it from treasuryResponse directly here for the dashboard summary.

            // 2. Fetch custody assignment transactions (initial assignments) - FILTERED BY PROJECT IF SELECTED
            let assignmentsEndpoint = `${API_BASE_URL}/transactions?type=custody_assignment&relatedUser=${engineerId}`;
            if (projectId) {
                assignmentsEndpoint += `&relatedProject=${projectId}`; // Filter by project if selected
            }

            const assignmentsResponse = await fetch(assignmentsEndpoint, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            let totalAssigned = 0;
            if (assignmentsResponse.ok) {
                const assignments = await assignmentsResponse.json();
                totalAssigned = assignments.reduce((sum, trans) => sum + trans.amount, 0);
            } else {
                console.error('Failed to fetch custody assignments:', assignmentsResponse.status);
            }
            totalAssignedCustodySpan.textContent = totalAssigned.toFixed(2);


            // 3. Fetch expense transactions from custody - FILTERED BY PROJECT IF SELECTED
            let expensesEndpoint = `${API_BASE_URL}/transactions?type=expense_from_custody&relatedUser=${engineerId}`;
            if (projectId) {
                expensesEndpoint += `&relatedProject=${projectId}`; // Add project filter
            }

            const expensesResponse = await fetch(expensesEndpoint, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });

            let totalSpent = 0;
            if (expensesResponse.ok) {
                const expenses = await expensesResponse.json();
                totalSpent = expenses.reduce((sum, trans) => sum + trans.amount, 0);
                renderCustodyExpenses(expenses);
            } else {
                console.error('Failed to fetch custody expenses:', expensesResponse.status);
                custodyExpensesTableBody.innerHTML = '<tr><td colspan="5">فشل جلب مصروفات العهدة.</td></tr>';
            }
            totalSpentFromCustodySpan.textContent = totalSpent.toFixed(2);

            // Calculate remaining balance for the *displayed project context*
            // If a project is selected, this reflects assigned for project - spent for project
            // If no project is selected, this reflects total assigned for engineer - total spent by engineer
            remainingCustodyBalanceSpan.textContent = (totalAssigned - totalSpent).toFixed(2);
            // Optionally, if engineer is viewing their own overall custody, you might display engineerOverallBalance here.
            // For now, the dashboard summary directly reflects the filters.

        } catch (error) {
            console.error('Error fetching engineer custody details:', error);
            showToast('حدث خطأ أثناء جلب تفاصيل عهدة المهندس.', 'error');
        }
    }

    // Function to render custody expenses in the table
    function renderCustodyExpenses(transactions) {
        custodyExpensesTableBody.innerHTML = '';
        if (transactions.length === 0) {
            custodyExpensesTableBody.innerHTML = '<tr><td colspan="5">لا توجد مصروفات من هذه العهدة حتى الآن.</td></tr>';
            return;
        }

        transactions.forEach(transaction => {
            const row = document.createElement('tr');
            // Ensure relatedUser, createdBy, and relatedProject are populated for display
            const engineerName = transaction.relatedUser ? transaction.relatedUser.username : 'غير محدد';
            const createdByName = transaction.createdBy ? transaction.createdBy.username : 'غير محدد';
            const projectName = transaction.relatedProject ? transaction.relatedProject.name : 'غير محدد';

            row.innerHTML = `
                <td>${new Date(transaction.date).toLocaleDateString('ar-EG')}</td>
                <td>${transaction.amount.toFixed(2)} EGP</td>
                <td>${transaction.description}</td>
                <td>${projectName}</td>
                <td>${createdByName}</td>
            `;
            custodyExpensesTableBody.appendChild(row);
        });
    }

    // Event listener for engineer selection dropdown
    if (engineerSelectFilter) {
        engineerSelectFilter.addEventListener('change', (e) => {
            selectedEngineerId = e.target.value;
            selectedProjectId = ''; // Reset project selection when engineer changes
            projectSelectFilter.value = ''; // Reset project dropdown to default
            if (selectedEngineerId) {
                fetchProjectsForEngineer(selectedEngineerId); // Fetch projects for new engineer
                fetchEngineerCustodyDetails(selectedEngineerId, null); // Fetch details for selected engineer (overall initially)
            } else {
                fetchEngineerCustodyDetails(null); // Clear details if no engineer selected
            }
        });
    }

    // Event listener for project selection dropdown
    if (projectSelectFilter) {
        projectSelectFilter.addEventListener('change', (e) => {
            selectedProjectId = e.target.value; // This will be '' if "كل المشاريع" is selected
            if (selectedEngineerId) { // Only fetch if an engineer is already selected
                fetchEngineerCustodyDetails(selectedEngineerId, selectedProjectId || null); // Pass null if 'كل المشاريع' selected
            }
        });
    }

    // Initial load logic is handled at the top
});
