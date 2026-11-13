/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import './scroll-fade.css';

/**
 * Fade only clipped edges. The first element child must wrap the content at its
 * natural size, so observing it also catches text, font, and list-size changes.
 */
export function scrollFade(node: HTMLElement, axis: 'horizontal' | 'vertical') {
    let previousStart = -1;
    let previousEnd = -1;

    const measure = (): void => {
        const viewport = axis === 'horizontal' ? node.clientWidth : node.clientHeight;
        const extent = axis === 'horizontal' ? node.scrollWidth : node.scrollHeight;
        const maximum = Math.max(0, extent - viewport);
        const position = Math.min(maximum, Math.max(0, axis === 'horizontal' ? node.scrollLeft : node.scrollTop));
        // Scroll offsets are fractional, but client/scroll sizes are rounded.
        // Taper near either edge and ignore the final rounding pixel.
        const fadeSize = Math.min(24, viewport / 2);
        const start = position > 1 ? Math.min(fadeSize, position) : 0;
        const remaining = maximum - position;
        const end = remaining > 1 ? Math.min(fadeSize, remaining) : 0;
        if (start === previousStart && end === previousEnd) {
            return;
        }
        previousStart = start;
        previousEnd = end;
        node.style.setProperty('--scroll-fade-start', `${start}px`);
        node.style.setProperty('--scroll-fade-end', `${end}px`);
        if (start || end) {
            node.dataset.scrollFade = axis;
        } else {
            delete node.dataset.scrollFade;
        }
    };

    // Measure immediately, then again before paint whenever layout changes.
    // Observing both boxes avoids relying on a scroll event after initial load.
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    if (node.firstElementChild) {
        observer.observe(node.firstElementChild);
    }
    node.addEventListener('scroll', measure, { passive: true });
    measure();

    return {
        destroy(): void {
            observer.disconnect();
            node.removeEventListener('scroll', measure);
            delete node.dataset.scrollFade;
            node.style.removeProperty('--scroll-fade-start');
            node.style.removeProperty('--scroll-fade-end');
        },
    };
}
