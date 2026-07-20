import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { net, protocol } from 'electron';
import { handleIllustrationAgentRequest } from './illustration-agent/route';
import { handleStoryAgentRequest } from './story-agent/route';
import { getWorkspaceDirectory } from './services/workspace';

const APP_SCHEME = 'app';
const APP_HOST = 'bundle';
const WORKSPACE_IMAGE_DIRECTORIES = [
  'character-expressions',
  'character-candidates',
  'character-portraits',
  'character-sheets',
  'illustrations',
  'story-frames',
] as const;

export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_SCHEME,
      privileges: {
        standard: true, // 当成标准协议,URL 解析更严格
        secure: true, // 标记为 https 同级,允许 Service Worker 等
        supportFetchAPI: true, // 允许 fetch()
        corsEnabled: true, // 允许跨域请求
        stream: true, // 支持流式响应
      },
    },
  ]);
}

export function getMainWindowUrl(): string {
  return `${APP_SCHEME}://${APP_HOST}/`;
}

export function registerAppProtocol(): void {
  const rendererRoot = path.resolve(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}`);

  protocol.handle(APP_SCHEME, async request => {
    const url = new URL(request.url);
    if (url.host !== APP_HOST) {
      return new Response('Not found', { status: 404 });
    }

    if (url.pathname === '/api/illustration-agent') {
      return handleIllustrationAgentRequest(request);
    }

    if (url.pathname === '/api/story-agent') {
      return handleStoryAgentRequest(request);
    }

    const imageDirectory = WORKSPACE_IMAGE_DIRECTORIES.find(directory =>
      url.pathname.startsWith(`/workspace-assets/${directory}/`),
    );
    if (imageDirectory) {
      const workspacePath = await getWorkspaceDirectory();
      const assetsRoot = path.resolve(workspacePath, 'assets', imageDirectory);
      const relativePath = decodeURIComponent(
        url.pathname.slice(`/workspace-assets/${imageDirectory}/`.length),
      );
      const filePath = path.resolve(assetsRoot, relativePath);
      if (!relativePath || !filePath.startsWith(`${assetsRoot}${path.sep}`)) {
        return new Response('Not found', { status: 404 });
      }
      return net.fetch(pathToFileURL(filePath).toString());
    }

    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
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
