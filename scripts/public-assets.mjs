export const publicModuleDirectories = ['src', 'src/expansion'];

export const fixedPublicAssets = [
  'styles.css',
  'favicon.svg',
  'LICENSE',
  'THIRD_PARTY_NOTICES.md',
  'src/expansion/boards-chess-LICENSE.txt',
  'assets/monopoly/hills.png',
  'assets/monopoly/old-town.png',
  'assets/monopoly/riverside.png',
  'assets/monopoly/seaside.png',
  'assets/monopoly/station.png',
  'assets/monopoly/town-map.png',
  'assets/monopoly/town-park.png',
  'assets/monopoly/woodland.png',
];

const fixedPaths = new Set(fixedPublicAssets.map(file => `/${file}`));
const moduleName = /^[a-z\d_-]+\.(?:js|css)$/;

export function isPublicAsset(pathname) {
  if (fixedPaths.has(pathname)) return true;
  const lastSlash = pathname.lastIndexOf('/');
  const directory = pathname.slice(1, lastSlash);
  return publicModuleDirectories.includes(directory) && moduleName.test(pathname.slice(lastSlash + 1));
}
