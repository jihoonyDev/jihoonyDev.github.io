// Theme switcher functionality
class ThemeManager {
    constructor() {
        this.theme = this.getStoredTheme() || this.getSystemTheme();
        this.init();
    }

    init() {
        // 페이지 로드 즉시 테마 적용
        this.applyThemeImmediately();
        this.updateTheme();
        this.setupToggleButton();
        this.setupSystemThemeListener();
    }

    applyThemeImmediately() {
        // FOUC (Flash of Unstyled Content) 방지를 위해 즉시 테마 적용
        const html = document.documentElement;
        if (this.theme === 'dark') {
            html.setAttribute('data-theme', 'dark');
        } else {
            html.setAttribute('data-theme', 'light');
        }
    }

    getStoredTheme() {
        return localStorage.getItem('theme');
    }

    getSystemTheme() {
        // 기본값을 다크 모드로 설정
        return 'dark';
    }

    setTheme(theme) {
        this.theme = theme;
        localStorage.setItem('theme', theme);
        this.updateTheme();
    }

    updateTheme() {
        const html = document.documentElement;
        
        if (this.theme === 'dark') {
            html.setAttribute('data-theme', 'dark');
        } else {
            html.setAttribute('data-theme', 'light');
        }

        this.updateToggleButton();
    }

    updateToggleButton() {
        const lightIcon = document.querySelector('.light-icon');
        const darkIcon = document.querySelector('.dark-icon');
        
        if (lightIcon && darkIcon) {
            if (this.theme === 'dark') {
                // 다크 모드일 때: 태양 아이콘 표시 (라이트로 전환 가능)
                lightIcon.classList.remove('hidden');
                darkIcon.classList.add('hidden');
            } else {
                // 라이트 모드일 때: 달 아이콘 표시 (다크로 전환 가능)
                lightIcon.classList.add('hidden');
                darkIcon.classList.remove('hidden');
            }
        }
    }

    toggleTheme() {
        const newTheme = this.theme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
    }

    setupToggleButton() {
        const toggleButton = document.querySelector('.theme-toggle');
        if (toggleButton) {
            toggleButton.addEventListener('click', () => {
                this.toggleTheme();
            });
        }
    }

    setupSystemThemeListener() {
        // Listen for system theme changes only if user hasn't set a manual preference
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!this.getStoredTheme()) {
                this.theme = 'dark'; // 항상 다크 모드 기본값 유지
                this.updateTheme();
            }
        });
    }
}

// 페이지 로드 즉시 테마 적용 (FOUC 방지)
(function() {
    const storedTheme = localStorage.getItem('theme');
    const theme = storedTheme || 'dark'; // 기본값을 다크 모드로 설정
    
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
    }
})();

// Initialize theme manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.themeManager = new ThemeManager();
}); 