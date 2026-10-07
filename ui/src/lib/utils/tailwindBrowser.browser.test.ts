import { afterEach, expect, it, vi } from 'vitest';
import { createIsolatedContainer } from './tailwindBrowser';

const containers: ReturnType<typeof createIsolatedContainer>[] = [];
const hosts: HTMLElement[] = [];

const createContainer = () => {
  const host = document.createElement('div');
  document.body.appendChild(host);

  const container = createIsolatedContainer(host);
  hosts.push(host);
  containers.push(container);

  return { host, container };
};

afterEach(() => {
  for (const container of containers) container.tailwind(false);
  for (const host of hosts) host.remove();

  containers.length = 0;
  hosts.length = 0;
});

it('builds isolated utility styles and observes new classes', async () => {
  const { host, container } = createContainer();
  container.root.className = 'w-[40px]';

  await vi.waitFor(() => expect(getComputedStyle(container.root).width).toBe('40px'), {
    timeout: 10000
  });

  container.root.className = 'w-[80px]';

  await vi.waitFor(() => expect(getComputedStyle(container.root).width).toBe('80px'), {
    timeout: 10000
  });

  container.tailwind(false);

  expect(host.shadowRoot!.querySelector('style')).toBeNull();
});

it('does not install styles after disabling during initialization and can enable again', async () => {
  const { host, container } = createContainer();
  container.tailwind(false);

  // Another container waits for the same compiler, ensuring the pending initialization settles.
  const other = createContainer();
  other.container.root.className = 'w-[40px]';

  await vi.waitFor(() => expect(getComputedStyle(other.container.root).width).toBe('40px'), {
    timeout: 10000
  });

  expect(host.shadowRoot!.querySelector('style')).toBeNull();

  container.root.className = 'w-[80px]';
  container.tailwind(true);

  await vi.waitFor(() => expect(getComputedStyle(container.root).width).toBe('80px'), {
    timeout: 10000
  });

  expect(host.shadowRoot!.querySelectorAll('style')).toHaveLength(1);
});
