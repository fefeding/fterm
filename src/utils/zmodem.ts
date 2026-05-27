/**
 * @file ZMODEM 协议处理工具
 * @description 使用 zmodem.js 库实现 ZMODEM 文件传输（rz/sz）
 */

// @ts-ignore
import * as Zmodem from 'zmodem.js/src/zmodem_browser.js';

export { Zmodem };

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
 * 创建 ZMODEM Sentry 实例
 * Sentry 拦截所有服务器数据，检测 ZMODEM 协议序列
 */
export function createSentry(opts: {
  toTerminal: (data: number[]) => void;
  sender: (data: number[]) => void;
  onDetect: (detection: any) => void;
  onRetract: () => void;
}) {
  return new Zmodem.Sentry({
    to_terminal: opts.toTerminal,
    sender: opts.sender,
    on_detect: opts.onDetect,
    on_retract: opts.onRetract,
  });
}

/**
 * 将 base64 字符串转换为数字数组（octets）
 */
export function base64ToOctets(base64: string): number[] {
  const binary = atob(base64);
  const octets: number[] = new Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    octets[i] = binary.charCodeAt(i);
  }
  return octets;
}

/**
 * 将字符串转换为数字数组（octets）
 */
export function stringToOctets(str: string): number[] {
  const encoder = new TextEncoder();
  const uint8 = encoder.encode(str);
  return Array.from(uint8);
}

/**
 * 将数字数组（octets）转换为 Uint8Array
 */
export function octetsToUint8Array(octets: number[]): Uint8Array {
  return new Uint8Array(octets);
}

/**
 * 将数字数组（octets）发送给 WebSocket（base64编码）
 */
export function octetsToBase64(octets: number[] | Uint8Array): string {
  const arr = octets instanceof Uint8Array ? octets : new Uint8Array(octets);
  let binary = '';
  for (let i = 0; i < arr.length; i++) {
    binary += String.fromCharCode(arr[i]);
  }
  return btoa(binary);
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
