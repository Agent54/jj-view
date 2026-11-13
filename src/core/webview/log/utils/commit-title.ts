/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

const COMMIT_TYPE_GLYPHS = {
    feat: 'M11.2 3.8Q12 1.8 12.8 3.8C14.1 8.1 15.9 9.9 20.2 11.2Q22.2 12 20.2 12.8C15.9 14.1 14.1 15.9 12.8 20.2Q12 22.2 11.2 20.2C9.9 15.9 8.1 14.1 3.8 12.8Q1.8 12 3.8 11.2C8.1 9.9 9.9 8.1 11.2 3.8Z',
    chore: 'M14 6a5 5 0 0 0-6 6L3 17a3 3 0 0 0 4 4l5-5a5 5 0 0 0 6-6l-3 3-4-4z',
    test: 'M9 3a1 1 0 0 0 0 2v5l-5.5 8.3A2.4 2.4 0 0 0 5.5 22h13a2.4 2.4 0 0 0 2-3.7L15 10V5a1 1 0 0 0 0-2z',
    fix: 'M9 6a3 3 0 1 1 6 0v1H9zM7 8h10v8a5 5 0 0 1-10 0zM7 9 4.5 7.5a1 1 0 0 0-1 1.7L7 11zM17 9l2.5-1.5a1 1 0 0 1 1 1.7L17 11zM3 13h4v2H3a1 1 0 0 1 0-2zM17 13h4a1 1 0 0 1 0 2h-4zM7 17l-3.5 2a1 1 0 0 0 1 1.7L8 19zM17 17l3.5 2a1 1 0 0 1-1 1.7L16 19z',
    hotfix: 'M12 2c1 6 7 7 7 13a7 7 0 0 1-14 0c0-3 2-5 4-7 0 3 1 4 2 4 2-3 2-6 1-10z',
    style: 'm9 11 9-8a2.1 2.1 0 0 1 3 3l-9 8zM9 11c-3-1-5 1-5 4 0 2-1 3-2 4 5 1 10-1 10-5z',
    refactor:
        'M4 6h11V3.8c0-.7.8-1.1 1.4-.6l5 4.2a.8.8 0 0 1 0 1.2l-5 4.2c-.6.5-1.4.1-1.4-.6V10H4a2 2 0 0 1 0-4zM20 14H9v-2.2c0-.7-.8-1.1-1.4-.6l-5 4.2a.8.8 0 0 0 0 1.2l5 4.2c.6.5 1.4.1 1.4-.6V18h11a2 2 0 0 0 0-4z',
    ui: 'M5 3h14a2 2 0 0 1 2 2v2H3V5a2 2 0 0 1 2-2zM3 9h5v12H5a2 2 0 0 1-2-2zM10 9h11v10a2 2 0 0 1-2 2h-9z',
};

export function compactCommitTitle(title: string): { text: string; prefix: string; glyphPath: string } {
    const colon = title.indexOf(':');
    if (colon === -1) {
        return { text: title, prefix: '', glyphPath: '' };
    }

    const prefix = title.slice(0, colon + 1);
    const type = /\b(hotfix|feat|chore|test|fix|style|refactor|ui)\b/i.exec(prefix)?.[1].toLowerCase();
    if (!type || !Object.hasOwn(COMMIT_TYPE_GLYPHS, type)) {
        return { text: title, prefix: '', glyphPath: '' };
    }

    return {
        text: title.slice(colon + 1).trimStart(),
        prefix,
        glyphPath: COMMIT_TYPE_GLYPHS[type as keyof typeof COMMIT_TYPE_GLYPHS],
    };
}
