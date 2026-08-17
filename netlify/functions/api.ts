import serverless from "serverless-http";
import { createApp } from "../../server/_core/app";

const appPromise = Promise.resolve(createApp().app).then(app => serverless(app));

export async function handler(event: Parameters<NonNullable<ReturnType<typeof serverless>["handler"]>>[0], context: Parameters<NonNullable<ReturnType<typeof serverless>["handler"]>>[1]) {
  const appHandler = await appPromise;
  return appHandler(event, context);
}
