/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export class TooltipTiming {
    private activeHide?: () => void;
    private warmUntil = 0;

    get delay(): number {
        return this.activeHide || Date.now() < this.warmUntil ? 0 : 800;
    }

    shown(hide: () => void): void {
        if (this.activeHide !== hide) {
            this.activeHide?.();
        }
        this.activeHide = hide;
    }

    hidden(hide: () => void): void {
        if (this.activeHide === hide) {
            this.activeHide = undefined;
            this.warmUntil = Date.now() + 1000;
        }
    }
}

// Shared by all custom tooltips in this webview, including graph rows and toolbar buttons.
export const tooltipTiming = new TooltipTiming();
