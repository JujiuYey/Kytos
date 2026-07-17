import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { net, protocol } from 'electron';

const APP_SCHEME = 'app';
const APP_HOST = 'bundle';

export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
      },
    },
  ]);
}

export function getMainWindowUrl(): string {
  return `${APP_SCHEME}://${APP_HOST}/`;
}

export function registerAppProtocol(): void {
  const rendererRoot = path.resolve(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}`);

  protocol.handle(APP_SCHEME, request => {
    const url = new URL(request.url);
    if (url.host !== APP_HOST) {
      return new Response('Not found', { status: 404 });
    }

    const decodedPath = decodeURIComponent(url.pathname);
    const relativePath =
      decodedPath === '/' || path.extname(decodedPath) === ''
        ? 'index.html'
        : decodedPath.replace(/^\/+/, '');
    const filePath = path.resolve(rendererRoot, relativePath);
    const rendererRootPrefix = `${rendererRoot}${path.sep}`;

    if (
      filePath !== path.join(rendererRoot, 'index.html') &&
      !filePath.startsWith(rendererRootPrefix)
    ) {
      return new Response('Not found', { status: 404 });
    }

    return net.fetch(pathToFileURL(filePath).toString());
  });
}
