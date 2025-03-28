/**
 * 表示状態管理クラス
 * UI表示状態を一元管理し、ビュー間の状態同期を実現します
 */
import Singleton from '../utils/Singleton';
import EventEmitter from '../utils/EventEmitter';
import { Filter } from './models';

class ViewStateManager extends Singleton {
  constructor() {
    super();
    this.eventEmitter = new EventEmitter();
    
    // 表示状態
    this.state = {
      currentView: 'streams', // 'streams' または 'schedules'
      viewMode: 'grid',       // 'grid' または 'list'
      loading: false,
      filter: new Filter(),
      selectedStream: null,
      selectedSchedule: null,
      searchQuery: '',
      page: 1,
      itemsPerPage: 20,
      showFilterPanel: false,
      lastError: null,
      toast: {
        show: false,
        message: '',
        type: 'info',
      }
    };
  }

  /**
   * 表示状態を初期化します
   * @param {Object} initialState - 初期表示状態
   */
  initialize(initialState = {}) {
    this.state = {
      ...this.state,
      ...initialState
    };
    this.eventEmitter.emit('viewState:initialized', this.state);
  }

  /**
   * 表示状態を更新します
   * @param {Object} updates - 更新内容
   */
  updateState(updates) {
    const oldState = { ...this.state };
    this.state = {
      ...this.state,
      ...updates
    };
    
    // 変更があった項目を特定
    const changedKeys = Object.keys(updates).filter(key => 
      JSON.stringify(oldState[key]) !== JSON.stringify(this.state[key])
    );
    
    if (changedKeys.length > 0) {
      // 状態変更イベントを発火
      this.eventEmitter.emit('viewState:updated', {
        newState: this.state,
        oldState,
        changedKeys
      });
      
      // 各プロパティ固有のイベントも発火
      changedKeys.forEach(key => {
        this.eventEmitter.emit(`viewState:${key}Changed`, {
          newValue: this.state[key],
          oldValue: oldState[key]
        });
      });
    }
  }

  /**
   * 現在の表示状態を取得します
   * @return {Object} - 現在の表示状態
   */
  getState() {
    return { ...this.state };
  }

  /**
   * 表示モードを切り替えます
   * @param {string} mode - 'grid' または 'list'
   */
  setViewMode(mode) {
    if (mode !== 'grid' && mode !== 'list') {
      throw new Error(`無効な表示モード: ${mode}`);
    }
    this.updateState({ viewMode: mode });
  }

  /**
   * 表示するコンテンツを切り替えます
   * @param {string} view - 'streams' または 'schedules'
   */
  setCurrentView(view) {
    if (view !== 'streams' && view !== 'schedules') {
      throw new Error(`無効なビュー: ${view}`);
    }
    this.updateState({ currentView: view });
  }

  /**
   * ローディング状態を設定します
   * @param {boolean} isLoading - ローディング中かどうか
   */
  setLoading(isLoading) {
    this.updateState({ loading: isLoading });
  }

  /**
   * フィルター条件を設定します
   * @param {Filter|Object} filter - フィルター条件
   */
  setFilter(filter) {
    const newFilter = filter instanceof Filter ? filter : new Filter(filter);
    this.updateState({ filter: newFilter });
  }

  /**
   * 選択されたストリームを設定します
   * @param {Stream|null} stream - 選択されたストリーム
   */
  setSelectedStream(stream) {
    this.updateState({ selectedStream: stream });
  }

  /**
   * 選択されたスケジュールを設定します
   * @param {Schedule|null} schedule - 選択されたスケジュール
   */
  setSelectedSchedule(schedule) {
    this.updateState({ selectedSchedule: schedule });
  }

  /**
   * 検索クエリを設定します
   * @param {string} query - 検索クエリ
   */
  setSearchQuery(query) {
    this.updateState({ searchQuery: query });
  }

  /**
   * 現在のページを設定します
   * @param {number} page - ページ番号
   */
  setPage(page) {
    this.updateState({ page: Math.max(1, page) });
  }

  /**
   * ページあたりの表示件数を設定します
   * @param {number} count - 表示件数
   */
  setItemsPerPage(count) {
    this.updateState({ itemsPerPage: Math.max(1, count) });
  }

  /**
   * フィルターパネルの表示状態を設定します
   * @param {boolean} show - 表示するかどうか
   */
  setFilterPanelVisibility(show) {
    this.updateState({ showFilterPanel: show });
  }

  /**
   * エラー状態を設定します
   * @param {Error|null} error - エラー情報
   */
  setLastError(error) {
    this.updateState({ lastError: error });
  }

  /**
   * トースト通知を表示します
   * @param {string} message - トーストメッセージ
   * @param {string} [type='info'] - メッセージタイプ ('info', 'success', 'warning', 'error')
   * @param {number} [duration=3000] - 表示時間（ミリ秒）
   */
  showToast(message, type = 'info', duration = 3000) {
    this.updateState({
      toast: {
        show: true,
        message,
        type
      }
    });
    
    // 指定時間後に非表示にする
    setTimeout(() => {
      this.updateState({
        toast: {
          ...this.state.toast,
          show: false
        }
      });
    }, duration);
  }

  /**
   * トースト通知を非表示にします
   */
  hideToast() {
    this.updateState({
      toast: {
        ...this.state.toast,
        show: false
      }
    });
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

export default ViewStateManager;