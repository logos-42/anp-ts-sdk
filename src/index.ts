/**
 * ANP SDK 主入口文件
 * 整合所有ANP自动配置功能
 */

// 导出核心类
export { ANPSDK, AutoConfigAgent, ANPClient } from './auto-config';
export { HTTPAutoConfig } from './http-auto-config';
export { DIDAutoConfig } from './did-auto-config';
export { ANPKeyGenerator, KeyType } from './anp-key-generator';

// 导出类型定义
export type {
  AutoConfigOptions,
  AgentConfig,
  ANPRequest,
  ANPResponse,
  AgentInterface
} from './auto-config';

export type {
  HTTPAutoConfigOptions,
  RouteConfig,
  HTTPConfig
} from './http-auto-config';

export type {
  DIDAutoConfigOptions,
  ServiceEndpoint,
  DIDConfig
} from './did-auto-config';

export type {
  KeyPairResult,
  DIDDocument,
  VerificationMethod,
  Service
} from './anp-key-generator';

// 默认导出主SDK类
export { ANPSDK as default } from './auto-config';
