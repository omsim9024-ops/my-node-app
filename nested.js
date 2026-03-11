async function h() {
  try {
    try { data = raw ? JSON.parse(raw) : {}; } catch (_e) { data = null; }
  } catch (err) { }
}
