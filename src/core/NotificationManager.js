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
        message: streamObj.title,
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
        message: `${minutesUntilStart}分後に「${scheduleObj.title}」が始まります`,
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
  }}