const nwbuilder = require('nw-builder');
const { resolve, join } = require('path');
const { copyFileSync, existsSync, readdirSync } = require('fs');

const projectRoot = resolve(__dirname, '..');

const args = process.argv.slice(2);
const targetPlatform = args.find(arg => arg.startsWith('--platform='))?.split('=')[1];
const supportedPlatforms = ['win', 'osx', 'linux'];

function getCurrentPlatform() {
  const platform = process.platform;
  if (platform === 'darwin') return ['osx'];
  if (platform === 'linux') return ['linux'];
  return ['win', 'linux'];
}

function getAppConfig(platform) {
  const config = {
    icon: resolve(projectRoot, 'dist', 'public', 'favicon.ico')
  };
  if (platform === 'osx') {
    config.LSApplicationCategoryType = 'public.app-category.productivity';
    config.NSHumanReadableCopyright = 'Copyright © 2025';
    config.NSLocalNetworkUsageDescription = '需要网络访问以进行 SSH 连接';
    config.CFBundleIdentifier = 'com.fterm.app';
    config.CFBundleName = 'fterm';
    config.CFBundleDisplayName = 'fterm 远程终端';
    config.CFBundleShortVersionString = '0.1.0';
    config.CFBundleVersion = '0.1.0';
  }
  return config;
}

async function buildPlatform(platform) {
  const outDir = resolve(projectRoot, `release/fterm-${platform}`);
  console.log(`\n========================================`);
  console.log(`构建 ${platform} 平台...`);
  console.log(`========================================`);

  await nwbuilder.default({
    mode: 'build',
    srcDir: resolve(projectRoot, 'dist'),
    version: '0.78.1',
    flavor: 'normal',
    platform,
    arch: 'x64',
    outDir,
    cacheDir: resolve(projectRoot, 'nw-cache'),
    downloadUrl: 'https://github.com/nwjs/nw.js/releases/download/v0.78.1',
    zip: false,
    logLevel: 'info',
    glob: false,
    app: getAppConfig(platform)
  });

  console.log(`✅ ${platform} 构建完成 -> ${outDir}`);
}

async function build() {
  try {
    console.log('构建 fterm NW.js 应用...\n');

    console.log('1. 构建 Vue 应用...');
    const { execSync } = require('child_process');
    execSync('npm run build', { stdio: 'inherit', cwd: projectRoot });

    console.log('\n2. 复制 package.json 到 dist...');
    copyFileSync(join(projectRoot, 'package.json'), join(projectRoot, 'dist', 'package.json'));

    console.log('\n3. 安装生产依赖到 dist...');
    execSync('pnpm install --only=production', { stdio: 'inherit', cwd: resolve(projectRoot, 'dist') });

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
