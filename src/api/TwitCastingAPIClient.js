/**
 * TwitCasting API クライアント
 * TwitCastingプラットフォーム固有のAPI機能を提供します
 */
import BaseAPIClient from './BaseAPIClient';
import { Stream, Schedule, Auth } from '../core/models';

class TwitCastingAPIClient extends BaseAPIClient {
  constructor() {
    super('twitcasting');
    this.baseUrl = 'https://apiv2.twitcasting.tv';
    this.authUrl = 'https://apiv2.twitcasting.tv/oauth2';
    this.clientId = null;
    this.clientSecret = null;
    this.auth = new Auth({ platformType: 'twitcasting' });
    this.redirectUri = chrome.identity.getRedirectURL('twitcasting');
    this.scopes = ['read']; // 基本的な読み取り権限のみ
  }

  /**
   * クライアントを初期化します
   * @param {Object} options - 初期化オプション
   * @param {string} options.clientId - クライアントID
   * @param {string} options.clientSecret - クライアントシークレット
   * @param {Auth} options.auth - 認証情報
   * @return {Promise<void>}
   */
  async initialize(options = {}) {
    if (options.clientId) {
      this.clientId = options.clientId;
    }
    
    if (options.clientSecret) {
      this.clientSecret = options.clientSecret;
    }
    
    if (options.auth) {
      this.auth = new Auth(options.auth);
    }
    
    // chromeストレージから認証情報を読み込む
    try {
      const result = await chrome.storage.local.get('twitcasting_auth');
      if (result.twitcasting_auth) {
        this.auth = new Auth({
          ...this.auth,
          ...result.twitcasting_auth
        });
      }
    } catch (error) {
      console.error('TwitCastingの認証情報の読み込みに失敗しました', error);
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
    } else if (this.clientId && this.clientSecret) {
      // Basic認証（アクセストークンがない場合）
      const credentials = btoa(`${this.clientId}:${this.clientSecret}`);
      options.headers['Authorization'] = `Basic ${credentials}`;
    }
    
    // TwitCastingのAPIバージョンヘッダー
    options.headers['X-Api-Version'] = '2.0';
    
    return options;
  }

  /**
   * レートリミット情報を更新します
   * @param {Response} response - フェッチレスポンス
   * @protected
   * @override
   */
  updateRateLimitInfo(response) {
    // TwitCastingのレートリミットヘッダーを解析
    const rateLimit = response.headers.get('X-RateLimit-Limit');
    const rateRemaining = response.headers.get('X-RateLimit-Remaining');
    const rateReset = response.headers.get('X-RateLimit-Reset');
    
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
   * TwitCastingで認証を行います
   * @param {Object} options - 認証オプション
   * @return {Promise<Auth>} - 認証情報
   * @override
   */
  async authenticate(options = {}) {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('TwitCasting Client IDとClient Secretが設定されていません');
    }
    
    try {
      // 認証URLの構築
      const authUrl = new URL(`${this.authUrl}/authorize`);
      authUrl.searchParams.append('client_id', this.clientId);
      authUrl.searchParams.append('redirect_uri', this.redirectUri);
      authUrl.searchParams.append('response_type', 'code');
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
      
      // リダイレクトURLから認可コードを抽出
      const url = new URL(responseUrl);
      const code = url.searchParams.get('code');
      
      if (!code) {
        throw new Error('認可コードの取得に失敗しました');
      }
      
      // アクセストークンを取得
      const tokenResponse = await fetch(`${this.authUrl}/access_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${btoa(`${this.clientId}:${this.clientSecret}`)}`
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: this.redirectUri
        })
      });
      
      if (!tokenResponse.ok) {
        throw new Error(`アクセストークンの取得に失敗しました: ${tokenResponse.status}`);
      }
      
      const tokenData = await tokenResponse.json();
      
      // ユーザー情報の取得
      const userInfo = await this.getUserInfo(tokenData.access_token);
      
      // 認証情報の更新
      this.auth = new Auth({
        platformType: 'twitcasting',
        clientId: this.clientId,
        clientSecret: this.clientSecret,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: Date.now() + (tokenData.expires_in * 1000),
        isAuthorized: true,
        userId: userInfo.user.id,
        userName: userInfo.user.name
      });
      
      // chromeストレージに保存
      await chrome.storage.local.set({
        twitcasting_auth: {
          clientId: this.auth.clientId,
          clientSecret: this.auth.clientSecret,
          accessToken: this.auth.accessToken,
          refreshToken: this.auth.refreshToken,
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
    const response = await fetch(`${this.baseUrl}/verify_credentials`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Api-Version': '2.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`ユーザー情報の取得に失敗しました: ${response.status}`);
    }
    
    return await response.json();
  }

  /**
   * ライブ配信情報を取得します
   * @param {Object} options - 取得オプション
   * @return {Promise<Array<Stream>>} - ストリーム情報の配列
   * @override
   */
  async getStreams(options = {}) {
    try {
      let streams = [];
      
      // 認証情報が必要
      if (!this.clientId || !this.clientSecret) {
        throw new Error('TwitCasting Client IDとClient Secretが設定されていません');
      }
      
      // オプションに基づいて取得方法を決定
      if (options.userId) {
        // 特定のユーザーの配信を取得
        const userIds = Array.isArray(options.userId) ? options.userId : [options.userId];
        
        for (const userId of userIds) {
          const liveInfo = await this.getUserLiveInfo(userId);
          if (liveInfo.is_live) {
            streams.push(this.convertToStreamModel(liveInfo));
          }
        }
      } else {
        // 現在の配信一覧を取得（カテゴリ指定可能）
        const endpoint = new URL(`${this.baseUrl}/search/lives`);
        
        if (options.type) {
          endpoint.searchParams.append('type', options.type);
        }
        
        if (options.limit) {
          endpoint.searchParams.append('limit', options.limit);
        } else {
          endpoint.searchParams.append('limit', 50); // デフォルト
        }
        
        if (options.lang) {
          endpoint.searchParams.append('lang', options.lang);
        }
        
        const data = await this.request(endpoint.toString());
        
        // レスポンスデータをStreamモデルに変換
        streams = data.movies.map(this.convertToStreamModel.bind(this));
      }
      
      return streams;
    } catch (error) {
      throw this.handleApiError(error, 'getStreams');
    }
  }

  /**
   * 特定のユーザーのライブ情報を取得します
   * @param {string} userId - ユーザーID
   * @return {Promise<Object>} - ライブ情報
   * @private
   */
  async getUserLiveInfo(userId) {
    const endpoint = `${this.baseUrl}/users/${userId}`;
    return await this.request(endpoint);
  }

  /**
   * TwitCastingのレスポンスデータをStreamモデルに変換します
   * @param {Object} liveData - ライブデータ
   * @return {Stream} - ストリームモデル
   * @private
   */
  convertToStreamModel(liveData) {
    let thumbnail = '';
    let url = '';
    
    if (liveData.movie) {
      // 検索APIのレスポンス形式
      thumbnail = liveData.movie.large_thumbnail || liveData.movie.small_thumbnail || '';
      url = `https://twitcasting.tv/${liveData.broadcaster.screen_id}/movie/${liveData.movie.id}`;
      
      return new Stream({
        id: liveData.movie.id,
        title: liveData.movie.title || `${liveData.broadcaster.name}の配信`,
        streamerName: liveData.broadcaster.name,
        thumbnailUrl: thumbnail,
        platformType: 'twitcasting',
        startedAt: new Date(liveData.movie.created * 1000).getTime(),
        viewerCount: liveData.movie.current_view_count,
        gameOrCategory: liveData.movie.category || '',
        url: url,
        isFavorite: false,
        notified: false
      });
    } else if (liveData.user && liveData.is_live) {
      // ユーザー情報APIのレスポンス形式
      thumbnail = liveData.user.image || '';
      url = `https://twitcasting.tv/${liveData.user.screen_id}`;
      
      return new Stream({
        id: liveData.movie?.id || `${liveData.user.id}_live`,
        title: liveData.movie?.title || `${liveData.user.name}の配信`,
        streamerName: liveData.user.name,
        thumbnailUrl: thumbnail,
        platformType: 'twitcasting',
        startedAt: liveData.movie?.created ? new Date(liveData.movie.created * 1000).getTime() : Date.now(),
        viewerCount: liveData.movie?.current_view_count || 0,
        gameOrCategory: liveData.movie?.category || '',
        url: url,
        isFavorite: false,
        notified: false
      });
    }
    
    // その他の形式の場合
    return new Stream({
      id: liveData.id || '',
      title: liveData.title || '',
      streamerName: liveData.name || '',
      thumbnailUrl: liveData.thumbnail_url || '',
      platformType: 'twitcasting',
      startedAt: liveData.started_at ? new Date(liveData.started_at * 1000).getTime() : Date.now(),
      viewerCount: liveData.viewer_count || 0,
      gameOrCategory: liveData.category || '',
      url: liveData.url || '',
      isFavorite: false,
      notified: false
    });
  }

  /**
   * スケジュール情報を取得します
   * @param {Object} options - 取得オプション
   * @return {Promise<Array<Schedule>>} - スケジュール情報の配列
   * @override
   */
  async getSchedules(options = {}) {
    // TwitCastingにはスケジュール機能がないため、空の配列を返す
    return Promise.resolve([]);
  }
}

export default TwitCastingAPIClient;