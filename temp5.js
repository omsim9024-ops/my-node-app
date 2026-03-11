async function handleRegisterSubmit(e) {
    try {
        alert('register handler invoked (role=' + selectedRole + ')');
        // debug - see if handler fires and what code is present
        const debugCode = document.getElementById('regCode') ? document.getElementById('regCode').value.trim() : '';
        console.log('[auth] register submit, role=', selectedRole, 'code=', debugCode);
        // no registration allowed for admin role; should be hidden in UI but guard anyway
        if (selectedRole === 'admin') {
            alert('Admin accounts must be created by a developer.');
            return;
        }
        e.preventDefault();

    const firstName = document.getElementById('regFirstName').value.trim();
    const lastName = document.getElementById('regLastName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;
    const agreeTerms = document.querySelector('input[name="agreeTerms"]').checked;
    // regCode removed per new policy
    const regCode = document.getElementById('regCode') ? document.getElementById('regCode').value.trim() : '';
    const gradeLevel = 'Unspecified';
    const studentID = document.getElementById('regStudentID') ? document.getElementById('regStudentID').value.trim() : '';
    const adminRole = document.getElementById('adminRoleSelect') ? document.getElementById('adminRoleSelect').value : '';

    if (!firstName || !lastName || !email || !password || !confirmPassword) {
        alert('Please fill in all required fields');
        return;
    }
    if (password.length < 8) {
        alert('Password must be at least 8 characters');
        return;
    }
    if (password !== confirmPassword) {
        alert('Passwords do not match');
        return;
    }
    if (!agreeTerms) {
        alert('Please agree to the terms and conditions');
        return;
    }
    if (selectedRole === 'student' && studentID && !/^\d{12}$/.test(studentID)) {
        alert('LRN must be exactly 12 digits (numbers only).');
        return;
    }
    if (selectedRole === 'admin' && !adminRole) {
        alert('Please select an admin role');
        return;
    }

    // teacher must provide a registration code
    if (selectedRole === 'adviser') {
        if (!regCode) {
            alert('Please enter the registration code provided by the admin');
            return;
        }
        const validation = await validateRegistrationCode(regCode);
        if (!validation.valid) {
            alert(validation.error || 'Invalid registration code');
            return;
        }
    }

    try {
        let endpoint = '';
        let body = {};

        if (selectedRole === 'student') {
            endpoint = '/api/auth/register';
            body = { firstName, lastName, email, password, gradeLevel, studentID: studentID || undefined };
        } else if (selectedRole === 'adviser') {
            endpoint = '/api/adviser-auth/register'; // new public endpoint we'll add on server
            // server expects snake_case names; mirror student logic
            body = { first_name: firstName, last_name: lastName, email, password };
            const adviserIdInput = document.getElementById('regAdviserId');
            if (adviserIdInput) body.adviser_id = adviserIdInput.value.trim();
            if (regCode) body.registrationCode = regCode;
        } else if (selectedRole === 'admin') {
            endpoint = '/api/admin/register';
            body = { name: `${firstName} ${lastName}`, email, password, role: adminRole };
        }

        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: selectedRole === 'admin' ? 'include' : 'same-origin',
            body: JSON.stringify(body)
        });

        const raw = await response.text();
        let data;
        let data;

        if (!response.ok) {
            alert((data && data.error) ? data.error : `Registration failed: ${response.status}`);
            return;
        }

        // (server-side registration endpoints already increment the code usage count)
        // the client no longer needs to call useRegistrationCode here.

        await showSuccessModal('Account created successfully. Please log in using your credentials.');

        const loginTabBtn = document.querySelector('.tab-btn[data-tab="login"]');
        if (loginTabBtn) loginTabBtn.click();
        showLoginFormMessage('Account created successfully. Please log in using your credentials.');

        e.target.reset();
    } catch (err) {
        console.error('Registration error:', err);
        alert('Registration exception: ' + (err.message || String(err)));
    }
}
