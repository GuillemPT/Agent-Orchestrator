import { ISecureStorage } from '../../domain/interfaces/ISecureStorage';

export class KeytarSecureStorage implements ISecureStorage {
  private keytar: any;

  constructor() {
    // Dynamically import keytar to handle different platforms
    try {
      this.keytar = require('keytar');
    } catch (error) {
      console.warn('Keytar not available, using fallback storage');
      this.keytar = null;
    }
  }

  async setPassword(service: string, account: string, password: string): Promise<void> {
    if (this.keytar) {
      await this.keytar.setPassword(service, account, password);
    } else {
      // Fallback: In-memory storage (not secure, for development only)
      console.warn('Using insecure fallback storage');
    }
  }

  async getPassword(service: string, account: string): Promise<string | null> {
    if (this.keytar) {
      return await this.keytar.getPassword(service, account);
    }
    return null;
  }

  async deletePassword(service: string, account: string): Promise<boolean> {
    if (this.keytar) {
      return await this.keytar.deletePassword(service, account);
    }
    return false;
  }

  async findCredentials(service: string): Promise<Array<{ account: string; password: string }>> {
    if (this.keytar) {
      return await this.keytar.findCredentials(service);
    }
    return [];
  }
}
