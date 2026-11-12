/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { expect, test, waitForScmReady } from './standalone-fixture';

test('squash immediately combines titles and bodies by default', async ({ page, server, testRepo }) => {
    testRepo.writeFile('parent.txt', 'parent\n');
    testRepo.describe('Parent title\n\nParent body\n\nAnother paragraph');
    const parent = testRepo.getChangeId('@');
    testRepo.new();
    testRepo.writeFile('child.txt', 'child\n');
    testRepo.describe('Child title\n\nChild body');
    const child = testRepo.getChangeId('@');
    testRepo.new();
    const current = testRepo.getChangeId('@');

    await page.goto(server.serverUrl);
    await waitForScmReady(page);
    await page.getByTestId('scm-settings-button').click();
    const modal = page.getByTestId('settings-modal');
    await modal.getByTestId('category-btn-commit-editor').click();
    await expect(modal.getByTestId('setting-control-commit.editDescriptionOnSquash')).not.toBeChecked();
    await modal.getByRole('button', { name: 'Close', exact: true }).click();

    const childRow = page.locator(`.commit-row[data-change-id="${child}"]`);
    await childRow.hover();
    await childRow.getByRole('button', { name: 'Squash', exact: true }).click();

    await expect
        .poll(() => testRepo.getDescription(parent))
        .toBe('Parent title, Child title\n\nParent body\n\nAnother paragraph\n\nChild body');
    expect(testRepo.getFileContent(parent, 'child.txt')).toBe('child\n');
    expect(testRepo.getChangeId('@')).toBe(current);
    expect(testRepo.getParents('@')).toEqual([parent]);
    await expect(page.locator(`.commit-row[data-change-id="${child}"]`)).toHaveCount(0);
    await expect(page.getByText('SQUASH_MSG', { exact: true })).toHaveCount(0);
});

test('enabling edit description on squash opens the combined message before merging', async ({
    page,
    server,
    testRepo,
}) => {
    testRepo.writeFile('parent.txt', 'parent\n');
    testRepo.describe('Parent title\n\nParent body');
    const parent = testRepo.getChangeId('@');
    testRepo.new();
    testRepo.writeFile('child.txt', 'child\n');
    testRepo.describe('Child title\n\nChild body');
    const child = testRepo.getChangeId('@');

    await page.goto(server.serverUrl);
    await waitForScmReady(page);
    await page.getByTestId('scm-settings-button').click();
    const modal = page.getByTestId('settings-modal');
    await modal.getByTestId('category-btn-commit-editor').click();
    await modal.getByTestId('setting-control-commit.editDescriptionOnSquash').check();
    await modal.getByRole('button', { name: 'Close', exact: true }).click();

    const childRow = page.locator(`.commit-row[data-change-id="${child}"]`);
    await childRow.hover();
    await childRow.getByRole('button', { name: 'Squash', exact: true }).click();
    await expect(page.getByText('SQUASH_MSG', { exact: true })).toBeVisible();
    await expect(page.getByTestId('file-content-container')).toContainText('Parent title, Child title');
    await expect(page.getByTestId('file-content-container')).toContainText('Parent body');
    await expect(page.getByTestId('file-content-container')).toContainText('Child body');
    expect(testRepo.getDescription(parent)).toBe('Parent title\n\nParent body');
    expect(testRepo.getChangeId('@')).toBe(child);

    await page.getByText('SQUASH_MSG', { exact: true }).click({ button: 'right' });
    await page.getByTestId('menu-item-jj-view.completeSquashRevision').click();
    await expect
        .poll(() => testRepo.getDescription(parent))
        .toBe('Parent title, Child title\n\nParent body\n\nChild body');
    await expect(page.getByText('SQUASH_MSG', { exact: true })).toHaveCount(0);
});
