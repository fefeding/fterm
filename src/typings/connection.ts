/**
 * SSH 连接配置接口
 */
export interface ConnectionEntity {
  id?: string;
  name: string;
  type?: 'ssh';
  host: string;
  port?: number;
  username: string;
  authType?: 'password' | 'privateKey';
  password?: string;
  privateKey?: string;
  passphrase?: string;
  terminal?: {
    cols: number;
    rows: number;
    fontSize: number;
    fontFamily: string;
    theme: string;
    cursorStyle: 'block' | 'underline' | 'bar';
  };
  options?: Record<string, any>;
  enabled?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * 终端 Tab 信息
 */
export interface TerminalTab {
  id: string;
  connectionId: string;
  connectionName: string;
  sessionId?: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  cols: number;
  rows: number;
}

/**
 * WebSocket 消息协议
 */
export interface WSMessage {
  type: 'terminal' | 'resize' | 'create' | 'close' | 'status' | 'error' | 'zmodem';
  sessionId?: string;
  data?: any;
}

/**
 * API 响应格式
 */
export interface ApiResponse<T = any> {
  ret: number;
  msg: string;
  data?: T;
}
