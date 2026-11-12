/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, expect, it } from 'vitest';
import { compactCommitTitle } from '../core/webview/log/utils/commit-title';

describe('compactCommitTitle', () => {
    it.each(['feat', 'chore', 'test', 'fix', 'hotfix'])('compacts %s prefixes and preserves later colons', (type) => {
        const result = compactCommitTitle(`${type}: handle input: output`);
        expect(result.text).toBe('handle input: output');
        expect(result.prefix).toBe(`${type}:`);
        expect(result.glyphPath).not.toBe('');
    });

    it.each([
        'feat(ui)!:',
        'HOTFIX(server):',
        'release chore:',
        'test:',
    ])('preserves the full prefix %s for tooltips', (prefix) => {
        expect(compactCommitTitle(`${prefix}   update`).prefix).toBe(prefix);
        expect(compactCommitTitle(`${prefix}   update`).text).toBe('update');
    });

    it.each([
        '',
        'fix the title',
        'docs: fix the title',
        'feature: update',
        'prefix: update',
        'contest: update',
        ': fix',
    ])('leaves unrelated title %j unchanged', (title) => {
        expect(compactCommitTitle(title)).toEqual({ text: title, prefix: '', glyphPath: '' });
    });
});
