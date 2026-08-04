// WYSIWYG export via tab capture + geometric crop.
// Uses window.innerWidth/Height for scale (clientWidth caused a fat right margin).
(function () {
    const PAGE_BG = '#f9f9f9';
    // Capture this much outside the element so card box-shadows aren't clipped.
    const SHADOW_PAD_CSS = 12;
    // Extra empty page-bg margin around the result (equal on all sides).
    const MARGIN_CSS = 2;
    // Preserve the full dashboard shadow at the bottom of the continuous capture.
    const CONTINUOUS_BOTTOM_SHADOW_PAD_CSS = 12;

    function timestampSlug() {
        const d = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
    }

    function delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    function downloadCanvas(canvas, filename) {
        const link = document.createElement('a');
        link.download = filename;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }

    function viewportSize() {
        // innerWidth/Height match Chrome tab-capture frames. clientWidth is
        // smaller by the scrollbar and made the right margin look too wide.
        const vv = window.visualViewport;
        return {
            width: window.innerWidth,
            height: window.innerHeight,
            offsetLeft: vv ? vv.offsetLeft : 0,
            offsetTop: vv ? vv.offsetTop : 0
        };
    }

    function ensureInView(target, padCss) {
        const prevX = window.scrollX;
        const prevY = window.scrollY;

        target.scrollIntoView({ block: 'start', inline: 'nearest' });
        const needTop = padCss + 8;
        let rect = target.getBoundingClientRect();
        if (rect.top < needTop) {
            window.scrollBy(0, rect.top - needTop);
        }

        rect = target.getBoundingClientRect();
        const vh = window.innerHeight;
        const needBottom = padCss + 8;
        if (rect.bottom > vh - needBottom) {
            const overflow = rect.bottom - (vh - needBottom);
            const canScroll = Math.max(0, rect.top - needTop);
            if (canScroll > 0) {
                window.scrollBy(0, Math.min(overflow, canScroll));
            }
        }

        return function restore() {
            window.scrollTo(prevX, prevY);
        };
    }

    function hideExportChrome() {
        const root = document.documentElement;
        const hadClass = root.classList.contains('is-exporting');
        root.classList.add('is-exporting');

        const prev = [];
        const hide = (el) => {
            if (!el || prev.some((p) => p[0] === el)) return;
            prev.push([el, el.style.visibility]);
            el.style.visibility = 'hidden';
        };

        document.querySelectorAll(
            '.export-bar, .export-button, .modebar, .modebar-container, .plotly-notifier'
        ).forEach(hide);

        // Floating "inspector" / inspect overlays from browser tooling or extensions.
        document.querySelectorAll('body *').forEach((el) => {
            if (el.closest('.simulator-export-region')) return;
            const label = (
                (el.getAttribute && (el.getAttribute('aria-label') || el.getAttribute('title'))) ||
                ''
            ).trim();
            const text = (el.childElementCount === 0 && el.textContent ? el.textContent : '').trim();
            const sample = (label || text).slice(0, 80);
            if (!/inspect/i.test(sample)) return;
            const cs = window.getComputedStyle(el);
            if (cs.position !== 'fixed' && cs.position !== 'absolute' && cs.position !== 'sticky') return;
            hide(el);
            if (el.parentElement && el.parentElement !== document.body) {
                const pcs = window.getComputedStyle(el.parentElement);
                if (pcs.position === 'fixed' || pcs.position === 'absolute') hide(el.parentElement);
            }
        });

        if (document.activeElement && typeof document.activeElement.blur === 'function') {
            document.activeElement.blur();
        }
        try {
            document.body.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        } catch (err) { /* ignore */ }

        // Clear Plotly hover cards if present.
        if (window.Plotly && typeof window.Plotly.Fx === 'object') {
            document.querySelectorAll('.js-plotly-plot').forEach((gd) => {
                try {
                    window.Plotly.Fx.hover(gd, []);
                } catch (err) { /* ignore */ }
            });
        }

        return function restore() {
            prev.forEach(([el, value]) => {
                el.style.visibility = value;
            });
            if (!hadClass) root.classList.remove('is-exporting');
        };
    }

    // Crop element (+ shadow pad) from the tab frame, then place with equal
    // page-bg margin on every side.
    function cropElementFromFrame(frameCanvas, element, shadowPadCss, marginCss) {
        const rect = element.getBoundingClientRect();
        const vp = viewportSize();
        const scaleX = frameCanvas.width / vp.width;
        const scaleY = frameCanvas.height / vp.height;
        const scale = (scaleX + scaleY) / 2;

        const elX = (rect.left - vp.offsetLeft) * scaleX;
        const elY = (rect.top - vp.offsetTop) * scaleY;
        const elW = rect.width * scaleX;
        const elH = rect.height * scaleY;
        const shadowX = shadowPadCss * scaleX;
        const shadowY = shadowPadCss * scaleY;
        const bottomShadowCss = element.id === 'continuous-export-region'
            ? CONTINUOUS_BOTTOM_SHADOW_PAD_CSS
            : shadowPadCss;
        const bottomShadowY = bottomShadowCss * scaleY;

        const srcLeft = Math.max(0, elX - shadowX);
        const srcTop = Math.max(0, elY - shadowY);
        const srcRight = Math.min(frameCanvas.width, elX + elW + shadowX);
        const srcBottom = Math.min(frameCanvas.height, elY + elH + bottomShadowY);
        const copyW = Math.max(1, Math.round(srcRight - srcLeft));
        const copyH = Math.max(1, Math.round(srcBottom - srcTop));

        const margin = Math.max(1, Math.round(marginCss * scale));
        const out = document.createElement('canvas');
        out.width = copyW + margin * 2;
        out.height = copyH + margin * 2;
        const ctx = out.getContext('2d');
        ctx.fillStyle = PAGE_BG;
        ctx.fillRect(0, 0, out.width, out.height);
        // Always place content at (margin, margin) so all sides match.
        ctx.drawImage(
            frameCanvas,
            srcLeft, srcTop, copyW, copyH,
            margin, margin, copyW, copyH
        );
        return out;
    }

    async function grabFrameFromTrack(track) {
        if (typeof ImageCapture !== 'undefined') {
            try {
                const bitmap = await new ImageCapture(track).grabFrame();
                const canvas = document.createElement('canvas');
                canvas.width = bitmap.width;
                canvas.height = bitmap.height;
                canvas.getContext('2d').drawImage(bitmap, 0, 0);
                if (bitmap.close) bitmap.close();
                return canvas;
            } catch (err) {
                console.warn('ImageCapture.grabFrame failed; using video element', err);
            }
        }

        const stream = new MediaStream([track]);
        const video = document.createElement('video');
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        await video.play();

        const start = performance.now();
        while ((video.videoWidth < 2 || video.videoHeight < 2) && performance.now() - start < 2500) {
            await delay(40);
        }
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        await delay(150);

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        video.pause();
        video.srcObject = null;
        return canvas;
    }

    async function settleCaptureFrame() {
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        await delay(100);
    }

    // Continuous mode is taller than a typical browser viewport. Capture it in
    // vertical tiles so the dashboard and its shadow are present in the source.
    async function captureContinuousElement(track, element, shadowPadCss, marginCss) {
        const rect = element.getBoundingClientRect();
        const elementLeft = rect.left + window.scrollX;
        const elementTop = rect.top + window.scrollY;
        const captureLeft = elementLeft - shadowPadCss;
        const captureRight = elementLeft + rect.width + shadowPadCss;
        const captureTop = elementTop - shadowPadCss;
        const captureBottom = elementTop + rect.height + CONTINUOUS_BOTTOM_SHADOW_PAD_CSS;
        const captureWidth = captureRight - captureLeft;
        const captureHeight = captureBottom - captureTop;
        const maxScrollY = Math.max(
            0,
            document.documentElement.scrollHeight - window.innerHeight
        );

        let cursorY = captureTop;
        let out = null;
        let ctx = null;
        let outputScaleX = 1;
        let outputScaleY = 1;
        let margin = 0;

        while (cursorY < captureBottom - 0.25) {
            const visualOffsetTop = window.visualViewport
                ? window.visualViewport.offsetTop
                : 0;
            const scrollY = Math.min(
                maxScrollY,
                Math.max(0, cursorY - visualOffsetTop)
            );
            window.scrollTo(window.scrollX, scrollY);
            await settleCaptureFrame();

            const vp = viewportSize();
            const viewportLeft = window.scrollX + vp.offsetLeft;
            const viewportTop = window.scrollY + vp.offsetTop;
            const segmentStart = Math.max(cursorY, viewportTop);
            const segmentEnd = Math.min(captureBottom, viewportTop + vp.height);
            if (segmentEnd <= segmentStart + 0.25) {
                throw new Error('Unable to bring the full continuous export into view');
            }

            const frame = await grabFrameFromTrack(track);
            const frameScaleX = frame.width / vp.width;
            const frameScaleY = frame.height / vp.height;

            if (!out) {
                outputScaleX = frameScaleX;
                outputScaleY = frameScaleY;
                const outputScale = (outputScaleX + outputScaleY) / 2;
                margin = Math.max(1, Math.round(marginCss * outputScale));
                out = document.createElement('canvas');
                out.width = Math.round(captureWidth * outputScaleX) + margin * 2;
                out.height = Math.round(captureHeight * outputScaleY) + margin * 2;
                ctx = out.getContext('2d');
                ctx.fillStyle = PAGE_BG;
                ctx.fillRect(0, 0, out.width, out.height);
            }

            const drawLeft = Math.max(captureLeft, viewportLeft);
            const drawRight = Math.min(captureRight, viewportLeft + vp.width);
            if (drawRight <= drawLeft) {
                throw new Error('Unable to bring the continuous export width into view');
            }

            const drawWidth = drawRight - drawLeft;
            const drawHeight = segmentEnd - segmentStart;
            ctx.drawImage(
                frame,
                (drawLeft - viewportLeft) * frameScaleX,
                (segmentStart - viewportTop) * frameScaleY,
                drawWidth * frameScaleX,
                drawHeight * frameScaleY,
                margin + (drawLeft - captureLeft) * outputScaleX,
                margin + (segmentStart - captureTop) * outputScaleY,
                drawWidth * outputScaleX,
                drawHeight * outputScaleY
            );

            cursorY = segmentEnd;
        }

        return out;
    }

    async function captureElement(element) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
            throw new Error('Screen capture is not available in this browser');
        }

        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: { displaySurface: 'browser' },
            audio: false,
            preferCurrentTab: true,
            selfBrowserSurface: 'include',
            surfaceSwitching: 'exclude',
            systemAudio: 'exclude'
        });

        const [track] = stream.getVideoTracks();
        let restoreScroll = function () {};
        let restoreChrome = function () {};
        try {
            const previousX = window.scrollX;
            const previousY = window.scrollY;
            const isContinuous = element.id === 'continuous-export-region';
            restoreScroll = isContinuous
                ? function () { window.scrollTo(previousX, previousY); }
                : ensureInView(element, SHADOW_PAD_CSS + MARGIN_CSS);
            restoreChrome = hideExportChrome();

            if (isContinuous) {
                return await captureContinuousElement(
                    track,
                    element,
                    SHADOW_PAD_CSS,
                    MARGIN_CSS
                );
            }

            await settleCaptureFrame();
            const frame = await grabFrameFromTrack(track);
            return cropElementFromFrame(frame, element, SHADOW_PAD_CSS, MARGIN_CSS);
        } finally {
            restoreChrome();
            restoreScroll();
            stream.getTracks().forEach((t) => t.stop());
        }
    }

    async function exportRegion(targetId, button) {
        const target = document.getElementById(targetId);
        if (!target) {
            console.error('Export target not found:', targetId);
            return;
        }

        button.disabled = true;

        try {
            const canvas = await captureElement(target);
            const mode = button.getAttribute('data-export-name')
                || (targetId.includes('continuous') ? 'continuous' : 'binary');
            downloadCanvas(canvas, 'e2p-' + mode + '-' + timestampSlug() + '.png');
        } catch (err) {
            if (err && (err.name === 'NotAllowedError' || err.name === 'AbortError')) {
                return;
            }
            console.error('Failed to export simulator image:', err);
            alert(
                'Accurate export needs Chrome or Edge, and you must share this tab when prompted.\n\n' +
                'In the dialog, choose “This tab” / the current tab, then Allow.'
            );
        } finally {
            button.disabled = false;
        }
    }

    function initExportButtons() {
        document.querySelectorAll('.export-button[data-export-target]').forEach((button) => {
            button.addEventListener('click', () => {
                exportRegion(button.getAttribute('data-export-target'), button);
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initExportButtons);
    } else {
        initExportButtons();
    }
})();
