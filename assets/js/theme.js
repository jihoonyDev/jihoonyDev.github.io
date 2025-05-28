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
                // 버튼 클릭 시 항상 기본 동작 방지 (예: form 제출 방지. 링크 이동은 HTML button에 없음)
                e.preventDefault(); 
                
                const dropdown = toggle.closest('.nav-dropdown');
                const isActive = dropdown.classList.contains('active');
                const isNested = dropdown.classList.contains('nested');
                
                if (!isNested) {
                    document.querySelectorAll('.nav-dropdown:not(.nested)').forEach(item => {
                        if (item !== dropdown) {
                            item.classList.remove('active');
                            item.querySelectorAll('.nav-dropdown.nested').forEach(nestedItem => {
                                nestedItem.classList.remove('active');
                            });
                        }
                    });
                } else {
                    const parentDropdownMenu = dropdown.closest('.nav-dropdown-menu');
                    if (parentDropdownMenu) {
                        parentDropdownMenu.querySelectorAll('.nav-dropdown.nested').forEach(item => {
                            if (item !== dropdown) {
                                item.classList.remove('active');
                            }
                        });
                    }
                }
                
                if (isActive) {
                    dropdown.classList.remove('active');
                    dropdown.querySelectorAll('.nav-dropdown.nested').forEach(nestedItem => {
                        nestedItem.classList.remove('active');
                    });
                } else {
                    dropdown.classList.add('active');
                }
            });
        });
        
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
    
    // TOC 초기화 - 더 확실한 조건 확인
    const tocElement = document.getElementById('toc');
    const postContent = document.querySelector('.post-content');
    
    if (tocElement && postContent) {
        window.tocManager = new TOCManager();
    }
});

// TOC (Table of Contents) 관리 클래스
class TOCManager {
    constructor() {
        this.tocContainer = document.getElementById('toc');
        this.contentContainer = document.querySelector('.post-content');
        this.headings = [];
        this.init();
    }

    init() {
        if (!this.tocContainer || !this.contentContainer) return;
        
        this.generateTOC();
        this.setupScrollSpy();
        this.setupSmoothScroll();
        this.setupTocScrollEvent();
    }

    generateTOC() {
        const headings = this.contentContainer.querySelectorAll('h1, h2, h3, h4, h5, h6');
        
        if (headings.length === 0) {
            const tocSidebar = this.tocContainer.closest('.toc-sidebar');
            if (tocSidebar) {
                tocSidebar.style.display = 'none';
            }
            return;
        }

        const tocList = document.createElement('ul');
        
        headings.forEach((heading, index) => {
            const id = heading.id || `heading-${index}`;
            heading.id = id;
            
            const level = parseInt(heading.tagName.charAt(1));
            const text = heading.textContent.trim();
            
            const listItem = document.createElement('li');
            const link = document.createElement('a');
            
            link.href = `#${id}`;
            link.textContent = text;
            link.className = `toc-h${level}`;
            link.setAttribute('data-heading-id', id);
            
            listItem.appendChild(link);
            tocList.appendChild(listItem);
            
            this.headings.push({
                element: heading,
                link: link,
                id: id,
                level: level
            });
        });
        
        this.tocContainer.appendChild(tocList);
    }

    setupScrollSpy() {
        const observerOptions = {
            root: null,
            rootMargin: '-20% 0px -70% 0px',
            threshold: 0
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const headingId = entry.target.id;
                const tocLink = this.tocContainer.querySelector(`a[data-heading-id="${headingId}"]`);
                
                if (entry.isIntersecting) {
                    this.setActiveLink(tocLink);
                }
            });
        }, observerOptions);

        this.headings.forEach(heading => {
            observer.observe(heading.element);
        });
    }

    setActiveLink(activeLink) {
        this.tocContainer.querySelectorAll('a').forEach(link => {
            link.classList.remove('active');
        });
        
        if (activeLink) {
            activeLink.classList.add('active');
        }
    }

    setupSmoothScroll() {
        this.tocContainer.addEventListener('click', (e) => {
            if (e.target.tagName === 'A') {
                e.preventDefault();
                
                const targetId = e.target.getAttribute('href').substring(1);
                const targetElement = document.getElementById(targetId);
                
                if (targetElement) {
                    const headerHeight = document.querySelector('header')?.offsetHeight || 0;
                    const offset = headerHeight + 20;
                    
                    const targetPosition = targetElement.offsetTop - offset;
                    
                    window.scrollTo({
                        top: targetPosition,
                        behavior: 'smooth'
                    });
                }
            }
        });
    }

    setupTocScrollEvent() {
        const tocContainer = document.querySelector('.toc-container');
        
        if (!tocContainer) return;
        
        // TOC 컨테이너에서 휠 이벤트 처리
        tocContainer.addEventListener('wheel', (e) => {
            const delta = e.deltaY;
            const scrollTop = tocContainer.scrollTop;
            const scrollHeight = tocContainer.scrollHeight;
            const clientHeight = tocContainer.clientHeight;
            
            // TOC 내부에 스크롤할 공간이 있는지 확인
            if (scrollHeight > clientHeight) {
                // 스크롤이 맨 위나 맨 아래에 도달했을 때만 페이지 스크롤 허용
                if ((delta < 0 && scrollTop > 0) || (delta > 0 && scrollTop < scrollHeight - clientHeight)) {
                    e.preventDefault();
                    e.stopPropagation();
                    tocContainer.scrollTop += delta;
                }
            }
        }, { passive: false });
        
        // 터치 이벤트도 처리 (모바일 대응)
        let touchStartY = 0;
        
        tocContainer.addEventListener('touchstart', (e) => {
            touchStartY = e.touches[0].clientY;
        }, { passive: true });
        
        tocContainer.addEventListener('touchmove', (e) => {
            const scrollTop = tocContainer.scrollTop;
            const scrollHeight = tocContainer.scrollHeight;
            const clientHeight = tocContainer.clientHeight;
            
            if (scrollHeight > clientHeight) {
                const touchY = e.touches[0].clientY;
                const deltaY = touchStartY - touchY;
                
                if ((deltaY < 0 && scrollTop > 0) || (deltaY > 0 && scrollTop < scrollHeight - clientHeight)) {
                    e.stopPropagation();
                }
            }
        }, { passive: false });
    }
} 