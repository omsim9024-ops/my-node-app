(async () => {
  try {
    const res = await fetch('http://localhost:3000/api/enrollments');
    console.log('HTTP', res.status);
    const text = await res.text();
    console.log(text.substring(0, 2000));
  } catch (err) {
    console.error('Fetch error:', err.message);
  }
})();

