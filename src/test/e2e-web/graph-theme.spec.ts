/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { TestRepo } from '../test-repo';
import { ARTIFACT_DIR, expect, recordGifFlow, test, waitForScmReady } from './standalone-fixture';

test('Cobalt badges and actions, Silver lanes, and dotted history retain theme and diff behavior', async ({
    page,
    server,
    testRepo,
}) => {
    testRepo.writeFile('base.txt', 'base\n');
    testRepo.describe('Initial commit');
    testRepo.bookmark('devlocal', '@');
    const initialChange = testRepo.getChangeId('@');
    testRepo.new();
    testRepo.writeFile('base.txt', 'hidden intermediate\n');
    testRepo.describe('Hidden intermediate');
    testRepo.new();
    testRepo.writeFile('base.txt', 'remote baseline\n');
    testRepo.describe('Remote baseline');
    const remoteCommit = testRepo.getCommitId('@');
    const remoteChange = testRepo.getChangeId('@');
    testRepo.new();
    testRepo.writeFile('release.txt', 'release candidate\n');
    testRepo.describe('Release candidate');
    const releaseChange = testRepo.getChangeId('@');
    testRepo.new();
    testRepo.tag('v1.0.0', '@-');
    testRepo.writeFile('working.txt', 'work in progress\n');
    testRepo.describe('Working copy');
    testRepo.addRemote('origin', testRepo.path);
    execFileSync(TestRepo.getGitBinary(), ['update-ref', 'refs/remotes/origin/main', remoteCommit], {
        cwd: testRepo.path,
    });
    testRepo.gitImport();
    const jjConfigDir = path.join(server.userDataDir, 'jj');
    fs.mkdirSync(jjConfigDir, { recursive: true });
    fs.writeFileSync(
        path.join(jjConfigDir, 'config.toml'),
        `[revsets]\nlog = '@ | ${initialChange} | ${remoteChange} | ${releaseChange}'\n`,
    );

    await page.goto(server.serverUrl);
    await waitForScmReady(page);
    await page.evaluate(async () => {
        await window.__JJ_VIEW_ENV__?.config.update?.('appearance.theme', 'pierre-dark-cobalt');
        await window.__JJ_VIEW_ENV__?.config.update?.('logTheme', 'silver');
    });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'pierre-dark-cobalt');
    await page.getByTestId('scm-collapse-toggle').click();

    const graph = page.locator('.commit-graph');
    const local = graph.locator('.bookmark-pill', { hasText: 'devlocal' });
    const remote = graph.locator('.bookmark-pill', { hasText: 'main@origin' });
    const tag = graph.locator('.tag-wrapper .bookmark-pill', { hasText: 'v1.0.0' });
    await expect(local).toHaveCSS('background-color', 'rgb(31, 112, 235)');
    await expect(remote).toHaveCSS('background-color', 'rgb(130, 80, 223)');
    await expect(tag).toHaveCSS('background-color', 'rgb(128, 86, 6)');
    for (const badge of [local, remote, tag]) {
        await expect(badge).toHaveCSS('color', 'rgb(255, 255, 255)');
        await expect(badge).toHaveCSS('border-radius', '4px');
    }
    const current = graph.locator('.node-working-copy');
    await expect(current).toHaveCSS('fill', 'rgb(45, 160, 68)');
    await expect(current).not.toHaveCSS('filter', 'none');
    await expect(graph.locator('.graph-svg text')).toHaveCount(0);
    await expect(graph.locator('.graph-svg > path').first()).toHaveCSS('stroke', 'rgb(230, 237, 244)');
    const termination = graph.locator('.history-termination').first();
    await expect(termination).toBeVisible();
    await expect(termination.locator('.history-dot')).toHaveCount(3);

    const releaseRow = graph.locator('.commit-row', { hasText: 'Release candidate' });
    await recordGifFlow(
        page,
        async (capture) => {
            await page.mouse.move(700, 100);
            await capture();
            await releaseRow.hover();
            const actions = releaseRow.locator('.hover-actions');
            await expect(actions.getByRole('button').first()).toHaveCSS('background-color', 'rgb(35, 134, 54)');
            await expect(actions.getByRole('button').first()).toHaveCSS('border-radius', '5px');
            await page.screenshot({ path: path.join(ARTIFACT_DIR, 'pierre-dark-cobalt.png') });
            await capture();
        },
        { outputPath: path.join(ARTIFACT_DIR, 'pierre-dark-cobalt.gif') },
    );

    // The custom theme must also resolve in Pierre's diff highlighter and worker.
    await releaseRow.locator('.commit-id').click();
    await page.getByTestId('commit-details-view').locator('.file-row', { hasText: 'release.txt' }).click();
    await expect(
        page.getByTestId('diff-content-container').getByText('release candidate', { exact: true }),
    ).toBeVisible();

    // Switching away must remove custom colors rather than leaking them into other themes.
    await page.evaluate(async () => {
        await window.__JJ_VIEW_ENV__?.config.update?.('appearance.theme', 'pierre-light');
        await window.__JJ_VIEW_ENV__?.config.update?.('logTheme', 'default');
    });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'pierre-light');
    await expect(local).not.toHaveCSS('background-color', 'rgb(31, 112, 235)');
    await expect(graph.locator('.graph-svg > path').first()).not.toHaveCSS('stroke', 'rgb(230, 237, 244)');
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'graph-theme-light-fallback.png') });
});
