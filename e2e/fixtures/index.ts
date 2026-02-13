/**
 * E2E Test Fixtures Index
 *
 * Re-exports all test fixtures for convenient importing.
 */

export { expect, test } from "@playwright/test"
export { getMissingAuthCredentialNames, hasE2EAuthCredentials, login, requireLogin } from "./auth"
