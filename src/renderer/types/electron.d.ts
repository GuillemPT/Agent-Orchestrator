export interface IElectronAPI {
  agent: {
    create: (data: any) => Promise<any>;
    update: (id: string, updates: any) => Promise<any>;
    delete: (id: string) => Promise<void>;
    getAll: () => Promise<any[]>;
    getById: (id: string) => Promise<any>;
    exportToMd: (agent: any) => Promise<string>;
  };
  skill: {
    create: (data: any) => Promise<any>;
    update: (id: string, updates: any) => Promise<any>;
    delete: (id: string) => Promise<void>;
    getAll: () => Promise<any[]>;
    exportToMd: (skill: any) => Promise<string>;
    exportToYaml: (skill: any) => Promise<string>;
  };
  mcp: {
    load: () => Promise<any>;
    save: (config: any) => Promise<void>;
    export: () => Promise<string>;
  };
  secure: {
    setPassword: (service: string, account: string, password: string) => Promise<void>;
    getPassword: (service: string, account: string) => Promise<string | null>;
    deletePassword: (service: string, account: string) => Promise<boolean>;
  };
  sync: {
    syncDirectories: (options: any) => Promise<void>;
    detectChanges: () => Promise<{ github: string[]; home: string[] }>;
  };
  pattern: {
    generateInstructions: (agent: any, patterns?: string[]) => Promise<any>;
  };
}

declare global {
  interface Window {
    api: IElectronAPI;
  }
}

export {};
