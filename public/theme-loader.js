// ==========================================
// THEME LOADER — chỉ đọc theme từ localStorage
// Áp dụng cho mọi module. KHÔNG có nút toggle.
// ==========================================

(function applySavedTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
})();