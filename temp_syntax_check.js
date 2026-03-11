async function test() {
    try {
        alert('register handler invoked');
        e.preventDefault();

        const raw = '';
        let data;
        try { data = raw ? JSON.parse(raw) : {}; } catch (_e) { data = null; }

        if (!raw) {
            alert('fail');
            return;
        }

        e.target.reset();
    } catch (err) {
        console.error(err);
        alert('Registration exception: ' + (err.message || String(err)));
    }
}
