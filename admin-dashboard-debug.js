// Debug helper script for reports
(function(){
    function resolveSchoolCodeForDebug() {
        try {
            const params = new URLSearchParams(window.location.search || '');
            const fromQuery = String(params.get('school') || params.get('tenant') || params.get('code') || '').trim().toLowerCase();
            if (fromQuery) return fromQuery;
        } catch (_e) { }
        return String(localStorage.getItem('sms.selectedSchoolCode') || localStorage.getItem('sms.selectedTenantCode') || '').trim().toLowerCase();
    }

    async function debugApiFetch(pathOrUrl, options = {}) {
        const schoolCode = resolveSchoolCodeForDebug();
        const url = new URL(pathOrUrl, window.location.origin);
        if (schoolCode) {
            url.searchParams.set('school', schoolCode);
        }

        const headers = {
            ...(options.headers || {}),
            ...(schoolCode ? { 'x-tenant-code': schoolCode } : {})
        };

        return fetch(url.toString(), {
            credentials: 'include',
            ...options,
            headers
        });
    }

    function showReportDebugInfo(message) {
        const activeReport = document.querySelector('.report-content.active');
        if (!activeReport) return;
        const prev = activeReport.querySelector('.report-debug-box');
        if (prev) prev.remove();
        const box = document.createElement('div');
        box.className = 'report-debug-box';
        box.style.cssText = 'background:#fff3cd;border-left:4px solid #ffeeba;padding:10px;margin:10px 0;border-radius:4px;color:#856404;font-size:13px;';
        box.textContent = message;
        const container = activeReport.querySelector('.content-card') || activeReport;
        container.insertBefore(box, container.firstChild);
    }

    async function forceLoadReportsUsingAll(reportType) {
        try {
            const resp = await debugApiFetch((typeof API_BASE !== 'undefined' ? API_BASE : '') + '/api/enrollments');
            if (!resp.ok) {
                showNotification('Failed fetching enrollments from server', 'error');
                console.error('forceLoadReportsUsingAll: fetch failed', resp.status, resp.statusText);
                return;
            }

            const enrollments = await resp.json();
            if (!Array.isArray(enrollments) || enrollments.length === 0) {
                showReportDebugInfo('Server returned 0 enrollments.');
                showNotification('No enrollments returned from server', 'error');
                console.info('forceLoadReportsUsingAll: no enrollments returned');
                return;
            }

            // Cache them in the in-memory store if available
            try { if (typeof addEnrollmentToStore === 'function') enrollments.forEach(e => addEnrollmentToStore(e)); } catch (e) { console.warn('Caching enrollments failed', e); }

            // Map to student-like objects (reuse mapping logic)
            const students = [];
            enrollments.forEach(enrollment => {
                try {
                    let data = enrollment.enrollment_data || {};
                    if (typeof data === 'string') {
                        try { data = JSON.parse(data); } catch (err) { /* ignore parse errors */ }
                    }

                    const studentObj = {
                        id: enrollment.student_id || data.studentID || data.studentId || data.lrn || data.email || `${(data.firstName||data.firstname||'').toString()} ${(data.lastName||data.lastname||'').toString()}`.trim(),
                        gender: (data.gender || data.sex || data.Gender || '').toString(),
                        grade_level: (data.grade_level || data.grade || data.gradeLevel || data['Grade'] || '').toString(),
                        disability_status: (data.disability || data.disability_status || data.disabilityType || '').toString(),
                        ip_status: (data.ip || data.ip_status || data.indigenous || '').toString(),
                        four_ps_status: (data.four_ps || data.fourPs || data.four_ps_status || data['4ps'] || '').toString(),
                        mother_tongue: (data.mother_tongue || data.motherTongue || data.language || '').toString(),
                        track: (data.track || data.program || data.track_program || '').toString(),
                        elective: (data.elective || data.elective_choice || data.electiveSelection || '').toString()
                    };

                    students.push(studentObj);
                } catch (err) {
                    console.warn('forceLoadReportsUsingAll: failed to parse enrollment', err);
                }
            });

            console.info('forceLoadReportsUsingAll: mapped students=', students.length, 'from enrollments=', enrollments.length);

            // Call report renderer for the requested type
            if (reportType === 'demographics') {
                loadDemographicsReport(students);
            } else if (reportType === 'disability') {
                loadDisabilityReport(students);
            } else if (reportType === 'indigenous') {
                loadIndigenousReport(students);
            } else if (reportType === '4ps') {
                load4PsReport(students);
            } else if (reportType === 'mothertongue') {
                loadMotherTongueReport(students);
            } else if (reportType === 'track') {
                loadTrackReport(students);
            } else if (reportType === 'electives') {
                loadElectivesReport(students);
            }

            showReportDebugInfo(`Loaded ${students.length} student records from server (fallback).`);
            showNotification('Reports loaded from server enrollments', 'success');
        } catch (err) {
            console.error('forceLoadReportsUsingAll error', err);
            showNotification('Failed loading enrollments for reports', 'error');
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        const tabs = document.querySelector('.report-tabs');
        if (!tabs) return;
        const btn = document.createElement('button');
        btn.id = 'debugLoadReportsBtn';
        btn.className = 'btn btn-secondary';
        btn.style.marginLeft = '12px';
        btn.textContent = 'Load Reports (server)';
        tabs.appendChild(btn);
        btn.addEventListener('click', () => {
            const activeTab = document.querySelector('.report-tab.active');
            const reportType = activeTab ? activeTab.getAttribute('data-report') : 'demographics';
            forceLoadReportsUsingAll(reportType);
        });
    });
})();



