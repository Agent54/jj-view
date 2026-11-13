/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { extractRevision } from '../../../../src/core/commands/command-utils';
import type { CopyChangeIdPayload } from '../../../../src/core/commands/copy-change-id';

export function createCopyChangeIdPayload(args: unknown[]): CopyChangeIdPayload {
    return { revision: extractRevision(args) ?? '@' };
}
