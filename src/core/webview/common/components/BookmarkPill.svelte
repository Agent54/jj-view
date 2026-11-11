<!--
  Copyright 2026 Google LLC
  SPDX-License-Identifier: Apache-2.0
-->
<script lang="ts">
import type { JjBookmark } from '../../../jj-types';
import BasePill from './BasePill.svelte';

interface Props {
    bookmark: JjBookmark;
    style?: string;
}

let { bookmark, style = '' }: Props = $props();

let displayName = $derived(bookmark.remote ? `${bookmark.name}@${bookmark.remote}` : bookmark.name);
let accentColor = $derived(bookmark.remote ? 'var(--vscode-charts-purple)' : 'var(--vscode-charts-blue)');
let tokenPrefix = $derived(bookmark.remote ? '--vscode-jjView-remoteBookmark' : '--vscode-jjView-bookmark');
let backgroundColor = $derived(`var(${tokenPrefix}-background, color-mix(in srgb, ${accentColor}, transparent 90%))`);
let foregroundColor = $derived(`var(${tokenPrefix}-foreground, ${accentColor})`);
let borderColor = $derived(`var(${tokenPrefix}-background, color-mix(in srgb, ${accentColor}, transparent 50%))`);

let vscodeContext = $derived(
    JSON.stringify({
        webviewSection: 'jj.bookmark',
        bookmarkName: bookmark.name,
        isRemoteBookmark: !!bookmark.remote,
        preventDefaultContextMenuItems: true,
    }),
);
</script>

<span
    data-vscode-context={vscodeContext}
    class="bookmark-wrapper"
>
    <BasePill
        title={displayName}
        style="background-color: {backgroundColor}; color: {foregroundColor}; border: 1px solid {borderColor}; {style}"
    >
        <span class="pill-label">{displayName}</span>
    </BasePill>
</span>

<style>
    .bookmark-wrapper {
        display: inline-flex;
        align-items: center;
        min-width: 22px;
        flex-shrink: 1;
    }
</style>

