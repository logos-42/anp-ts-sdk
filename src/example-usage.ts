/**
 * ANP自动配置模块使用示例
 * 展示如何使用HTTP端口自动配置和DID文档自动配置功能
 */

import { HTTPAutoConfig, HTTPConfig } from './http-auto-config';
import { DIDAutoConfig, DIDConfig } from './did-auto-config';
import express from 'express';

/**
 * 示例1: 基础HTTP服务器自动配置
 */
async function example1_BasicHTTPConfig() {
  console.log('=== 示例1: 基础HTTP服务器自动配置 ===');
  
  const httpConfig = new HTTPAutoConfig({
    autoStart: true,
    autoPort: true,
    portRange: [3000, 3100],
    logLevel: 'info'
  });

  try {
    const config = await httpConfig.autoSetup();
    
    console.log('HTTP服务器配置完成:');
    console.log(`- 端口: ${config.port}`);
    console.log(`- 主机: ${config.host}`);
    console.log(`- 本地IP: ${config.localIP}`);
    console.log(`- 端点: ${config.endpoint}`);
    
    // 添加自定义路由
    httpConfig.addRoute({
      method: 'GET',
      path: '/hello',
      handler: (req: express.Request, res: express.Response) => {
        res.json({ message: 'Hello from ANP Agent!' });
      }
    });

    // 等待一段时间后停止
    setTimeout(async () => {
      await httpConfig.stop();
      console.log('HTTP服务器已停止');
    }, 5000);

  } catch (error) {
    console.error('HTTP配置失败:', error);
  }
}

/**
 * 示例2: 基础DID文档自动配置
 */
async function example2_BasicDIDConfig() {
  console.log('\n=== 示例2: 基础DID文档自动配置 ===');
  
  const didConfig = new DIDAutoConfig({
    autoDID: true,
    agentName: 'My ANP Agent',
    agentDescription: 'A sample ANP agent for demonstration',
    agentVersion: '1.0.0',
    logLevel: 'info'
  });

  try {
    const config = await didConfig.autoSetup('localhost', 3000);
    
    console.log('DID配置完成:');
    console.log(`- DID: ${config.did}`);
    console.log(`- 密钥类型: ${config.keyType}`);
    console.log(`- 公钥: ${config.publicKey.substring(0, 20)}...`);
    
    // 导出DID文档
    const didDocument = didConfig.exportDIDDocument();
    console.log('\nDID文档:');
    console.log(didDocument);
    
    // 导出智能体描述文档
    const agentDescription = didConfig.exportAgentDescription();
    console.log('\n智能体描述文档:');
    console.log(agentDescription);
    
  } catch (error) {
    console.error('DID配置失败:', error);
  }
}

/**
 * 示例3: 完整ANP智能体自动配置
 */
async function example3_FullANPAgentConfig() {
  console.log('\n=== 示例3: 完整ANP智能体自动配置 ===');
  
  // 步骤1: 配置HTTP服务器
  const httpConfig = new HTTPAutoConfig({
    autoStart: true,
    autoPort: true,
    portRange: [3000, 3100],
    logLevel: 'info'
  });

  try {
    const httpSetup = await httpConfig.autoSetup();
    console.log(`HTTP服务器启动在: ${httpSetup.endpoint}`);
    
    // 步骤2: 配置DID文档
    const didConfig = new DIDAutoConfig({
      autoDID: true,
      agentName: 'Full ANP Agent',
      agentDescription: 'A complete ANP agent with auto-configuration',
      agentVersion: '1.0.0',
      interfaces: [
        {
          type: 'NaturalLanguageInterface',
          description: 'Natural language processing interface',
          url: `${httpSetup.endpoint}/anp/nlp`
        },
        {
          type: 'StructuredInterface',
          description: 'Structured API interface',
          url: `${httpSetup.endpoint}/anp/api`
        }
      ],
      serviceEndpoints: [
        {
          id: 'anp-service',
          type: 'ANPAgentService',
          serviceEndpoint: `${httpSetup.endpoint}/anp/api`,
          description: 'Main ANP communication endpoint'
        }
      ],
      logLevel: 'info'
    });

    const didSetup = await didConfig.autoSetup(httpSetup.localIP, httpSetup.port);
    console.log(`DID配置完成: ${didSetup.did}`);
    
    // 步骤3: 配置ANP路由
    httpConfig.addRoute({
      method: 'GET',
      path: '/.well-known/did.json',
      handler: (req: express.Request, res: express.Response) => {
        res.json(didConfig.getDIDDocument());
      }
    });

    httpConfig.addRoute({
      method: 'GET',
      path: '/agents/full-agent/ad.json',
      handler: (req: express.Request, res: express.Response) => {
        res.json(didConfig.getAgentDescription());
      }
    });

    httpConfig.addRoute({
      method: 'POST',
      path: '/anp/api',
      handler: (req: express.Request, res: express.Response) => {
        // 处理ANP请求
        const response = {
          response: `收到ANP请求: ${JSON.stringify(req.body)}`,
          timestamp: new Date().toISOString(),
          did: didSetup.did
        };
        res.json(response);
      }
    });

    httpConfig.addRoute({
      method: 'POST',
      path: '/anp/nlp',
      handler: (req: express.Request, res: express.Response) => {
        // 处理自然语言请求
        const response = {
          response: `自然语言处理: ${req.body.message || 'Hello'}`,
          timestamp: new Date().toISOString(),
          did: didSetup.did
        };
        res.json(response);
      }
    });

    console.log('\n🎉 完整ANP智能体配置完成！');
    console.log(`- HTTP端点: ${httpSetup.endpoint}`);
    console.log(`- DID: ${didSetup.did}`);
    console.log(`- DID文档: ${httpSetup.endpoint}/.well-known/did.json`);
    console.log(`- 智能体描述: ${httpSetup.endpoint}/agents/full-agent/ad.json`);
    console.log(`- ANP API: ${httpSetup.endpoint}/anp/api`);
    console.log(`- 自然语言接口: ${httpSetup.endpoint}/anp/nlp`);
    
    // 等待一段时间后停止
    setTimeout(async () => {
      await httpConfig.stop();
      console.log('\nANP智能体已停止');
    }, 10000);

  } catch (error) {
    console.error('完整配置失败:', error);
  }
}

/**
 * 示例4: 自定义配置
 */
async function example4_CustomConfig() {
  console.log('\n=== 示例4: 自定义配置 ===');
  
  // 自定义HTTP配置
  const httpConfig = new HTTPAutoConfig({
    autoStart: true,
    autoPort: false, // 使用指定端口
    portRange: [8080, 8080], // 指定端口8080
    host: '127.0.0.1',
    logLevel: 'debug',
    middlewares: [
      // 自定义中间件
      (req: express.Request, res: express.Response, next: express.NextFunction) => {
        console.log(`自定义中间件: ${req.method} ${req.path}`);
        next();
      }
    ]
  });

  try {
    const httpSetup = await httpConfig.autoSetup();
    console.log(`自定义HTTP服务器启动在: ${httpSetup.endpoint}`);
    
    // 自定义DID配置
    const didConfig = new DIDAutoConfig({
      autoDID: true,
      agentName: 'Custom ANP Agent',
      agentDescription: 'A custom configured ANP agent',
      agentVersion: '2.0.0',
      interfaces: [
        {
          type: 'StructuredInterface',
          description: 'Custom structured interface',
          url: `${httpSetup.endpoint}/custom/api`
        }
      ],
      serviceEndpoints: [
        {
          id: 'custom-service',
          type: 'CustomService',
          serviceEndpoint: `${httpSetup.endpoint}/custom/api`,
          description: 'Custom service endpoint'
        }
      ],
      logLevel: 'debug'
    });

    const didSetup = await didConfig.autoSetup(httpSetup.localIP, httpSetup.port);
    console.log(`自定义DID配置完成: ${didSetup.did}`);
    
    // 添加自定义路由
    httpConfig.addRoute({
      method: 'GET',
      path: '/custom/info',
      handler: (req: express.Request, res: express.Response) => {
        res.json({
          agent: 'Custom ANP Agent',
          did: didSetup.did,
          endpoint: httpSetup.endpoint,
          timestamp: new Date().toISOString()
        });
      }
    });

    console.log('\n🎉 自定义配置完成！');
    console.log(`- 自定义端点: ${httpSetup.endpoint}/custom/info`);
    
    // 等待一段时间后停止
    setTimeout(async () => {
      await httpConfig.stop();
      console.log('\n自定义ANP智能体已停止');
    }, 5000);

  } catch (error) {
    console.error('自定义配置失败:', error);
  }
}

/**
 * 运行所有示例
 */
async function runAllExamples() {
  console.log('🚀 开始运行ANP自动配置示例...\n');
  
  try {
    await example1_BasicHTTPConfig();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await example2_BasicDIDConfig();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await example3_FullANPAgentConfig();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await example4_CustomConfig();
    
    console.log('\n✅ 所有示例运行完成！');
  } catch (error) {
    console.error('示例运行失败:', error);
  }
}

// 如果直接运行此文件，则执行所有示例
if (require.main === module) {
  runAllExamples();
}

// 导出示例函数
export {
  example1_BasicHTTPConfig,
  example2_BasicDIDConfig,
  example3_FullANPAgentConfig,
  example4_CustomConfig,
  runAllExamples
};
