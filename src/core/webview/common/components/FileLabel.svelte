<!--
  Copyright 2026 Google LLC
  SPDX-License-Identifier: Apache-2.0
-->
<script lang="ts">
interface Props {
    fileName: string;
    dirName: string;
    deleted?: boolean;
    conflicted?: boolean;
}

let { fileName, dirName, deleted = false, conflicted = false }: Props = $props();
</script>

<span class="file-label">
    <span class="file-name" class:deleted class:conflicted>{fileName}</span>
    {#if dirName}
        <span class="dir-name">{dirName}</span>
    {/if}
</span>

<style>
    .file-label {
        display: flex;
        align-items: baseline;
        gap: 6px;
        min-width: 0;
        flex: 1 1 auto;
        overflow: hidden;
        white-space: nowrap;
    }

    .file-name {
        font-weight: 500;
        color: var(--vscode-foreground, #d4d4d4);
        font-size: 13px;
        flex-shrink: 0;
        line-height: 22px;
    }

    .file-name.deleted {
        text-decoration: line-through;
        opacity: 0.75;
    }

    .file-name.conflicted {
        color: var(--vscode-gitDecoration-conflictingResourceForeground, #e51400);
    }

    .dir-name {
        font-size: 11px;
        color: var(--vscode-descriptionForeground, #8a8a8a);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        line-height: 22px;
        opacity: 0.85;
    }
</style>
