/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as path from 'node:path';
import { ARTIFACT_DIR, expect, recordGifFlow, test, waitForScmReady } from './standalone-fixture';

for (const responseMode of ['text', 'queued']) {
    test(`generates an older commit description through the existing agent (${responseMode}) without switching revisions`, async ({
        page,
        server,
        testRepo,
    }) => {
        testRepo.writeFile('older.txt', 'older feature\n');
        testRepo.describe('Older description');
        const olderChange = testRepo.getChangeId('@');
        const olderCommit = testRepo.getCommitId('@');
        testRepo.new();
        testRepo.writeFile('current.txt', 'unrelated current work\n');
        testRepo.describe('Current work');
        const currentChange = testRepo.getChangeId('@');
        const rootChange = testRepo.getChangeId('root()');
        const generated = 'feat: describe the older feature';

        let requestBody = '';
        let releaseResponse: () => void = () => {};
        const responseReady = new Promise<void>((resolve) => {
            releaseResponse = resolve;
        });
        await page.route('**/_sidecar/get-conversation-metadata', (route) => route.fulfill({ json: {} }));
        await page.route('**/_sidecar/send-message', async (route) => {
            requestBody = route.request().postData() ?? '';
            await responseReady;
            if (responseMode === 'queued') {
                // Simulate the existing conversation applying its requested description asynchronously.
                testRepo.describe(generated, olderChange);
                await route.fulfill({
                    json: {
                        response: { sendMessage: { recipientId: 'existing-conversation', content: 'request echo' } },
                    },
                });
            } else {
                await route.fulfill({ json: { status: 'delivered', response: generated } });
            }
        });

        const url = new URL(server.serverUrl);
        url.searchParams.set('conversationId', 'existing-conversation');
        await page.goto(url.href);
        await waitForScmReady(page);
        const olderRow = page.locator(`.commit-row[data-change-id="${olderChange}"]`);
        const currentRow = page.locator(`.commit-row[data-change-id="${currentChange}"]`);
        const immutableRow = page.locator(`.commit-row[data-change-id="${rootChange}"]`);
        await immutableRow.hover();
        await expect(immutableRow.getByRole('button', { name: 'Generate description with AI' })).toHaveCount(0);
        await currentRow.hover();
        await expect(currentRow.getByRole('button', { name: 'Generate description with AI' })).toBeVisible();
        await currentRow.locator('.commit-id').click();

        await recordGifFlow(
            page,
            async (capture) => {
                await olderRow.hover();
                const button = olderRow.getByRole('button', { name: 'Generate description with AI' });
                await expect(button).toBeVisible();
                await capture();
                await button.click();
                await expect(button).toBeDisabled();
                await expect.poll(() => requestBody).toContain(olderCommit);
                expect(requestBody).toContain(olderChange);
                expect(requestBody).toContain('older feature');
                expect(requestBody).not.toContain('unrelated current work');
                releaseResponse();
                await expect(olderRow.locator('.commit-desc')).toHaveText(generated);
                await expect(currentRow.locator('.commit-desc')).toHaveText('Current work');
                expect(testRepo.getChangeId('@')).toBe(currentChange);
                if (responseMode === 'queued') {
                    await expect(page.getByTestId('notification-toast')).toContainText(
                        'Description requested in Antigravity',
                    );
                }
                await capture();
            },
            { outputPath: path.join(ARTIFACT_DIR, `ai-description-${responseMode}.gif`) },
        );
        await page.screenshot({ path: path.join(ARTIFACT_DIR, `ai-description-${responseMode}.png`) });
        await expect(page.locator('[data-testid="notification-toast"][data-severity="error"]')).toHaveCount(0);
    });
}

test('AI buttons explain the existing setup when no conversation is connected', async ({ page, server, testRepo }) => {
    const changeId = testRepo.getChangeId('@');
    await page.goto(server.serverUrl);
    await waitForScmReady(page);
    await page.getByTestId('agent-draft-button').click();
    await expect(page.getByTestId('notification-toast')).toContainText(
        'AI descriptions require an Antigravity conversation',
    );
    expect(testRepo.getChangeId('@')).toBe(changeId);
    const row = page.locator(`.commit-row[data-change-id="${changeId}"]`);
    await row.hover();
    await expect(row.getByRole('button', { name: 'Generate description with AI' })).toBeVisible();
    await expect(row.locator('.commit-desc')).toHaveText('');
});
