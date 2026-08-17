export type DemoEnvironmentPolicy = {
  hasDedicatedDatabase: boolean;
  hasDedicatedStorage: boolean;
  permitsProductionData: boolean;
  permitsExternalDelivery: boolean;
  persistsVisitorData: boolean;
  publicRegistrationEnabled: boolean;
};

export const STATIC_DEMO_PREVIEW_POLICY: DemoEnvironmentPolicy = {
  hasDedicatedDatabase: false,
  hasDedicatedStorage: false,
  permitsProductionData: false,
  permitsExternalDelivery: false,
  persistsVisitorData: false,
  publicRegistrationEnabled: false,
};

export function canEnablePublicDemoRegistration(policy: DemoEnvironmentPolicy) {
  return policy.hasDedicatedDatabase
    && policy.hasDedicatedStorage
    && !policy.permitsProductionData
    && !policy.permitsExternalDelivery
    && policy.persistsVisitorData;
}
