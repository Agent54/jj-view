<!--
  Copyright 2026 Google LLC
  SPDX-License-Identifier: Apache-2.0
-->
<script lang="ts">
import BasePill from './BasePill.svelte';

interface Props {
    workspace: string;
    workspacePath?: string;
    style?: string;
}

let { workspace, workspacePath, style = '' }: Props = $props();

const accentColor = 'var(--vscode-charts-yellow)';
const backgroundColor = `var(--vscode-jjView-workspace-background, color-mix(in srgb, ${accentColor}, transparent 90%))`;
const foregroundColor = 'var(--vscode-jjView-workspace-foreground, var(--vscode-foreground))';

let vscodeContext = $derived(
    JSON.stringify({
        webviewSection: 'workspace',
        workspaceName: workspace,
        preventDefaultContextMenuItems: true,
    }),
);
</script>

<span
    data-vscode-context={vscodeContext}
    class="workspace-wrapper"
>
    <BasePill
        title={workspacePath ?? workspace}
        style="background-color: {backgroundColor}; color: {foregroundColor}; border: none; {style}"
    >
        <span class="pill-label">
            <span class="isolate-dir">{workspace}</span>
        </span>
    </BasePill>
</span>

<style>
    .workspace-wrapper {
        display: inline-flex;
        align-items: center;
        min-width: 22px;
        flex-shrink: 1;
    }

    .pill-label {
        direction: rtl;
        text-align: left;
    }

    .isolate-dir {
        direction: ltr;
        unicode-bidi: isolate;
    }
</style>

