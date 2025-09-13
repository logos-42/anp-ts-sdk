/**
 * ANP HTTP端口自动配置模块
 * 提供端口自动分配、HTTP服务器自动启动等功能
 */

import * as net from 'net';
import * as os from 'os';
import * as http from 'http';
import * as url from 'url';
import express from 'express';
import { Server } from 'http';

// 类型定义
export interface HTTPAutoConfigOptions {
  /** 是否自动启动HTTP服务器 */
  autoStart?: boolean;
  /** 是否自动分配端口 */
  autoPort?: boolean;
  /** 端口范围 */
  portRange?: [number, number];
  /** 主机地址 */
  host?: string;
  /** 日志级别 */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  /** 自定义中间件 */
  middlewares?: express.RequestHandler[];
  /** 自定义路由 */
  routes?: RouteConfig[];
}

export interface RouteConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  handler: express.RequestHandler;
}

export interface HTTPConfig {
  port: number;
  host: string;
  localIP: string;
  endpoint: string;
  server: Server;
  app: express.Application;
}

/**
 * HTTP端口自动配置类
 */
export class HTTPAutoConfig {
  private options: Required<HTTPAutoConfigOptions>;
  private autoPort: number | null = null;
  private localIP: string | null = null;
  private server: Server | null = null;
  private app: express.Application | null = null;
  private isRunning: boolean = false;

  constructor(options: HTTPAutoConfigOptions = {}) {
    this.options = {
      autoStart: true,
      autoPort: true,
      portRange: [3000, 4000],
      host: '0.0.0.0',
      logLevel: 'info',
      middlewares: [],
      routes: [],
      ...options
    };
  }

  /**
   * 核心方法：自动配置HTTP服务器
   */
  async autoSetup(): Promise<HTTPConfig> {
    this.log('info', '🔄 HTTP自动配置: 开始配置...');
    
    try {
      // 步骤1: 自动分配端口
      if (this.options.autoPort) {
        this.autoPort = await this.findAvailablePort();
        this.log('info', `✅ 自动分配端口: ${this.autoPort}`);
      } else {
        this.autoPort = this.options.portRange[0];
        this.log('info', `✅ 使用指定端口: ${this.autoPort}`);
      }
      
      // 步骤2: 获取本地IP
      this.localIP = await this.getLocalIP();
      this.log('info', `✅ 本地IP: ${this.localIP}`);
      
      // 步骤3: 启动HTTP服务器
      if (this.options.autoStart) {
        await this.startHTTPServer();
        this.log('info', `✅ HTTP服务器启动在端口: ${this.autoPort}`);
        
        // 步骤4: 配置中间件
        this.setupMiddlewares();
        this.log('info', `✅ 中间件配置完成`);
        
        // 步骤5: 配置路由
        this.setupRoutes();
        this.log('info', `✅ 路由配置完成`);
      }
      
      this.isRunning = true;
      this.log('info', '🎉 HTTP自动配置完成！');
      return this.getConfig();
      
    } catch (error) {
      this.log('error', `❌ HTTP自动配置失败: ${error}`);
      throw error;
    }
  }

  /**
   * 自动分配可用端口
   */
  private async findAvailablePort(): Promise<number> {
    const [startPort, endPort] = this.options.portRange;
    
    // 首先尝试指定范围内的端口
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
   * 启动HTTP服务器
   */
  private async startHTTPServer(): Promise<void> {
    this.app = express();
    
    return new Promise((resolve, reject) => {
      this.server = this.app!.listen(this.autoPort!, this.options.host, (err?: Error) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * 配置中间件
   */
  private setupMiddlewares(): void {
    if (!this.app) {
      throw new Error('HTTP server not started');
    }

    // 基础中间件
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // CORS中间件
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });

    // 请求日志中间件
    this.app.use((req, res, next) => {
      this.log('debug', `${req.method} ${req.path} - ${req.ip}`);
      next();
    });

    // 自定义中间件
    this.options.middlewares.forEach(middleware => {
      this.app!.use(middleware);
    });
  }

  /**
   * 配置路由
   */
  private setupRoutes(): void {
    if (!this.app) {
      throw new Error('HTTP server not started');
    }

    // 健康检查端点
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        port: this.autoPort,
        host: this.options.host,
        localIP: this.localIP,
        endpoint: this.getEndpoint(),
        timestamp: new Date().toISOString()
      });
    });

    // 配置信息端点
    this.app.get('/config', (req, res) => {
      res.json(this.getConfig());
    });

    // 自定义路由
    this.options.routes.forEach(route => {
      (this.app as any)[route.method.toLowerCase()](route.path, route.handler);
    });

    // 404处理
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Not Found',
        path: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString()
      });
    });

    // 错误处理中间件
    this.app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      this.log('error', `请求处理错误: ${err.message}`);
      res.status(500).json({
        error: 'Internal Server Error',
        message: err.message,
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * 获取配置信息
   */
  public getConfig(): HTTPConfig {
    if (!this.autoPort || !this.localIP || !this.server || !this.app) {
      throw new Error('HTTP server not configured yet. Call autoSetup() first.');
    }

    return {
      port: this.autoPort,
      host: this.options.host,
      localIP: this.localIP,
      endpoint: this.getEndpoint(),
      server: this.server,
      app: this.app
    };
  }

  /**
   * 获取服务端点
   */
  public getEndpoint(): string {
    if (!this.localIP || !this.autoPort) {
      throw new Error('HTTP server not configured yet. Call autoSetup() first.');
    }
    return `http://${this.localIP}:${this.autoPort}`;
  }

  /**
   * 添加路由
   */
  public addRoute(route: RouteConfig): void {
    if (!this.app) {
      throw new Error('HTTP server not started');
    }
    
    (this.app as any)[route.method.toLowerCase()](route.path, route.handler);
    this.log('info', `✅ 添加路由: ${route.method} ${route.path}`);
  }

  /**
   * 添加中间件
   */
  public addMiddleware(middleware: express.RequestHandler): void {
    if (!this.app) {
      throw new Error('HTTP server not started');
    }
    
    this.app.use(middleware);
    this.log('info', `✅ 添加中间件`);
  }

  /**
   * 停止服务
   */
  public async stop(): Promise<void> {
    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => {
          this.log('info', '🛑 HTTP服务器已停止');
          this.isRunning = false;
          resolve();
        });
      });
    }
  }

  /**
   * 检查是否正在运行
   */
  public isServerRunning(): boolean {
    return this.isRunning;
  }

  /**
   * 获取Express应用实例
   */
  public getApp(): express.Application {
    if (!this.app) {
      throw new Error('HTTP server not started');
    }
    return this.app;
  }

  /**
   * 获取服务器实例
   */
  public getServer(): Server {
    if (!this.server) {
      throw new Error('HTTP server not started');
    }
    return this.server;
  }

  /**
   * 日志输出
   */
  private log(level: string, message: string): void {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevel = levels.indexOf(this.options.logLevel);
    const messageLevel = levels.indexOf(level);
    
    if (messageLevel >= currentLevel) {
      console.log(`[${new Date().toISOString()}] [HTTP-AUTO-CONFIG] [${level.toUpperCase()}] ${message}`);
    }
  }
}

// 导出主要类和接口
export { HTTPAutoConfig as default };
