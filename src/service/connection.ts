import { request } from '@/service/base';
import type { ConnectionEntity } from '@/typings/connection';

/**
 * SSH 连接管理服务（前端）
 */
export class ConnectionService {
  async getAllConnections() {
    return request('/api/connection/getConnections', {});
  }

  async getConnectionById(id: string) {
    return request('/api/connection/getConnection', { id });
  }

  async addConnection(connection: ConnectionEntity) {
    return request('/api/connection/addConnection', connection);
  }

  async updateConnection(id: string, updates: Partial<ConnectionEntity>) {
    return request('/api/connection/updateConnection', { id, ...updates });
  }

  async deleteConnection(id: string) {
    return request('/api/connection/deleteConnection', { id });
  }

  async testConnection(connection: ConnectionEntity) {
    return request('/api/connection/testConnection', connection);
  }
}
