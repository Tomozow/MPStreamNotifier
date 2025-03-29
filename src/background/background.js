/**
 * MPStreamNotifier バックグラウンドサービス
 * 定期的にAPIからデータを取得し、ストレージに保存・通知を管理します
 */
import {
  DataManager,
  APIManager,
  SettingsManager,
  NotificationManager,
  ErrorManager
} from '../core';
import { TwitchAPIClient, YouTubeAPIClient, TwitCastingAPIClient } from '../api';
import { BACKGROUND_EVENTS, AUTH_EVENTS } from '../utils/EventTypes';

// シングルトンインスタンスを取得
const dataManager = DataManager.getInstance();
const apiManager = APIManager.getInstance();
const settingsManager = SettingsManager.getInstance();
const notificationManager = NotificationManager.getInstance();
const errorManager = ErrorManager.getInstance();

// バックグラウンドサービスのメイン状態
let isInitialized = false;
let isUpdating = false;
let lastUpdateTime = null;
let updateAttempts = 0;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 30000; // 30秒後にリトライ

// エラーログ関数
const logError = (error, code = 'BACKGROUND_ERROR', source = 'background') => {
  console.error(`[Background] ${code}:`, error);
  errorManager.reportError({
    code,
    message: error.message || 'バックグラウンド処理でエラーが発生しました',
    details: error,
    source
  });
};

/**
 * バックグラウンドサービスを初期化
 */
async function initializeBackgroundService() {
  if (isInitialized) return;
  
  try {
    console.log('[Background] 初期化開始...');
    
    // 設定マネージャーを初期化
    await settingsManager.initialize();
    
    // APIクライアントを初期化して、APIマネージャーに登録
    const twitchClient = new TwitchAPIClient();
    const youtubeClient = new YouTubeAPIClient();
    const twitcastingClient = new TwitCastingAPIClient();
    
    await apiManager.initialize({
      twitch: twitchClient,
      youtube: youtubeClient,
      twitcasting: twitcastingClient
    });
    
    // データマネージャーを初期化
    await dataManager.initialize();
    
    // 通知マネージャーを初期化
    await notificationManager.initialize();
    
    // エラーハンドラーをセットアップ
    setupErrorHandler();
    
    // イベントリスナーをセットアップ
    setupEventListeners();
    
    // 初期化完了
    isInitialized = true;
    console.log('[Background] 初期化完了');
    
    // 設定に基づいてアラームをセットアップ
    setupAlarms();
    
    // 起動時更新が有効なら即時更新を実行
    const settings = settingsManager.getSettings();
    if (settings.startupRefresh) {
      fetchStreamData();
    }
  } catch (error) {
    logError(error, 'INIT_ERROR', 'background:initialization');
    console.error('[Background] 初期化に失敗しました:', error);
  }
}

/**
 * エラーハンドラーをセットアップ
 */
function setupErrorHandler() {
  errorManager.on('error:occurred', (errorData) => {
    // 重大なエラーの場合はバッジを更新
    if (errorData.isCritical) {
      updateBadge('!');
    }
    
    // エラーログをコンソールに出力
    console.error(`[Error] ${errorData.code}: ${errorData.message}`, errorData.details);
  });
}

/**
 * イベントリスナーをセットアップ
 */
function setupEventListeners() {
  // APIマネージャーのイベントリスナー
  apiManager.on('api:streamsReceived', (streams) => {
    console.log(`[Background] ${streams.length}件のストリームデータを取得しました`);
  });
  
  apiManager.on('error', (error) => {
    logError(error, error.code, error.source || 'api');
  });
  
  // 設定変更イベントリスナー
  settingsManager.on('settings:changed', (settings) => {
    console.log('[Background] 設定が変更されました');
    setupAlarms(); // 設定変更時にアラームを再設定
  });
  
  // 認証関連イベントリスナー
  [AUTH_EVENTS.TWITCH_AUTH_CHANGED, AUTH_EVENTS.YOUTUBE_AUTH_CHANGED, AUTH_EVENTS.TWITCASTING_AUTH_CHANGED]
    .forEach(eventName => {
      settingsManager.on(eventName, (authData) => {
        console.log(`[Background] 認証情報が更新されました: ${authData.platformType}`);
        // 認証情報更新時はデータ再取得をスケジュール
        scheduleImmediateUpdate();
      });
    });
}

/**
 * 設定に基づいてアラームをセットアップ
 */
function setupAlarms() {
  // 既存のアラームをクリア
  chrome.alarms.clear('fetchStreamData', () => {
    const settings = settingsManager.getSettings();
    const intervalMinutes = settings.updateInterval / 60; // 秒から分に変換
    
    // 新しいアラームを設定
    chrome.alarms.create('fetchStreamData', {
      delayInMinutes: 0.1, // 初回は少し遅らせる
      periodInMinutes: Math.max(1, intervalMinutes) // 最低1分間隔
    });
    
    console.log(`[Background] データ更新アラームを設定: ${intervalMinutes}分間隔`);
  });
}

/**
 * ストリームデータを取得・更新
 */
async function fetchStreamData() {
  if (isUpdating) {
    console.log('[Background] 更新処理が既に実行中です');
    return;
  }
  
  isUpdating = true;
  updateBadge('...');
  
  try {
    console.log('[Background] ストリームデータ更新開始...');
    
    // バックグラウンド更新開始イベントを発火
    dispatchEvent(BACKGROUND_EVENTS.UPDATE_STARTED);
    
    // 有効なプラットフォームを取得
    const settings = settingsManager.getSettings();
    const enabledPlatforms = Object.entries(settings.enabledPlatforms)
      .filter(([_, enabled]) => enabled)
      .map(([platform]) => platform);
    
    if (enabledPlatforms.length === 0) {
      console.log('[Background] 有効なプラットフォームがありません');
      updateBadge('0');
      isUpdating = false;
      return;
    }
    
    // APIマネージャーを使ってデータを取得
    console.log(`[Background] 次のプラットフォームからデータを取得: ${enabledPlatforms.join(', ')}`);
    const streams = await apiManager.getStreams(enabledPlatforms);
    
    // 取得したデータをデータマネージャーに保存
    await dataManager.replaceStreams(streams);
    
    // スケジュールデータの取得（対応プラットフォームのみ）
    try {
      // スケジュール取得に対応しているプラットフォームを抽出
      const scheduleCapablePlatforms = enabledPlatforms.filter(platform => {
        const client = apiManager.apiClients[platform];
        return client && typeof client.getSchedules === 'function';
      });
      
      if (scheduleCapablePlatforms.length > 0) {
        const schedules = await apiManager.getSchedules(scheduleCapablePlatforms);
        await dataManager.replaceSchedules(schedules);
      }
    } catch (scheduleError) {
      logError(scheduleError, 'SCHEDULE_FETCH_ERROR', 'background:schedules');
      // スケジュール取得エラーは非致命的なので処理を継続
    }
    
    // 新規ストリーム検出とリマインダー通知チェック
    await checkForNewStreamsAndReminders(streams);
    
    // バッジを更新
    updateBadge(streams.length.toString());
    
    // 更新完了
    lastUpdateTime = new Date();
    updateAttempts = 0;
    dispatchEvent(BACKGROUND_EVENTS.UPDATE_COMPLETED, { 
      streams, 
      timestamp: lastUpdateTime 
    });
    
    console.log(`[Background] ストリームデータ更新完了: ${streams.length}件`);
  } catch (error) {
    updateAttempts++;
    const willRetry = updateAttempts < MAX_RETRY_ATTEMPTS;
    
    logError(error, 'DATA_FETCH_ERROR', 'background:fetchData');
    console.error('[Background] データ取得エラー:', error);
    
    // エラー通知
    dispatchEvent(BACKGROUND_EVENTS.UPDATE_FAILED, { 
      error,
      attempts: updateAttempts,
      willRetry
    });
    
    // エラー表示をバッジに
    updateBadge('!');
    
    // リトライ
    if (willRetry) {
      console.log(`[Background] ${RETRY_DELAY_MS / 1000}秒後にリトライします (${updateAttempts}/${MAX_RETRY_ATTEMPTS})`);
      setTimeout(fetchStreamData, RETRY_DELAY_MS);
    }
  } finally {
    isUpdating = false;
  }
}

/**
 * 新規ストリームの検出とリマインダー通知のチェック
 * @param {Array} currentStreams - 現在のストリーム配列
 */
async function checkForNewStreamsAndReminders(currentStreams) {
  const settings = settingsManager.getSettings();
  if (!settings.enableNotifications) return;
  
  try {
    // 前回のストリームデータを取得
    const previousStreamsRaw = await new Promise((resolve) => {
      chrome.storage.local.get('previousStreams', (result) => {
        resolve(result.previousStreams || []);
      });
    });
    
    // 新規ストリームを検出
    const newStreams = currentStreams.filter(current => {
      // 通知済みのストリームはスキップ
      if (current.notified) return false;
      
      // お気に入りのみ通知設定がONの場合、お気に入りでなければスキップ
      if (settings.notifyOnlyFavorites && !current.isFavorite) return false;
      
      // 前回のデータに存在しなければ新規ストリーム
      return !previousStreamsRaw.some(prev => 
        prev.platformType === current.platformType && prev.id === current.id
      );
    });
    
    // 新規ストリームがあれば通知
    if (newStreams.length > 0) {
      await notifyNewStreams(newStreams);
      
      // 通知済みフラグをセット
      const updatedStreams = currentStreams.map(stream => {
        if (newStreams.some(newStream => 
          newStream.platformType === stream.platformType && newStream.id === stream.id
        )) {
          return { ...stream, notified: true };
        }
        return stream;
      });
      
      // 更新したストリーム情報を保存
      await dataManager.replaceStreams(updatedStreams);
    }
    
    // スケジュールリマインダーをチェック（設定が有効な場合）
    if (settings.reminders) {
      await checkScheduleReminders();
    }
    
    // 現在のストリームを前回データとして保存
    chrome.storage.local.set({ previousStreams: currentStreams });
  } catch (error) {
    logError(error, 'NOTIFICATION_CHECK_ERROR', 'background:notifications');
  }
}

/**
 * 新規ストリームの通知を表示
 * @param {Array} streams - 新規ストリーム配列
 */
async function notifyNewStreams(streams) {
  try {
    const maxNotifications = 5; // 一度に表示する最大通知数
    const streamsToNotify = streams.slice(0, maxNotifications);
    
    // 複数のストリームがある場合はまとめて通知
    if (streamsToNotify.length > 1) {
      const notificationOptions = {
        title: '新しい配信が開始されました',
        message: `${streamsToNotify.length}件の新規配信があります`,
        items: streamsToNotify.map(stream => ({
          title: stream.streamerName || 'ストリーマー',
          message: stream.title || 'タイトルなし'
        })),
        contextMessage: 'クリックして詳細を表示',
        type: 'list',
        groupId: 'new-streams'
      };
      
      await notificationManager.showNotification('new-streams-group', notificationOptions);
    } else {
      // 単一の通知の場合
      for (const stream of streamsToNotify) {
        const notificationOptions = {
          title: '新しい配信が開始されました',
          message: stream.title || 'タイトルなし',
          contextMessage: `${stream.streamerName} (${stream.platformType})`,
          type: 'basic',
          iconUrl: stream.thumbnailUrl || '/assets/icon128.png',
          buttons: [{ title: '視聴する' }],
          priority: 2
        };
        
        await notificationManager.showNotification(
          `stream-${stream.platformType}-${stream.id}`,
          notificationOptions,
          stream.url
        );
      }
    }
    
    console.log(`[Background] ${streamsToNotify.length}件の新規配信を通知しました`);
  } catch (error) {
    logError(error, 'SHOW_NOTIFICATION_ERROR', 'background:notifications');
  }
}

/**
 * スケジュールリマインダーをチェック
 */
async function checkScheduleReminders() {
  try {
    const settings = settingsManager.getSettings();
    if (!settings.reminders) return;
    
    const schedules = dataManager.schedules;
    const reminderMinutes = settings.reminderTime || 10;
    const now = new Date();
    const reminderThreshold = new Date(now.getTime() + (reminderMinutes * 60 * 1000));
    
    // リマインダー通知対象のスケジュールを抽出
    const schedulesToRemind = schedules.filter(schedule => {
      if (!schedule.scheduledStartTime || schedule.notified) return false;
      
      const startTime = new Date(schedule.scheduledStartTime);
      
      // 現在時刻 <= 開始時刻 <= (現在時刻 + リマインダー時間) の場合に通知
      return startTime > now && startTime <= reminderThreshold;
    });
    
    if (schedulesToRemind.length > 0) {
      // リマインダー通知
      for (const schedule of schedulesToRemind) {
        const startTime = new Date(schedule.scheduledStartTime);
        const minutesToStart = Math.round((startTime - now) / (60 * 1000));
        
        const notificationOptions = {
          title: 'まもなく配信が始まります',
          message: schedule.title || 'タイトルなし',
          contextMessage: `${schedule.streamerName} (${minutesToStart}分後)`,
          type: 'basic',
          iconUrl: schedule.thumbnailUrl || '/assets/icon128.png',
          buttons: [{ title: 'ページを開く' }],
        };
        
        await notificationManager.showNotification(
          `schedule-${schedule.platformType}-${schedule.id}`,
          notificationOptions,
          schedule.url
        );
        
        // 通知済みフラグをセット
        await dataManager.updateSchedule({
          ...schedule,
          notified: true
        });
      }
      
      console.log(`[Background] ${schedulesToRemind.length}件のスケジュールリマインダーを通知しました`);
    }
  } catch (error) {
    logError(error, 'REMINDER_CHECK_ERROR', 'background:reminders');
  }
}

/**
 * バッジカウンターを更新
 * @param {string} text - バッジに表示するテキスト
 */
function updateBadge(text) {
  chrome.action.setBadgeText({ text });
  
  // バッジの色を設定
  if (text === '!') {
    chrome.action.setBadgeBackgroundColor({ color: '#f55353' }); // エラー時は赤
  } else if (text === '...') {
    chrome.action.setBadgeBackgroundColor({ color: '#777777' }); // ロード中はグレー
  } else if (text === '↻') {
    chrome.action.setBadgeBackgroundColor({ color: '#00b173' }); // 更新予定は緑
  } else {
    chrome.action.setBadgeBackgroundColor({ color: '#9147ff' }); // 通常時はTwitch紫
  }
}

/**
 * 即時更新をスケジュール
 */
function scheduleImmediateUpdate() {
  updateBadge('↻');
  chrome.alarms.create('fetchStreamData', {
    delayInMinutes: 0.1 // 6秒後に実行
  });
}

/**
 * バックグラウンドイベントを発火
 * @param {string} eventName - イベント名
 * @param {Object} data - イベントデータ
 */
function dispatchEvent(eventName, data = {}) {
  // イベントを発火してポップアップなどに通知
  chrome.runtime.sendMessage({
    type: eventName,
    data: {
      ...data,
      timestamp: new Date().toISOString()
    }
  }).catch(() => {
    // メッセージ送信エラーは無視（受信側が開いていない可能性）
  });
}

// イベントリスナー登録
// ================================================================

// 拡張機能のインストール/更新時
chrome.runtime.onInstalled.addListener(details => {
  console.log('[Background] 拡張機能がインストールまたは更新されました:', details.reason);
  initializeBackgroundService();
});

// 拡張機能起動時
chrome.runtime.onStartup.addListener(() => {
  console.log('[Background] 拡張機能が起動しました');
  initializeBackgroundService();
});

// アラームリスナー（定期的な更新処理）
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'fetchStreamData') {
    console.log('[Background] データ更新アラームが発火しました');
    fetchStreamData();
  }
});

// メッセージリスナー（他のスクリプトからのメッセージ）
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] メッセージを受信:', message.type);
  
  // 即時更新リクエスト
  if (message.type === 'refresh') {
    fetchStreamData()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ 
        success: false, 
        error: error.message 
      }));
    return true; // 非同期レスポンスを示す
  }
  
  // 設定更新通知
  if (message.type === 'settings_updated') {
    settingsManager.loadSettings()
      .then(() => {
        setupAlarms();
        sendResponse({ success: true });
      })
      .catch(error => sendResponse({ 
        success: false, 
        error: error.message 
      }));
    return true;
  }
  
  // 認証情報更新通知
  if (message.type === 'auth_updated') {
    const { platformType } = message;
    console.log(`[Background] ${platformType}の認証情報が更新されました`);
    
    // 6秒後にデータを再取得
    scheduleImmediateUpdate();
    sendResponse({ success: true });
    return true;
  }
  
  // データ取得リクエスト
  if (message.type === 'get_data') {
    const { dataType } = message;
    if (dataType === 'streams') {
      sendResponse({ 
        success: true, 
        data: dataManager.streams,
        lastUpdated: lastUpdateTime
      });
    } else if (dataType === 'schedules') {
      sendResponse({ 
        success: true, 
        data: dataManager.schedules,
        lastUpdated: lastUpdateTime
      });
    } else {
      sendResponse({ 
        success: false, 
        error: '不明なデータタイプです' 
      });
    }
    return true;
  }
});

// 通知クリックリスナー
chrome.notifications.onClicked.addListener(notificationId => {
  console.log(`[Background] 通知がクリックされました: ${notificationId}`);
  notificationManager.handleNotificationClicked(notificationId);
});

// 通知ボタンクリックリスナー
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  console.log(`[Background] 通知のボタンがクリックされました: ${notificationId}, ボタン: ${buttonIndex}`);
  notificationManager.handleNotificationButtonClicked(notificationId, buttonIndex);
});

// 初期化
initializeBackgroundService();