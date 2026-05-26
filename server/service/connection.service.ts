import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConnectionEntity } from '../model/connection.entity';

/**
 * SSH 连接管理服务
 * 负责管理 SSH 连接配置的 CRUD，数据存储在本地 JSON 文件中
 */
export class ConnectionService {

  /**
   * 连接配置文件路径
   * 优先使用环境变量 fterm_DATA_DIR，否则使用用户主目录下的 .fterm 目录
   */
  private readonly configPath: string;

  constructor() {
    const dataDir = process.env.fterm_DATA_DIR || path.join(os.homedir(), '.fterm');
    this.configPath = path.join(dataDir, 'connections.json');
  }

  /**
   * 初始化服务，创建配置目录
   */
  async init() {
    const configDir = path.dirname(this.configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
  }

  /**
   * 获取所有 SSH 连接配置
   */
  async getAllConnections(): Promise<ConnectionEntity[]> {
    try {
      if (!fs.existsSync(this.configPath)) {
        return [];
      }
      const data = fs.readFileSync(this.configPath, 'utf8');
      return JSON.parse(data) as ConnectionEntity[];
    } catch (error) {
      console.error('读取连接配置失败:', error);
      return [];
    }
  }

  /**
   * 根据 ID 获取 SSH 连接配置
   */
  async getConnectionById(id: string): Promise<ConnectionEntity | null> {
    const connections = await this.getAllConnections();
    return connections.find(conn => conn.id === id) || null;
  }

  /**
   * 添加 SSH 连接配置
   */
  async addConnection(connection: ConnectionEntity): Promise<ConnectionEntity> {
    const connections = await this.getAllConnections();

    // 检查名称是否重复
    if (connections.find(conn => conn.name === connection.name)) {
      throw new Error('连接名称已存在');
    }

    // 生成 ID 并设置时间戳
    connection.id = this.generateId();
    connection.createdAt = new Date();
    connection.updatedAt = new Date();
    connection.enabled = connection.enabled !== undefined ? connection.enabled : true;

    connections.push(connection);
    await this.saveConnections(connections);

    return connection;
  }

  /**
   * 更新 SSH 连接配置
   */
  async updateConnection(id: string, updates: Partial<ConnectionEntity>): Promise<ConnectionEntity> {
    const connections = await this.getAllConnections();
    const index = connections.findIndex(conn => conn.id === id);

    if (index === -1) {
      throw new Error('连接配置不存在');
    }

    // 检查名称重复
    if (updates.name && connections.find((conn, idx) => conn.name === updates.name && idx !== index)) {
      throw new Error('连接名称已存在');
    }

    connections[index] = { ...connections[index], ...updates, updatedAt: new Date() } as ConnectionEntity;
    await this.saveConnections(connections);
    return connections[index];
  }

  /**
   * 删除 SSH 连接配置
   */
  async deleteConnection(id: string): Promise<void> {
    const connections = await this.getAllConnections();
    const filteredConnections = connections.filter(conn => conn.id !== id);

    if (filteredConnections.length === connections.length) {
      throw new Error('连接配置不存在');
    }

    await this.saveConnections(filteredConnections);
  }

  /**
   * 测试 SSH 连接
   */
  async testConnection(connection: ConnectionEntity): Promise<boolean> {
    try {
      const { Client } = require('ssh2');
      return new Promise<boolean>((resolve) => {
        const conn = new Client();
        const timeout = setTimeout(() => {
          conn.end();
          resolve(false);
        }, 10000);

        conn.on('ready', () => {
          clearTimeout(timeout);
          conn.end();
          resolve(true);
        }).on('error', (err: Error) => {
          clearTimeout(timeout);
          console.error('SSH 连接测试失败:', err.message);
          resolve(false);
        }).connect(this.getSSHConfig(connection));
      });
    } catch (error) {
      console.error('SSH 连接测试异常:', error);
      return false;
    }
  }

  /**
   * 从连接实体提取 ssh2 连接配置
   */
  getSSHConfig(connection: ConnectionEntity): any {
    const config: any = {
      host: connection.host,
      port: connection.port || 22,
      username: connection.username,
      readyTimeout: 30000,
      keepaliveInterval: 10000,
      keepaliveCountMax: 3,
    };

    if (connection.authType === 'privateKey' && connection.privateKey) {
      config.privateKey = connection.privateKey;
      if (connection.passphrase) {
        config.passphrase = connection.passphrase;
      }
    } else {
      config.password = connection.password;
    }

    return { ...config, ...connection.options };
  }

  /**
   * 保存连接配置到文件
   */
  private async saveConnections(connections: ConnectionEntity[]): Promise<void> {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(connections, null, 2), 'utf8');
    } catch (error) {
      console.error('保存连接配置失败:', error);
      throw error;
    }
  }

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}
