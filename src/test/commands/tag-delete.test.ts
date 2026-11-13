/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { execFileSync } from 'node:child_process';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { deleteTagCommand } from '../../core/commands/tag-delete';
import type { JjRepository } from '../../core/jj-repository';
import { JjService, NO_OP_LOGGER } from '../../core/jj-service';
import { FakeCommandContext } from '../fake-host-environment';
import { TestRepo } from '../test-repo';
import { createMock } from '../test-utils';

describe.each([true, false])('deleteTagCommand (colocate: %s)', (colocate) => {
    let repo: TestRepo;
    let jj: JjService;
    let ctx: FakeCommandContext;

    beforeEach(() => {
        repo = new TestRepo();
        repo.init({ colocate });
        jj = new JjService(repo.path, NO_OP_LOGGER);
        ctx = new FakeCommandContext(createMock<JjRepository>({ jj, refresh: vi.fn().mockResolvedValue(undefined) }));
    });

    afterEach(async () => {
        await repo.dispose();
    });

    test('deletes only the clicked tag and preserves a bookmark with the same name', async () => {
        repo.writeFile('release.txt', 'release content\n');
        repo.new();
        const target = repo.getCommitId('@-');
        repo.bookmark('v1.0.0', '@-');
        repo.tag('v1.0.0', '@-');
        repo.tag('v2.0.0', '@-');

        await deleteTagCommand(ctx, { tagName: 'v1.0.0' });

        expect(ctx.host.ui.errorMessages).toEqual([]);
        expect(await jj.getTagNames()).toEqual(['v2.0.0']);
        expect((await jj.getLogEntry(target))?.tags).toEqual(['v2.0.0']);
        expect(repo.getBookmarks('@-')).toContain('v1.0.0');
        expect(repo.getCommitId('@-')).toBe(target);
        expect(ctx.repo.refresh).toHaveBeenCalledWith({ reason: 'after tag delete' });
        expect(ctx.host.ui.infoMessages).toContain('Deleted tag "v1.0.0".');

        if (colocate) {
            const gitRoot = await jj.getGitRoot();
            if (!gitRoot) {
                throw new Error('Expected a Git repository');
            }
            const gitTags = execFileSync(
                TestRepo.getGitBinary(),
                ['--git-dir', gitRoot, 'for-each-ref', '--format=%(refname)', 'refs/tags/'],
                { encoding: 'utf8' },
            ).trim();
            expect(gitTags).toBe('refs/tags/v2.0.0');
        }
    });

    test('offers tag selection from the command palette', async () => {
        repo.new();
        repo.tag('v1.0.0', '@-');
        repo.tag('v2.0.0', '@-');
        ctx.host.ui.setNextQuickPickResponse({ label: 'v2.0.0' });

        await deleteTagCommand(ctx);

        expect(ctx.host.ui.errorMessages).toEqual([]);
        expect(await jj.getTagNames()).toEqual(['v1.0.0']);
        expect(ctx.host.ui.quickPickCalls[0]?.items.map((item) => item.label)).toEqual(['v1.0.0', 'v2.0.0']);
    });

    test('leaves tags unchanged when selection is cancelled', async () => {
        repo.new();
        repo.tag('v1.0.0', '@-');
        ctx.host.ui.setNextQuickPickResponse(undefined);

        await deleteTagCommand(ctx);

        expect(await jj.getTagNames()).toEqual(['v1.0.0']);
        expect(ctx.repo.refresh).not.toHaveBeenCalled();
    });

    test('reports when there are no local tags', async () => {
        await deleteTagCommand(ctx);

        expect(ctx.host.ui.infoMessages).toContain('No local tags to delete.');
        expect(ctx.host.ui.quickPickCalls).toEqual([]);
        expect(ctx.repo.refresh).not.toHaveBeenCalled();
    });

    test('reports command failures without claiming success', async () => {
        const brokenJj = new JjService(repo.path, NO_OP_LOGGER, { binaryPath: path.join(repo.path, 'missing-jj') });
        const brokenCtx = new FakeCommandContext(
            createMock<JjRepository>({ jj: brokenJj, refresh: vi.fn().mockResolvedValue(undefined) }),
        );

        await deleteTagCommand(brokenCtx, { tagName: 'v1.0.0' });

        expect(brokenCtx.host.ui.errorMessages).toHaveLength(1);
        expect(brokenCtx.host.ui.errorMessages[0]).toContain('Failed to delete tag');
        expect(brokenCtx.host.ui.infoMessages).toEqual([]);
        expect(brokenCtx.repo.refresh).not.toHaveBeenCalled();
    });
});
