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
      
      // 設定からクライアントIDを読み込む（認証情報になければ）
      if (!this.clientId) {
        const settings = await chrome.storage.local.get('settings');
        if (settings && settings.settings && settings.settings.twitchClientId) {
          this.clientId = settings.settings.twitchClientId;
        }
      }
      
      // トークンの有効期限チェック
      await this.checkTokenExpiration();
    } catch (error) {
      console.error('Twitchの認証情報の読み込みに失敗しました', error);
      this.eventEmitter.emit('client:error', {
        platformType: this.platformType,
        error,
        endpoint: 'initialize'
      });
    }
    
    return super.initialize();
  }
