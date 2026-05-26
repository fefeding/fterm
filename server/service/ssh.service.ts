import { Client, type ClientChannel } from 'ssh2';
import { ConnectionService } from './connection.service';
import { ConnectionEntity } from '../model/connection.entity';

/**
 * SSH 会话信息
 */
interface SSHSession {
  id: string;
  connectionId: string;
  client: Client;
  stream: ClientChannel;
  createdAt: Date;
}

/**
 * SSH 会话管理服务
 * 负责创建、管理和销毁 SSH 连接会话
 */
export class SSHService {
  private sessions: Map<string, SSHSession> = new Map();
  private connectionService: ConnectionService;

  constructor(connectionService: ConnectionService) {
    this.connectionService = connectionService;
  }

  /**
   * 创建 SSH 会话
   * @returns SSH 客户端和流
   */
  async createSession(sessionId: string, connectionId: string, cols: number = 80, rows: number = 24): Promise<SSHSession> {
    // 如果已存在同 ID 的会话，先关闭
    if (this.sessions.has(sessionId)) {
      this.closeSession(sessionId);
    }

    const connection = await this.connectionService.getConnectionById(connectionId);
    if (!connection) {
      throw new Error('连接配置不存在');
    }

    const sshConfig = this.connectionService.getSSHConfig(connection);
    const client = new Client();

    return new Promise<SSHSession>((resolve, reject) => {
      const timeout = setTimeout(() => {
        client.end();
        reject(new Error('SSH 连接超时'));
      }, 30000);

      client.on('ready', () => {
        clearTimeout(timeout);

        client.shell({
          term: 'xterm-256color',
          cols,
          rows,
        }, (err: Error | undefined, stream: ClientChannel) => {
          if (err) {
            client.end();
            reject(err);
            return;
          }

          const session: SSHSession = {
            id: sessionId,
            connectionId,
            client,
            stream,
            createdAt: new Date(),
          };

          this.sessions.set(sessionId, session);

          // 监听流关闭
          stream.on('close', () => {
            this.sessions.delete(sessionId);
          });

          resolve(session);
        });
      }).on('error', (err: Error) => {
        clearTimeout(timeout);
        reject(err);
      }).connect(sshConfig);
    });
  }

  /**
   * 获取 SSH 会话
   */
  getSession(sessionId: string): SSHSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * 向 SSH 会话写入数据（用户输入）
   */
  writeData(sessionId: string, data: string | Buffer): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || !session.stream) {
      return false;
    }
    try {
      session.stream.write(data);
      return true;
    } catch (error) {
      console.error(`写入 SSH 会话 ${sessionId} 失败:`, error);
      return false;
    }
  }

  /**
   * 调整终端窗口大小
   */
  resize(sessionId: string, cols: number, rows: number): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || !session.stream) {
      return false;
    }
    try {
      session.stream.setWindow(rows, cols, 0, 0);
      return true;
    } catch (error) {
      console.error(`调整终端大小 ${sessionId} 失败:`, error);
      return false;
    }
  }

  /**
   * 关闭 SSH 会话
   */
  closeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      try {
        session.stream?.end();
        session.client?.end();
      } catch (error) {
        console.error(`关闭 SSH 会话 ${sessionId} 失败:`, error);
      }
      this.sessions.delete(sessionId);
    }
  }

  /**
   * 关闭所有 SSH 会话
   */
  closeAllSessions(): void {
    for (const [sessionId] of this.sessions) {
      this.closeSession(sessionId);
    }
  }

  /**
   * 获取活跃会话数量
   */
  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * 获取所有活跃会话 ID
   */
  getActiveSessionIds(): string[] {
    return Array.from(this.sessions.keys());
  }
}
