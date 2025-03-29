/**
 * API管理クラス
 * 各プラットフォームのAPIクライアントを管理し、データの取得を統括します
 */
import Singleton from '../utils/Singleton';
import EventEmitter from '../utils/EventEmitter';

class APIManager extends Singleton {
  constructor() {
    super();
    this.eventEmitter = new EventEmitter();
    this.apiClients = {};
    this.isInitialized = false;
    this.currentRequests = new Map();
  }

  /**
   * APIマネージャーを初期化します
   * @param {Object} apiClients - APIクライアントのオブジェクト
   * @return {Promise<void>}
   */
  async initialize(apiClients = {}) {
    try {
      this.apiClients = apiClients;
      await Promise.all(
        Object.values(this.apiClients).map(client => 
          typeof client.initialize === 'function' ? client.initialize() : Promise.resolve()
        )
      );
      this.isInitialized = true;
      this.eventEmitter.emit('api:initialized');
    } catch (error) {
      this.eventEmitter.emit('error', {
        code: 'API_INIT_ERROR',
        message: 'APIの初期化に失敗しました',
        details: error
      });
      throw error;
    }
  }

  /**
   * APIクライアントを登録します
   * @param {string} platformType - プラットフォーム種別
   * @param {Object} apiClient - APIクライアントのインスタンス
   */
  registerApiClient(platformType, apiClient) {
    this.apiClients[platformType] = apiClient;
    if (this.isInitialized && typeof apiClient.initialize === 'function') {
      apiClient.initialize().catch(error => {
        this.eventEmitter.emit('error', {
          code: 'API_CLIENT_INIT_ERROR',
          message: `${platformType} APIクライアントの初期化に失敗しました`,
          details: error
        });
      });
    }
  }

  /**
   * ストリーム情報を取得します
   * @param {string|Array<string>} platformTypes - 取得対象のプラットフォーム種別
   * @param {Object} options - 取得オプション
   * @return {Promise<Array>} - 取得したストリーム情報の配列
   */
  async getStreams(platformTypes, options = {}) {
    const platforms = Array.isArray(platformTypes) ? platformTypes : [platformTypes];
    
    try {
      this.eventEmitter.emit('api:streamsRequested', platforms);
      
      const results = await Promise.allSettled(
        platforms.map(platform => {
          const apiClient = this.apiClients[platform];
          if (!apiClient) {
            return Promise.reject(new Error(`${platform} のAPIクライアントが見つかりません`));
          }
          
          // リクエストを記録
          const requestId = `${platform}_streams_${Date.now()}`;
          const request = apiClient.getStreams(options);
          this.currentRequests.set(requestId, request);
          
          return request.finally(() => {
            this.currentRequests.delete(requestId);
          });
        })
      );
      
      // エラーと成功の結果を処理
      const streams = [];
      const errors = [];
      
      results.forEach((result, index) => {
        const platform = platforms[index];
        if (result.status === 'fulfilled') {
          streams.push(...result.value);
        } else {
          errors.push({
            platformType: platform,
            error: result.reason
          });
          this.eventEmitter.emit('error', {
            code: 'API_STREAMS_ERROR',
            message: `${platform} のストリーム情報取得に失敗しました`,
            details: result.reason,
            source: platform
          });
        }
      });
      
      if (errors.length > 0 && errors.length === platforms.length) {
        // 全てのプラットフォームが失敗した場合
        throw new Error('すべてのプラットフォームのストリーム取得に失敗しました');
      }
      
      this.eventEmitter.emit('api:streamsReceived', streams);
      return streams;
    } catch (error) {
      this.eventEmitter.emit('error', {
        code: 'API_STREAMS_ERROR',
        message: 'ストリーム情報の取得に失敗しました',
        details: error
      });
      throw error;
    }
  }

  /**
   * スケジュール情報を取得します
   * @param {string|Array<string>} platformTypes - 取得対象のプラットフォーム種別
   * @param {Object} options - 取得オプション
   * @return {Promise<Array>} - 取得したスケジュール情報の配列
   */
  async getSchedules(platformTypes, options = {}) {
    const platforms = Array.isArray(platformTypes) ? platformTypes : [platformTypes];
    
    try {
      this.eventEmitter.emit('api:schedulesRequested', platforms);
      
      const results = await Promise.allSettled(
        platforms.map(platform => {
          const apiClient = this.apiClients[platform];
          if (!apiClient) {
            return Promise.reject(new Error(`${platform} のAPIクライアントが見つかりません`));
          }
          
          // APIクライアントがスケジュール取得機能を持っているか確認
          if (typeof apiClient.getSchedules !== 'function') {
            return Promise.reject(new Error(`${platform} のAPIクライアントはスケジュール取得をサポートしていません`));
          }
          
          // リクエストを記録
          const requestId = `${platform}_schedules_${Date.now()}`;
          const request = apiClient.getSchedules(options);
          this.currentRequests.set(requestId, request);
          
          return request.finally(() => {
            this.currentRequests.delete(requestId);
          });
        })
      );
      
      // エラーと成功の結果を処理
      const schedules = [];
      const errors = [];
      
      results.forEach((result, index) => {
        const platform = platforms[index];
        if (result.status === 'fulfilled') {
          schedules.push(...result.value);
        } else {
          errors.push({
            platformType: platform,
            error: result.reason
          });
          this.eventEmitter.emit('error', {
            code: 'API_SCHEDULES_ERROR',
            message: `${platform} のスケジュール情報取得に失敗しました`,
            details: result.reason,
            source: platform
          });
        }
      });
      
      if (errors.length > 0 && errors.length === platforms.length) {
        // 全てのプラットフォームが失敗した場合
        throw new Error('すべてのプラットフォームのスケジュール取得に失敗しました');
      }
      
      this.eventEmitter.emit('api:schedulesReceived', schedules);
      return schedules;
    } catch (error) {
      this.eventEmitter.emit('error', {
        code: 'API_SCHEDULES_ERROR',
        message: 'スケジュール情報の取得に失敗しました',
        details: error
      });
      throw error;
    }
  }

  /**
   * 認証を行います
   * @param {string} platformType - プラットフォーム種別
   * @param {Object} options - 認証オプション
   * @return {Promise<Object>} - 認証結果
   */
  async authenticate(platformType, options = {}) {
    try {
      const apiClient = this.apiClients[platformType];
      if (!apiClient) {
        throw new Error(`${platformType} のAPIクライアントが見つかりません`);
      }
      
      if (typeof apiClient.authenticate !== 'function') {
        throw new Error(`${platformType} のAPIクライアントは認証をサポートしていません`);
      }
      
      this.eventEmitter.emit('api:authRequested', platformType);
      const result = await apiClient.authenticate(options);
      this.eventEmitter.emit('api:authCompleted', { platformType, result });
      return result;
    } catch (error) {
      this.eventEmitter.emit('error', {
        code: 'API_AUTH_ERROR',
        message: `${platformType} の認証に失敗しました`,
        details: error,
        source: platformType
      });
      throw error;
    }
  }

  /**
   * 現在進行中のリクエストをキャンセルします
   * @param {string} [platformType] - プラットフォーム種別（省略時は全てのリクエストをキャンセル）
   */
  cancelRequests(platformType) {
    for (const [requestId, request] of this.currentRequests.entries()) {
      if (!platformType || requestId.startsWith(`${platformType}_`)) {
        if (typeof request.cancel === 'function') {
          request.cancel();
        }
        this.currentRequests.delete(requestId);
      }
    }
  }

  /**
   * イベントリスナーを登録します
   * @param {string} event - イベント名
   * @param {Function} callback - コールバック関数
   */
  on(event, callback) {
    this.eventEmitter.on(event, callback);
  }

  /**
   * イベントリスナーを解除します
   * @param {string} event - イベント名
   * @param {Function} callback - コールバック関数
   */
  off(event, callback) {
    this.eventEmitter.off(event, callback);
  }
}

export default APIManager;
