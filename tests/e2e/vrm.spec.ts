import { expect, test } from '@playwright/test';
import { createGlbWithoutVrmExtension, createMinimalVrm } from '../fixtures/create-minimal-vrm';

test.describe('VRM avatars', () => {
  test('opens a recognizable virtual host studio with local demo controls', async ({ page }) => {
    test.setTimeout(90_000);
    const pageErrors: string[] = [];
    const avatarRequests: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('request', (request) => { if (request.url().endsWith('.vrm')) avatarRequests.push(request.url()); });

    await page.goto('/vrm-viewer/');
    await expect(page).toHaveTitle(/VRM Viewer Online/);
    await expect(page.locator('.viewport-badge')).toContainText('avatar-sample-b.vrm', { timeout: 60_000 });
    const studio = page.getByRole('complementary', { name: 'Virtual host controls' });
    await expect(studio).toBeVisible();
    await expect(studio.getByText('Meet Nova')).toBeVisible();
    // Continuous WebGL animation can keep Chromium's software-rendered element
    // stability heuristic busy even though the fixed control panel is visible.
    // Force targets this known Playwright limitation while the pressed state
    // still verifies the real React handler and viewer command.
    await studio.getByRole('button', { name: 'Smile' }).click({ force: true });
    await expect(studio.getByRole('button', { name: 'Smile' })).toHaveAttribute('aria-pressed', 'true');
    await studio.getByRole('button', { name: 'Wave' }).click({ force: true });
    await expect(studio.getByRole('button', { name: 'Wave' })).toHaveAttribute('aria-pressed', 'true');
    await expect(studio.getByRole('checkbox', { name: /Eye contact/i })).toBeChecked();
    await expect(studio.getByRole('checkbox', { name: /Natural blink/i })).toBeChecked();
    await expect(studio).toContainText(/no camera or microphone/i);
    expect(avatarRequests).toHaveLength(1);
    expect(new URL(avatarRequests[0]!).origin).toBe(new URL(page.url()).origin);
    expect(pageErrors).toEqual([]);
  });

  test('loads a VRM 1.0 avatar and exposes avatar semantics', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto('/');
    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'minimal-avatar.vrm',
      mimeType: 'model/gltf-binary',
      buffer: createMinimalVrm('1.0'),
    });

    await expect(page.locator('.viewport-badge')).toContainText('minimal-avatar.vrm', { timeout: 20_000 });
    await expect(page.getByText('VRM avatar loader', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Avatar profile/i })).toBeVisible();
    await expect(page.getByText('Minimal VRM Avatar', { exact: true }).last()).toBeVisible();
    await expect(page.getByText('1.0', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('15', { exact: true }).first()).toBeVisible();
    await expect(page.locator('canvas')).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test('normalizes a legacy VRM 0.x avatar through the same loader', async ({ page }) => {
    await page.goto('/');
    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'legacy-avatar.vrm',
      mimeType: 'model/gltf-binary',
      buffer: createMinimalVrm('0.x'),
    });

    await expect(page.locator('.viewport-badge')).toContainText('legacy-avatar.vrm', { timeout: 20_000 });
    await expect(page.getByText('VRM avatar loader', { exact: true })).toBeVisible();
    await expect(page.getByText('Minimal VRM 0 Avatar', { exact: true }).last()).toBeVisible();
    await expect(page.getByText('0.x', { exact: true })).toBeVisible();
  });

  test('rejects a generic GLB renamed to .vrm', async ({ page }) => {
    await page.goto('/');
    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'not-an-avatar.vrm',
      mimeType: 'model/gltf-binary',
      buffer: createGlbWithoutVrmExtension(),
    });

    await expect(page.getByRole('alert')).toContainText('does not contain a valid VRM 0.x or VRM 1.0 avatar extension');
    await expect(page.getByRole('heading', { name: /See the model/ })).toBeVisible();
  });
});
