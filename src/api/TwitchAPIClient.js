/**
 * Twitch API クライアント
 * Twitchプラットフォーム固有のAPI機能を提供します
 */
import BaseAPIClient from './BaseAPIClient';
import { Stream, Schedule, Auth } from '../core/models';

class TwitchAPIClient extends BaseAPIClient {
  constructor() {
    super('twitch');
    this.baseUrl = 'https://api.twitch.tv/helix';
    this.authUrl = 'https://id.twitch.tv/oauth2';
    this.clientId = null;
    this.auth = new Auth({ platformType: 'twitch' });
    this.redirectUri = chrome.identity.getRedirectURL('twitch');
    this.scopes = [
      'user:read:email',
      'user:read:follows',
      'channel:read:subscriptions'
    ];
  }

  /**
   * クライアントを初期化します
   * @param {Object} options - 初期化オプション
   * @param {string} options.clientId - Twitch Client ID
   * @param {Auth} options.auth - 認証情報
   * @return {Promise<void>}
   */
  async initialize(options = {}) {
    if (options.clientId) {
      this.clientId = options.clientId;
    }
    
    if (options.auth) {
      this.auth = new Auth(options.auth);
    }
    
    // chromeストレージから認証情報を読み込む
    try {
      const result = await chrome.storage.local.get('twitch_auth');
      if (result.twitch_auth) {
        this.auth = new Auth({
          ...this.auth,
          ...result.twitch_auth
        });
      }
    } catch (error) {
      console.error('Twitchの認証情報の読み込みに失敗しました', error);
    }
    
    return super.initialize();
  }

  /**
   * デフォルトのリクエストオプションを取得します
   * @return {Object} - デフォルトオプション
   * @protected
   * @override
   */
  getDefaultRequestOptions() {
    const options = super.getDefaultRequestOptions();
    
    // 認証ヘッダーを追加
    if (this.auth.accessToken) {
      options.headers['Authorization'] = `Bearer ${this.auth.accessToken}`;
    }
    
    // Client-IDヘッダーを追加
    if (this.clientId) {
      options.headers['Client-ID'] = this.clientId;
    }
    
    return options;
  }

  /**
   * レートリミット情報を更新します
   * @param {Response} response - フェッチレスポンス
   * @protected
   * @override
   */
  updateRateLimitInfo(response) {
    // Twitchのレートリミットヘッダーを解析
    const rateLimit = response.headers.get('Ratelimit-Limit');
    const rateRemaining = response.headers.get('Ratelimit-Remaining');
    const rateReset = response.headers.get('Ratelimit-Reset');
    
    if (rateLimit) {
      this.rateLimitInfo.limit = parseInt(rateLimit, 10);
    }
    
    if (rateRemaining) {
      this.rateLimitInfo.remaining = parseInt(rateRemaining, 10);
    }
    
    if (rateReset) {
      this.rateLimitInfo.resetTime = parseInt(rateReset, 10) * 1000; // 秒からミリ秒に変換
    }
  }

  /**
   * Twitchで認証を行います
   * @param {Object} options - 認証オプション
   * @return {Promise<Auth>} - 認証情報
   * @override
   */
  async authenticate(options = {}) {
    if (!this.clientId) {
      throw new Error('Twitch Client IDが設定されていません');
    }
    
    try {
      // 認証URLの構築
      const authUrl = new URL(`${this.authUrl}/authorize`);
      authUrl.searchParams.append('client_id', this.clientId);
      authUrl.searchParams.append('redirect_uri', this.redirectUri);
      authUrl.searchParams.append('response_type', 'token');
      authUrl.searchParams.append('scope', this.scopes.join(' '));
      
      // Chrome拡張機能のOAuth認証フロー
      const responseUrl = await new Promise((resolve, reject) => {
        chrome.identity.launchWebAuthFlow({
          url: authUrl.toString(),
          interactive: true
        }, (redirectUrl) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(redirectUrl);
          }
        });
      });
      
      // リダイレクトURLからトークン情報を抽出
      const hashParams = new URLSearchParams(new URL(responseUrl).hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const expiresIn = parseInt(hashParams.get('expires_in'), 10);
      
      if (!accessToken) {
        throw new Error('アクセストークンの取得に失敗しました');
      }
      
      // ユーザー情報の取得
      const userInfo = await this.getUserInfo(accessToken);
      
      // 認証情報の更新
      this.auth = new Auth({
        platformType: 'twitch',
        clientId: this.clientId,
        accessToken,
        expiresAt: Date.now() + (expiresIn * 1000),
        isAuthorized: true,
        userId: userInfo.id,
        userName: userInfo.login
      });
      
      // chromeストレージに保存
      await chrome.storage.local.set({
        twitch_auth: {
          clientId: this.auth.clientId,
          accessToken: this.auth.accessToken,
          expiresAt: this.auth.expiresAt,
          isAuthorized: this.auth.isAuthorized,
          userId: this.auth.userId,
          userName: this.auth.userName
        }
      });
      
      return this.auth;
    } catch (error) {
      throw this.handleApiError(error, 'authenticate');
    }
  }

  /**
   * ユーザー情報を取得します
   * @param {string} accessToken - アクセストークン
   * @return {Promise<Object>} - ユーザー情報
   * @private
   */
  async getUserInfo(accessToken) {
    const response = await fetch(`${this.baseUrl}/users`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Client-ID': this.clientId
      }
    });
    
    if (!response.ok) {
      throw new Error(`ユーザー情報の取得に失敗しました: ${response.status}`);
    }
    
    const data = await response.json();
    return data.data[0] || {};
  }

  /**
   * ストリーム情報を取得します
   * @param {Object} options - 取得オプション
   * @return {Promise<Array<Stream>>} - ストリーム情報の配列
   * @override
   */
  async getStreams(options = {}) {
    try {
      // オプションの準備
      const endpoint = new URL(`${this.baseUrl}/streams`);
      
      // ゲーム/カテゴリによるフィルタリング
      if (options.gameId) {
        endpoint.searchParams.append('game_id', options.gameId);
      }
      
      // 特定のユーザーのストリームを取得
      if (options.userId) {
        endpoint.searchParams.append('user_id', Array.isArray(options.userId) ? options.userId.join('&user_id=') : options.userId);
      }
      
      // 言語フィルタリング
      if (options.language) {
        endpoint.searchParams.append('language', options.language);
      }
      
      // ページネーション
      if (options.first) {
        endpoint.searchParams.append('first', options.first);
      } else {
        endpoint.searchParams.append('first', 20); // デフォルト
      }
      
      if (options.after) {
        endpoint.searchParams.append('after', options.after);
      }
      
      // APIリクエスト
      const data = await this.request(endpoint.toString());
      
      // レスポンスデータをStreamモデルに変換
      return data.data.map(stream => new Stream({
        id: stream.id,
        title: stream.title,
        streamerName: stream.user_name,
        thumbnailUrl: stream.thumbnail_url
          .replace('{width}', '320')
          .replace('{height}', '180'),
        platformType: 'twitch',
        startedAt: new Date(stream.started_at).getTime(),
        viewerCount: stream.viewer_count,
        gameOrCategory: stream.game_name,
        url: `https://twitch.tv/${stream.user_login}`,
        isFavorite: false, // お気に入り状態は別途設定
        notified: false // 通知済みかどうかも別途設定
      }));
    } catch (error) {
      throw this.handleApiError(error, 'getStreams');
    }
  }

  /**
   * スケジュール情報を取得します
   * @param {Object} options - 取得オプション
   * @return {Promise<Array<Schedule>>} - スケジュール情報の配列
   * @override
   */
  async getSchedules(options = {}) {
    // スケジュール機能の実装は今後のフェーズで行う
    return Promise.resolve([]);
  }
}

export default TwitchAPIClient;