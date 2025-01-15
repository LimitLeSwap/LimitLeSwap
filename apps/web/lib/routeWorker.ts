/// <reference lib="webworker" />

import { findBestRoute } from "@/app/swap/utils/findRoute";

addEventListener("message", async (event) => {
  const { sourceToken, targetToken, rawInitialAmount, poolStore, limitStore } =
    event.data;

  let route = null;
  try {
    route = findBestRoute(
      sourceToken,
      targetToken,
      rawInitialAmount,
      poolStore,
      limitStore,
    );
  } catch (err) {
    console.error("Worker error in findBestRoute:", err);
  }

  postMessage(route);
});
