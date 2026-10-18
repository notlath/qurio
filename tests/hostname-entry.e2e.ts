import { test } from '@e2e-dev/mobile';
import { expect } from 'e2e';

test('an empty Tenant hostname shows an error', async ({ app, screen }) => {
  await app.clearState();
  await app.open();

  await expect(screen.getByRole('heading', 'Connect to your Tenant')).toBeVisible({ timeout: 30_000 });
  await screen.getByRole('button', 'Continue').tap();

  await expect(screen.getByText('Enter your Tenant hostname.')).toBeVisible();
});
