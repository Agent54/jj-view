/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

const COMMIT_TYPE_GLYPHS = {
    feat: 'M12 5v14M5 12h14',
    chore: 'M14 6a5 5 0 0 0-6 6L3 17a3 3 0 0 0 4 4l5-5a5 5 0 0 0 6-6l-3 3-4-4z',
    test: 'M9 3h6M10 3v7l-6 9a1.3 1.3 0 0 0 1 2h14a1.3 1.3 0 0 0 1-2l-6-9V3M7 15h10',
    fix: 'M9 7V5a3 3 0 0 1 6 0v2M7 7h10v8a5 5 0 0 1-10 0zM3 8l4 2M17 10l4-2M3 14h4M17 14h4M3 20l4-3M17 17l4 3M12 7v13',
    hotfix: 'M12 2c1 6 7 7 7 13a7 7 0 0 1-14 0c0-3 2-5 4-7 0 3 1 4 2 4 2-3 2-6 1-10z',
};

export function compactCommitTitle(title: string): { text: string; prefix: string; glyphPath: string } {
    const colon = title.indexOf(':');
    if (colon === -1) {
        return { text: title, prefix: '', glyphPath: '' };
    }

    const prefix = title.slice(0, colon + 1);
    const type = /\b(hotfix|feat|chore|test|fix)\b/i.exec(prefix)?.[1].toLowerCase();
    if (!type || !Object.hasOwn(COMMIT_TYPE_GLYPHS, type)) {
        return { text: title, prefix: '', glyphPath: '' };
    }

    return {
        text: title.slice(colon + 1).trimStart(),
        prefix,
        glyphPath: COMMIT_TYPE_GLYPHS[type as keyof typeof COMMIT_TYPE_GLYPHS],
    };
}
