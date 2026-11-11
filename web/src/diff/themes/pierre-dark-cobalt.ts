/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import pierreDark from '@pierre/theme/pierre-dark';

// Keep Pierre Dark's surfaces and syntax colors; only graph controls and badges differ.
export default {
    ...pierreDark,
    name: 'pierre-dark-cobalt',
    displayName: 'Pierre Dark Cobalt',
    colors: {
        ...pierreDark.colors,
        'jjView.bookmark.background': '#1f70eb',
        'jjView.bookmark.foreground': '#ffffff',
        'jjView.remoteBookmark.background': '#8250df',
        'jjView.remoteBookmark.foreground': '#ffffff',
        'jjView.tag.background': '#805606',
        'jjView.tag.foreground': '#ffffff',
        'jjView.commitAction.background': '#238636',
        'jjView.commitAction.hoverBackground': '#2da044',
        'jjView.commitAction.foreground': '#ffffff',
        'jjView.workingCopy.foreground': '#2da044',
    },
};
