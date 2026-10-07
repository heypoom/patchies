import * as tailwindcss from 'tailwindcss';
import indexCss from 'tailwindcss/index.css?raw';
import preflightCss from 'tailwindcss/preflight.css?raw';
import themeCss from 'tailwindcss/theme.css?raw';
import utilitiesCss from 'tailwindcss/utilities.css?raw';

const css = {
  index: indexCss,
  preflight: preflightCss,
  theme: themeCss,
  utilities: utilitiesCss
};

async function loadStylesheet(id: string, base: string) {
  if (id === 'tailwindcss') {
    return { path: 'virtual:tailwindcss/index.css', base, content: css.index };
  } else if (
    id === 'tailwindcss/preflight' ||
    id === 'tailwindcss/preflight.css' ||
    id === './preflight.css'
  ) {
    return { path: 'virtual:tailwindcss/preflight.css', base, content: css.preflight };
  } else if (id === 'tailwindcss/theme' || id === 'tailwindcss/theme.css' || id === './theme.css') {
    return { path: 'virtual:tailwindcss/theme.css', base, content: css.theme };
  } else if (
    id === 'tailwindcss/utilities' ||
    id === 'tailwindcss/utilities.css' ||
    id === './utilities.css'
  ) {
    return { path: 'virtual:tailwindcss/utilities.css', base, content: css.utilities };
  }
  throw new Error(`Unsupported @import "${id}"`);
}

export const compileTailwind = () =>
  tailwindcss.compile('@import "tailwindcss";', {
    base: '/',
    loadStylesheet,
    loadModule: async () => {
      throw new Error('Plugins/config not supported');
    }
  });
