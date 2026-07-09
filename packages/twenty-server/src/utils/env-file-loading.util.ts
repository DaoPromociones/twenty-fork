export const isEnvFileLoadingDisabled = (): boolean =>
  process.env.TWENTY_DISABLE_DOTENV === 'true';

export const shouldLoadEnvFile = (): boolean => !isEnvFileLoadingDisabled();
