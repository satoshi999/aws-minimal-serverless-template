/**
 * CDK 全体で共有するアプリケーションコンテキスト
 * - すべてのリソース命名の基点
 * - Stack をまたいで共通
 */
export interface AppContext {
  projectName: string;
  stage: string;

  /** `${projectName}-${stage}` */
  readonly baseName: string;
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Environment variable ${name} is required`);
  }
  return value;
}

export function buildAppContext(stage: string): AppContext {
  const projectName = requireEnv("PROJECT_NAME");

  return {
    projectName,
    stage,
    baseName: `${projectName}-${stage}`,
  };
}
