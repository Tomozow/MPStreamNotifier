/**
 * ベースAPIクライアントクラス
 * 各プラットフォーム固有のAPIクライアントの基底クラスとなる共通機能を提供します
 */
import EventEmitter from '../utils/EventEmitter';

class BaseAPIClient {
  constructor(platformType) {
    this.platformType = platformType;
    this.eventEmitter = new EventEmitter();
    this.isInitialized = false;
    this.maxRetries = 3;
    this.retryDelay = 1000; // ms
    this.requestTimeout = 10000; // 10秒
    this.activeRequests = new Map();
    this.rateLimitInfo = {
      limit: null,
      remaining: null,
      resetTime: null
    };
  }

  /**
   * APIクライアントを初期化します
   * @return {Promise<void>}
   */
  async initialize() {
    this.isInitialized = true;
    this.eventEmitter.emit('client:initialized', this.platformType);
    return Promise.resolve();
  }

  /**
   * APIにリクエストを送信します
   * @param {string} endpoint - APIエンドポイント
   * @param {Object} options - リクエストオプション
   * @return {Promise<any>} - レスポンスデータ
   */
  async request(endpoint, options = {}) {
    // 各プラットフォーム用にカスタマイズ可能なデフォルトオプション
    const defaultOptions = this.getDefaultRequestOptions();
    
    // オプションのマージ
    const requestOptions = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers
      }
    };

    // タイムアウト処理用
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, this.requestTimeout);

    const requestId = `${this.platformType}_${endpoint}_${Date.now()}`;
    
    // リクエスト実行
    try {
      // アクティブリクエストに登録
      const requestPromise = this.executeRequest(endpoint, requestOptions, controller);
      this.activeRequests.set(requestId, { promise: requestPromise, controller });
      
      const response = await requestPromise;
      
      // レートリミット情報を更新
      this.updateRateLimitInfo(response);
      
      // レスポンスのパース
      return await this.parseResponse(response);
    } catch (error) {
      // エラーハンドリング
      if (error.name === 'AbortError') {
        throw new Error(`リクエストがタイムアウトしました: ${endpoint}`);
      }
      
      // レートリミットエラーの場合
      if (error.status === 429) {
        this.handleRateLimitError(error);
        throw new Error(`レート制限に達しました: ${endpoint}`);
      }
      
      // その他のAPIエラー
      throw this.handleApiError(error, endpoint);
    } finally {
      // タイムアウトをクリア
      clearTimeout(timeoutId);
      // アクティブリクエストから削除
      this.activeRequests.delete(requestId);
    }
  }

  /**
   * リクエストを実行します（リトライロジック付き）
   * @param {string} endpoint - APIエンドポイント
   * @param {Object} options - リクエストオプション
   * @param {AbortController} controller - 中断コントローラー
   * @return {Promise<Response>} - フェッチレスポンス
   * @private
   */
  async executeRequest(endpoint, options, controller) {
    let retries = 0;
    
    while (true) {
      try {
        const response = await fetch(endpoint, {
          ...options,
          signal: controller.signal
        });
        
        // レスポンスが成功でなければエラーとして扱う
        if (!response.ok) {
          const error = new Error(`APIエラー: ${response.status} ${response.statusText}`);
          error.status = response.status;
          error.response = response;
          throw error;
        }
        
        return response;
      } catch (error) {
        // 中断エラーは再試行しない
        if (error.name === 'AbortError') {
          throw error;
        }
        
        // 最大リトライ回数に達したらエラーをスロー
        if (retries >= this.maxRetries) {
          throw error;
        }
        
        // 一時的なエラーの場合（ネットワークエラーなど）のみリトライ
        if (error.status && error.status !== 503 && error.status !== 502) {
          throw error;
        }
        
        // リトライ前に待機
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * (retries + 1)));
        retries++;
      }
    }
  }

  /**
   * デフォルトのリクエストオプションを取得します
   * @return {Object} - デフォルトオプション
   * @protected
   */
  getDefaultRequestOptions() {
    return {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      credentials: 'omit'
    };
  }

  /**
   * APIレスポンスをパースします
   * @param {Response} response - フェッチレスポンス
   * @return {Promise<any>} - パースされたデータ
   * @protected
   */
  async parseResponse(response) {
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    } else {
      return await response.text();
    }
  }

  /**
   * レートリミット情報を更新します
   * @param {Response} response - フェッチレスポンス
   * @protected
   */
  updateRateLimitInfo(response) {
    // 各プラットフォーム固有の実装に任せる
  }

  /**
   * レートリミットエラーを処理します
   * @param {Error} error - エラーオブジェクト
   * @protected
   */
  handleRateLimitError(error) {
    const resetTime = this.rateLimitInfo.resetTime || (Date.now() + 60000);
    this.eventEmitter.emit('client:rateLimit', {
      platformType: this.platformType,
      resetTime
    });
  }

  /**
   * APIエラーを処理します
   * @param {Error} error - エラーオブジェクト
   * @param {string} endpoint - APIエンドポイント
   * @return {Error} - 処理されたエラー
   * @protected
   */
  handleApiError(error, endpoint) {
    const apiError = new Error(`[${this.platformType}] ${error.message || 'APIリクエストエラー'}`);
    apiError.originalError = error;
    apiError.endpoint = endpoint;
    apiError.platformType = this.platformType;
    
    this.eventEmitter.emit('client:error', {
      platformType: this.platformType,
      error: apiError,
      endpoint
    });
    
    return apiError;
  }

  /**
   * すべてのアクティブなリクエストをキャンセルします
   */
  cancelAllRequests() {
    for (const { controller } of this.activeRequests.values()) {
      controller.abort();
    }
    this.activeRequests.clear();
  }

  /**
   * ストリーム情報を取得します（子クラスで実装）
   * @param {Object} options - オプション
   * @return {Promise<Array>} - ストリーム情報の配列
   */
  async getStreams(options = {}) {
    throw new Error('getStreams メソッドが実装されていません');
  }

  /**
   * スケジュール情報を取得します（子クラスで実装）
   * @param {Object} options - オプション
   * @return {Promise<Array>} - スケジュール情報の配列
   */
  async getSchedules(options = {}) {
    throw new Error('getSchedules メソッドが実装されていません');
  }

  /**
   * 認証を行います（子クラスで実装）
   * @param {Object} options - 認証オプション
   * @return {Promise<Object>} - 認証結果
   */
  async authenticate(options = {}) {
    throw new Error('authenticate メソッドが実装されていません');
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

export default BaseAPIClient;
