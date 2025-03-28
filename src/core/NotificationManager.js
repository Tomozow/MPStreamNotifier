/**
 * 通知管理クラス
 * デスクトップ通知の表示を管理します
 */
import Singleton from '../utils/Singleton';
import EventEmitter from '../utils/EventEmitter';
import { Stream, Schedule } from './models';

class NotificationManager extends Singleton {
  constructor() {
    super();
    this.eventEmitter = new EventEmitter();
    this.notifiedStreamIds = new Set();
    this.notifiedScheduleIds = new Set();
    this.settings = null;
  }

  /**
   * 通知マネージャーを初期化します
   * @param {Object} settings - 通知設定
   */
  initialize(settings) {
    this.settings = settings;
    
    // 通知がクリックされたときのイベントリスナー
    chrome.notifications.onClicked.addListener(this.onNotificationClicked.bind(this));
    
    // 通知ボタンがクリックされたときのイベントリスナー
    chrome.notifications.onButtonClicked.addListener(this.onNotificationButtonClicked.bind(this));
    
    this.eventEmitter.emit('notification:initialized');
  }

  /**
   * 通知設定を更新します
   * @param {Object} settings - 新しい通知設定
   */
  updateSettings(settings) {
    this.settings = {
      ...this.settings,
      ...settings
    };
    this.eventEmitter.emit('notification:settingsUpdated', this.settings);
  }

  /**
   * 新しいストリームの通知を表示します
   * @param {Stream|Object} stream - 通知するストリーム情報
   * @return {Promise<string>} - 通知ID
   */
  async notifyNewStream(stream) {
    const streamObj = stream instanceof Stream ? stream : new Stream(stream);
    
    // 通知済みの場合はスキップ
    if (this.notifiedStreamIds.has(streamObj.id) || streamObj.notified) {
      return null;
    }
    
    // 通知が無効の場合はスキップ
    if (!this.settings || !this.settings.enableNotifications) {
      return null;
    }
    
    // お気に入りのみ通知の設定時に、お気に入りでない場合はスキップ
    if (this.settings.notifyOnlyFavorites && !streamObj.isFavorite) {
      return null;
    }
    
    try {
      const notificationId = `stream_${streamObj.platformType}_${streamObj.id}`;
      const notificationOptions = {
        type: 'basic',
        title: `${streamObj.streamerName} が配信を開始しました`,
        message: streamObj.title || '配信タイトルなし',
        iconUrl: streamObj.thumbnailUrl || this.getPlatformIcon(streamObj.platformType),
        buttons: [
          { title: '配信を視聴' }
        ],
        requireInteraction: true
      };
      
      await new Promise((resolve) => {
        chrome.notifications.create(notificationId, notificationOptions, resolve);
      });
      
      // 通知済みとしてマーク
      this.notifiedStreamIds.add(streamObj.id);
      
      // イベント発火
      this.eventEmitter.emit('notification:streamNotified', streamObj);
      
      return notificationId;
    } catch (error) {
      this.eventEmitter.emit('error', {
        code: 'NOTIFICATION_ERROR',
        message: 'ストリーム通知の表示に失敗しました',
        details: error
      });
      return null;
    }
  }

  /**
   * 予定されたストリームのリマインダー通知を表示します
   * @param {Schedule|Object} schedule - 通知するスケジュール情報
   * @return {Promise<string>} - 通知ID
   */
  async notifyScheduleReminder(schedule) {
    const scheduleObj = schedule instanceof Schedule ? schedule : new Schedule(schedule);
    
    // 通知済みの場合はスキップ
    if (this.notifiedScheduleIds.has(scheduleObj.id) || scheduleObj.notified) {
      return null;
    }
    
    // 通知が無効の場合はスキップ
    if (!this.settings || !this.settings.enableNotifications || !this.settings.reminders) {
      return null;
    }
    
    try {
      const notificationId = `schedule_${scheduleObj.platformType}_${scheduleObj.id}`;
      const minutesUntilStart = this.getMinutesUntilStart(scheduleObj.scheduledStartTime);
      
      const notificationOptions = {
        type: 'basic',
        title: `${scheduleObj.streamerName} の配信が間もなく開始されます`,
        message: `${minutesUntilStart}分後に「${scheduleObj.title || '配信タイトルなし'}」が始まります`,
        iconUrl: scheduleObj.thumbnailUrl || this.getPlatformIcon(scheduleObj.platformType),
        buttons: [
          { title: '配信ページへ' }
        ],
        requireInteraction: true
      };
      
      await new Promise((resolve) => {
        chrome.notifications.create(notificationId, notificationOptions, resolve);
      });
      
      // 通知済みとしてマーク
      this.notifiedScheduleIds.add(scheduleObj.id);
      
      // イベント発火
      this.eventEmitter.emit('notification:scheduleNotified', scheduleObj);
      
      return notificationId;
    } catch (error) {
      this.eventEmitter.emit('error', {
        code: 'NOTIFICATION_ERROR',
        message: 'スケジュール通知の表示に失敗しました',
        details: error
      });
      return null;
    }
  }

  /**
   * エラー通知を表示します
   * @param {Object} error - エラー情報
   * @return {Promise<string>} - 通知ID
   */
  async notifyError(error) {
    try {
      const notificationId = `error_${Date.now()}`;
      const notificationOptions = {
        type: 'basic',
        title: 'エラーが発生しました',
        message: error.message || '不明なエラーが発生しました',
        iconUrl: '/assets/icon128.png',
        requireInteraction: false
      };
      
      await new Promise((resolve) => {
        chrome.notifications.create(notificationId, notificationOptions, resolve);
      });
      
      return notificationId;
    } catch (err) {
      console.error('エラー通知の表示に失敗しました', err);
      return null;
    }
  }

  /**
   * カスタム通知を表示します
   * @param {Object} options - 通知オプション
   * @param {string} options.title - 通知タイトル
   * @param {string} options.message - 通知メッセージ
   * @param {string} [options.iconUrl] - 通知アイコンURL
   * @param {Array<Object>} [options.buttons] - 通知ボタン
   * @param {boolean} [options.requireInteraction] - ユーザーの操作が必要かどうか
   * @return {Promise<string>} - 通知ID
   */
  async showCustomNotification(options) {
    try {
      const notificationId = `custom_${Date.now()}`;
      const notificationOptions = {
        type: 'basic',
        title: options.title,
        message: options.message,
        iconUrl: options.iconUrl || '/assets/icon128.png',
        buttons: options.buttons || [],
        requireInteraction: options.requireInteraction !== undefined ? options.requireInteraction : false
      };
      
      await new Promise((resolve) => {
        chrome.notifications.create(notificationId, notificationOptions, resolve);
      });
      
      return notificationId;
    } catch (error) {
      this.eventEmitter.emit('error', {
        code: 'NOTIFICATION_ERROR',
        message: 'カスタム通知の表示に失敗しました',
        details: error
      });
      return null;
    }
  }

  /**
   * 通知をクリアします
   * @param {string} notificationId - 通知ID
   * @return {Promise<boolean>} - 成功したかどうか
   */
  async clearNotification(notificationId) {
    try {
      return new Promise((resolve) => {
        chrome.notifications.clear(notificationId, resolve);
      });
    } catch (error) {
      return false;
    }
  }

  /**
   * すべての通知履歴をクリアします
   */
  clearAllNotificationHistory() {
    this.notifiedStreamIds.clear();
    this.notifiedScheduleIds.clear();
    this.eventEmitter.emit('notification:historyCleared');
  }

  /**
   * 特定のストリームの通知済みフラグをリセットします
   * @param {string} streamId - ストリームID
   */
  resetStreamNotification(streamId) {
    this.notifiedStreamIds.delete(streamId);
  }

  /**
   * 特定のスケジュールの通知済みフラグをリセットします
   * @param {string} scheduleId - スケジュールID
   */
  resetScheduleNotification(scheduleId) {
    this.notifiedScheduleIds.delete(scheduleId);
  }

  /**
   * 通知がクリックされたときの処理
   * @param {string} notificationId - 通知ID
   * @private
   */
  onNotificationClicked(notificationId) {
    // ストリーム通知の場合
    if (notificationId.startsWith('stream_')) {
      const [, platformType, streamId] = notificationId.split('_');
      this.eventEmitter.emit('notification:streamClicked', { platformType, streamId });
      
      // URLを開く処理はリスナー側で実装
    }
    // スケジュール通知の場合
    else if (notificationId.startsWith('schedule_')) {
      const [, platformType, scheduleId] = notificationId.split('_');
      this.eventEmitter.emit('notification:scheduleClicked', { platformType, scheduleId });
      
      // URLを開く処理はリスナー側で実装
    }
    // カスタム通知の場合
    else if (notificationId.startsWith('custom_')) {
      this.eventEmitter.emit('notification:customClicked', { notificationId });
    }
    
    // 通知を閉じる
    this.clearNotification(notificationId);
  }
  
  /**
   * 通知のボタンがクリックされたときの処理
   * @param {string} notificationId - 通知ID
   * @param {number} buttonIndex - クリックされたボタンのインデックス
   * @private
   */
  onNotificationButtonClicked(notificationId, buttonIndex) {
    // ストリーム通知の場合
    if (notificationId.startsWith('stream_')) {
      const [, platformType, streamId] = notificationId.split('_');
      this.eventEmitter.emit('notification:streamButtonClicked', { 
        platformType, 
        streamId, 
        buttonIndex 
      });
    }
    // スケジュール通知の場合
    else if (notificationId.startsWith('schedule_')) {
      const [, platformType, scheduleId] = notificationId.split('_');
      this.eventEmitter.emit('notification:scheduleButtonClicked', { 
        platformType, 
        scheduleId, 
        buttonIndex 
      });
    }
    // カスタム通知の場合
    else if (notificationId.startsWith('custom_')) {
      this.eventEmitter.emit('notification:customButtonClicked', { 
        notificationId, 
        buttonIndex 
      });
    }
    
    // 通知を閉じる
    this.clearNotification(notificationId);
  }

  /**
   * 開始時間までの残り分数を計算します
   * @param {Date|number|string} scheduledTime - 予定時刻
   * @return {number} - 残り分数
   * @private
   */
  getMinutesUntilStart(scheduledTime) {
    const scheduleDate = new Date(scheduledTime);
    const now = new Date();
    const diffMs = scheduleDate.getTime() - now.getTime();
    return Math.max(0, Math.floor(diffMs / (1000 * 60)));
  }

  /**
   * プラットフォームのアイコンを取得します
   * @param {string} platformType - プラットフォーム種別
   * @return {string} - アイコンURL
   * @private
   */
  getPlatformIcon(platformType) {
    switch (platformType) {
      case 'twitch':
        return '/assets/twitch_icon.png';
      case 'youtube':
        return '/assets/youtube_icon.png';
      case 'twitcasting':
        return '/assets/twitcasting_icon.png';
      default:
        return '/assets/icon128.png';
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

export default NotificationManager;