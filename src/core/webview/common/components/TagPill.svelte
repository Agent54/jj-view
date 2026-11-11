<!--
  Copyright 2026 Google LLC
  SPDX-License-Identifier: Apache-2.0
-->
<script lang="ts">
import BasePill from './BasePill.svelte';

interface Props {
    tag: string;
    style?: string;
}

let { tag, style = '' }: Props = $props();

const accentColor = 'var(--vscode-charts-green)';
const backgroundColor = `var(--vscode-jjView-tag-background, color-mix(in srgb, ${accentColor}, transparent 90%))`;
const foregroundColor = `var(--vscode-jjView-tag-foreground, ${accentColor})`;
const borderColor = `var(--vscode-jjView-tag-background, color-mix(in srgb, ${accentColor}, transparent 50%))`;

let vscodeContext = $derived(
    JSON.stringify({
        webviewSection: 'jj.tag',
        tagName: tag,
        preventDefaultContextMenuItems: true,
    }),
);
</script>

<span data-vscode-context={vscodeContext} class="tag-wrapper">
    <BasePill
        title={tag}
        style="background-color: {backgroundColor}; color: {foregroundColor}; border: 1px solid {borderColor}; {style}"
    >
        <span aria-hidden="true" class="codicon codicon-tag"></span>
        <span class="pill-label">{tag}</span>
    </BasePill>
</span>

<style>
    .tag-wrapper {
        display: inline-flex;
        align-items: center;
        min-width: 22px;
        flex-shrink: 1;
    }
</style>



