// ==========================================
// THEME TOGGLE — dùng chung cho các module
// Tự động đồng bộ theme qua localStorage
// ==========================================

(function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    document.addEventListener('DOMContentLoaded', function() {
        const btn = document.getElementById('themeToggleBtn');
        if (btn) {
            btn.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
        }
    });
})();

function toggleTheme() {
    const html = document.documentElement;
    const themeBtn = document.getElementById('themeToggleBtn');
    const current = html.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    
    html.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    
    if (themeBtn) {
        themeBtn.textContent = next === 'dark' ? '☀️' : '🌙';
    }
}

// Tự gắn sự kiện click cho nút theme khi DOM ready
document.addEventListener('DOMContentLoaded', function() {
    const btn = document.getElementById('themeToggleBtn');
    if (btn) {
        btn.addEventListener('click', toggleTheme);
    }
});