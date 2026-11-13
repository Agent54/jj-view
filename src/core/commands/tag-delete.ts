/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type { CommandContext } from '../host/command-context';
import { showJjError } from '../host/ui-helpers';

export interface DeleteTagPayload {
    tagName?: string;
}

export async function deleteTagCommand(ctx: CommandContext, payload?: DeleteTagPayload): Promise<void> {
    try {
        let tagName = payload?.tagName?.trim() || undefined;
        if (!tagName) {
            const names = await ctx.host.ui.withProgress('Fetching tags...', () => ctx.repo.jj.getTagNames());
            if (names.length === 0) {
                await ctx.host.ui.showInformation('No local tags to delete.');
                return;
            }
            const pick = await ctx.host.ui.showQuickPick(
                names.map((name) => ({ label: name })),
                { placeHolder: 'Select a tag to delete' },
            );
            tagName = pick?.label;
        }
        if (!tagName) {
            return;
        }

        await ctx.host.ui.withProgress(`Deleting tag "${tagName}"...`, () => ctx.repo.jj.deleteTag(tagName));
        await ctx.repo.refresh({ reason: 'after tag delete' });
        await ctx.host.ui.showInformation(`Deleted tag "${tagName}".`);
    } catch (err: unknown) {
        await showJjError(ctx.host.ui, err, 'Failed to delete tag', ctx.repo.jj, ctx.log);
    }
}
