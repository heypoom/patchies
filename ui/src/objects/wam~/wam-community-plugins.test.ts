import { describe, expect, it } from 'vitest';
import { parseWamCommunityPlugins } from './wam-community-plugins';

describe('parseWamCommunityPlugins', () => {
  it('resolves community entry paths into loadable WAM URLs', () => {
    expect(
      parseWamCommunityPlugins([
        {
          identifier: 'com.wimmics.bigmuff',
          name: 'Big Muff',
          vendor: 'Wimmics',
          description: 'A fuzz effect',
          category: ['Effect', 'Distortion'],
          thumbnail: 'wimmics/BigMuff/screenshot.png',
          path: 'wimmics/BigMuff/index.js'
        }
      ])
    ).toEqual([
      {
        identifier: 'com.wimmics.bigmuff',
        name: 'Big Muff',
        vendor: 'Wimmics',
        description: 'A fuzz effect',
        categories: ['Effect', 'Distortion'],
        thumbnailUrl:
          'https://www.webaudiomodules.com/community/plugins/wimmics/BigMuff/screenshot.png',
        url: 'https://www.webaudiomodules.com/community/plugins/wimmics/BigMuff/index.js'
      }
    ]);
  });

  it('skips malformed registry entries', () => {
    expect(parseWamCommunityPlugins([{ name: 'Missing path' }, null, 'not an entry'])).toEqual([]);
  });

  it('skips invalid entry paths without discarding a plugin with an invalid thumbnail', () => {
    expect(
      parseWamCommunityPlugins([
        { name: 'Invalid entry', path: 'https://[invalid' },
        {
          name: 'Valid entry',
          path: 'wimmics/BigMuff/index.js',
          thumbnail: 'https://[invalid'
        }
      ])
    ).toEqual([
      {
        identifier: '',
        name: 'Valid entry',
        vendor: '',
        description: '',
        categories: [],
        thumbnailUrl: undefined,
        url: 'https://www.webaudiomodules.com/community/plugins/wimmics/BigMuff/index.js'
      }
    ]);
  });
});
