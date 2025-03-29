import './popup.css';

// UIコントローラークラス
class UIController {
  constructor() {
    this.initDomReferences();
    this.bindEvents();
    this.init();
  }

  // DOM要素の参照を取得
  initDomReferences() {
    this.refreshButton = document.getElementById('refreshButton');
    this.filterButton = document.getElementById('filterButton');
    this.settingsButton = document.getElementById('settingsButton');
    this.filterPanel = document.getElementById('filterPanel');
    this.applyFiltersButton = document.getElementById('applyFilters');
    this.resetFiltersButton = document.getElementById('resetFilters');
    this.loading = document.getElementById('loading');
    this.errorElement = document.getElementById('error');
    this.streamsContainer = document.getElementById('streamsContainer');
    this.lastUpdated = document.getElementById('lastUpdated');
    this.streamCount = document.getElementById('streamCount');
  }

  // イベントハンドラの登録
  bindEvents() {
    this.refreshButton.addEventListener('click', () => this.refresh());
    this.filterButton.addEventListener('click', () => this.toggleFilterPanel());
    this.settingsButton.addEventListener('click', () => this.openSettings());
    this.applyFiltersButton.addEventListener('click', () => this.applyFilters());
    this.resetFiltersButton.addEventListener('click', () => this.resetFilters());
  }

  // 初期化
  init() {
    this.showLoading();
    // ここで後々DataManagerからデータを取得して表示する
    // 仮実装としてはタイマーでloadingを非表示にするだけ
    setTimeout(() => {
      this.hideLoading();
      this.showEmptyState();
    }, 1000);
  }

  // 更新処理
  refresh() {
    this.showLoading();
    // ここで後々DataManagerのrefreshメソッドを呼び出す
    // 仮実装としてはタイマーでloadingを非表示にするだけ
    setTimeout(() => {
      this.hideLoading();
      this.showEmptyState();
      this.updateLastUpdated();
    }, 1000);
  }

  // フィルターパネルの表示/非表示を切り替え
  toggleFilterPanel() {
    this.filterPanel.classList.toggle('hidden');
  }

  // 設定画面を開く
  openSettings() {
    chrome.runtime.openOptionsPage();
  }

  // フィルターを適用
  applyFilters() {
    // 後々フィルターを適用する処理を実装する
    this.filterPanel.classList.add('hidden');
    this.refresh();
  }

  // フィルターをリセット
  resetFilters() {
    // フィルターの各チェックボックスをデフォルト値に戻す
    document.getElementById('filterTwitch').checked = true;
    document.getElementById('filterYouTube').checked = true;
    document.getElementById('filterTwitCasting').checked = true;
    document.getElementById('filterFavorites').checked = false;
    document.getElementById('filterLive').checked = true;
    document.getElementById('filterScheduled').checked = true;
  }

  // ロード中表示
  showLoading() {
    this.loading.classList.remove('hidden');
    this.streamsContainer.classList.add('hidden');
    this.errorElement.classList.add('hidden');
  }

  // ロード中表示を消す
  hideLoading() {
    this.loading.classList.add('hidden');
    this.streamsContainer.classList.remove('hidden');
  }

  // 配信がないときの表示
  showEmptyState() {
    this.streamsContainer.innerHTML = '<div class="empty-state">現在配信されているストリームはありません</div>';
    this.streamCount.textContent = '0 配信';
  }

  // エラー表示
  showError(message) {
    this.errorElement.textContent = message;
    this.errorElement.classList.remove('hidden');
    this.loading.classList.add('hidden');
  }

  // 最終更新時刻の更新
  updateLastUpdated() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    this.lastUpdated.textContent = `最終更新: ${hours}:${minutes}`;
  }
}

// 拡張機能の初期化
document.addEventListener('DOMContentLoaded', () => {
  const ui = new UIController();
});
