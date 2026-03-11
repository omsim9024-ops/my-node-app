function setSignInFeedback(message, type = '') {
    const node = document.getElementById('developerSignInFeedback');
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

    const signUpLink = document.getElementById('developerSignUpLink');
    if (signUpLink) {
        const next = buildDeveloperRedirectTarget('developer-dashboard.html');
        signUpLink.href = `developer-signup.html?next=${encodeURIComponent(next)}`;
    }

    if (typeof getDeveloperSession === 'function' && getDeveloperSession()) {
        window.location.replace(buildDeveloperRedirectTarget('developer-dashboard.html'));
        return;
    }

    const form = document.getElementById('developerSignInForm');
    const button = document.getElementById('developerSignInBtn');
    if (!form || !button) return;

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        setSignInFeedback('');
        button.disabled = true;

        const email = document.getElementById('developerEmail')?.value || '';
        const password = document.getElementById('developerPassword')?.value || '';
        const result = await signInDeveloper({ email, password });

        if (!result.success) {
            setSignInFeedback(result.error || 'Sign in failed.', 'error');
            button.disabled = false;
            return;
        }

        setSignInFeedback('Sign in successful. Redirecting…', 'success');
        const destination = buildDeveloperRedirectTarget('developer-dashboard.html');
        window.location.replace(destination);
    });
});

