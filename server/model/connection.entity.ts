/**
 * SSH 连接配置实体
 * 实际数据保存在本地 JSON 文件中（~/.fterm/connections.json）
 */
export class ConnectionEntity {
  /** 连接 ID */
  id!: string;

  /** 连接名称 */
  name!: string;

  /** 连接类型 */
  type: 'ssh' = 'ssh';

  /** 主机地址 */
  host!: string;

  /** SSH 端口，默认 22 */
  port: number = 22;

  /** 用户名 */
  username!: string;

  /** 认证方式 */
  authType: 'password' | 'privateKey' = 'password';

  /** 密码（加密存储） */
  password?: string;

  /** 私钥内容 */
  privateKey?: string;

  /** 私钥密码 */
  passphrase?: string;

  /** 终端配置 */
  terminal: {
    cols: number;
    rows: number;
    fontSize: number;
    fontFamily: string;
    theme: string;
    cursorStyle: 'block' | 'underline' | 'bar';
  } = {
    cols: 80,
    rows: 24,
    fontSize: 14,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    theme: 'dark',
    cursorStyle: 'block',
  };

  /** 扩展选项（keepalive 间隔等） */
  options: Record<string, any> = {};

  /** 是否启用 */
  enabled: boolean = true;

  /** 创建时间 */
  createdAt: Date = new Date();

  /** 更新时间 */
  updatedAt: Date = new Date();
}
