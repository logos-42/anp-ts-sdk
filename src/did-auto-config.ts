/**
 * ANP DID文档自动配置模块
 * 提供DID自动生成、DID文档自动配置等功能
 */

import { ANPKeyGenerator, KeyType } from './anp-key-generator';

// 类型定义
export interface DIDAutoConfigOptions {
  /** 是否自动生成DID */
  autoDID?: boolean;
  /** 密钥类型 */
  keyType?: KeyType;
  /** 智能体名称 */
  agentName?: string;
  /** 智能体描述 */
  agentDescription?: string;
  /** 智能体版本 */
  agentVersion?: string;
  /** 自定义接口配置 */
  interfaces?: AgentInterface[];
  /** 服务端点配置 */
  serviceEndpoints?: ServiceEndpoint[];
  /** 日志级别 */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export interface AgentInterface {
  type: 'NaturalLanguageInterface' | 'StructuredInterface';
  description: string;
  url?: string;
}

export interface ServiceEndpoint {
  id: string;
  type: string;
  serviceEndpoint: string;
  description?: string;
}

export interface DIDConfig {
  did: string;
  privateKey: string;
  publicKey: string;
  didDocument: any;
  agentDescription: any;
  keyType: KeyType;
}

/**
 * DID文档自动配置类
 */
export class DIDAutoConfig {
  private options: Required<DIDAutoConfigOptions>;
  private autoDid: string | null = null;
  private privateKey: string | null = null;
  private publicKey: string | null = null;
  private didDocument: any = null;
  private agentDescription: any = null;

  constructor(options: DIDAutoConfigOptions = {}) {
    this.options = {
      autoDID: true,
      keyType: KeyType.ED25519,
      agentName: 'Auto-Configured ANP Agent',
      agentDescription: 'Automatically configured ANP agent via SDK',
      agentVersion: '1.0.0',
      interfaces: [
        {
          type: 'NaturalLanguageInterface',
          description: 'Auto-configured natural language interface'
        }
      ],
      serviceEndpoints: [],
      logLevel: 'info',
      ...options
    };
  }

  /**
   * 核心方法：自动配置DID和文档
   */
  async autoSetup(domain: string, port?: number): Promise<DIDConfig> {
    this.log('info', '🔄 DID自动配置: 开始配置...');
    
    try {
      // 步骤1: 生成DID和密钥对
      await this.generateDIDAndKeys(domain, port);
      this.log('info', `✅ 生成DID: ${this.autoDid}`);
      
      // 步骤2: 配置DID文档
      await this.configureDIDDocument();
      this.log('info', `✅ DID文档配置完成`);
      
      // 步骤3: 生成智能体描述文档
      await this.generateAgentDescription();
      this.log('info', `✅ 智能体描述文档生成完成`);
      
      this.log('info', '🎉 DID自动配置完成！');
      return this.getConfig();
      
    } catch (error) {
      this.log('error', `❌ DID自动配置失败: ${error}`);
      throw error;
    }
  }

  /**
   * 生成DID和密钥对
   */
  private async generateDIDAndKeys(domain: string, port?: number): Promise<void> {
    // 构建完整的域名（包含端口）
    const fullDomain = port ? `${domain}:${port}` : domain;
    
    // 使用ANP密钥生成器
    const generator = new ANPKeyGenerator(fullDomain, 'auto-agent');
    const keyPair = await generator.generateKeyPair(this.options.keyType);
    
    this.autoDid = keyPair.did;
    this.privateKey = keyPair.private_key;
    
    // 解析DID文档
    this.didDocument = JSON.parse(keyPair.did_document);
    
    // 提取公钥
    if (this.didDocument.verificationMethod && this.didDocument.verificationMethod[0]) {
      this.publicKey = this.didDocument.verificationMethod[0].publicKeyMultibase;
    }
  }

  /**
   * 配置DID文档
   */
  private async configureDIDDocument(): Promise<void> {
    if (!this.didDocument) {
      throw new Error('DID document not generated yet');
    }

    // 更新服务端点
    if (this.options.serviceEndpoints.length > 0) {
      this.didDocument.service = this.options.serviceEndpoints.map(endpoint => ({
        id: endpoint.id,
        type: endpoint.type,
        serviceEndpoint: endpoint.serviceEndpoint,
        description: endpoint.description
      }));
    }

    // 确保必要的字段存在
    if (!this.didDocument.service) {
      this.didDocument.service = [];
    }

    // 添加默认服务端点（如果存在）
    const defaultEndpoint = this.options.serviceEndpoints.find(ep => ep.id === 'default');
    if (!defaultEndpoint && this.options.serviceEndpoints.length === 0) {
      this.didDocument.service.push({
        id: 'default',
        type: 'ANPAgentService',
        serviceEndpoint: 'http://localhost:3000/anp/api',
        description: 'Default ANP agent service endpoint'
      });
    }
  }

  /**
   * 生成智能体描述文档
   */
  private async generateAgentDescription(): Promise<void> {
    this.agentDescription = {
      "@context": {
        "@vocab": "https://schema.org/",
        "ad": "https://service.agent-network-protocol.com/ad#"
      },
      "@type": "ad:AgentDescription",
      "name": this.options.agentName,
      "did": this.autoDid,
      "description": this.options.agentDescription,
      "version": this.options.agentVersion,
      "created": new Date().toISOString(),
      "ad:interfaces": this.options.interfaces.map(iface => ({
        "@type": `ad:${iface.type}`,
        "url": iface.url || this.getDefaultInterfaceUrl(),
        "description": iface.description
      })),
      "ad:capabilities": [
        {
          "@type": "ad:Capability",
          "name": "Natural Language Processing",
          "description": "Process natural language requests and responses"
        },
        {
          "@type": "ad:Capability", 
          "name": "HTTP Communication",
          "description": "Communicate via HTTP protocol"
        }
      ],
      "ad:supportedProtocols": [
        {
          "@type": "ad:Protocol",
          "name": "ANP",
          "version": "1.0",
          "description": "Agent Network Protocol"
        }
      ]
    };
  }

  /**
   * 获取默认接口URL
   */
  private getDefaultInterfaceUrl(): string {
    // 从DID文档中获取服务端点
    if (this.didDocument && this.didDocument.service && this.didDocument.service[0]) {
      return this.didDocument.service[0].serviceEndpoint;
    }
    return 'http://localhost:3000/anp/api';
  }

  /**
   * 更新服务端点
   */
  public updateServiceEndpoint(endpoint: ServiceEndpoint): void {
    if (!this.didDocument) {
      throw new Error('DID document not configured yet');
    }

    if (!this.didDocument.service) {
      this.didDocument.service = [];
    }

    // 查找现有端点并更新，或添加新端点
    const existingIndex = this.didDocument.service.findIndex((s: any) => s.id === endpoint.id);
    if (existingIndex >= 0) {
      this.didDocument.service[existingIndex] = {
        id: endpoint.id,
        type: endpoint.type,
        serviceEndpoint: endpoint.serviceEndpoint,
        description: endpoint.description
      };
    } else {
      this.didDocument.service.push({
        id: endpoint.id,
        type: endpoint.type,
        serviceEndpoint: endpoint.serviceEndpoint,
        description: endpoint.description
      });
    }

    this.log('info', `✅ 更新服务端点: ${endpoint.id}`);
  }

  /**
   * 添加接口
   */
  public addInterface(iface: AgentInterface): void {
    this.options.interfaces.push(iface);
    
    if (this.agentDescription) {
      this.agentDescription['ad:interfaces'].push({
        "@type": `ad:${iface.type}`,
        "url": iface.url || this.getDefaultInterfaceUrl(),
        "description": iface.description
      });
    }

    this.log('info', `✅ 添加接口: ${iface.type}`);
  }

  /**
   * 获取配置信息
   */
  public getConfig(): DIDConfig {
    if (!this.autoDid || !this.privateKey || !this.publicKey || !this.didDocument || !this.agentDescription) {
      throw new Error('DID not configured yet. Call autoSetup() first.');
    }

    return {
      did: this.autoDid,
      privateKey: this.privateKey,
      publicKey: this.publicKey,
      didDocument: this.didDocument,
      agentDescription: this.agentDescription,
      keyType: this.options.keyType
    };
  }

  /**
   * 获取DID
   */
  public getDID(): string {
    if (!this.autoDid) {
      throw new Error('DID not configured yet. Call autoSetup() first.');
    }
    return this.autoDid;
  }

  /**
   * 获取私钥
   */
  public getPrivateKey(): string {
    if (!this.privateKey) {
      throw new Error('Private key not configured yet. Call autoSetup() first.');
    }
    return this.privateKey;
  }

  /**
   * 获取公钥
   */
  public getPublicKey(): string {
    if (!this.publicKey) {
      throw new Error('Public key not configured yet. Call autoSetup() first.');
    }
    return this.publicKey;
  }

  /**
   * 获取DID文档
   */
  public getDIDDocument(): any {
    if (!this.didDocument) {
      throw new Error('DID document not configured yet. Call autoSetup() first.');
    }
    return this.didDocument;
  }

  /**
   * 获取智能体描述文档
   */
  public getAgentDescription(): any {
    if (!this.agentDescription) {
      throw new Error('Agent description not configured yet. Call autoSetup() first.');
    }
    return this.agentDescription;
  }

  /**
   * 导出DID文档为JSON字符串
   */
  public exportDIDDocument(): string {
    return JSON.stringify(this.getDIDDocument(), null, 2);
  }

  /**
   * 导出智能体描述文档为JSON字符串
   */
  public exportAgentDescription(): string {
    return JSON.stringify(this.getAgentDescription(), null, 2);
  }

  /**
   * 验证DID文档格式
   */
  public validateDIDDocument(): boolean {
    try {
      const doc = this.getDIDDocument();
      
      // 基本验证
      if (!doc['@context'] || !doc.id || !doc.verificationMethod) {
        return false;
      }

      // 验证DID格式
      if (!doc.id.startsWith('did:wba:')) {
        return false;
      }

      return true;
    } catch (error) {
      this.log('error', `DID文档验证失败: ${error}`);
      return false;
    }
  }

  /**
   * 日志输出
   */
  private log(level: string, message: string): void {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevel = levels.indexOf(this.options.logLevel);
    const messageLevel = levels.indexOf(level);
    
    if (messageLevel >= currentLevel) {
      console.log(`[${new Date().toISOString()}] [DID-AUTO-CONFIG] [${level.toUpperCase()}] ${message}`);
    }
  }
}

// 导出主要类和接口
export { DIDAutoConfig as default };
