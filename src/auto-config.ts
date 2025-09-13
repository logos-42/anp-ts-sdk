/**
 * ANP协议自动配置模块
 * 提供端口自动分配、DID自动生成、HTTP服务器自动启动等功能
 */

import * as net from 'net';
import * as os from 'os';
import express from 'express';
import { ANPKeyGenerator, KeyType } from './anp-key-generator';

// 类型定义
export interface AutoConfigOptions {
  /** 是否自动启动HTTP服务器 */
  autoStart?: boolean;
  /** 是否自动分配端口 */
  autoPort?: boolean;
  /** 是否自动生成DID */
  autoDID?: boolean;
  /** 发现服务地址 */
  discoveryService?: string;
  /** 端口范围 */
  portRange?: [number, number];
  /** 智能体名称 */
  agentName?: string;
  /** 自定义接口配置 */
  interfaces?: AgentInterface[];
  /** 日志级别 */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export interface AgentInterface {
  type: 'NaturalLanguageInterface' | 'StructuredInterface';
  description: string;
  url?: string;
}

export interface AgentConfig {
  did: string;
  port: number;
  endpoint: string;
  localIP: string;
  privateKey: string;
  didDocument: any;
  agentDescription: any;
}

export interface ANPRequest {
  content?: string;
  message?: string;
  [key: string]: any;
}

export interface ANPResponse {
  response: string;
  timestamp: string;
  did: string;
  [key: string]: any;
}

/**
 * 自动配置ANP智能体类
 */
export class AutoConfigAgent {
  private options: Required<AutoConfigOptions>;
  private autoPort: number | null = null;
  private autoDid: string | null = null;
  private autoDescription: any = null;
  private privateKey: string | null = null;
  private localIP: string | null = null;
  private server: any = null;
  private app: express.Application | null = null;
  private isRunning: boolean = false;
  private didDocument: any = null;

  constructor(options: AutoConfigOptions = {}) {
    this.options = {
      autoStart: true,
      autoPort: true,
      autoDID: true,
      discoveryService: '',
      portRange: [3000, 4000],
      agentName: 'Auto-Configured ANP Agent',
      interfaces: [
        {
          type: 'NaturalLanguageInterface',
          description: 'Auto-configured natural language interface'
        }
      ],
      logLevel: 'info',
      ...options
    };
  }

  /**
   * 核心方法：自动配置所有内容
   */
  async autoSetup(): Promise<AgentConfig> {
    this.log('info', '🔄 ANP SDK: 开始自动配置...');
    
    try {
      // 步骤1: 自动分配端口
      this.autoPort = await this.findAvailablePort();
      this.log('info', `✅ 自动分配端口: ${this.autoPort}`);
      
      // 步骤2: 获取本地IP
      this.localIP = await this.getLocalIP();
      this.log('info', `✅ 本地IP: ${this.localIP}`);
      
      // 步骤3: 自动生成DID和密钥
      await this.generateDIDAndKeys();
      this.log('info', `✅ 生成DID: ${this.autoDid}`);
      
      // 步骤4: 启动HTTP服务器
      if (this.options.autoStart) {
        await this.startHTTPServer();
        this.log('info', `✅ HTTP服务器启动在端口: ${this.autoPort}`);
        
        // 步骤5: 自动配置路由
        this.setupRoutes();
        this.log('info', `✅ 路由配置完成`);
        
        // 步骤6: 注册到发现服务
        await this.registerToDiscovery();
        this.log('info', `✅ 注册到发现服务`);
      }
      
      this.isRunning = true;
      this.log('info', '🎉 ANP SDK: 自动配置完成！');
      return this.getConfig();
      
    } catch (error) {
      this.log('error', `❌ ANP SDK: 自动配置失败: ${error}`);
      throw error;
    }
  }

  /**
   * 自动分配可用端口
   */
  private async findAvailablePort(): Promise<number> {
    const [startPort, endPort] = this.options.portRange;
    
    for (let port = startPort; port <= endPort; port++) {
      if (await this.isPortAvailable(port)) {
        return port;
      }
    }
    
    // 如果指定范围内没有可用端口，使用系统自动分配
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      
      server.listen(0, () => {
        const port = (server.address() as net.AddressInfo).port;
        server.close(() => {
          resolve(port);
        });
      });
      
      server.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * 检查端口是否可用
   */
  private async isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();
      
      server.listen(port, () => {
        server.close(() => {
          resolve(true);
        });
      });
      
      server.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * 获取本地IP地址
   */
  private async getLocalIP(): Promise<string> {
    const interfaces = os.networkInterfaces();
    
    for (const name of Object.keys(interfaces)) {
      const iface = interfaces[name];
      if (iface) {
        for (const alias of iface) {
          if (alias.family === 'IPv4' && !alias.internal) {
            return alias.address;
          }
        }
      }
    }
    
    return '127.0.0.1'; // 回退到localhost
  }

  /**
   * 自动生成DID和密钥
   */
  private async generateDIDAndKeys(): Promise<void> {
    // 使用本地IP和端口生成DID
    const domain = `${this.localIP}:${this.autoPort}`;
    const generator = new ANPKeyGenerator(domain, 'auto-agent');
    
    const keyPair = await generator.generateKeyPair(KeyType.ED25519);
    
    this.autoDid = keyPair.did;
    this.privateKey = keyPair.private_key;
    
    // 解析DID文档
    this.didDocument = JSON.parse(keyPair.did_document);
    
    // 更新服务端点URL
    if (this.didDocument.service && this.didDocument.service[0]) {
      this.didDocument.service[0].serviceEndpoint = 
        `http://${this.localIP}:${this.autoPort}/anp/api`;
    }
    
    // 生成智能体描述文档
    this.autoDescription = {
      "@context": {
        "@vocab": "https://schema.org/",
        "ad": "https://service.agent-network-protocol.com/ad#"
      },
      "@type": "ad:AgentDescription",
      "name": this.options.agentName,
      "did": this.autoDid,
      "description": "Automatically configured ANP agent via SDK",
      "version": "1.0.0",
      "created": new Date().toISOString(),
      "ad:interfaces": this.options.interfaces.map(iface => ({
        "@type": `ad:${iface.type}`,
        "url": iface.url || `http://${this.localIP}:${this.autoPort}/anp/api`,
        "description": iface.description
      }))
    };
  }

  /**
   * 启动HTTP服务器
   */
  private async startHTTPServer(): Promise<void> {
    this.app = express();
    this.app.use(express.json());
    
    return new Promise((resolve, reject) => {
      this.server = this.app!.listen(this.autoPort!, (err?: Error) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * 设置路由
   */
  private setupRoutes(): void {
    if (!this.app) {
      throw new Error('HTTP server not started');
    }

    // DID文档端点
    this.app.get('/.well-known/did.json', (req, res) => {
      res.json(this.didDocument);
    });
    
    // 智能体描述文档端点
    this.app.get('/agents/auto-agent/ad.json', (req, res) => {
      res.json(this.autoDescription);
    });
    
    // ANP通信端点
    this.app.post('/anp/api', (req, res) => {
      this.handleANPRequest(req, res);
    });
    
    // 健康检查端点
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        did: this.autoDid,
        port: this.autoPort,
        endpoint: this.getEndpoint(),
        timestamp: new Date().toISOString()
      });
    });
    
    // 配置信息端点
    this.app.get('/config', (req, res) => {
      res.json(this.getConfig());
    });
  }

  /**
   * 处理ANP请求
   */
  private async handleANPRequest(req: express.Request, res: express.Response): Promise<void> {
    try {
      // 验证请求签名（简化版）
      const isValid = await this.verifyRequest(req);
      if (!isValid) {
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }
      
      // 处理业务逻辑
      const response = await this.processMessage(req.body);
      res.json(response);
      
    } catch (error) {
      this.log('error', `处理ANP请求失败: ${error}`);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * 验证请求（简化版）
   */
  private async verifyRequest(req: express.Request): Promise<boolean> {
    // 这里应该实现完整的DID签名验证
    // 为了演示，这里简化处理
    return true;
  }

  /**
   * 处理消息
   */
  private async processMessage(message: ANPRequest): Promise<ANPResponse> {
    // 这里是您的智能体业务逻辑
    return {
      response: `收到消息: ${message.content || message.message || 'Hello'}`,
      timestamp: new Date().toISOString(),
      did: this.autoDid!
    };
  }

  /**
   * 注册到发现服务
   */
  private async registerToDiscovery(): Promise<void> {
    if (!this.options.discoveryService) {
      this.log('warn', '⚠️ 未配置发现服务，跳过注册');
      return;
    }

    try {
      const response = await fetch(this.options.discoveryService, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: this.autoDescription,
          endpoint: this.getEndpoint()
        })
      });
      
      if (response.ok) {
        this.log('info', '✅ 成功注册到发现服务');
      } else {
        this.log('warn', '⚠️ 发现服务注册失败');
      }
    } catch (error) {
      this.log('warn', `⚠️ 发现服务不可用: ${error}`);
    }
  }

  /**
   * 获取配置信息
   */
  public getConfig(): AgentConfig {
    if (!this.autoDid || !this.autoPort || !this.localIP || !this.privateKey) {
      throw new Error('Agent not configured yet. Call autoSetup() first.');
    }

    return {
      did: this.autoDid,
      port: this.autoPort,
      endpoint: this.getEndpoint(),
      localIP: this.localIP,
      privateKey: this.privateKey,
      didDocument: this.didDocument,
      agentDescription: this.autoDescription
    };
  }

  /**
   * 获取服务端点
   */
  public getEndpoint(): string {
    if (!this.localIP || !this.autoPort) {
      throw new Error('Agent not configured yet. Call autoSetup() first.');
    }
    return `http://${this.localIP}:${this.autoPort}/anp/api`;
  }

  /**
   * 停止服务
   */
  public async stop(): Promise<void> {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          this.log('info', '🛑 ANP Agent 已停止');
          this.isRunning = false;
          resolve();
        });
      });
    }
  }

  /**
   * 检查是否正在运行
   */
  public isAgentRunning(): boolean {
    return this.isRunning;
  }

  /**
   * 日志输出
   */
  private log(level: string, message: string): void {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevel = levels.indexOf(this.options.logLevel);
    const messageLevel = levels.indexOf(level);
    
    if (messageLevel >= currentLevel) {
      console.log(`[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`);
    }
  }
}

/**
 * ANP客户端类
 */
export class ANPClient {
  private did: string;
  private privateKey: string;

  constructor(did: string, privateKey: string) {
    this.did = did;
    this.privateKey = privateKey;
  }

  /**
   * 发送请求到其他智能体
   */
  async sendRequest(targetUrl: string, message: ANPRequest): Promise<ANPResponse> {
    const signature = this.generateSignature(message);
    
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `DIDWba did="${this.did}", signature="${signature}"`
      },
      body: JSON.stringify(message)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json() as ANPResponse;
  }

  /**
   * 生成签名（简化版）
   */
  private generateSignature(data: ANPRequest): string {
    // 这里应该实现完整的DID签名
    // 为了演示，返回一个模拟签名
    return 'mock_signature_' + Date.now();
  }
}

/**
 * ANP SDK主类
 */
export class ANPSDK {
  private options: AutoConfigOptions;
  private agent: AutoConfigAgent | null = null;
  private isRunning: boolean = false;

  constructor(options: AutoConfigOptions = {}) {
    this.options = options;
  }

  /**
   * 主要API：一键启动智能体
   */
  async start(): Promise<AgentConfig & { stop: () => Promise<void> }> {
    if (this.isRunning) {
      throw new Error('Agent is already running');
    }

    this.agent = new AutoConfigAgent(this.options);
    const config = await this.agent.autoSetup();
    this.isRunning = true;
    
    return {
      ...config,
      stop: () => this.stop()
    };
  }

  /**
   * 停止智能体
   */
  async stop(): Promise<void> {
    if (this.agent) {
      await this.agent.stop();
      this.agent = null;
      this.isRunning = false;
    }
  }

  /**
   * 创建客户端
   */
  createClient(did: string, privateKey: string): ANPClient {
    return new ANPClient(did, privateKey);
  }

  /**
   * 检查是否正在运行
   */
  isAgentRunning(): boolean {
    return this.isRunning;
  }
}

// 导出主要类和接口
export { ANPSDK as default };
