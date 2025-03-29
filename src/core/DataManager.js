/**
 * データ管理クラス
 * ストリーム情報やスケジュール情報を管理し、永続化を担当します
 */
import Singleton from '../utils/Singleton';
import EventEmitter from '../utils/EventEmitter';
import { Stream, Schedule } from './models';

class DataManager extends Singleton {
  constructor() {
    super();
    this.eventEmitter = new EventEmitter();
    this.streams = [];
    this.schedules = [];
    this.lastUpdated = null;
    this.isLoading = false;
  }

  /**
   * データマネージャーを初期化し、保存されたデータをロードします
   * @return {Promise<void>}
   */
  async initialize() {
    this.isLoading = true;
    try {
      await this.loadStreams();
      await this.loadSchedules();
      this.lastUpdated = new Date();
      this.isLoading = false;
      this.eventEmitter.emit('data:initialized');
    } catch (error) {
      this.isLoading = false;
      this.eventEmitter.emit('error', {
        code: 'DATA_INIT_ERROR',
        message: 'データの初期化に失敗しました',
        details: error
      });
      throw error;
    }
  }

  /**
   * ストリームデータを保存します
   * @param {Array<Stream>} streams - 保存するストリーム配列
   * @return {Promise<void>}
   */
  async saveStreams(streams = this.streams) {
    try {
      await new Promise((resolve) => {
        chrome.storage.local.set({ 'streams': streams }, resolve);
      });
      this.streams = streams;
      this.lastUpdated = new Date();
      this.eventEmitter.emit('streams:updated', this.streams);
    } catch (error) {
      this.eventEmitter.emit('error', {
        code: 'SAVE_STREAMS_ERROR',
        message: 'ストリームデータの保存に失敗しました',
        details: error
      });
      throw error;
    }
  }

  /**
   * ストリームデータをロードします
   * @return {Promise<Array<Stream>>}
   */
  async loadStreams() {
    try {
      return new Promise((resolve) => {
        chrome.storage.local.get('streams', (result) => {
          const streamData = result.streams || [];
          this.streams = streamData.map(data => new Stream(data));
          resolve(this.streams);
        });
      });
    } catch (error) {
      this.eventEmitter.emit('error', {
        code: 'LOAD_STREAMS_ERROR',
        message: 'ストリームデータの読み込みに失敗しました',
        details: error
      });
      throw error;
    }
  }

  /**
   * スケジュールデータを保存します
   * @param {Array<Schedule>} schedules - 保存するスケジュール配列
   * @return {Promise<void>}
   */
  async saveSchedules(schedules = this.schedules) {
    try {
      await new Promise((resolve) => {
        chrome.storage.local.set({ 'schedules': schedules }, resolve);
      });
      this.schedules = schedules;
      this.eventEmitter.emit('schedules:updated', this.schedules);
    } catch (error) {
      this.eventEmitter.emit('error', {
        code: 'SAVE_SCHEDULES_ERROR',
        message: 'スケジュールデータの保存に失敗しました',
        details: error
      });
      throw error;
    }
  }

  /**
   * スケジュールデータをロードします
   * @return {Promise<Array<Schedule>>}
   */
  async loadSchedules() {
    try {
      return new Promise((resolve) => {
        chrome.storage.local.get('schedules', (result) => {
          const scheduleData = result.schedules || [];
          this.schedules = scheduleData.map(data => new Schedule(data));
          resolve(this.schedules);
        });
      });
    } catch (error) {
      this.eventEmitter.emit('error', {
        code: 'LOAD_SCHEDULES_ERROR',
        message: 'スケジュールデータの読み込みに失敗しました',
        details: error
      });
      throw error;
    }
  }

  /**
   * ストリームを追加または更新します
   * @param {Stream|Object} streamData - 追加/更新するストリームデータ
   * @return {Promise<void>}
   */
  async updateStream(streamData) {
    const stream = streamData instanceof Stream ? streamData : new Stream(streamData);
    const index = this.streams.findIndex(s => s.id === stream.id && s.platformType === stream.platformType);
    
    if (index === -1) {
      // 新規ストリームの場合は追加
      this.streams.push(stream);
    } else {
      // 既存ストリームの場合は更新
      this.streams[index] = stream;
    }
    
    await this.saveStreams();
    return stream;
  }

  /**
   * スケジュールを追加または更新します
   * @param {Schedule|Object} scheduleData - 追加/更新するスケジュールデータ
   * @return {Promise<void>}
   */
  async updateSchedule(scheduleData) {
    const schedule = scheduleData instanceof Schedule ? scheduleData : new Schedule(scheduleData);
    const index = this.schedules.findIndex(s => s.id === schedule.id && s.platformType === schedule.platformType);
    
    if (index === -1) {
      // 新規スケジュールの場合は追加
      this.schedules.push(schedule);
    } else {
      // 既存スケジュールの場合は更新
      this.schedules[index] = schedule;
    }
    
    await this.saveSchedules();
    return schedule;
  }

  /**
   * ストリーム配列を置き換えます
   * @param {Array<Stream|Object>} streams - 新しいストリーム配列
   * @return {Promise<void>}
   */
  async replaceStreams(streams) {
    this.streams = streams.map(data => data instanceof Stream ? data : new Stream(data));
    await this.saveStreams();
  }

  /**
   * スケジュール配列を置き換えます
   * @param {Array<Schedule|Object>} schedules - 新しいスケジュール配列
   * @return {Promise<void>}
   */
  async replaceSchedules(schedules) {
    this.schedules = schedules.map(data => data instanceof Schedule ? data : new Schedule(data));
    await this.saveSchedules();
  }

  /**
   * プラットフォーム別のストリーム情報を取得します
   * @param {string} platformType - プラットフォーム種別
   * @return {Array<Stream>} - ストリーム配列
   */
  getStreamsByPlatform(platformType) {
    return this.streams.filter(stream => stream.platformType === platformType);
  }

  /**
   * プラットフォーム別のスケジュール情報を取得します
   * @param {string} platformType - プラットフォーム種別
   * @return {Array<Schedule>} - スケジュール配列
   */
  getSchedulesByPlatform(platformType) {
    return this.schedules.filter(schedule => schedule.platformType === platformType);
  }

  /**
   * フィルター条件に一致するストリーム情報を取得します
   * @param {Function} filterFn - フィルター関数
   * @return {Array<Stream>} - フィルター条件に一致するストリーム配列
   */
  getFilteredStreams(filterFn) {
    return filterFn ? this.streams.filter(filterFn) : [...this.streams];
  }

  /**
   * フィルター条件に一致するスケジュール情報を取得します
   * @param {Function} filterFn - フィルター関数
   * @return {Array<Schedule>} - フィルター条件に一致するスケジュール配列
   */
  getFilteredSchedules(filterFn) {
    return filterFn ? this.schedules.filter(filterFn) : [...this.schedules];
  }

  /**
   * 全てのデータをクリアします
   * @return {Promise<void>}
   */
  async clearAllData() {
    try {
      await new Promise((resolve) => {
        chrome.storage.local.remove(['streams', 'schedules'], resolve);
      });
      this.streams = [];
      this.schedules = [];
      this.eventEmitter.emit('data:cleared');
    } catch (error) {
      this.eventEmitter.emit('error', {
        code: 'CLEAR_DATA_ERROR',
        message: 'データのクリアに失敗しました',
        details: error
      });
      throw error;
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

export default DataManager;
