// public/js/dashboard.js

document.addEventListener('DOMContentLoaded', () => {
    // جلب عناصر الداشبورد
    const clientsCountSpan = document.getElementById('clientsCount');
    const totalProjectsCountSpan = document.getElementById('totalProjectsCount');
    const ongoingProjectsCountSpan = document.getElementById('ongoingProjectsCount');
    const completedProjectsCountSpan = document.getElementById('completedProjectsCount');

    // دالة لجلب بيانات لوحة التحكم
    async function fetchDashboardData() {
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            // توجيه المستخدم لصفحة تسجيل الدخول إذا لم يكن هناك توكن
            window.location.href = 'index.html';
            return;
        }

        try {
            // **تم تعديل الـ endpoint ليتوافق مع الـ Backend**
            const response = await fetch('https://6943-156-203-135-174.ngrok-free.app/api/dashboard/summary', {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });

            if (!response.ok) {
                // إذا كان الرد ليس OK (مثلاً 401, 403, 500)
                const errorData = await response.json();
                console.error('Failed to fetch dashboard data:', response.status, errorData.message);
                showToast(errorData.message || 'فشل جلب بيانات لوحة التحكم.', 'error');
                // إذا كان خطأ مصادقة أو صلاحية، أعد التوجيه لصفحة تسجيل الدخول
                if (response.status === 401 || response.status === 403) {
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('userRole');
                    localStorage.removeItem('username');
                    window.location.href = 'index.html';
                }
                return;
            }

            const data = await response.json();

            // تحديث الواجهة ببيانات الداشبورد
            clientsCountSpan.textContent = data.clientsCount;
            totalProjectsCountSpan.textContent = data.totalProjectsCount;
            ongoingProjectsCountSpan.textContent = data.ongoingProjectsCount;
            completedProjectsCountSpan.textContent = data.completedProjectsCount;

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            showToast('حدث خطأ في الاتصال بالخادم أثناء جلب بيانات لوحة التحكم.', 'error');
        }
    }

    // استدعاء الدالة لجلب البيانات عند تحميل الصفحة
    fetchDashboardData();

    // تأكد من وجود دالة checkAuthAndRole في auth.js أو قم بتضمينها هنا إذا لم تكن موجودة.
    // يتم استدعائها في auth.js عند DOMContentLoaded، لذا لا داعي لاستدعائها مرة أخرى هنا.
});
