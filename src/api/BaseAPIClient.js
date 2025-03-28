/**
 * ベースAPIクライアントクラス
 * 各プラットフォーム固有のAPIクライアントの基底クラスとなる共通機能を提供します
 */
import EventEmitter from '../utils/EventEmitter';

class BaseAPIClient {
  constructor(platformType) {
    this.platformType = platformType;
    this