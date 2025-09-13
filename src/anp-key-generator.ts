/**
 * ANP协议密钥对生成器 - TypeScript版本
 * 支持Ed25519和secp256k1算法
 */

import * as crypto from 'crypto';
import { createHash } from 'crypto';
import { Buffer } from 'buffer';
import * as ed25519 from '@noble/ed25519';
import * as secp256k1 from '@noble/secp256k1';
import bs58 from 'bs58';
import base64url from 'base64url';

// 支持的密钥类型
export enum KeyType {
  ED25519 = 'Ed25519VerificationKey2020',
  SECP256K1 = 'EcdsaSecp256k1VerificationKey2019',
  X25519 = 'X25519KeyAgreementKey2019'
}

// DID文档接口
export interface DIDDocument {
  '@context': string[];
  id: string;
  verificationMethod?: VerificationMethod[];
  authentication: (string | VerificationMethod)[];
  keyAgreement?: (string | VerificationMethod)[];
  humanAuthorization?: (string | VerificationMethod)[];
  service?: Service[];
}

// 验证方法接口
export interface VerificationMethod {
  id: string;
  type: string;
  controller: string;
  publicKeyJwk?: PublicKeyJWK;
  publicKeyMultibase?: string;
}

// JWK公钥接口
export interface PublicKeyJWK {
  crv: string;
  x?: string;
  y?: string;
  kty: string;
  kid: string;
}

// 服务接口
export interface Service {
  id: string;
  type: string;
  serviceEndpoint: string;
}

// 密钥对结果接口
export interface KeyPairResult {
  did_document: string;
  private_key: string;
  did: string;
}

// 签名数据接口
export interface SignatureData {
  nonce: string;
  timestamp: string;
  service: string;
  did: string;
}

/**
 * ANP密钥对生成器类
 */
export class ANPKeyGenerator {
  private readonly domain: string;
  private readonly path?: string;

  constructor(domain: string, path?: string) {
    this.domain = domain;
    this.path = path;
  }

  /**
   * 生成DID标识符
   */
  private generateDID(): string {
    if (this.path) {
      return `did:wba:${this.domain}:${this.path}`;
    }
    return `did:wba:${this.domain}`;
  }

  /**
   * 生成安全的随机字符串
   */
  private generateNonce(length: number = 16): string {
    return crypto.randomBytes(length).toString('base64url');
  }

  /**
   * 生成Ed25519密钥对
   */
  public async generateEd25519KeyPair(): Promise<{ privateKey: Uint8Array; publicKey: Uint8Array }> {
    const privateKey = ed25519.utils.randomPrivateKey();
    const publicKey = await ed25519.getPublicKey(privateKey);
    
    return {
      privateKey,
      publicKey
    };
  }

  /**
   * 生成secp256k1密钥对
   */
  public async generateSecp256k1KeyPair(): Promise<{ privateKey: Uint8Array; publicKey: Uint8Array }> {
    const privateKey = secp256k1.utils.randomPrivateKey();
    const publicKey = await secp256k1.getPublicKey(privateKey);
    
    return {
      privateKey,
      publicKey
    };
  }

  /**
   * 将公钥转换为Multibase格式
   */
  private encodeMultibase(publicKey: Uint8Array): string {
    const base58 = bs58.encode(publicKey);
    return `z${base58}`;
  }


  /**
   * 生成JWK格式的公钥
   */
  private generateJWK(publicKey: Uint8Array, keyType: KeyType): PublicKeyJWK {
    const kid = this.generateNonce(16);
    
    if (keyType === KeyType.SECP256K1) {
      // 对于secp256k1，需要提取x,y坐标
      // secp256k1公钥格式：04 + x(32字节) + y(32字节)
      const x = publicKey.slice(1, 33);
      const y = publicKey.slice(33, 65);
      
      return {
        crv: 'secp256k1',
        x: base64url.encode(Buffer.from(x)),
        y: base64url.encode(Buffer.from(y)),
        kty: 'EC',
        kid: kid
      };
    }
    
    return {
      crv: 'Ed25519',
      kty: 'OKP',
      kid: kid
    };
  }

  /**
   * 生成完整的密钥对和DID文档
   */
  public async generateKeyPair(keyType: KeyType = KeyType.ED25519): Promise<KeyPairResult> {
    const did = this.generateDID();
    const keyId = this.generateNonce(16); // 使用更长的密钥ID
    
    // 生成密钥对
    let keyPair: { privateKey: Uint8Array; publicKey: Uint8Array };
    let verificationMethods: VerificationMethod[] = [];
    let authenticationMethods: (string | VerificationMethod)[] = [];
    let keyAgreementMethods: (string | VerificationMethod)[] = [];
    let humanAuthorizationMethods: (string | VerificationMethod)[] = [];
    
    if (keyType === KeyType.ED25519) {
      keyPair = await this.generateEd25519KeyPair();
      
      // 生成身份验证密钥
      const authKeyId = `${did}#${keyId}`;
      const authMethod: VerificationMethod = {
        id: authKeyId,
        type: KeyType.ED25519,
        controller: did,
        publicKeyMultibase: this.encodeMultibase(keyPair.publicKey)
      };
      
      verificationMethods.push(authMethod);
      authenticationMethods.push(authKeyId);
      
      // 生成密钥协商密钥
      const keyAgreementPair = await this.generateEd25519KeyPair();
      const keyAgreementId = `${did}#key-2`;
      const keyAgreementMethod: VerificationMethod = {
        id: keyAgreementId,
        type: KeyType.X25519,
        controller: did,
        publicKeyMultibase: this.encodeMultibase(keyAgreementPair.publicKey)
      };
      
      verificationMethods.push(keyAgreementMethod);
      keyAgreementMethods.push(keyAgreementMethod);
      
      // 生成人类授权密钥
      const humanAuthPair = await this.generateEd25519KeyPair();
      const humanAuthId = `${did}#key-3`;
      const humanAuthMethod: VerificationMethod = {
        id: humanAuthId,
        type: KeyType.ED25519,
        controller: did,
        publicKeyMultibase: this.encodeMultibase(humanAuthPair.publicKey)
      };
      
      verificationMethods.push(humanAuthMethod);
      humanAuthorizationMethods.push(authKeyId, humanAuthMethod);
      
    } else if (keyType === KeyType.SECP256K1) {
      keyPair = await this.generateSecp256k1KeyPair();
      const jwk = this.generateJWK(keyPair.publicKey, keyType);
      
      const authKeyId = `${did}#${keyId}`;
      const authMethod: VerificationMethod = {
        id: authKeyId,
        type: KeyType.SECP256K1,
        controller: did,
        publicKeyJwk: jwk
      };
      
      verificationMethods.push(authMethod);
      authenticationMethods.push(authKeyId);
      
      // 生成密钥协商密钥
      const keyAgreementPair = await this.generateEd25519KeyPair();
      const keyAgreementId = `${did}#key-2`;
      const keyAgreementMethod: VerificationMethod = {
        id: keyAgreementId,
        type: KeyType.X25519,
        controller: did,
        publicKeyMultibase: this.encodeMultibase(keyAgreementPair.publicKey)
      };
      
      verificationMethods.push(keyAgreementMethod);
      keyAgreementMethods.push(keyAgreementMethod);
      
      // 生成人类授权密钥
      const humanAuthPair = await this.generateEd25519KeyPair();
      const humanAuthId = `${did}#key-3`;
      const humanAuthMethod: VerificationMethod = {
        id: humanAuthId,
        type: KeyType.ED25519,
        controller: did,
        publicKeyMultibase: this.encodeMultibase(humanAuthPair.publicKey)
      };
      
      verificationMethods.push(humanAuthMethod);
      humanAuthorizationMethods.push(authKeyId, humanAuthMethod);
      
    } else {
      throw new Error(`不支持的密钥类型: ${keyType}`);
    }

    // 生成符合官方规范的DID文档
    const didDocument: DIDDocument = {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/suites/jws-2020/v1',
        'https://w3id.org/security/suites/secp256k1-2019/v1',
        'https://w3id.org/security/suites/ed25519-2020/v1',
        'https://w3id.org/security/suites/x25519-2019/v1'
      ],
      id: did,
      verificationMethod: verificationMethods,
      authentication: authenticationMethods,
      keyAgreement: keyAgreementMethods,
      humanAuthorization: humanAuthorizationMethods,
      service: [{
        id: `${did}#agent-description`,
        type: 'AgentDescription',
        serviceEndpoint: `https://${this.domain}/agents/${this.path || 'default'}/ad.json`
      }]
    };

    // 生成PEM格式的私钥
    const privateKeyPem = this.generatePEMPrivateKey(keyPair.privateKey, keyType);

    return {
      did_document: JSON.stringify(didDocument, null, 2),
      private_key: privateKeyPem,
      did: did
    };
  }

  /**
   * 生成PEM格式的私钥
   */
  private generatePEMPrivateKey(privateKey: Uint8Array, keyType: KeyType): string {
    // 根据密钥类型生成正确的PEM头部
    let header: string;
    let footer: string;
    
    if (keyType === KeyType.ED25519) {
      header = '-----BEGIN ED25519 PRIVATE KEY-----';
      footer = '-----END ED25519 PRIVATE KEY-----';
    } else if (keyType === KeyType.SECP256K1) {
      header = '-----BEGIN SECP256K1 PRIVATE KEY-----';
      footer = '-----END SECP256K1 PRIVATE KEY-----';
    } else {
      header = `-----BEGIN ${keyType} PRIVATE KEY-----`;
      footer = `-----END ${keyType} PRIVATE KEY-----`;
    }
    
    const base64Key = Buffer.from(privateKey).toString('base64');
    
    // 每64个字符换行
    const formattedKey = base64Key.match(/.{1,64}/g)?.join('\n') || base64Key;
    
    return `${header}\n${formattedKey}\n${footer}`;
  }

  /**
   * 生成签名数据
   */
  public generateSignatureData(service: string, did: string): SignatureData {
    return {
      nonce: this.generateNonce(),
      timestamp: new Date().toISOString(),
      service: service,
      did: did
    };
  }

  /**
   * 使用JCS规范化JSON
   */
  public jcsCanonicalize(obj: any): string {
    // 简化的JCS实现，实际应该使用专门的JCS库
    return JSON.stringify(obj, Object.keys(obj).sort());
  }

  /**
   * 使用Ed25519私钥签名
   */
  public async signEd25519(privateKey: Uint8Array, data: SignatureData): Promise<string> {
    const canonicalJson = this.jcsCanonicalize(data);
    const message = Buffer.from(canonicalJson, 'utf8');
    const signature = await ed25519.sign(message, privateKey);
    return Buffer.from(signature).toString('base64url');
  }

  /**
   * 使用secp256k1私钥签名
   */
  public async signSecp256k1(privateKey: Uint8Array, data: SignatureData): Promise<string> {
    const canonicalJson = this.jcsCanonicalize(data);
    const messageHash = createHash('sha256').update(canonicalJson).digest();
    const signature = await secp256k1.sign(messageHash, privateKey);
    // 在1.7.1版本中，sign方法直接返回紧凑格式的签名字节数组
    return Buffer.from(signature).toString('base64url');
  }

  /**
   * 验证Ed25519签名
   */
  public async verifyEd25519(publicKey: Uint8Array, signature: string, data: SignatureData): Promise<boolean> {
    try {
      const canonicalJson = this.jcsCanonicalize(data);
      const message = Buffer.from(canonicalJson, 'utf8');
      const signatureBuffer = Buffer.from(signature, 'base64url');
      return await ed25519.verify(signatureBuffer, message, publicKey);
    } catch (error) {
      return false;
    }
  }

  /**
   * 验证secp256k1签名
   */
  public async verifySecp256k1(publicKey: Uint8Array, signature: string, data: SignatureData): Promise<boolean> {
    try {
      const canonicalJson = this.jcsCanonicalize(data);
      const messageHash = createHash('sha256').update(canonicalJson).digest();
      const signatureBuffer = Buffer.from(signature, 'base64url');
      return await secp256k1.verify(signatureBuffer, messageHash, publicKey);
    } catch (error) {
      return false;
    }
  }
}

// 使用示例
export async function example() {
  const generator = new ANPKeyGenerator('example.com', 'user:alice');
  
  // 生成Ed25519密钥对
  const ed25519Result = await generator.generateKeyPair(KeyType.ED25519);
  console.log('Ed25519 DID文档:', ed25519Result.did_document);
  console.log('Ed25519 私钥:', ed25519Result.private_key);
  
  // 生成secp256k1密钥对
  const secp256k1Result = await generator.generateKeyPair(KeyType.SECP256K1);
  console.log('secp256k1 DID文档:', secp256k1Result.did_document);
  console.log('secp256k1 私钥:', secp256k1Result.private_key);
  
  // 生成签名数据
  const signatureData = generator.generateSignatureData('example.com', ed25519Result.did);
  console.log('签名数据:', signatureData);
  
  // 测试Ed25519签名和验证
  const ed25519KeyPair = await generator.generateEd25519KeyPair();
  const ed25519Signature = await generator.signEd25519(ed25519KeyPair.privateKey, signatureData);
  const ed25519Valid = await generator.verifyEd25519(ed25519KeyPair.publicKey, ed25519Signature, signatureData);
  console.log('Ed25519 签名:', ed25519Signature);
  console.log('Ed25519 验证结果:', ed25519Valid);
  
  // 测试secp256k1签名和验证
  const secp256k1KeyPair = await generator.generateSecp256k1KeyPair();
  const secp256k1Signature = await generator.signSecp256k1(secp256k1KeyPair.privateKey, signatureData);
  const secp256k1Valid = await generator.verifySecp256k1(secp256k1KeyPair.publicKey, secp256k1Signature, signatureData);
  console.log('secp256k1 签名:', secp256k1Signature);
  console.log('secp256k1 验证结果:', secp256k1Valid);
}

// 如果直接运行此文件
if (require.main === module) {
  example();
}
