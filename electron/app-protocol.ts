// 自定义 app:// 协议：AI Agent 端点、Vue 静态资源、工作区图片
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { net, protocol } from 'electron';
import { handleCharacterCreateAgentRequest } from './character-create-agent/route';
import { handleIllustrationAgentRequest } from './illustration-agent/route';
import { handleStoryAgentRequest } from './story-agent/route';
import { getWorkspaceDirectory } from './services/workspace';

// 自定义协议名
const APP_SCHEME = 'app';
// 协议下的虚拟主机名（仅作为 namespace，无 DNS 含义）
const APP_HOST = 'bundle';
// 工作区下允许通过 app:// 对外暴露的图片目录白名单
const WORKSPACE_IMAGE_DIRECTORIES = [
  'character-expressions',
  'character-candidates',
  'character-portraits',
  'character-sheets',
  'illustrations',
  'story-frames',
] as const;

// 必须在 app.ready 之前调用：声明 app 协议为特权协议
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_SCHEME,
      privileges: {
        // 当成标准协议，URL 解析更严格
        standard: true,
        // 标记为 https 同级，允许 Service Worker 等
        secure: true,
        // 允许 fetch()
        supportFetchAPI: true,
        // 允许跨域请求
        corsEnabled: true,
        // 支持流式响应（AI Agent SSE 必需）
        stream: true,
      },
    },
  ]);
}

// 返回主窗口加载的 URL，指向 bundle 根路径
export function getMainWindowUrl(): string {
  return `${APP_SCHEME}://${APP_HOST}/`;
}

// 实际接管 app:// 请求（必须在 app.ready 之后调用）
export function registerAppProtocol(): void {
  const rendererRoot = path.resolve(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}`);

  protocol.handle(APP_SCHEME, async request => {
    const url = new URL(request.url);
    // host 不是 bundle 一律 404，防止协议被滥用
    if (url.host !== APP_HOST) {
      return new Response('Not found', { status: 404 });
    }

    // AI Agent 端点：渲染端用 fetch() 调用，命中后转交各 Agent 路由
    if (url.pathname === '/api/illustration-agent') {
      return handleIllustrationAgentRequest(request);
    }

    if (url.pathname === '/api/character-create-agent') {
      return handleCharacterCreateAgentRequest(request);
    }

    if (url.pathname === '/api/story-agent') {
      return handleStoryAgentRequest(request);
    }

    // 工作区图片：白名单目录 + 路径越界检查
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
      // 解析后必须在 assetsRoot 下，挡住 ../ 等越界访问
      if (!relativePath || !filePath.startsWith(`${assetsRoot}${path.sep}`)) {
        return new Response('Not found', { status: 404 });
      }
      return net.fetch(pathToFileURL(filePath).toString());
    }

    // 开发模式下未匹配：vite dev server 自己处理其他资源
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      return new Response('Not found', { status: 404 });
    }

    // 生产模式：返回 Vue 打包的静态资源
    const decodedPath = decodeURIComponent(url.pathname);
    // 根路径或无扩展名 → 当成 SPA 入口，回退到 index.html
    const relativePath =
      decodedPath === '/' || path.extname(decodedPath) === ''
        ? 'index.html'
        : decodedPath.replace(/^\/+/, '');
    const filePath = path.resolve(rendererRoot, relativePath);
    const rendererRootPrefix = `${rendererRoot}${path.sep}`;

    // 解析后必须在 rendererRoot 下，挡住 ../ 等越界访问
    if (
      filePath !== path.join(rendererRoot, 'index.html') &&
      !filePath.startsWith(rendererRootPrefix)
    ) {
      return new Response('Not found', { status: 404 });
    }

    return net.fetch(pathToFileURL(filePath).toString());
  });
}
