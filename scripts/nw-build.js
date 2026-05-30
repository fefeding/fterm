const { resolve, join } = require('path');
const { copyFileSync, readFileSync, existsSync, mkdirSync } = require('fs');

const projectRoot = resolve(__dirname, '..');

const args = process.argv.slice(2);
const targetPlatform = args.find(arg => arg.startsWith('--platform='))?.split('=')[1];
const supportedPlatforms = ['win', 'osx', 'linux'];

function getCurrentPlatform() {
  const platform = process.platform;
  if (platform === 'darwin') return ['osx'];
  if (platform === 'linux') return ['linux'];
  return ['win'];
}

function getAppConfig(platform) {
  const config = {
    icon: resolve(projectRoot, 'dist', 'public', 'favicon.ico')
  };
  if (platform === 'osx') {
    config.LSApplicationCategoryType = 'public.app-category.productivity';
    config.NSHumanReadableCopyright = 'Copyright © 2025';
    config.NSLocalNetworkUsageDescription = '需要网络访问以进行 SSH 连接';
    config.CFBundleIdentifier = 'com.aicmd.app';
    config.CFBundleName = 'aicmd';
    config.CFBundleDisplayName = 'AICmd Terminal';
    config.CFBundleShortVersionString = '0.1.0';
    config.CFBundleVersion = '0.1.0';
  }
  return config;
}

function getNwVersion() {
  try {
    const pkg = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf-8'));
    const nwVersion = pkg.devDependencies?.nw;
    if (nwVersion) {
      return nwVersion.replace(/^\^/, '');
    }
  } catch (e) {
    console.warn('无法读取 NW.js 版本，使用 latest');
  }
  return 'latest';
}

async function buildPlatform(platform) {
  const outDir = resolve(projectRoot, `release/aicmd-${platform}`);
  console.log(`\n========================================`);
  console.log(`构建 ${platform} 平台...`);
  console.log(`========================================`);

  // nw-builder v4 为 ESM 模块，需动态导入
  const { default: nwbuild } = await import('nw-builder');

  const nwVersion = getNwVersion();
  console.log(`使用 NW.js 版本: ${nwVersion}`);

  await nwbuild({
    mode: 'build',
    srcDir: resolve(projectRoot, 'dist'),
    version: nwVersion,
    flavor: 'normal',
    platform,
    arch: 'x64',
    outDir,
    cacheDir: resolve(projectRoot, 'nw-cache'),
    glob: false,
    logLevel: 'info',
    app: getAppConfig(platform),
    zip: true,
    // 支持通过环境变量配置下载镜像（如云构建环境）
    downloadUrl: process.env.NWJS_DOWNLOAD_URL || 'https://dl.nwjs.io',
    manifestUrl: process.env.NWJS_MANIFEST_URL || 'https://nwjs.io/versions.json',
    shaSum: process.env.NWJS_SKIP_SHA !== 'true',
  });

  console.log(`✅ ${platform} 构建完成 -> ${outDir}`);
}

async function build() {
  try {
    console.log('Building aicmd NW.js app...\n');

    const { execSync } = require('child_process');

    console.log('1. 构建 Vue 应用 + 服务端...');
    execSync('npm run build', { stdio: 'inherit', cwd: projectRoot });

    console.log('\n2. 复制 package.json 到 dist...');
    copyFileSync(join(projectRoot, 'package.json'), join(projectRoot, 'dist', 'package.json'));

    // 复制 patches 目录（pnpm patchedDependencies 需要）
    const patchesDir = join(projectRoot, 'patches');
    if (existsSync(patchesDir)) {
      const distPatchesDir = join(projectRoot, 'dist', 'patches');
      if (!existsSync(distPatchesDir)) mkdirSync(distPatchesDir, { recursive: true });
      const { cpSync } = require('fs');
      cpSync(patchesDir, distPatchesDir, { recursive: true, force: true });
    }

    console.log('\n3. 安装生产依赖到 dist...');
    // 优先使用 pnpm，回退到 npm
    try {
      execSync('pnpm install --prod', { stdio: 'inherit', cwd: resolve(projectRoot, 'dist') });
    } catch (e) {
      console.log('pnpm install 失败，尝试 npm install...');
      execSync('npm install --omit=dev --no-audit --no-fund', { stdio: 'inherit', cwd: resolve(projectRoot, 'dist') });
    }

    let platformsToBuild = [];
    if (targetPlatform) {
      if (targetPlatform === 'all') platformsToBuild = supportedPlatforms;
      else if (supportedPlatforms.includes(targetPlatform)) platformsToBuild = [targetPlatform];
      else { console.error(`不支持的平台: ${targetPlatform}`); process.exit(1); }
    } else {
      platformsToBuild = getCurrentPlatform();
    }

    for (const platform of platformsToBuild) {
      await buildPlatform(platform);
    }

    console.log('\n🎉 所有平台构建完成！');
  } catch (error) {
    console.error('构建失败:', error);
    process.exit(1);
  }
}

build();
