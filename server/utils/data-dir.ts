import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

/**
 * 获取数据目录路径（统一入口）
 * 所有需要写入的文件（PID、日志、配置、会话等）都必须通过此函数获取目录
 *
 * 优先级：环境变量 AICMD_DATA_DIR > ~/.aicmd
 */
export function getDataDir(): string {
  return process.env.AICMD_DATA_DIR || path.join(os.homedir(), '.aicmd');
}

/**
 * 确保数据目录存在，不存在则创建
 */
export function ensureDataDir(): string {
  const dir = getDataDir();
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (e: any) {
    console.error(`Cannot create data directory ${dir}: ${e.message}`);
    throw e;
  }
  return dir;
}

/**
 * 获取数据目录下的文件绝对路径
 * @param filename 文件名或相对路径（如 'server.log', 'ai-history/xxx.json'）
 */
export function getDataPath(...segments: string[]): string {
  return path.join(getDataDir(), ...segments);
}

/**
 * 递归修复目录及文件权限：目录 755，文件 644
 */
export function fixPermissions(dir?: string): void {
  const targetDir = dir || getDataDir();
  try {
    fs.chmodSync(targetDir, 0o755);
    const entries = fs.readdirSync(targetDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(targetDir, entry.name);
      try {
        if (entry.isDirectory()) {
          fixPermissions(fullPath);
        } else {
          fs.chmodSync(fullPath, 0o644);
        }
      } catch { /* 单个文件失败不影响其他 */ }
    }
  } catch { /* ignore */ }
}
