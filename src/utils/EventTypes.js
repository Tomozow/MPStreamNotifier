/**
 * アプリケーション全体で使用するイベント名の定数定義
 * イベント名を一元管理することでタイプミスを防ぎ、可読性を向上させます
 */

// データ関連イベント
export const DATA_EVENTS = {
  // ストリームデータ関連
  STREAMS_UPDATED: 'streams:updated',
  STREAM_ADDED: 'stream:added',
  STREAM_REMOVED: 'stream:removed',
  STREAM_STATUS_CHANGED: 'stream:statusChanged',
  
  // スケジュールデータ関連
  SCHEDULE_UPDATED: 'schedule:updated',
  SCHEDULE_ITEM_ADDED: 'schedule:itemAdded',
  SCHEDULE_ITEM_REMOVED: 'schedule:itemRemoved',
  SCHEDULE_ITEM_CHANGED: 'schedule:itemChanged',
  
  // お気に入り関連
  FAVORITE_ADDED: 'favorite:added',
  FAVORITE_REMOVED: 'favorite:removed',
  FAVORITES_UPDATED: 'favorites:updated',
};

// 設定関連イベント
export const SETTINGS_EVENTS = {
  SETTINGS_CHANGED: 'settings:changed',
  UPDATE_INTERVAL_CHANGED: 'settings:updateIntervalChanged',
  NOTIFICATION_SETTINGS_CHANGED: 'settings:notificationChanged',
  UI_SETTINGS_CHANGED: 'settings:uiChanged',
  FILTER_SETTINGS_CHANGED: 'settings:filterChanged',
};

// 認証関連イベント
export const AUTH_EVENTS = {
  AUTH_STATUS_CHANGED: 'auth:statusChanged',
  AUTH_TOKEN_EXPIRED: 'auth:tokenExpired',
  AUTH_ERROR: 'auth:error',
  
  // プラットフォーム固有の認証イベント
  TWITCH_AUTH_CHANGED: 'auth:twitchChanged',
  YOUTUBE_AUTH_CHANGED: 'auth:youtubeChanged',
  TWITCASTING_AUTH_CHANGED: 'auth:twitcastingChanged',
};

// UI関連イベント
export const UI_EVENTS = {
  VIEW_CHANGED: 'ui:viewChanged',
  TAB_CHANGED: 'ui:tabChanged',
  FILTER_APPLIED: 'ui:filterApplied',
  FILTER_REMOVED: 'ui:filterRemoved',
  SORT_CHANGED: 'ui:sortChanged',
  REFRESH_REQUESTED: 'ui:refreshRequested',
};

// エラー関連イベント
export const ERROR_EVENTS = {
  ERROR_OCCURRED: 'error:occurred',
  API_ERROR: 'error:apiError',
  NETWORK_ERROR: 'error:networkError',
  STORAGE_ERROR: 'error:storageError',
  AUTH_ERROR: 'error:authError',
};

// 通知関連イベント
export const NOTIFICATION_EVENTS = {
  NOTIFICATION_SHOWN: 'notification:shown',
  NOTIFICATION_CLICKED: 'notification:clicked',
  NOTIFICATION_CLOSED: 'notification:closed',
};

// バックグラウンド処理関連イベント
export const BACKGROUND_EVENTS = {
  UPDATE_STARTED: 'background:updateStarted',
  UPDATE_COMPLETED: 'background:updateCompleted',
  UPDATE_FAILED: 'background:updateFailed',
};

// すべてのイベントタイプをまとめたオブジェクト
export const ALL_EVENTS = {
  ...DATA_EVENTS,
  ...SETTINGS_EVENTS,
  ...AUTH_EVENTS,
  ...UI_EVENTS,
  ...ERROR_EVENTS,
  ...NOTIFICATION_EVENTS,
  ...BACKGROUND_EVENTS,
};

export default ALL_EVENTS;