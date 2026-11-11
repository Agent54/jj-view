<!--
  Copyright 2026 Google LLC
  SPDX-License-Identifier: Apache-2.0
-->
<script lang="ts">
import type { ActionPayload, CommitAction } from '../../../host/ipc/log-view-schemas';
import type { JjLogEntry } from '../../../jj-types';
import { BookmarkPill, IconButton, TagPill, WorkspacePill } from '../../common/components';
import Tooltip from '../../common/components/Tooltip.svelte';
import { getCompactRelativeTimeString, getRelativeTimeString } from '../../common/utils/time-utils';
import type { DragManager } from '../drag-manager.svelte';
import { COMMIT_ROW_PADDING_LEFT } from '../layout-constants';
import { formatCommitTooltip } from '../utils/commit-tooltip';
import { computeCommitActions } from '../utils/commit-utils';
import DraggableBookmark from './DraggableBookmark.svelte';

interface Props {
    onGenerateDescription?: (commit: JjLogEntry) => Promise<void>;
    commit: JjLogEntry;
    now: number;
    onClick: (modifiers: { multiSelect: boolean }) => void;
    onAction: (action: string, payload: ActionPayload) => void;
    isSelected?: boolean;
    isHighlighted?: boolean;
    selectionCount: number;
    hasImmutableSelection: boolean;
    idDisplayLength: number;
    hiddenActions?: Set<CommitAction>;
    dragManager: DragManager;
    descendantCount?: number;
    graphPaddingLeft?: number;
}

let {
    onGenerateDescription,
    commit,
    now,
    onClick,
    onAction,
    isSelected = false,
    isHighlighted = false,
    selectionCount,
    hasImmutableSelection,
    idDisplayLength,
    hiddenActions = new Set(),
    dragManager,
    descendantCount = 0,
    graphPaddingLeft = 0,
}: Props = $props();

let isHovered = $state(false);
let rowElement: HTMLDivElement | undefined = $state();
let isGeneratingDescription = $state(false);

async function handleGenerateDescription(e: MouseEvent): Promise<void> {
    e.stopPropagation();
    if (!onGenerateDescription || !canGenerateDescription || isGeneratingDescription) {
        return;
    }
    isGeneratingDescription = true;
    try {
        await onGenerateDescription(commit);
    } finally {
        isGeneratingDescription = false;
    }
}

const isImmutable = $derived(commit.is_immutable || false);
const canGenerateDescription = $derived(Boolean(onGenerateDescription) && !isImmutable);
const isCurrentWorkingCopy = $derived(commit.is_current_working_copy);
const isConflict = $derived(commit.conflict);
const isEmpty = $derived(commit.is_empty);
const codeForgeChange = $derived(commit.codeForgeChange);

const commentButtonState = $derived.by(() => {
    if (!codeForgeChange) {
        return undefined;
    }
    const unresolved = Math.max(0, codeForgeChange.unresolvedComments || 0);
    const drafts = Math.max(0, codeForgeChange.draftComments || 0);
    const responses = Math.max(0, codeForgeChange.draftResponses || 0);
    const addressed = Math.max(0, codeForgeChange.addressedThreads ?? responses);

    if (unresolved === 0 && drafts === 0 && responses === 0) {
        return undefined;
    }

    if (unresolved === 0) {
        const totalDrafts = drafts + responses;
        return {
            icon: 'codicon-edit',
            badge: `${totalDrafts}`,
            title: `${totalDrafts} Draft Comment${totalDrafts === 1 ? '' : 's'} (Click to view)`,
            allDrafted: true,
        };
    }

    if (addressed >= unresolved) {
        const addressedText = unresolved === 1 ? 'Addressed in draft' : 'All addressed in draft';
        return {
            icon: 'codicon-comment-discussion',
            badge: `${unresolved} ✎`,
            title: `${unresolved} Unresolved Comment${unresolved === 1 ? '' : 's'} (${addressedText}) (Click to view)`,
            allDrafted: true,
        };
    }

    if (addressed > 0) {
        return {
            icon: 'codicon-comment-discussion',
            badge: `${unresolved} (${addressed}✎)`,
            title: `${unresolved} Unresolved Comment${unresolved === 1 ? '' : 's'} (${addressed} addressed in draft) (Click to view)`,
            allDrafted: false,
        };
    }

    const draftNoteText = drafts > 0 ? ` (${drafts} draft note${drafts === 1 ? '' : 's'})` : '';
    return {
        icon: 'codicon-comment-discussion',
        badge: `${unresolved}`,
        title: `${unresolved} Unresolved Comment${unresolved === 1 ? '' : 's'}${draftNoteText} (Click to view)`,
        allDrafted: false,
    };
});

const actionsInfo = $derived(
    computeCommitActions(commit, hiddenActions, isSelected, selectionCount, hasImmutableSelection),
);
const visibleActions = $derived(actionsInfo.visibleActions);
const vscodeContext = $derived(actionsInfo.vscodeContext);

const isOver = $derived(dragManager.activeDropTarget?.changeId === commit.change_id);
const isDraggingThis = $derived(
    dragManager.activeDragItem?.type === 'commit' && dragManager.activeDragItem.changeId === commit.change_id,
);

// Background color computation
const backgroundColor = $derived.by(() => {
    if (isSelected) {
        if (isConflict) {
            return 'color-mix(in srgb, var(--vscode-list-activeSelectionBackground), var(--vscode-charts-red) 20%)';
        }
        return 'var(--vscode-list-activeSelectionBackground)';
    }
    if (isHovered || isOver || isHighlighted) {
        if (isConflict) {
            return 'color-mix(in srgb, transparent, var(--vscode-charts-red) 20%)';
        }
        if (commit.is_divergent) {
            return 'color-mix(in srgb, transparent, var(--vscode-charts-purple) 20%)';
        }
        return 'var(--vscode-list-hoverBackground)';
    }
    if (isConflict) {
        return 'color-mix(in srgb, transparent, var(--vscode-charts-red) 10%)';
    }
    if (commit.is_divergent) {
        return 'color-mix(in srgb, transparent, var(--vscode-charts-purple) 10%)';
    }
    return undefined;
});

const isValidDropTarget = $derived(isOver && !isDraggingThis);
const dropColor = $derived(dragManager.activeModifier?.accentColor || 'var(--vscode-list-activeSelectionForeground)');
const isInsertAfter = $derived(dragManager.activeModifier?.id.startsWith('insert-after') ?? false);
const isInsertBefore = $derived(dragManager.activeModifier?.id.startsWith('insert-before') ?? false);
const isInsertModifier = $derived(isInsertAfter || isInsertBefore);

// Outline computation for drop target
const outline = $derived.by(() => {
    if (isValidDropTarget && dragManager.activeDragItem?.type === 'commit') {
        if (isInsertModifier) {
            return undefined;
        }
        return `2px dashed ${dropColor}`;
    }
    return undefined;
});

const textOpacity = $derived(isDraggingThis ? 0.5 : 1);
const fontStyle = $derived(isImmutable && !isSelected ? 'italic' : 'normal');

const descriptionFull = $derived(commit.description.trim());
const descriptionFirstLine = $derived(descriptionFull.split('\n')[0]);
const commitTooltip = $derived(formatCommitTooltip(commit));
const timestamp = $derived(commit.author.timestamp || commit.committer.timestamp);
const relativeTime = $derived(getCompactRelativeTimeString(timestamp, now));

// Change ID parts
const [idPart, offsetPart] = $derived(commit.change_id.split('/'));
const shortId = $derived(commit.change_id_shortest);
const hasShortId = $derived(shortId && idPart.startsWith(shortId));

// Active dragging bookmark check
const isDraggingBookmark = $derived(dragManager.activeDragItem?.type === 'bookmark');
const activeBookmark = $derived(dragManager.activeDragItem?.type === 'bookmark' ? dragManager.activeDragItem : null);
const hasActiveBookmarkAlready = $derived(
    commit.bookmarks?.some(
        (b) => b.name === activeBookmark?.name && (b.remote ?? null) === (activeBookmark?.remote ?? null),
    ),
);
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
    bind:this={rowElement}
    class="commit-row"
    class:working-copy={isCurrentWorkingCopy}
    role="option"
    aria-selected={isSelected}
    tabindex="0"
    data-change-id={commit.change_id}
    data-selected={isSelected}
    data-highlighted={isHighlighted}
    data-hovered={isHovered}
    data-vscode-context={JSON.stringify(vscodeContext)}
    style:padding-left={`${graphPaddingLeft + COMMIT_ROW_PADDING_LEFT}px`}
    style:background-color={backgroundColor}
    style:outline={outline}
    style:opacity={textOpacity}
    style:font-weight={isSelected ? 'normal' : undefined}
    use:dragManager.draggable={() => ({
        type: 'commit',
        changeId: commit.change_id,
        description: commit.description,
        change_id_shortest: commit.change_id_shortest,
        descendantCount,
    })}
    use:dragManager.droppable={() => commit.change_id}
    onclick={(e) => {
        e.stopPropagation();
        const multiSelect = e.ctrlKey || e.metaKey;
        onClick({ multiSelect });
    }}
    onkeydown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick({ multiSelect: e.ctrlKey || e.metaKey });
        }
    }}
    onmouseenter={() => (isHovered = true)}
    onmouseleave={() => (isHovered = false)}
>
    {#if isValidDropTarget && dragManager.activeDragItem?.type === 'commit'}
        {#if isInsertAfter}
            <div class="drop-indicator-line top" style:--drop-color={dropColor}></div>
        {:else if isInsertBefore}
            <div class="drop-indicator-line bottom" style:--drop-color={dropColor}></div>
        {/if}
    {/if}
    <!-- Anchor actions at the start of the description, independently of trailing metadata. -->
    <div class="row-actions-anchor">
        <!-- Overlay Actions -->
        {#if isHovered && !dragManager.isDragging && (canGenerateDescription || (selectionCount <= 1 && (visibleActions.newChild || visibleActions.edit || visibleActions.squash)))}
            <div
                class="hover-actions"
                data-vscode-context={JSON.stringify({
                    webviewSection: 'commitActions',
                    'jj.newChildVisible': visibleActions.newChild,
                    'jj.editVisible': visibleActions.edit,
                    'jj.squashVisible': visibleActions.squash,
                    preventDefaultContextMenuItems: true,
                })}
            >
                {#if canGenerateDescription}
                    <IconButton
                        title="Generate description with AI"
                        tooltip="Generate a description for this commit without switching the working copy."
                        icon={isGeneratingDescription ? 'codicon-loading codicon-modifier-spin' : 'codicon-sparkle'}
                        disabled={isGeneratingDescription}
                        onClick={handleGenerateDescription}
                    />
                {/if}

                {#if selectionCount <= 1 && visibleActions.newChild}
                    <IconButton
                        title="New Child"
                        tooltip="Create a new working-copy revision after this commit."
                        icon="codicon-plus"
                        onClick={(e) => {
                            e.stopPropagation();
                            onAction('newChild', { changeId: commit.change_id });
                        }}
                        contextData={{
                            webviewSection: 'commitAction',
                            'jj.actionId': 'newChild',
                            actionTitle: 'New Child',
                        }}
                    />
                {/if}

                {#if selectionCount <= 1 && visibleActions.edit}
                    <IconButton
                        title="Edit Commit"
                        tooltip="Make this commit the working copy so you can edit its files."
                        icon="codicon-edit"
                        onClick={(e) => {
                            e.stopPropagation();
                            onAction('edit', { changeId: commit.change_id });
                        }}
                        contextData={{
                            webviewSection: 'commitAction',
                            'jj.actionId': 'edit',
                            actionTitle: 'Edit',
                        }}
                    />
                {/if}

                {#if selectionCount <= 1 && visibleActions.squash}
                    <IconButton
                        title="Squash"
                        tooltip="Move this commit's changes into its parent and remove this commit."
                        icon="codicon-arrow-down"
                        onClick={(e) => {
                            e.stopPropagation();
                            onAction('squash', { changeId: commit.change_id });
                        }}
                        contextData={{
                            webviewSection: 'commitAction',
                            'jj.actionId': 'squash',
                            actionTitle: 'Squash',
                        }}
                    />
                {/if}

            </div>
        {/if}
    </div>

    <!-- Description, Bookmarks, Trailing Metadata, and Code Forge Info -->
    <div class="right-column">
        <!-- Description & Bookmarks -->
        <div class="desc-row">
            <span
                class="commit-desc"
                style:font-weight={isCurrentWorkingCopy && !isSelected ? 'bold' : 'normal'}
                style:color={isSelected
                    ? 'var(--vscode-list-activeSelectionForeground)'
                    : isImmutable
                      ? 'var(--vscode-descriptionForeground)'
                      : isEmpty
                        ? 'var(--vscode-testing-iconPassed)'
                        : !commit.description
                          ? 'var(--vscode-editorWarning-foreground)'
                          : 'inherit'}
                style:font-style={fontStyle}
            >
                {#if commit.is_divergent}
                    <span class="divergent-label">(divergent) </span>
                {/if}
                {descriptionFirstLine}
            </span>

            <!-- Right-aligned Bookmarks & Pills -->
            <span class="pills-group">
                {#each commit.bookmarks || [] as bookmark (`${bookmark.name}-${bookmark.remote || 'local'}`)}
                    <DraggableBookmark {bookmark} {dragManager} />
                {/each}
                {#if isOver && isDraggingBookmark && activeBookmark && !hasActiveBookmarkAlready}
                    <BookmarkPill
                        bookmark={{ name: activeBookmark.name, remote: activeBookmark.remote }}
                        style="opacity: 0.7; background-color: transparent; border: 1px dashed var(--vscode-charts-blue); box-shadow: inset 0 0 8px var(--vscode-charts-blue);"
                    />
                {/if}
                {#each commit.working_copies || [] as workspace (workspace)}
                    <WorkspacePill {workspace} />
                {/each}
                {#each commit.tags || [] as tag (tag)}
                    <TagPill {tag} />
                {/each}

                {#if isValidDropTarget && dragManager.activeDragItem?.type === 'commit'}
                    <span
                        class="drop-badge"
                        style:background-color={dragManager.activeModifier?.accentColor || 'var(--vscode-charts-blue)'}
                    >
                        {dragManager.activeModifier?.badgeText || 'Drop here'}
                    </span>
                {/if}
            </span>

            <span class="commit-metadata">
                <!-- Always render ID to maintain layout stability. -->
                <span class="commit-id" style:min-width={`${idDisplayLength}ch`}>
                    {#if hasShortId && shortId}
                        <span style:font-weight="bold">{shortId}</span>
                        {#if idPart.length > shortId.length}
                            <span style:opacity="0.6">
                                {idPart.substring(shortId.length, idDisplayLength)}
                            </span>
                        {/if}
                    {:else}
                        {idPart.substring(0, idDisplayLength)}
                    {/if}
                    {#if offsetPart}
                        <span
                            style:color={commit.is_hidden
                                ? 'var(--vscode-descriptionForeground)'
                                : 'var(--vscode-charts-purple)'}
                        >
                            /{offsetPart}
                        </span>
                    {/if}
                </span>
                <time
                    class="commit-time"
                    datetime={relativeTime === '—' ? undefined : timestamp}
                    aria-label={getRelativeTimeString(timestamp, now)}
                >{relativeTime}</time>
            </span>
        </div>

        <!-- Code Forge Info -->
        {#if codeForgeChange}
            <div class="code-forge-row">
                {#if codeForgeChange.status === 'MERGED' || codeForgeChange.status === 'ABANDONED'}
                    <span
                        class="forge-status-badge"
                        style:border-color={codeForgeChange.status === 'MERGED'
                            ? 'var(--vscode-descriptionForeground)'
                            : 'var(--vscode-gitDecoration-ignoredResourceForeground)'}
                        style:color={codeForgeChange.status === 'MERGED'
                            ? 'var(--vscode-descriptionForeground)'
                            : 'var(--vscode-gitDecoration-ignoredResourceForeground)'}
                    >
                        {codeForgeChange.status}
                    </span>
                {/if}

                <!-- CL Link -->
                <a
                    href={codeForgeChange.url}
                    class="cl-link"
                    title={codeForgeChange.url}
                    onclick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onAction('openCodeForge', {
                            changeId: commit.change_id,
                            url: codeForgeChange.url,
                        });
                    }}
                >
                    <span>{codeForgeChange.displayLabel}</span>
                    <span class="codicon codicon-link-external cl-link-icon"></span>
                </a>

                <!-- Sync Status -->
                {#if codeForgeChange.status === 'NEW'}
                    {#if !commit.codeForgeNeedsUpload}
                        <div
                            title={codeForgeChange.parentSynced === false
                                ? 'Parent mismatch (Local parent differs from remote)'
                                : codeForgeChange.synced
                                  ? 'Synced (content matches remote)'
                                  : 'Up to date with remote'}
                            class="sync-icon-container"
                        >
                            <span class="codicon codicon-cloud"></span>
                        </div>
                    {:else}
                        <button
                            type="button"
                            onclick={(e) => {
                                e.stopPropagation();
                                onAction('upload', { changeId: commit.change_id });
                            }}
                            title={codeForgeChange.parentSynced === false
                                ? 'Parent mismatch (Click to push update)'
                                : 'Local changes need upload (Click to push)'}
                            aria-label={`Upload changes to ${codeForgeChange.providerName}`}
                            class="upload-button"
                        >
                            <span class="codicon codicon-cloud-upload"></span>
                        </button>
                    {/if}
                {/if}

                <!-- Comments -->
                {#if commentButtonState}
                    <button
                        type="button"
                        title={commentButtonState.title}
                        aria-label={commentButtonState.title}
                        onclick={(e) => {
                            e.stopPropagation();
                            onAction('showComments', { changeId: commit.change_id });
                        }}
                        onkeydown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
                                e.stopPropagation();
                                if (e.key === ' ' || e.key === 'Spacebar') {
                                    e.preventDefault();
                                }
                            }
                        }}
                        class="comments-button"
                        class:all-drafted={commentButtonState.allDrafted}
                    >
                        <span class="codicon {commentButtonState.icon} comments-icon" aria-hidden="true"></span>
                        <span>{commentButtonState.badge}</span>
                    </button>
                {/if}

                <!-- Submittable -->
                {#if codeForgeChange.submittable && codeForgeChange.status === 'NEW'}
                    <span title="Ready to Submit" class="submittable-icon">
                        <span class="codicon codicon-check"></span>
                    </span>
                {/if}

            </div>
        {/if}
    </div>
</div>

<Tooltip
    anchor={rowElement}
    text={commitTooltip}
    multiline
    disabled={dragManager.isDragging}
    ignoreSelector=".hover-actions, .pills-group, a, button, [title]"
/>

<style>
    .commit-row {
        position: relative;
        min-height: 28px;
        height: auto;
        display: flex;
        align-items: stretch;
        flex-direction: row;
        justify-content: flex-start;
        padding-bottom: 0;
        cursor: pointer;
        box-sizing: border-box;
        width: 100%;
        outline-offset: -2px;
        touch-action: none;
        min-width: 0;
        padding-top: 0;
        padding-right: 8px;
    }

    .drop-indicator-line {
        position: absolute;
        left: 0;
        right: 0;
        height: 2px;
        background-color: var(--drop-color);
        z-index: 10;
        pointer-events: none;
    }

    .drop-indicator-line.top {
        top: -1px;
    }

    .drop-indicator-line.bottom {
        bottom: -1px;
    }

    .drop-indicator-line::before {
        content: '';
        position: absolute;
        left: 0;
        top: -3px;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background-color: var(--drop-color);
    }

    .row-actions-anchor {
        flex-shrink: 0;
        width: 0;
        position: relative;
        display: flex;
        align-items: center;
        height: 28px;
    }

    .commit-id {
        display: flex;
        align-items: center;
        opacity: 1;
        font-family: var(--vscode-editor-font-family, monospace);
        font-size: var(--vscode-editor-font-size, 12px);
        color: var(--vscode-descriptionForeground);
        justify-content: flex-end;
        flex-shrink: 0;
    }

    .commit-metadata {
        display: inline-flex;
        align-items: center;
        flex-shrink: 0;
        gap: 4px;
        margin-left: 12px;
        color: var(--vscode-descriptionForeground);
        font-weight: normal;
    }

    .commit-time {
        flex: 0 0 auto;
        min-width: 3ch;
        text-align: right;
        font-family: var(--vscode-editor-font-family, monospace);
        font-size: calc(var(--vscode-font-size, 13px) - 3px);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
    }

    .hover-actions {
        position: absolute;
        /* Stay aligned with the description while the ID and time remain at the row end. */
        left: 0;
        top: 50%;
        transform: translateY(-50%);
        display: flex;
        align-items: center;
        gap: 2px;
        padding: 2px;
        background: var(--vscode-list-hoverBackground);
        border: 1px solid var(--vscode-editorGroupHeader-tabsBorder);
        border-radius: 6px;
        z-index: 1;
        width: max-content;
        cursor: default;
    }

    .hover-actions :global(.icon-button) {
        width: 22px;
        height: 22px;
        border-radius: 5px;
        background: var(--vscode-jjView-commitAction-background, var(--vscode-button-secondaryBackground));
        color: var(--vscode-jjView-commitAction-foreground, var(--vscode-button-secondaryForeground));
    }

    .hover-actions :global(.icon-button:hover) {
        background: var(--vscode-jjView-commitAction-hoverBackground, var(--vscode-button-secondaryHoverBackground));
    }

    .right-column {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-width: 0;
        justify-content: center;
    }

    .desc-row {
        display: flex;
        align-items: center;
        height: 28px;
        line-height: 28px;
        width: 100%;
    }

    .commit-desc {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-right: 8px;
        flex: 1 1 40px;
        min-width: 0;
    }

    .divergent-label {
        color: var(--vscode-charts-purple);
        margin-right: 4px;
    }

    .pills-group {
        display: flex;
        margin-left: auto;
        flex: 0 100 auto;
        gap: 4px;
        align-items: center;
        overflow: hidden;
        line-height: normal;
    }

    .drop-badge {
        color: var(--vscode-editor-background);
        font-size: 0.8em;
        font-weight: bold;
        padding: 1px 6px;
        border-radius: 3px;
        margin-left: 8px;
        white-space: nowrap;
    }

    .code-forge-row {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: -2px;
        overflow: hidden;
        height: 22px;
    }

    .forge-status-badge {
        border: 1px solid;
        background-color: transparent;
        padding: 0 4px;
        border-radius: 3px;
        font-weight: normal;
        font-size: inherit;
        display: inline-flex;
        align-items: center;
        opacity: 0.9;
        height: 16px;
        line-height: 14px;
    }

    .cl-link {
        color: var(--vscode-textLink-foreground);
        text-decoration: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 3px;
    }

    .cl-link-icon {
        font-size: 10px;
    }

    .sync-icon-container {
        display: flex;
        align-items: center;
        justify-content: center;
        margin-left: 4px;
        color: var(--vscode-descriptionForeground);
        cursor: default;
        width: 14px;
        height: 14px;
    }

    .upload-button {
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-left: 4px;
        color: var(--vscode-charts-yellow);
        background: none;
        border: none;
        padding: 0;
        width: 14px;
        height: 14px;
    }

    .comments-button {
        display: flex;
        align-items: center;
        gap: 3px;
        color: var(--vscode-problemsWarningIcon-foreground, var(--vscode-editorWarning-foreground));
        margin-left: 4px;
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
        white-space: nowrap;
        flex-shrink: 0;
    }

    .comments-button:focus-visible {
        outline: 1px solid var(--vscode-focusBorder);
        outline-offset: 1px;
    }

    .comments-button.all-drafted {
        color: var(--vscode-editorInfo-foreground, var(--vscode-charts-blue));
    }

    .comments-icon {
        font-size: 11px;
    }

    .submittable-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--vscode-testing-iconPassed);
        margin-left: 4px;
        width: 12px;
        height: 12px;
    }
</style>

