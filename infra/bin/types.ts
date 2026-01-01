/**
 * CDK 全体で共有するアプリケーションコンテキスト
 * - すべてのリソース命名の基点
 * - Stack をまたいで共通
 */
export interface AppContext {
  projectName: string;
  envName: string;

  /** `${projectName}-${envName}` */
  readonly baseName: string;
}
