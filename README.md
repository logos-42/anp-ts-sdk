# ANP TypeScript SDK

智能体网络协议 (Agent Network Protocol) TypeScript SDK - 提供完整的ANP自动配置工具包。

## 功能特性

- **密钥生成**: 支持Ed25519和Secp256k1密钥对生成
- **DID自动配置**: 自动创建和配置去中心化身份
- **HTTP自动配置**: 自动配置HTTP服务和路由
- **智能体自动配置**: 完整的ANP智能体配置管理

## 安装

```bash
npm install anp-ts-sdk
```

## 快速开始

```typescript
import { ANPSDK, ANPKeyGenerator } from 'anp-ts-sdk';

// 生成密钥对
const keyGenerator = new ANPKeyGenerator();
const keyPair = await keyGenerator.generateKeyPair('ed25519');

// 初始化SDK
const sdk = new ANPSDK({
  keyPair: keyPair,
  network: 'testnet'
});

// 自动配置智能体
await sdk.autoConfig();
```

## API文档

### ANPKeyGenerator
- `generateKeyPair(type: 'ed25519' | 'secp256k1')`: 生成密钥对
- `generateDID(keyPair: KeyPairResult)`: 生成DID文档

### ANPSDK
- `autoConfig()`: 自动配置智能体
- `connect(peerId: string)`: 连接到其他智能体
- `sendMessage(message: ANPRequest)`: 发送消息

### HTTPAutoConfig
- `setupServer(port: number)`: 设置HTTP服务器
- `addRoute(path: string, handler: Function)`: 添加路由

### DIDAutoConfig
- `createDID()`: 创建DID
- `updateDID(did: string, updates: any)`: 更新DID

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request！

## 联系方式

- 作者: liuyuanjie
- 邮箱: 2844169590@qq.com
