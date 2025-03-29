/**
 * YouTube API クライアント
 * YouTubeプラットフォーム固有のAPI機能を提供します
 */
import BaseAPIClient from './BaseAPIClient';
import { Stream, Schedule, Auth } from '../core/models';

class YouTubeAPIClient extends BaseAPIClient {
  constructor() {
    super('youtube');
    this.baseUrl = 'https://www.googleapis.com/youtube/v3';
    this.authUrl = 'https://accounts.google.com/o/oauth2';
    this.apiKey = null;
    this.clientId = null;
    this.clientSecret = null;
    this.auth = new Auth({ platformType: 'youtube' });
    this.redirectUri = chrome.identity.getRedirectURL('youtube');
    this.scopes = [
      'https://www.googleapis.com/auth/youtube.readonly'
    ];
  }

  /**
   * クライアントを初期化します
   * @param {Object} options - 初期化オプション
   * @param {string} options.apiKey - YouTube API Key
   * @param {string} options.clientId - OAuth Client ID
   * @param {Auth} options.auth - 認証情報
   * @return {Promise<void>}
   */
  async initialize(options = {}) {
    if (options.apiKey) {
      this.apiKey = options.apiKey;
    }
    
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
      const result = await chrome.storage.local.get('youtube_auth');
      if (result.youtube_auth) {
        this.auth = new Auth({
          ...this.auth,
          ...result.youtube_auth
        });
      }
    } catch (error) {
      console.error('YouTubeの認証情報の読み込みに失敗しました', error);
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
    
    // 認証ヘッダーを追加（OAuthを使用する場合）
    if (this.auth.accessToken) {
      options.headers['Authorization'] = `Bearer ${this.auth.accessToken}`;
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
    // YouTubeAPIのクォータ情報はヘッダーには含まれていないため、
    // 実装は省略（APIのエラーレスポンスで確認が必要）
  }

  /**
   * YouTubeで認証を行います
   * @param {Object} options - 認証オプション
   * @return {Promise<Auth>} - 認証情報
   * @override
   */
  async authenticate(options = {}) {
    if (!this.clientId) {
      throw new Error('YouTube Client IDが設定されていません');
    }
    
    try {
      // 認証URLの構築
      const authUrl = new URL(`${this.authUrl}/auth`);
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
      
      // チャンネル情報の取得
      const channelInfo = await this.getChannelInfo(accessToken);
      
      // 認証情報の更新
      this.auth = new Auth({
        platformType: 'youtube',
        clientId: this.clientId,
        accessToken,
        expiresAt: Date.now() + (expiresIn * 1000),
        isAuthorized: true,
        userId: channelInfo.id,
        userName: channelInfo.snippet.title
      });
      
      // chromeストレージに保存
      await chrome.storage.local.set({
        youtube_auth: {
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
   * チャンネル情報を取得します
   * @param {string} accessToken - アクセストークン
   * @return {Promise<Object>} - チャンネル情報
   * @private
   */
  async getChannelInfo(accessToken) {
    const response = await fetch(`${this.baseUrl}/channels?part=snippet&mine=true`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`チャンネル情報の取得に失敗しました: ${response.status}`);
    }
    
    const data = await response.json();
    return data.items[0] || {};
  }

  /**
   * ライブストリーム情報を取得します
   * @param {Object} options - 取得オプション
   * @return {Promise<Array<Stream>>} - ストリーム情報の配列
   * @override
   */
  async getStreams(options = {}) {
    try {
      // APIキーが必要
      if (!this.apiKey && !this.auth.accessToken) {
        throw new Error('YouTube API Keyまたはアクセストークンがありません');
      }
      
      // オプションの準備
      const endpoint = new URL(`${this.baseUrl}/search`);
      
      // APIキーまたはアクセストークンを使用
      if (!this.auth.accessToken) {
        endpoint.searchParams.append('key', this.apiKey);
      }
      
      // ライブストリームを検索
      endpoint.searchParams.append('part', 'snippet');
      endpoint.searchParams.append('eventType', 'live');
      endpoint.searchParams.append('type', 'video');
      endpoint.searchParams.append('maxResults', options.maxResults || 25);
      
      // 特定のチャンネルの検索
      if (options.channelId) {
        endpoint.searchParams.append('channelId', options.channelId);
      }
      
      // 検索クエリ
      if (options.query) {
        endpoint.searchParams.append('q', options.query);
      }
      
      // ページネーション
      if (options.pageToken) {
        endpoint.searchParams.append('pageToken', options.pageToken);
      }
      
      // APIリクエスト
      const data = await this.request(endpoint.toString());
      
      // 動画詳細情報を取得（視聴者数を含む）
      const videoIds = data.items.map(item => item.id.videoId).join(',');
      const detailsEndpoint = new URL(`${this.baseUrl}/videos`);
      if (!this.auth.accessToken) {
        detailsEndpoint.searchParams.append('key', this.apiKey);
      }
      detailsEndpoint.searchParams.append('part', 'snippet,liveStreamingDetails');
      detailsEndpoint.searchParams.append('id', videoIds);
      
      const detailsData = await this.request(detailsEndpoint.toString());
      
      // レスポンスデータをStreamモデルに変換
      return detailsData.items.map(video => {
        const stream = new Stream({
          id: video.id,
          title: video.snippet.title,
          streamerName: video.snippet.channelTitle,
          thumbnailUrl: video.snippet.thumbnails.medium.url,
          platformType: 'youtube',
          startedAt: video.liveStreamingDetails?.actualStartTime 
            ? new Date(video.liveStreamingDetails.actualStartTime).getTime() 
            : Date.now(),
          viewerCount: parseInt(video.liveStreamingDetails?.concurrentViewers || '0', 10),
          gameOrCategory: video.snippet.categoryId,
          url: `https://www.youtube.com/watch?v=${video.id}`,
          isFavorite: false, // お気に入り状態は別途設定
          notified: false // 通知済みかどうかも別途設定
        });
        return stream;
      });
    } catch (error) {
      throw this.handleApiError(error, 'getStreams');
    }
  }

  /**
   * 今後の配信スケジュール情報を取得します
   * @param {Object} options - 取得オプション
   * @return {Promise<Array<Schedule>>} - スケジュール情報の配列
   * @override
   */
  async getSchedules(options = {}) {
    try {
      // APIキーが必要
      if (!this.apiKey && !this.auth.accessToken) {
        throw new Error('YouTube API Keyまたはアクセストークンがありません');
      }
      
      // オプションの準備
      const endpoint = new URL(`${this.baseUrl}/search`);
      
      // APIキーまたはアクセストークンを使用
      if (!this.auth.accessToken) {
        endpoint.searchParams.append('key', this.apiKey);
      }
      
      // 今後のライブストリームを検索
      endpoint.searchParams.append('part', 'snippet');
      endpoint.searchParams.append('eventType', 'upcoming');
      endpoint.searchParams.append('type', 'video');
      endpoint.searchParams.append('maxResults', options.maxResults || 25);
      
      // 特定のチャンネルの検索
      if (options.channelId) {
        endpoint.searchParams.append('channelId', options.channelId);
      }
      
      // ページネーション
      if (options.pageToken) {
        endpoint.searchParams.append('pageToken', options.pageToken);
      }
      
      // APIリクエスト
      const data = await this.request(endpoint.toString());
      
      // 動画詳細情報を取得（予定開始時間を含む）
      const videoIds = data.items.map(item => item.id.videoId).join(',');
      if (!videoIds) {
        return []; // 予定されたライブがない場合
      }
      
      const detailsEndpoint = new URL(`${this.baseUrl}/videos`);
      if (!this.auth.accessToken) {
        detailsEndpoint.searchParams.append('key', this.apiKey);
      }
      detailsEndpoint.searchParams.append('part', 'snippet,liveStreamingDetails');
      detailsEndpoint.searchParams.append('id', videoIds);
      
      const detailsData = await this.request(detailsEndpoint.toString());
      
      // レスポンスデータをScheduleモデルに変換
      return detailsData.items.map(video => {
        return new Schedule({
          id: video.id,
          title: video.snippet.title,
          streamerName: video.snippet.channelTitle,
          platformType: 'youtube',
          scheduledStartTime: video.liveStreamingDetails?.scheduledStartTime 
            ? new Date(video.liveStreamingDetails.scheduledStartTime).getTime() 
            : null,
          thumbnailUrl: video.snippet.thumbnails.medium.url,
          gameOrCategory: video.snippet.categoryId,
          url: `https://www.youtube.com/watch?v=${video.id}`,
          notified: false // リマインダー通知済みかどうかは別途設定
        });
      });
    } catch (error) {
      throw this.handleApiError(error, 'getSchedules');
    }
  }
}

export default YouTubeAPIClient;
