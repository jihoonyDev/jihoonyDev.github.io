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
        
        // 햄버거 메뉴 설정
        this.setupHamburgerMenu();
    }
    
    setupHamburgerMenu() {
        const hamburgerButton = document.querySelector('.hamburger-menu');
        const sideNav = document.querySelector('.side-nav');
        const sideNavOverlay = document.querySelector('.side-nav-overlay');
        const closeNavButton = document.querySelector('.close-nav');
        
        if (hamburgerButton && sideNav && sideNavOverlay) {
            // 햄버거 버튼 클릭 시 사이드 네비게이션 열기
            hamburgerButton.addEventListener('click', () => {
                sideNav.classList.add('active');
                sideNavOverlay.classList.add('active');
                document.body.style.overflow = 'hidden'; // 스크롤 방지
            });
            
            // 닫기 버튼 클릭 시 사이드 네비게이션 닫기
            if (closeNavButton) {
                closeNavButton.addEventListener('click', () => {
                    this.closeSideNav();
                });
            }
            
            // 오버레이 클릭 시 사이드 네비게이션 닫기
            sideNavOverlay.addEventListener('click', () => {
                this.closeSideNav();
            });
            
            // ESC 키로 네비게이션 닫기
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && sideNav.classList.contains('active')) {
                    this.closeSideNav();
                }
            });
            
            // 메뉴 링크 클릭 시 메뉴 닫기
            const navLinks = sideNav.querySelectorAll('a');
            navLinks.forEach(link => {
                link.addEventListener('click', () => {
                    this.closeSideNav();
                });
            });
            
            // 드롭다운 토글 설정
            this.setupDropdownToggles();
        }
    }
    
    closeSideNav() {
        const sideNav = document.querySelector('.side-nav');
        const sideNavOverlay = document.querySelector('.side-nav-overlay');
        
        if (sideNav && sideNavOverlay) {
            sideNav.classList.remove('active');
            sideNavOverlay.classList.remove('active');
            document.body.style.overflow = ''; // 스크롤 복원
        }
    }

    setupDropdownToggles() {
        const dropdownToggles = document.querySelectorAll('.nav-dropdown-toggle');
        
        dropdownToggles.forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.preventDefault();
                const dropdown = toggle.closest('.nav-dropdown');
                const isActive = dropdown.classList.contains('active');
                const isNested = dropdown.classList.contains('nested');
                
                // 중첩 드롭다운이 아닌 경우에만 다른 드롭다운들 닫기
                if (!isNested) {
                    document.querySelectorAll('.nav-dropdown:not(.nested)').forEach(item => {
                        if (item !== dropdown) {
                            item.classList.remove('active');
                            // 해당 드롭다운의 중첩 드롭다운들도 닫기
                            item.querySelectorAll('.nav-dropdown.nested').forEach(nestedItem => {
                                nestedItem.classList.remove('active');
                            });
                        }
                    });
                } else {
                    // 중첩 드롭다운인 경우 같은 레벨의 다른 중첩 드롭다운들만 닫기
                    const parentDropdown = dropdown.closest('.nav-dropdown-menu');
                    if (parentDropdown) {
                        parentDropdown.querySelectorAll('.nav-dropdown.nested').forEach(item => {
                            if (item !== dropdown) {
                                item.classList.remove('active');
                            }
                        });
                    }
                }
                
                // 현재 드롭다운 토글
                if (isActive) {
                    dropdown.classList.remove('active');
                    // 하위 중첩 드롭다운들도 닫기
                    dropdown.querySelectorAll('.nav-dropdown.nested').forEach(nestedItem => {
                        nestedItem.classList.remove('active');
                    });
                } else {
                    dropdown.classList.add('active');
                }
            });
        });
        
        // 문서 클릭 시 모든 드롭다운 닫기
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.nav-dropdown')) {
                document.querySelectorAll('.nav-dropdown').forEach(dropdown => {
                    dropdown.classList.remove('active');
                });
            }
        });
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