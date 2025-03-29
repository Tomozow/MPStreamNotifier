/**
 * API関連のモジュールをエクスポートするインデックスファイル
 */
import BaseAPIClient from './BaseAPIClient';
import TwitchAPIClient from './TwitchAPIClient';
import YouTubeAPIClient from './YouTubeAPIClient';
import TwitCastingAPIClient from './TwitCastingAPIClient';

export {
  BaseAPIClient,
  TwitchAPIClient,
  YouTubeAPIClient,
  TwitCastingAPIClient
};

/**
 * プラットフォームに応じたAPIクライアントのインスタンスを生成します
 * @param {string} platformType - プラットフォーム種別 ('twitch', 'youtube', 'twitcasting')
 * @param {Object} options - 初期化オプション
 * @return {BaseAPIClient} - APIクライアントのインスタンス
 */
export function createAPIClient(platformType, options = {}) {
  switch (platformType.toLowerCase()) {
    case 'twitch':
      return new TwitchAPIClient(options);
    case 'youtube':
      return new YouTubeAPIClient(options);
    case 'twitcasting':
      return new TwitCastingAPIClient(options);
    default:
      throw new Error(`未対応のプラットフォーム: ${platformType}`);
  }
}

/**
 * 全プラットフォームのAPIクライアントを生成します
 * @param {Object} options - 各プラットフォームの初期化オプション
 * @return {Object} - プラットフォーム名をキーとするAPIクライアントのオブジェクト
 */
export function createAllAPIClients(options = {}) {
  const clients = {};
  
  if (options.twitch !== false) {
    clients.twitch = new TwitchAPIClient();
    if (options.twitch) {
      clients.twitch.initialize(options.twitch);
    }
  }
  
  if (options.youtube !== false) {
    clients.youtube = new YouTubeAPIClient();
    if (options.youtube) {
      clients.youtube.initialize(options.youtube);
    }
  }
  
  if (options.twitcasting !== false) {
    clients.twitcasting = new TwitCastingAPIClient();
    if (options.twitcasting) {
      clients.twitcasting.initialize(options.twitcasting);
    }
  }
  
  return clients;
}
