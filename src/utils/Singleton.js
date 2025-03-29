/**
 * シングルトンパターンの基底クラス
 * このクラスを継承することで、子クラスは自動的にシングルトンとして動作します
 */
class Singleton {
  /**
   * インスタンスを取得します。既に存在する場合は既存のインスタンスを返します。
   * @return {Object} シングルトンインスタンス
   */
  static getInstance() {
    if (!this._instance) {
      this._instance = new this();
    }
    return this._instance;
  }

  /**
   * シングルトンインスタンスを破棄します（主にテスト用）
   */
  static destroyInstance() {
    this._instance = null;
  }
}

export default Singleton;
