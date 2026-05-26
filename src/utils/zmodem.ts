/**
 * @file ZMODEM 协议处理工具
 * @description 检测和处理 rz/sz 文件传输序列，配合 lrzsz 库使用
 */

// ZMODEM 协议关键序列
export const ZMODEM_START = '\x18B00'; // ZMODEM 初始化序列 (CAN + B00)
export const ZMODEM_END = '\x18B08';   // ZMODEM 结束序列
export const ZRQINIT = 'rz';          // 接收文件命令
export const ZSINIT = 'sz';           // 发送文件命令

export type ZmodemDirection = 'upload' | 'download';
export type ZmodemState = 'idle' | 'detecting' | 'transferring' | 'complete' | 'error';

export interface ZmodemProgress {
  direction: ZmodemDirection;
  fileName: string;
  bytesSent: number;
  bytesTotal: number;
  percent: number;
  state: ZmodemState;
}

/**
 * 检测数据中是否包含 ZMODEM 启动序列
 */
export function detectZmodemStart(data: string): boolean {
  return data.includes(ZMODEM_START) || data.includes('\x18B0');
}

/**
 * 检测数据中是否包含 ZMODEM 结束序列
 */
export function detectZmodemEnd(data: string): boolean {
  return data.includes(ZMODEM_END) || data.includes('OO');
}

/**
 * ZMODEM 会话管理器
 * 封装 lrzsz 库的调用逻辑
 */
export class ZmodemSession {
  private direction: ZmodemDirection = 'upload';
  private state: ZmodemState = 'idle';
  private fileName: string = '';
  private onDataCallback: ((data: string | ArrayBuffer) => void) | null = null;
  private onProgressCallback: ((progress: ZmodemProgress) => void) | null = null;
  private onCompleteCallback: (() => void) | null = null;
  private onErrorCallback: ((error: Error) => void) | null = null;

  /**
   * 设置数据发送回调（发送到 WebSocket/SSH）
   */
  onData(cb: (data: string | ArrayBuffer) => void) {
    this.onDataCallback = cb;
    return this;
  }

  /**
   * 设置进度回调
   */
  onProgress(cb: (progress: ZmodemProgress) => void) {
    this.onProgressCallback = cb;
    return this;
  }

  /**
   * 设置完成回调
   */
  onComplete(cb: () => void) {
    this.onCompleteCallback = cb;
    return this;
  }

  /**
   * 设置错误回调
   */
  onError(cb: (error: Error) => void) {
    this.onErrorCallback = cb;
    return this;
  }

  /**
   * 开始上传文件 (rz - 本地发送到远程)
   * @param files 要上传的文件列表
   */
  async startUpload(files: File[]): Promise<void> {
    this.direction = 'upload';
    this.state = 'transferring';

    try {
      for (const file of files) {
        this.fileName = file.name;
        this.emitProgress(0, file.size);

        // 读取文件内容
        const buffer = await file.arrayBuffer();

        // 发送文件名（模拟 rz 协议）
        if (this.onDataCallback) {
          // 发送文件元数据
          this.onDataCallback(JSON.stringify({
            type: 'zmodem',
            action: 'start',
            fileName: file.name,
            fileSize: file.size,
          }));

          // 分块发送文件内容
          const chunkSize = 8192;
          let sent = 0;
          const uint8 = new Uint8Array(buffer);

          while (sent < uint8.length) {
            const end = Math.min(sent + chunkSize, uint8.length);
            const chunk = uint8.slice(sent, end);
            this.onDataCallback(chunk.buffer);
            sent = end;
            this.emitProgress(sent, file.size);
          }

          // 发送完成信号
          this.onDataCallback(JSON.stringify({
            type: 'zmodem',
            action: 'end',
            fileName: file.name,
          }));
        }
      }

      this.state = 'complete';
      this.onCompleteCallback?.();
    } catch (error: any) {
      this.state = 'error';
      this.onErrorCallback?.(error);
    }
  }

  /**
   * 开始下载文件 (sz - 从远程接收文件)
   */
  startDownload(fileName: string) {
    this.direction = 'download';
    this.state = 'transferring';
    this.fileName = fileName;

    // 发送下载请求到远程
    if (this.onDataCallback) {
      this.onDataCallback(JSON.stringify({
        type: 'zmodem',
        action: 'download',
        fileName,
      }));
    }
  }

  /**
   * 处理从 SSH/终端接收的数据
   * 用于下载模式下接收文件块
   */
  handleData(data: ArrayBuffer | string): Blob | null {
    if (this.direction !== 'download' || this.state !== 'transferring') {
      return null;
    }

    // 简单实现：累积数据块
    if (typeof data === 'string') {
      // 文本数据可能是进度信息
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'zmodem') {
          if (parsed.action === 'progress') {
            this.emitProgress(parsed.bytesSent, parsed.bytesTotal);
          } else if (parsed.action === 'end') {
            this.state = 'complete';
            this.onCompleteCallback?.();
          } else if (parsed.action === 'error') {
            this.state = 'error';
            this.onErrorCallback?.(new Error(parsed.message));
          }
        }
      } catch {
        // 非 JSON 数据，忽略
      }
    }

    return null;
  }

  /**
   * 取消传输
   */
  cancel() {
    this.state = 'idle';
    if (this.onDataCallback) {
      // 发送取消信号 (CAN character x 8)
      this.onDataCallback('\x18\x18\x18\x18\x18\x18\x18\x18');
    }
  }

  /**
   * 获取当前状态
   */
  getState() {
    return {
      direction: this.direction,
      state: this.state,
      fileName: this.fileName,
    };
  }

  /**
   * 重置会话
   */
  reset() {
    this.direction = 'upload';
    this.state = 'idle';
    this.fileName = '';
  }

  private emitProgress(bytesSent: number, bytesTotal: number) {
    this.onProgressCallback?.({
      direction: this.direction,
      fileName: this.fileName,
      bytesSent,
      bytesTotal,
      percent: bytesTotal > 0 ? Math.round((bytesSent / bytesTotal) * 100) : 0,
      state: this.state,
    });
  }
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
