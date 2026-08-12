import type { Attachment } from 'svelte/attachments';

export const revealSection: Attachment<HTMLElement> = (element) => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  element.classList.add('motion-ready');

  const observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry) return;

      element.classList.toggle('is-active', entry.isIntersecting);
      if (entry.isIntersecting) element.classList.add('is-revealed');
    },
    {
      rootMargin: '0px 0px -2% 0px',
      threshold: 0
    }
  );

  observer.observe(element);

  return () => observer.disconnect();
};
