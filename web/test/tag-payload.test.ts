/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, expect, test } from 'vitest';
import { createTagPayload as createVsCodeTagPayload } from '../../src/vscode/payloads/tag.payload';
import { createDeleteTagPayload as createVsCodeDeleteTagPayload } from '../../src/vscode/payloads/tag-delete.payload';
import { createTagPayload as createWebTagPayload } from '../src/commands/payloads/tag.payload';
import { createDeleteTagPayload as createWebDeleteTagPayload } from '../src/commands/payloads/tag-delete.payload';

describe.each([
    { host: 'VS Code', createPayload: createVsCodeTagPayload },
    { host: 'web', createPayload: createWebTagPayload },
])('tag payload for $host', ({ createPayload }) => {
    test('uses the clicked revision instead of the working copy', () => {
        expect(createPayload([{ commitId: 'abc123' }])).toEqual({ revision: 'abc123' });
        expect(createPayload([{ 'jj.revision': 'def456' }])).toEqual({ revision: 'def456' });
        expect(createPayload(['abc123'])).toEqual({ revision: 'abc123' });
    });

    test('uses the working copy for a command palette invocation', () => {
        expect(createPayload([])).toEqual({ revision: '@' });
    });
});

describe.each([
    { host: 'VS Code', createPayload: createVsCodeDeleteTagPayload },
    { host: 'web', createPayload: createWebDeleteTagPayload },
])('delete tag payload for $host', ({ createPayload }) => {
    test('uses the clicked tag instead of its inherited revision or bookmark', () => {
        expect(createPayload([{ tagName: 'v1.0.0', commitId: 'abc123', bookmarkName: 'main' }])).toEqual({
            tagName: 'v1.0.0',
        });
        expect(createPayload([' v1.0.0 '])).toEqual({ tagName: 'v1.0.0' });
    });

    test('does not treat revision or bookmark context as a tag name', () => {
        expect(createPayload([{ commitId: 'abc123', bookmarkName: 'main' }])).toEqual({ tagName: undefined });
        expect(createPayload([])).toEqual({ tagName: undefined });
    });
});
