function setSignUpFeedback(message, type = '') {
    const node = document.getElementById('developerSignUpFeedback');
    if (!node) return;
    node.textContent = String(message || '');
    node.classList.remove('error', 'success');
    if (type) node.classList.add(type);
}

function wirePasswordToggles() {
    document.querySelectorAll('.dev-password-toggle').forEach((button) => {
        button.addEventListener('click', () => {
            const targetId = button.getAttribute('data-target');
            const input = targetId ? document.getElementById(targetId) : null;
            if (!input) return;
            const makeVisible = input.type === 'password';
            input.type = makeVisible ? 'text' : 'password';
            button.textContent = makeVisible ? 'Hide' : 'Show';
            button.setAttribute('aria-label', makeVisible ? 'Hide password' : 'Show password');
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    wirePasswordToggles();

    const signInLink = document.getElementById('developerSignInLink');
    if (signInLink) {
        const next = buildDeveloperRedirectTarget('developer-dashboard.html');
        signInLink.href = `developer-signin.html?next=${encodeURIComponent(next)}`;
    }

    if (typeof getDeveloperSession === 'function' && getDeveloperSession()) {
        window.location.replace(buildDeveloperRedirectTarget('developer-dashboard.html'));
        return;
    }

    const form = document.getElementById('developerSignUpForm');
    const button = document.getElementById('developerSignUpBtn');
    if (!form || !button) return;

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        setSignUpFeedback('');
        button.disabled = true;

        const fullName = document.getElementById('developerFullName')?.value || '';
        const email = document.getElementById('developerEmail')?.value || '';
        const password = document.getElementById('developerPassword')?.value || '';
        const confirm = document.getElementById('developerConfirmPassword')?.value || '';

        if (password !== confirm) {
            setSignUpFeedback('Passwords do not match.', 'error');
            button.disabled = false;
            return;
        }

        const registration = await registerDeveloper({ fullName, email, password });
        if (!registration.success) {
            setSignUpFeedback(registration.error || 'Registration failed.', 'error');
            button.disabled = false;
            return;
        }

        setSignUpFeedback('Registration successful. Redirecting…', 'success');
        const destination = buildDeveloperRedirectTarget('developer-dashboard.html');
        window.location.replace(destination);
    });
});

