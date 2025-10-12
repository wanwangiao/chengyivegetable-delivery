import sharedEnv from '@chengyi/config';

export const env = {
  ...sharedEnv,
  port: Number(sharedEnv.PORT ?? 3000)
};
