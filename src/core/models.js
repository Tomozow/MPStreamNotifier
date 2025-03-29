/**
 * アプリケーションで使用する各種データモデルの定義
 */

/**
 * ストリーム情報のモデル
 */
export class Stream {
  constructor(data = {}) {
    this.id = data.id || '';                  // ストリームID
    this.title = data.title || '';            // タイトル
    this.streamerName = data.streamerName || ''; // 配信者名
    this.thumbnailUrl = data.thumbnailUrl || ''; // サムネイルURL
    this.platformType = data.platformType || ''; // プラットフォーム種別 ('twitch', 'youtube', 'twitcasting')
    this.startedAt = data.startedAt || null;  // 配信開始日時
    this.viewerCount = data.viewerCount || 0; // 視聴者数
    this.gameOrCategory = data.gameOrCategory || ''; // ゲーム名またはカテゴリ
    this.url = data.url || '';                // 配信URL
    this.isFavorite = data.isFavorite || false; // お気に入り状態
    this.notified = data.notified || false;   // 通知済みフラグ
  }
}

/**
 * スケジュール情報のモデル
 */
export class Schedule {
  constructor(data = {}) {
    this.id = data.id || '';                  // スケジュールID
    this.title = data.title || '';            // タイトル
    this.streamerName = data.streamerName || ''; // 配信者名
    this.platformType = data.platformType || ''; // プラットフォーム種別
    this.scheduledStartTime = data.scheduledStartTime || null; // 予定開始時間
    this.thumbnailUrl = data.thumbnailUrl || ''; // サムネイルURL
    this.gameOrCategory = data.gameOrCategory || ''; // ゲーム名またはカテゴリ
    this.url = data.url || '';                // URL
    this.notified = data.notified || false;   // リマインダー通知済みフラグ
  }
}

/**
 * 認証情報のモデル
 */
export class Auth {
  constructor(data = {}) {
    this.platformType = data.platformType || ''; // プラットフォーム種別
    this.clientId = data.clientId || '';     // クライアントID
    this.clientSecret = data.clientSecret || ''; // クライアントシークレット（必要な場合のみ）
    this.accessToken = data.accessToken || ''; // アクセストークン
    this.refreshToken = data.refreshToken || ''; // リフレッシュトークン
    this.expiresAt = data.expiresAt || 0;     // トークン有効期限（Unix タイムスタンプ）
    this.isAuthorized = data.isAuthorized || false; // 認証済みフラグ
    this.userId = data.userId || '';          // プラットフォーム上のユーザーID
    this.userName = data.userName || '';      // プラットフォーム上のユーザー名
    this.scope = data.scope || '';            // 認証されたスコープ（スペース区切り）
    this.lastValidated = data.lastValidated || 0; // 最後にトークンを検証した時刻
  }
}

/**
 * 設定のモデル
 */
export class Settings {
  constructor(data = {}) {
    // 更新設定
    this.updateInterval = data.updateInterval || 60; // データ更新間隔（秒）
    
    // 表示設定
    this.defaultView = data.defaultView || 'grid'; // デフォルト表示モード（'grid' or 'list'）
    this.showViewerCount = data.showViewerCount !== false; // 視聴者数表示
    this.showThumbnails = data.showThumbnails !== false; // サムネイル表示
    this.showOffline = data.showOffline || false; // オフライン配信者も表示
    this.maxItemsPerPage = data.maxItemsPerPage || 20; // ページあたり最大表示数
    
    // 通知設定
    this.enableNotifications = data.enableNotifications !== false; // 通知有効フラグ
    this.notifyOnlyFavorites = data.notifyOnlyFavorites || false; // お気に入りのみ通知
    this.notificationSound = data.notificationSound || true; // 通知音
    this.reminders = data.reminders || false; // リマインダー通知有効フラグ
    this.reminderTime = data.reminderTime || 10; // リマインダー時間（分前）
    
    // プラットフォーム設定
    this.enabledPlatforms = data.enabledPlatforms || {
      twitch: true,
      youtube: true,
      twitcasting: true
    };
    
    // お気に入り
    this.favorites = data.favorites || []; // お気に入り配信者ID配列
  }
}

/**
 * フィルター条件のモデル
 */
export class Filter {
  constructor(data = {}) {
    this.name = data.name || '';              // フィルター名（保存時使用）
    this.platforms = data.platforms || {      // プラットフォームフィルター
      twitch: true,
      youtube: true,
      twitcasting: true
    };
    this.showOnlyFavorites = data.showOnlyFavorites || false; // お気に入りのみ表示
    this.searchText = data.searchText || '';  // 検索テキスト
    this.categories = data.categories || [];  // カテゴリ/ゲームフィルター
    this.savedFilters = data.savedFilters || []; // 保存済みフィルター配列
  }
}

/**
 * エラー情報のモデル
 */
export class Error {
  constructor(data = {}) {
    this.code = data.code || 'UNKNOWN';       // エラーコード
    this.message = data.message || '';        // エラーメッセージ
    this.timestamp = data.timestamp || Date.now(); // エラー発生時刻
    this.source = data.source || '';          // エラー発生源
    this.details = data.details || null;      // 詳細情報
    this.isCritical = data.isCritical || false; // 致命的エラーフラグ
  }
}
