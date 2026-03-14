export type UserFeatureSettings = {
  autoCategorize: boolean;
  autoSuggestCard: boolean;
  enableTemplates: boolean;
  enablePredictiveSuggestions: boolean;
  enableSplitTransaction: boolean;
  showInvoicePreview: boolean;
  enableRecurringEditScope: boolean;
  enableAdvancedFilters: boolean;
  enableQuickFiltersInicio: boolean;
  enableSearchInicio: boolean;
  enableBatchActionsInicio: boolean;
  enableDashboardInsights: boolean;
  enableCashflowHighlights: boolean;
  showFixedCardExpensesSection: boolean;
  excludeFixedCardFromTotals: boolean;
  blockDuplicateTransactions: boolean;
  enableUndoAfterActions: boolean;
  requireReceiptAboveAmount: boolean;
  receiptMinAmount: number;
  notifyCardClosing: boolean;
  notifyCardDue: boolean;
  notifyAnomalies: boolean;
  notifyMissingReceipt: boolean;
  notifyOrphanTransactions: boolean;
  notifySubscriptionCharges: boolean;
  notifyImportPendingReview: boolean;
  enableImportCenter: boolean;
  enableImportReconciliation: boolean;
  enableCsvImport: boolean;
  enableOfxImport: boolean;
  enableObjetivosSearch: boolean;
  enableObjetivosInsights: boolean;
  enableObjetivosProjection: boolean;
  enableObjetivosDeleteConfirm: boolean;
  enableObjetivosHighlightCompleted: boolean;
  enableObjetivosQuickActions: boolean;
  enableObjetivosAutoCalc: boolean;
  enableObjetivosTimeline: boolean;
  enableAppLock: boolean;
  requirePasswordForGoogle: boolean;
  allowBiometricUnlock: boolean;
  showSecuritySection: boolean;
  showWhatsAppSection: boolean;
  showConnectedServicesCard: boolean;
  showProfileTips: boolean;
  enableExperimentalFeatures: boolean;
  compactCardView: boolean;
};

export const DEFAULT_USER_FEATURE_SETTINGS: UserFeatureSettings = {
  autoCategorize: true,
  autoSuggestCard: true,
  enableTemplates: false,
  enablePredictiveSuggestions: false,
  enableSplitTransaction: false,
  showInvoicePreview: true,
  enableRecurringEditScope: false,
  enableAdvancedFilters: false,
  enableQuickFiltersInicio: false,
  enableSearchInicio: true,
  enableBatchActionsInicio: false,
  enableDashboardInsights: false,
  enableCashflowHighlights: false,
  showFixedCardExpensesSection: true,
  excludeFixedCardFromTotals: true,
  blockDuplicateTransactions: false,
  enableUndoAfterActions: true,
  requireReceiptAboveAmount: false,
  receiptMinAmount: 200,
  notifyCardClosing: true,
  notifyCardDue: true,
  notifyAnomalies: false,
  notifyMissingReceipt: false,
  notifyOrphanTransactions: true,
  notifySubscriptionCharges: false,
  notifyImportPendingReview: false,
  enableImportCenter: false,
  enableImportReconciliation: false,
  enableCsvImport: false,
  enableOfxImport: false,
  enableObjetivosSearch: false,
  enableObjetivosInsights: true,
  enableObjetivosProjection: true,
  enableObjetivosDeleteConfirm: true,
  enableObjetivosHighlightCompleted: true,
  enableObjetivosQuickActions: false,
  enableObjetivosAutoCalc: true,
  enableObjetivosTimeline: true,
  enableAppLock: true,
  requirePasswordForGoogle: true,
  allowBiometricUnlock: true,
  showSecuritySection: true,
  showWhatsAppSection: true,
  showConnectedServicesCard: true,
  showProfileTips: true,
  enableExperimentalFeatures: false,
  compactCardView: false,
};

export const getSettingsStorageKey = (userId: string) => `sunshine:settings:${userId}`;

export const readSettingsFromStorage = (userId: string): UserFeatureSettings => {
  try {
    const raw = localStorage.getItem(getSettingsStorageKey(userId));
    if (!raw) return DEFAULT_USER_FEATURE_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<UserFeatureSettings>;
    return { ...DEFAULT_USER_FEATURE_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_USER_FEATURE_SETTINGS;
  }
};

export const writeSettingsToStorage = (userId: string, settings: UserFeatureSettings) => {
  try {
    localStorage.setItem(getSettingsStorageKey(userId), JSON.stringify(settings));
  } catch {
    // ignore localStorage failures
  }
};
