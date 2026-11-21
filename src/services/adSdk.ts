/**
 * Rewarded Ad SDK Adapter (Placeholder)
 * -------------------------------------
 * Replace `requestRewardedAd` internals with AdMob, Unity Ads, IronSource,
 * or CrazyGames/Poki SDK calls when publishing to production.
 */

export type AdPlacement = 'repair_free' | 'garage_unlock_item';

export interface AdRequestResult {
  completed: boolean;
  placement: AdPlacement;
  itemLabel?: string;
}

type AdModalTrigger = (
  placement: AdPlacement,
  itemLabel?: string
) => Promise<boolean>;

let registeredUiHandler: AdModalTrigger | null = null;

/**
 * Registers the UI modal handler that simulates watching a 5-second rewarded ad.
 */
export function registerRewardedAdUiHandler(handler: AdModalTrigger | null) {
  registeredUiHandler = handler;
}

/**
 * Public entry point used by Garage and Repair Shop.
 * Swap this function body with your live Ad SDK (`admob.rewarded.show()`, `UnityAds.Show()`, etc.).
 */
export async function showRewardedAd(
  placement: AdPlacement,
  itemLabel?: string
): Promise<AdRequestResult> {
  if (registeredUiHandler) {
    const completed = await registeredUiHandler(placement, itemLabel);
    return { completed, placement, itemLabel };
  }
  return { completed: false, placement, itemLabel };
}
