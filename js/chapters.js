(function () {
    var observer = null;
    var chapters = [];

    function revealChapter(chapter) {
        // Double rAF so the browser paints the hidden state before transitioning
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                chapter.classList.add('is-visible');
            });
        });
        if (observer) {
            try {
                observer.unobserve(chapter);
            } catch (e) {
                // ignore
            }
        }
    }

    function isDisplayed(el) {
        return el.getClientRects().length > 0;
    }

    // Trigger when the chapter title area reaches mid-viewport — not when a
    // tall section's top edge barely clips (fade was finishing off-screen).
    function isInView(el) {
        var rect = el.getBoundingClientRect();
        var vh = window.innerHeight || document.documentElement.clientHeight;
        if (rect.width <= 0 || rect.height <= 0) return false;
        return rect.top < vh * 0.72 && rect.bottom > vh * 0.18;
    }

    function pendingDisplayed() {
        return chapters.some(function (chapter) {
            return !chapter.classList.contains('is-visible') && isDisplayed(chapter);
        });
    }

    function syncChapters() {
        chapters.forEach(function (chapter) {
            if (chapter.classList.contains('is-visible')) return;
            if (!isDisplayed(chapter)) {
                if (observer) {
                    try {
                        observer.unobserve(chapter);
                    } catch (e) {
                        // ignore
                    }
                }
                return;
            }
            if (isInView(chapter)) {
                revealChapter(chapter);
                return;
            }
            if (observer) {
                try {
                    observer.unobserve(chapter);
                } catch (e) {
                    // ignore
                }
                observer.observe(chapter);
            }
        });
    }

    function revealChapters() {
        chapters = Array.prototype.slice.call(document.querySelectorAll('.page-chapter'));
        if (!chapters.length) return;

        var reduceMotion = false;
        try {
            reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        } catch (e) {
            // ignore
        }

        if (reduceMotion || !('IntersectionObserver' in window)) {
            chapters.forEach(function (chapter) {
                chapter.classList.add('is-visible');
            });
            return;
        }

        document.documentElement.classList.add('js-chapters');

        observer = new IntersectionObserver(
            function (entries) {
                entries.forEach(function (entry) {
                    if (!entry.isIntersecting) return;
                    if (!isInView(entry.target)) return;
                    revealChapter(entry.target);
                });
            },
            {
                // Wait until the top of the chapter reaches ~mid viewport
                threshold: 0,
                rootMargin: '0px 0px -28% 0px'
            }
        );

        // Let the opacity:0 style apply before any sync reveal
        requestAnimationFrame(function () {
            syncChapters();
        });

        window.addEventListener(
            'scroll',
            function () {
                if (!pendingDisplayed()) return;
                syncChapters();
            },
            { passive: true }
        );

        document.querySelectorAll('.mode-toggle').forEach(function (btn) {
            btn.addEventListener('click', function () {
                requestAnimationFrame(function () {
                    setTimeout(syncChapters, 50);
                });
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', revealChapters);
    } else {
        revealChapters();
    }
})();
